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
  test("defaults to only the verified pilot identity", () => {
    expect(canAccessGoogleCalendar("true", pilot)).toBe(true);
    expect(canAccessGoogleCalendar("true", { ...pilot, id: "someone-else" })).toBe(false);
    expect(canAccessGoogleCalendar("true", null)).toBe(false);
  });
  test("accepts a server-controlled allowlist and trims its entries", () => {
    const reviewer = { ...pilot, id: "reviewer-id" };
    expect(canAccessGoogleCalendar("true", reviewer, "other-id, reviewer-id ")).toBe(true);
    expect(canAccessGoogleCalendar("true", pilot, "other-id,reviewer-id")).toBe(false);
    expect(canAccessGoogleCalendar("true", reviewer, "")).toBe(false);
  });
  test("allows any eligible identity only when production explicitly uses a wildcard", () => {
    expect(canAccessGoogleCalendar("true", { ...pilot, id: "public-user" }, "*")).toBe(true);
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
  test("administrator metadata does not bypass the allowlist", () => {
    expect(
      canAccessGoogleCalendar("true", {
        ...pilot,
        id: "another-admin",
        app_metadata: { role: "admin", google_calendar: true },
      }),
    ).toBe(false);
  });
});
