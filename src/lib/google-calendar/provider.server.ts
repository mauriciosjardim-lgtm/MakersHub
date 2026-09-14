import { z } from "zod";
import { CALENDAR_SCOPES, CalendarError, type CalendarConfig, type TokenBundle } from "./protocol";

const responseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().max(86400),
  scope: z.string().optional(),
});

export function authorizationUrl(config: CalendarConfig, state: string, challenge: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export class GoogleCalendarProvider {
  constructor(
    private config: CalendarConfig,
    private http: typeof fetch = fetch,
  ) {}

  private async tokens(params: Record<string, string>) {
    let response: Response;
    try {
      response = await this.http("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          ...params,
        }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw new CalendarError("google_unavailable", 503);
    }
    // Never put provider payloads, tokens, authorization codes or URLs in errors/logs.
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new CalendarError(
        body.error === "invalid_grant" ? "reconnect_required" : "google_unavailable",
        503,
      );
    }
    const result = responseSchema.safeParse(await response.json().catch(() => null));
    if (!result.success || result.data.token_type.toLowerCase() !== "bearer")
      throw new CalendarError("google_response_invalid", 502);
    return result.data;
  }

  async exchange(code: string, verifier: string, expectedEmail: string): Promise<TokenBundle> {
    const result = await this.tokens({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: verifier,
    });
    try {
      const scopes = result.scope?.split(/\s+/) ?? [];
      if (!result.refresh_token || !CALENDAR_SCOPES.slice(2).every((s) => scopes.includes(s))) {
        throw new CalendarError("permissions_missing");
      }
      const response = await this.http("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${result.access_token}` },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      const identity = z
        .object({
          sub: z.string().min(1),
          email: z.string().email(),
          email_verified: z.literal(true),
        })
        .safeParse(await response.json().catch(() => null));
      if (
        !response.ok ||
        !identity.success ||
        identity.data.email.toLowerCase() !== expectedEmail.toLowerCase()
      ) {
        throw new CalendarError("wrong_google_account");
      }
      return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + result.expires_in * 1000,
        scopes,
        googleSubject: identity.data.sub,
        email: identity.data.email,
      };
    } catch (error) {
      await this.revoke(result.refresh_token ?? result.access_token).catch(() => undefined);
      throw error instanceof CalendarError ? error : new CalendarError("google_unavailable", 503);
    }
  }

  async refresh(previous: TokenBundle): Promise<TokenBundle> {
    const result = await this.tokens({
      grant_type: "refresh_token",
      refresh_token: previous.refreshToken,
    });
    const scopes = result.scope?.split(/\s+/) ?? previous.scopes;
    if (!CALENDAR_SCOPES.slice(2).every((s) => scopes.includes(s)))
      throw new CalendarError("reconnect_required", 409);
    return {
      ...previous,
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? previous.refreshToken,
      expiresAt: Date.now() + result.expires_in * 1000,
      scopes,
    };
  }

  async revoke(token: string): Promise<void> {
    let response: Response;
    try {
      response = await this.http("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw new CalendarError("revocation_pending", 503);
    }
    if (response.ok) return;
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 400 && body.error === "invalid_token") return;
    throw new CalendarError("revocation_pending", 503);
  }
}
