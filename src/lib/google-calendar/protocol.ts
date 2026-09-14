import { z } from "zod";

export const CALENDAR_PATH = "/api/integrations/google-calendar";
export const CALLBACK_PATH = `${CALENDAR_PATH}/callback`;
export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;
export const OAUTH_TTL_SECONDS = 600;

export class CalendarError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

export const tokenBundleSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().finite(),
  scopes: z.array(z.string()),
  googleSubject: z.string().min(1),
  email: z.string().email(),
});
export type TokenBundle = z.infer<typeof tokenBundleSchema>;
export interface Owner {
  userId: string;
  empresaId: string;
  sessionId: string;
  email: string;
}
export interface OAuthState {
  state_hash: string;
  browser_hash: string;
  user_id: string;
  empresa_id: string;
  session_id: string;
  generation: string;
  verifier_ciphertext: string;
  expires_at: string;
}
export interface Connection {
  user_id: string;
  empresa_id: string;
  generation: string;
  status: "pending" | "connected" | "revoking" | "reconnect_required";
  tokens_ciphertext: string | null;
  google_email: string | null;
}
export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
}

export function callbackParameters(url: URL): { state: string; code?: string; denied: boolean } {
  for (const key of ["state", "code", "error"]) {
    if (url.searchParams.getAll(key).length > 1) throw new CalendarError("invalid_callback");
  }
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? undefined;
  const denied = url.searchParams.has("error");
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    (!denied && (!code || code.length > 4096)) ||
    (denied && code)
  ) {
    throw new CalendarError("invalid_callback");
  }
  return { state, code, denied };
}
