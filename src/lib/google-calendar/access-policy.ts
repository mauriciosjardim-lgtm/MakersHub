// The default keeps the existing pilot working if the deploy configuration is
// temporarily absent. Production should always set GOOGLE_CALENDAR_ALLOWED_USER_IDS.
export const GOOGLE_CALENDAR_PILOT_USER_ID = "c88dae71-5946-4e75-a3db-c0dd26fe0dd1";

export interface CalendarIdentity {
  id: string;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
}

export function canAccessGoogleCalendar(
  enabled: string | undefined,
  user: CalendarIdentity | null,
  allowedUserIds = GOOGLE_CALENDAR_PILOT_USER_ID,
): boolean {
  if (!user) return false;
  const allowlist = new Set(
    allowedUserIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return (
    enabled === "true" &&
    (allowlist.has("*") || allowlist.has(user.id)) &&
    Boolean(user.email_confirmed_at) &&
    user.is_anonymous !== true &&
    user.app_metadata?.account_type !== "client_portal"
  );
}
