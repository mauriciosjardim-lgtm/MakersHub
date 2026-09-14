import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { randomSecret, seal, sha256, tokenContext, unseal } from "./crypto.server";
import { CalendarService, type CalendarProvider } from "./service.server";
import type { CalendarRepository } from "./repository.server";
import {
  CALENDAR_SCOPES,
  CalendarError,
  callbackParameters,
  type CalendarConfig,
  type Connection,
  type OAuthState,
  type Owner,
  type TokenBundle,
} from "./protocol";
import { oauthCookie, readOAuthCookie, requireSameOrigin } from "./http.server";
import { GoogleCalendarProvider } from "./provider.server";

const owner: Owner = {
  userId: "c88dae71-5946-4e75-a3db-c0dd26fe0dd1",
  empresaId: "tenant-a",
  sessionId: "session-a",
  email: "mauriciosjardim@gmail.com",
};
const config: CalendarConfig = {
  clientId: "test-client",
  clientSecret: "fake-secret",
  redirectUri: "https://makershub.app.br/api/integrations/google-calendar/callback",
  encryptionKey: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
};
const bundle = (): TokenBundle => ({
  accessToken: "fake-access",
  refreshToken: "fake-refresh",
  email: owner.email,
  googleSubject: "google-123",
  expiresAt: Date.now() + 3600000,
  scopes: [...CALENDAR_SCOPES],
});

class MemoryRepository implements CalendarRepository {
  state: OAuthState | null = null;
  row: Connection | null = null;
  active = true;
  lock: string | null = null;
  async sessionActive(o: Owner) {
    return this.active && o.sessionId === owner.sessionId && o.empresaId === owner.empresaId;
  }
  async begin(s: OAuthState) {
    if (this.row && this.row.status !== "pending") throw new Error("already connected");
    this.state = s;
    this.row = {
      user_id: s.user_id,
      empresa_id: s.empresa_id,
      generation: s.generation,
      status: "pending",
      tokens_ciphertext: null,
      google_email: null,
    };
  }
  async consume(s: string, b: string) {
    if (
      !this.state ||
      this.state.state_hash !== s ||
      this.state.browser_hash !== b ||
      Date.parse(this.state.expires_at) <= Date.now()
    )
      return null;
    const result = this.state;
    this.state = null;
    return result;
  }
  async connection(o: Owner) {
    return this.row?.user_id === o.userId && this.row?.empresa_id === o.empresaId
      ? { ...this.row }
      : null;
  }
  private matches(o: Owner, g: string) {
    return (
      this.row?.user_id === o.userId &&
      this.row.empresa_id === o.empresaId &&
      this.row.generation === g
    );
  }
  async save(o: Owner, g: string, ciphertext: string, email: string) {
    if (!this.matches(o, g) || this.row?.status !== "pending") return false;
    this.row = {
      ...this.row,
      tokens_ciphertext: ciphertext,
      google_email: email,
      status: "connected",
    };
    return true;
  }
  async remove(o: Owner, g: string) {
    if (this.state?.generation === g && this.state.user_id === o.userId) this.state = null;
    if (this.matches(o, g)) this.row = null;
  }
  async markRevoking(o: Owner, g: string) {
    if (this.matches(o, g)) this.row!.status = "revoking";
  }
  async claimRefresh(o: Owner, g: string, lock: string) {
    if (!this.matches(o, g) || this.row?.status !== "connected" || this.lock) return false;
    this.lock = lock;
    return true;
  }
  async finishRefresh(o: Owner, g: string, lock: string, cipher: string) {
    if (!this.matches(o, g) || this.row?.status !== "connected" || this.lock !== lock) return false;
    this.row.tokens_ciphertext = cipher;
    this.lock = null;
    return true;
  }
  async releaseRefresh(o: Owner, g: string, lock: string, reconnect: boolean) {
    if (this.matches(o, g) && this.row?.status === "connected" && this.lock === lock) {
      this.lock = null;
      if (reconnect) this.row.status = "reconnect_required";
    }
  }
}
function fixture() {
  const repo = new MemoryRepository();
  let flag = "true";
  let exchanges = 0;
  let refreshes = 0;
  const revoked: string[] = [];
  const provider: CalendarProvider = {
    exchange: async () => {
      exchanges++;
      return bundle();
    },
    refresh: async (previous) => {
      refreshes++;
      return { ...previous, accessToken: "renewed", expiresAt: Date.now() + 3600000 };
    },
    revoke: async (token) => {
      revoked.push(token);
    },
  };
  const service = new CalendarService({
    config,
    repo,
    provider,
    enabled: () => flag,
    identity: async (id) => ({ id, email: owner.email, email_confirmed_at: "2026-09-14" }),
  });
  const start = async () => {
    const result = await service.start(owner);
    return { ...result, state: new URL(result.url).searchParams.get("state")! };
  };
  return {
    repo,
    service,
    provider,
    revoked,
    start,
    setFlag: (v: string) => {
      flag = v;
    },
    exchanges: () => exchanges,
    refreshes: () => refreshes,
  };
}

