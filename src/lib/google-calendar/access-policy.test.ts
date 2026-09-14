import { describe, expect, test } from "bun:test";
import { canAccessGoogleCalendar, type CalendarIdentity } from "./access-policy";

const pilot: CalendarIdentity = {
  id: "c88dae71-5946-4e75-a3db-c0dd26fe0dd1",
  email_confirmed_at: "2026-09-14T00:00:00Z",
};

describe("Google Calendar pilot access", () => {
  test("defaults to disabled and requires an explicit switch", () => {
    for (const value of [undefined, "", "false", "1", "TRUE", " true "]) {
      expect(canAccessGoogleCalendar(value, pilot)).toBe(false);
    }
  });
  test("allows only the verified pilot identity", () => {
    expect(canAccessGoogleCalendar("true", pilot)).toBe(true);
    expect(canAccessGoogleCalendar("true", { ...pilot, id: "someone-else" })).toBe(false);
    expect(canAccessGoogleCalendar("true", null)).toBe(false);
  });
  test("rejects unverified, anonymous, and portal accounts", () => {
    expect(canAccessGoogleCalendar("true", { ...pilot, email_confirmed_at: null })).toBe(false);
    expect(canAccessGoogleCalendar("true", { ...pilot, is_anonymous: true })).toBe(false);
    expect(
      canAccessGoogleCalendar("true", {
        ...pilot,
        app_metadata: { account_type: "client_portal" },
      }),
    ).toBe(false);
  });
  test("administrator metadata does not grant access to another identity", () => {
    expect(
      canAccessGoogleCalendar("true", {
        ...pilot,
        id: "another-admin",
        app_metadata: { role: "admin", google_calendar: true },
      }),
    ).toBe(false);
  });
});
