import { canAccessGoogleCalendar, type CalendarIdentity } from "./access-policy";
import { randomSecret, seal, sha256, stateContext, tokenContext, unseal } from "./crypto.server";
import { authorizationUrl } from "./provider.server";
import {
  CalendarError,
  OAUTH_TTL_SECONDS,
  tokenBundleSchema,
  type CalendarConfig,
  type Owner,
  type TokenBundle,
} from "./protocol";
import type { CalendarRepository } from "./repository.server";

export interface CalendarProvider {
  exchange(code: string, verifier: string, email: string): Promise<TokenBundle>;
  refresh(previous: TokenBundle): Promise<TokenBundle>;
  revoke(token: string): Promise<void>;
}
export interface ServiceDependencies {
  config: CalendarConfig;
  enabled(): string | undefined;
  identity(userId: string): Promise<(CalendarIdentity & { email?: string }) | null>;
  repo: CalendarRepository;
  provider: CalendarProvider;
}

export class CalendarService {
  constructor(private deps: ServiceDependencies) {}

  async authorize(owner: Owner, disconnect = false) {
    const user = await this.deps.identity(owner.userId);
    if (
      !canAccessGoogleCalendar(disconnect ? "true" : this.deps.enabled(), user) ||
      !user?.email ||
      !(await this.deps.repo.sessionActive(owner))
    ) {
      throw new CalendarError("access_denied", 403);
    }
    return user.email;
  }

  async status(owner: Owner) {
    await this.authorize(owner, true);
    const connection = await this.deps.repo.connection(owner);
    return {
      enabled: this.deps.enabled() === "true",
      configured: true,
      status: connection?.status ?? "disconnected",
      email: connection?.google_email ?? null,
    };
  }

  async start(owner: Owner) {
    await this.authorize(owner);
    const current = await this.deps.repo.connection(owner);
    if (current && current.status !== "pending") throw new CalendarError("disconnect_first", 409);
    const state = randomSecret();
    const browser = randomSecret();
    const verifier = randomSecret();
    const stateHash = await sha256(state);
    const generation = crypto.randomUUID();
    await this.deps.repo.begin({
      state_hash: stateHash,
      browser_hash: await sha256(browser),
      user_id: owner.userId,
      empresa_id: owner.empresaId,
      session_id: owner.sessionId,
      generation,
      verifier_ciphertext: await seal(
        verifier,
        this.deps.config.encryptionKey,
        stateContext(stateHash),
      ),
      expires_at: new Date(Date.now() + OAUTH_TTL_SECONDS * 1000).toISOString(),
    });
    return { url: authorizationUrl(this.deps.config, state, await sha256(verifier)), browser };
  }

  async callback(state: string, browser: string, code: string | undefined, denied: boolean) {
    if (this.deps.enabled() !== "true") throw new CalendarError("access_denied", 403);
    if (!/^[A-Za-z0-9_-]{43}$/.test(browser)) throw new CalendarError("invalid_state");
    const saved = await this.deps.repo.consume(await sha256(state), await sha256(browser));
    if (!saved) throw new CalendarError("invalid_state");
    const owner: Owner = {
      userId: saved.user_id,
      empresaId: saved.empresa_id,
      sessionId: saved.session_id,
      email: "",
    };
    let issued: TokenBundle | undefined;
    try {
      const email = await this.authorize(owner);
      if (denied) throw new CalendarError("consent_denied");
      if (!code) throw new CalendarError("invalid_callback");
      const current = await this.deps.repo.connection(owner);
      if (current?.generation !== saved.generation || current.status !== "pending")
        throw new CalendarError("invalid_state");
      const verifier = await unseal(
        saved.verifier_ciphertext,
        this.deps.config.encryptionKey,
        stateContext(saved.state_hash),
      );
      if (typeof verifier !== "string") throw new CalendarError("invalid_state");
      issued = await this.deps.provider.exchange(code, verifier, email);
      // Logout, tenant changes and flag shutdown during the Google request must not save a grant.
      await this.authorize(owner);
      const ciphertext = await seal(
        issued,
        this.deps.config.encryptionKey,
        tokenContext(owner.userId, owner.empresaId, saved.generation),
      );
      if (!(await this.deps.repo.save(owner, saved.generation, ciphertext, issued.email)))
        throw new CalendarError("invalid_state");
    } catch (error) {
      if (issued) await this.deps.provider.revoke(issued.refreshToken).catch(() => undefined);
      // Generation guards prevent an old callback from removing a newer attempt.
      await this.deps.repo.remove(owner, saved.generation).catch(() => undefined);
      throw error;
    }
  }

  async disconnect(owner: Owner) {
    await this.authorize(owner, true);
    const connection = await this.deps.repo.connection(owner);
    if (!connection) return;
    // Stop use before attempting the external revocation. Keep encrypted tokens
    // on a network failure so the user can retry without losing the revoke handle.
    await this.deps.repo.markRevoking(owner, connection.generation);
    if (connection.tokens_ciphertext) {
      const tokens = tokenBundleSchema.parse(
        await unseal(
          connection.tokens_ciphertext,
          this.deps.config.encryptionKey,
          tokenContext(owner.userId, owner.empresaId, connection.generation),
        ),
      );
      await this.deps.provider.revoke(tokens.refreshToken);
    }
    await this.deps.repo.remove(owner, connection.generation);
  }

  // Internal only. Never serialize this result into an HTTP response.
  async accessToken(owner: Owner): Promise<string> {
    await this.authorize(owner);
    const c = await this.deps.repo.connection(owner);
    if (!c?.tokens_ciphertext || c.status !== "connected")
      throw new CalendarError("reconnect_required", 409);
    const aad = tokenContext(owner.userId, owner.empresaId, c.generation);
    const previous = tokenBundleSchema.parse(
      await unseal(c.tokens_ciphertext, this.deps.config.encryptionKey, aad),
    );
    if (previous.expiresAt > Date.now() + 60000) return previous.accessToken;
    const lock = crypto.randomUUID();
    if (!(await this.deps.repo.claimRefresh(owner, c.generation, lock)))
      throw new CalendarError("refresh_in_progress", 409);
    try {
      const renewed = await this.deps.provider.refresh(previous);
      await this.authorize(owner);
      const ciphertext = await seal(renewed, this.deps.config.encryptionKey, aad);
      if (!(await this.deps.repo.finishRefresh(owner, c.generation, lock, ciphertext)))
        throw new CalendarError("reconnect_required", 409);
      return renewed.accessToken;
    } catch (error) {
      await this.deps.repo.releaseRefresh(
        owner,
        c.generation,
        lock,
        error instanceof CalendarError && error.code === "reconnect_required",
      );
      throw error;
    }
  }
}
