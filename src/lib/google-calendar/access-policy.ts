// The pilot is intentionally limited to one verified Supabase identity.
// An email address, browser setting, or user-editable metadata cannot grant access.
const PILOT_USER_ID = "c88dae71-5946-4e75-a3db-c0dd26fe0dd1";

export interface CalendarIdentity {
  id: string;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
}

export function canAccessGoogleCalendar(
  enabled: string | undefined,
  user: CalendarIdentity | null,
): boolean {
  return (
    enabled === "true" &&
    user?.id === PILOT_USER_ID &&
    Boolean(user.email_confirmed_at) &&
    user.is_anonymous !== true &&
    user.app_metadata?.account_type !== "client_portal"
  );
}