describe("OAuth cryptography", () => {
  test("encrypts nondeterministically and authenticates owner, tenant and generation", async () => {
    const aad = tokenContext(owner.userId, owner.empresaId, "generation-a");
    const a = await seal(bundle(), config.encryptionKey, aad);
    const b = await seal(bundle(), config.encryptionKey, aad);
    expect(a).not.toEqual(b);
    expect(a).not.toContain("fake-refresh");
    expect(((await unseal(a, config.encryptionKey, aad)) as TokenBundle).refreshToken).toBe(
      "fake-refresh",
    );
    for (const wrong of [
      tokenContext("other", owner.empresaId, "generation-a"),
      tokenContext(owner.userId, "other", "generation-a"),
      tokenContext(owner.userId, owner.empresaId, "generation-b"),
    ]) {
      await expect(unseal(a, config.encryptionKey, wrong)).rejects.toThrow(
        "credentials_unavailable",
      );
    }
    await expect(
      unseal(a.slice(0, 22) + "!" + a.slice(23), config.encryptionKey, aad),
    ).rejects.toThrow();
    await expect(unseal(a, Buffer.alloc(32, 1).toString("base64"), aad)).rejects.toThrow();
  });
  test("PKCE hashes match RFC 7636 vector", async () => {
    expect(await sha256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("OAuth lifecycle", () => {
  test("stores ciphertext only, binds PKCE and prevents callback replay", async () => {
    const f = fixture();
    const a = await f.start();
    const url = new URL(a.url);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(f.repo.state?.state_hash).not.toBe(a.state);
    expect(f.repo.state?.browser_hash).not.toBe(a.browser);
    await f.service.callback(a.state, a.browser, "code", false);
    expect(f.repo.row?.status).toBe("connected");
    expect(f.repo.row?.tokens_ciphertext).not.toContain("fake-access");
    const status = await f.service.status(owner);
    expect(JSON.stringify(status)).not.toMatch(/fake-access|fake-refresh|ciphertext/);
    await expect(f.service.callback(a.state, a.browser, "code", false)).rejects.toThrow(
      "invalid_state",
    );
    expect(f.exchanges()).toBe(1);
  });
  test("wrong browser does not consume a valid attempt", async () => {
    const f = fixture();
    const a = await f.start();
    await expect(f.service.callback(a.state, randomSecret(), "code", false)).rejects.toThrow(
      "invalid_state",
    );
    expect(f.exchanges()).toBe(0);
    expect(f.repo.state).not.toBeNull();
  });
  test("expired state and replaced attempts cannot connect", async () => {
    const f = fixture();
    const a = await f.start();
    f.repo.state!.expires_at = new Date(Date.now() - 1).toISOString();
    await expect(f.service.callback(a.state, a.browser, "code", false)).rejects.toThrow(
      "invalid_state",
    );
    const b = await f.start();
    const c = await f.start();
    await expect(f.service.callback(b.state, b.browser, "code", false)).rejects.toThrow(
      "invalid_state",
    );
    await f.service.callback(c.state, c.browser, "code", false);
    expect(f.exchanges()).toBe(1);
  });
  test("denied consent consumes the attempt without issuing tokens", async () => {
    const f = fixture();
    const a = await f.start();
    await expect(f.service.callback(a.state, a.browser, undefined, true)).rejects.toThrow(
      "consent_denied",
    );
    expect(f.exchanges()).toBe(0);
    expect(f.repo.row).toBeNull();
    expect(f.repo.state).toBeNull();
  });
  test("other users, other tenants and logged-out sessions cannot start", async () => {
    const f = fixture();
    await expect(f.service.start({ ...owner, userId: "other" })).rejects.toThrow("access_denied");
    await expect(f.service.start({ ...owner, empresaId: "other" })).rejects.toThrow(
      "access_denied",
    );
    f.repo.active = false;
    await expect(f.start()).rejects.toThrow("access_denied");
    expect(f.repo.state).toBeNull();
  });
  test("flag shutdown blocks callbacks, but permits disconnect", async () => {
    const f = fixture();
    const a = await f.start();
    f.setFlag("false");
    await expect(f.service.callback(a.state, a.browser, "code", false)).rejects.toThrow(
      "access_denied",
    );
    expect(f.exchanges()).toBe(0);
    await f.service.disconnect(owner);
    expect(f.repo.row).toBeNull();
  });
  test("logout during token exchange revokes the grant instead of persisting it", async () => {
    const f = fixture();
    const a = await f.start();
    f.provider.exchange = async () => {
      f.repo.active = false;
      return bundle();
    };
    await expect(f.service.callback(a.state, a.browser, "code", false)).rejects.toThrow(
      "access_denied",
    );
    expect(f.revoked).toEqual(["fake-refresh"]);
    expect(f.repo.row).toBeNull();
  });
  test("disconnect during token exchange cannot resurrect a connection", async () => {
    const f = fixture();
    const a = await f.start();
    f.provider.exchange = async () => {
      await f.service.disconnect(owner);
      return bundle();
    };
    await expect(f.service.callback(a.state, a.browser, "code", false)).rejects.toThrow(
      "invalid_state",
    );
    expect(f.repo.row).toBeNull();
    expect(f.revoked).toEqual(["fake-refresh"]);
  });
  test("failed revocation blocks token use and preserves encrypted retry material", async () => {
    const f = fixture();
    const a = await f.start();
    await f.service.callback(a.state, a.browser, "code", false);
    f.provider.revoke = async () => {
      throw new CalendarError("revocation_pending", 503);
    };
    await expect(f.service.disconnect(owner)).rejects.toThrow("revocation_pending");
    expect(f.repo.row?.status).toBe("revoking");
    expect(f.repo.row?.tokens_ciphertext).toBeTruthy();
    await expect(f.service.accessToken(owner)).rejects.toThrow("reconnect_required");
    f.provider.revoke = async () => {};
    f.setFlag("false");
    await f.service.disconnect(owner);
    expect(f.repo.row).toBeNull();
  });
  test("refresh preserves a refresh token and serializes competing renewals", async () => {
    const f = fixture();
    const a = await f.start();
    f.provider.exchange = async () => ({ ...bundle(), expiresAt: 0 });
    await f.service.callback(a.state, a.browser, "code", false);
    const results = await Promise.allSettled([
      f.service.accessToken(owner),
      f.service.accessToken(owner),
    ]);
    expect(f.refreshes()).toBe(1);
    expect(results.some((r) => r.status === "fulfilled" && r.value === "renewed")).toBe(true);
    expect(await f.service.accessToken(owner)).toBe("renewed");
    expect(f.refreshes()).toBe(1);
  });
  test("invalid_grant requires reconnection without retry loops", async () => {
    const f = fixture();
    const a = await f.start();
    f.provider.exchange = async () => ({ ...bundle(), expiresAt: 0 });
    await f.service.callback(a.state, a.browser, "code", false);
    f.provider.refresh = async () => {
      throw new CalendarError("reconnect_required", 503);
    };
    await expect(f.service.accessToken(owner)).rejects.toThrow("reconnect_required");
    expect(f.repo.row?.status).toBe("reconnect_required");
  });
});

describe("HTTP boundary", () => {
  test("cookies are host-only and HttpOnly; duplicate cookies are rejected", () => {
    expect(oauthCookie("value", config.redirectUri)).toContain(
      "__Host-makershub-google-oauth=value; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; Secure",
    );
    expect(oauthCookie("", config.redirectUri, true)).toContain("Max-Age=0");
    expect(() =>
      readOAuthCookie(
        new Request(config.redirectUri, {
          headers: { cookie: "__Host-makershub-google-oauth=a; __Host-makershub-google-oauth=b" },
        }),
        config.redirectUri,
      ),
    ).toThrow("invalid_state");
  });
  test("write requests must originate on the configured origin", () => {
    expect(() =>
      requireSameOrigin(
        new Request(config.redirectUri, { headers: { origin: "https://attacker.example" } }),
        config.redirectUri,
      ),
    ).toThrow("invalid_origin");
    expect(() => requireSameOrigin(new Request(config.redirectUri), config.redirectUri)).toThrow(
      "invalid_origin",
    );
    expect(() =>
      requireSameOrigin(
        new Request(config.redirectUri, { headers: { origin: "https://makershub.app.br" } }),
        config.redirectUri,
      ),
    ).not.toThrow();
  });
  test("rejects duplicate state/code parameters and ambiguous responses", () => {
    const state = randomSecret();
    for (const query of [
      `state=${state}&state=${state}&code=c`,
      `state=${state}&code=c&code=d`,
      `state=${state}&code=c&error=denied`,
      "state=short&code=c",
    ]) {
      expect(() => callbackParameters(new URL(`${config.redirectUri}?${query}`))).toThrow(
        "invalid_callback",
      );
    }
  });
});

describe("Google token endpoint contract", () => {
  test("default transport preserves the native Workers fetch receiver", async () => {
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async function (this: unknown, url: RequestInfo | URL, init?: RequestInit) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      if (init?.redirect !== "manual") throw new TypeError("Unsupported redirect mode");
      calls.push(String(url));
      if (String(url).endsWith("/token"))
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "Bearer",
          expires_in: 3600,
          scope: CALENDAR_SCOPES.join(" "),
        });
      if (String(url).endsWith("/userinfo"))
        return Response.json({ sub: "google-123", email: owner.email, email_verified: true });
      return new Response(null, { status: 200 });
    } as typeof fetch;
    try {
      const provider = new GoogleCalendarProvider(config);
      const connected = await provider.exchange("code", "verifier", owner.email);
      expect(connected.email).toBe(owner.email);
      await provider.refresh(connected);
      await provider.revoke(connected.refreshToken);
      expect(calls).toEqual([
        "https://oauth2.googleapis.com/token",
        "https://openidconnect.googleapis.com/v1/userinfo",
        "https://oauth2.googleapis.com/token",
        "https://oauth2.googleapis.com/revoke",
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });
  test("refresh sends secrets in form body, preserves refresh_token when omitted", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const http = (async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        access_token: "new-access",
        token_type: "Bearer",
        expires_in: 3600,
      });
    }) as typeof fetch;
    const result = await new GoogleCalendarProvider(config, http).refresh(bundle());
    expect(result.refreshToken).toBe("fake-refresh");
    expect(result.accessToken).toBe("new-access");
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    const body = calls[0].init?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("client_secret")).toBe(config.clientSecret);
    expect(calls[0].init?.redirect).toBe("manual");
  });
  test("wrong Google account is revoked and never accepted", async () => {
    const calls: string[] = [];
    const http = (async (url) => {
      calls.push(String(url));
      if (String(url).endsWith("/token"))
        return Response.json({
          access_token: "a",
          refresh_token: "r",
          token_type: "Bearer",
          expires_in: 3600,
          scope: CALENDAR_SCOPES.join(" "),
        });
      if (String(url).endsWith("/userinfo"))
        return Response.json({ sub: "other", email: "other@example.com", email_verified: true });
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    await expect(
      new GoogleCalendarProvider(config, http).exchange("code", "verifier", owner.email),
    ).rejects.toThrow("wrong_google_account");
    expect(calls.at(-1)).toBe("https://oauth2.googleapis.com/revoke");
  });
  test("redirect responses are rejected without following credential-bearing requests", async () => {
    let calls = 0;
    const http = (async (_url, init) => {
      calls += 1;
      expect(init?.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { location: "https://unexpected.example/token" },
      });
    }) as typeof fetch;
    const provider = new GoogleCalendarProvider(config, http);
    await expect(provider.refresh(bundle())).rejects.toThrow("google_unavailable");
    await expect(provider.revoke("fake-token")).rejects.toThrow("revocation_pending");
    expect(calls).toBe(2);
  });
  test("provider errors do not leak their response body", async () => {
    const http = (async () =>
      Response.json(
        { error: "invalid_grant", error_description: "secret-response" },
        { status: 400 },
      )) as typeof fetch;
    try {
      await new GoogleCalendarProvider(config, http).refresh(bundle());
      throw new Error("expected failure");
    } catch (e) {
      expect((e as Error).message).toBe("reconnect_required");
      expect(JSON.stringify(e)).not.toContain("secret-response");
    }
  });
});
