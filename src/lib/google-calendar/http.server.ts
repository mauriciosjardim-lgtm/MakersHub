import { Buffer } from "node:buffer";
import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";
import { canAccessGoogleCalendar } from "./access-policy";
import {
  CALLBACK_PATH,
  CALENDAR_PATH,
  CalendarError,
  OAUTH_TTL_SECONDS,
  callbackParameters,
  type CalendarConfig,
  type Owner,
} from "./protocol";
import { GoogleCalendarProvider } from "./provider.server";
import { SupabaseCalendarRepository } from "./repository.server";
import { CalendarService } from "./service.server";

const uuid = z.string().uuid();
export function calendarConfig(): CalendarConfig {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const encryptionKey = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY;
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? `https://makershub.app.br${CALLBACK_PATH}`;
  if (!clientId || !clientSecret || !encryptionKey || !/^[A-Za-z0-9+/]{43}=$/.test(encryptionKey)) {
    throw new CalendarError("configuration_missing", 503);
  }
  const url = new URL(redirectUri);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    (!local && url.protocol !== "https:") ||
    url.pathname !== CALLBACK_PATH ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new CalendarError("configuration_missing", 503);
  }
  return { clientId, clientSecret, encryptionKey, redirectUri };
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new CalendarError("configuration_missing", 503);
  return { url, key };
}
async function authenticated(request: Request): Promise<{ user: User; sessionId: string }> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 16384) throw new CalendarError("unauthorized", 401);
  const { url, key } = supabaseConfig();
  const client = createClient(url, key, { auth: authOptions });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new CalendarError("unauthorized", 401);
  // Parse claims only AFTER GoTrue validates this exact access token.
  let claims: { session_id?: unknown; sub?: unknown };
  try {
    claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    throw new CalendarError("unauthorized", 401);
  }
  const parsed = uuid.safeParse(claims.session_id);
  if (!parsed.success || claims.sub !== data.user.id) throw new CalendarError("unauthorized", 401);
  return { user: data.user, sessionId: parsed.data };
}
function runtime(config: CalendarConfig) {
  const { url } = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new CalendarError("configuration_missing", 503);
  const admin = createClient(url, key, { auth: authOptions });
  const repo = new SupabaseCalendarRepository(admin);
  const service = new CalendarService({
    config,
    repo,
    provider: new GoogleCalendarProvider(config),
    enabled: () => process.env.GOOGLE_CALENDAR_ENABLED,
    identity: async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw new CalendarError("identity_unavailable", 503);
      return data.user;
    },
  });
  return { admin, service };
}

export function oauthCookieName(redirectUri: string) {
  return new URL(redirectUri).protocol === "https:"
    ? "__Host-makershub-google-oauth"
    : "makershub-google-oauth";
}
export function oauthCookie(value: string, redirectUri: string, clear = false): string {
  return `${oauthCookieName(redirectUri)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : OAUTH_TTL_SECONDS}${new URL(redirectUri).protocol === "https:" ? "; Secure" : ""}`;
}
export function readOAuthCookie(request: Request, redirectUri: string): string {
  const name = oauthCookieName(redirectUri);
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`${name}=`));
  if (matches.length !== 1) throw new CalendarError("invalid_state");
  return matches[0].slice(name.length + 1);
}
export function requireSameOrigin(request: Request, redirectUri: string) {
  const origin = new URL(redirectUri).origin;
  if (new URL(request.url).origin !== origin || request.headers.get("origin") !== origin) {
    throw new CalendarError("invalid_origin", 403);
  }
}

export async function handleGoogleCalendar(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Request-Id": requestId,
  });
  const json = (body: unknown, status = 200) => {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(body), { status, headers });
  };
  const isCallback = url.pathname === CALLBACK_PATH;
  let config: CalendarConfig | undefined;
  try {
    const expectedMethod =
      isCallback || url.pathname === `${CALENDAR_PATH}/status` ? "GET" : "POST";
    if (
      ![
        CALLBACK_PATH,
        `${CALENDAR_PATH}/start`,
        `${CALENDAR_PATH}/status`,
        `${CALENDAR_PATH}/disconnect`,
      ].includes(url.pathname)
    )
      return json({ error: "not_found" }, 404);
    if (request.method !== expectedMethod) {
      headers.set("Allow", expectedMethod);
      return json({ error: "method_not_allowed" }, 405);
    }
    if (isCallback) {
      config = calendarConfig();
      if (url.origin !== new URL(config.redirectUri).origin)
        throw new CalendarError("invalid_origin", 403);
      const params = callbackParameters(url);
      const browser = readOAuthCookie(request, config.redirectUri);
      const { service } = runtime(config);
      await service.callback(params.state, browser, params.code, params.denied);
      headers.set("Set-Cookie", oauthCookie("", config.redirectUri, true));
      headers.set(
        "Location",
        `${new URL(config.redirectUri).origin}/agenda?google_calendar=connected`,
      );
      return new Response(null, { status: 303, headers });
    }
    const auth = await authenticated(request);
    const eligible = canAccessGoogleCalendar("true", auth.user);
    if (!eligible) {
      if (url.pathname.endsWith("/status"))
        return json({ enabled: false, configured: false, status: "unavailable", email: null });
      throw new CalendarError("access_denied", 403);
    }
    try {
      config = calendarConfig();
    } catch {
      if (url.pathname.endsWith("/status"))
        return json({ enabled: false, configured: false, status: "unavailable", email: null });
      throw new CalendarError("configuration_missing", 503);
    }
    if (request.method === "POST") requireSameOrigin(request, config.redirectUri);
    const { admin, service } = runtime(config);
    const { data: profile, error } = await admin
      .from("usuarios")
      .select("empresa_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error || !profile?.empresa_id) throw new CalendarError("access_denied", 403);
    const owner: Owner = {
      userId: auth.user.id,
      empresaId: profile.empresa_id,
      sessionId: auth.sessionId,
      email: auth.user.email ?? "",
    };
    if (url.pathname.endsWith("/status")) return json(await service.status(owner));
    if (url.pathname.endsWith("/disconnect")) {
      await service.disconnect(owner);
      headers.set("Set-Cookie", oauthCookie("", config.redirectUri, true));
      return json({ status: "disconnected" });
    }
    const result = await service.start(owner);
    headers.set("Set-Cookie", oauthCookie(result.browser, config.redirectUri));
    return json({ url: result.url });
  } catch (error) {
    const known = error instanceof CalendarError;
    const code = known ? error.code : "integration_unavailable";
    const status = known ? error.status : 503;
    console.warn(
      JSON.stringify({ event: "google_calendar.request_failed", requestId, code, status }),
    );
    if (isCallback && config && url.origin === new URL(config.redirectUri).origin) {
      headers.set("Set-Cookie", oauthCookie("", config.redirectUri, true));
      headers.set(
        "Location",
        `${new URL(config.redirectUri).origin}/agenda?google_calendar=${encodeURIComponent(code)}`,
      );
      return new Response(null, { status: 303, headers });
    }
    return json({ error: code, requestId }, status);
  }
}
