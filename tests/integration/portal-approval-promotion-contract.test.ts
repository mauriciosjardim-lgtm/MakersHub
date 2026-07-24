import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260724203000_auto_promote_approved_reviews.sql",
  "utf8",
).toLowerCase();

describe("client approval promotion contract", () => {
  test("promotes an approved review to delivery in the authenticated response transaction", () => {
    expect(migration).toContain("create or replace function public.responder_revisao_portal");
    expect(migration).toContain("when p_decision = 'approved' then 'delivery'");
    expect(migration).toContain("and rv.status = 'pending'");
    expect(migration).toContain("and rv.kind = 'review'");
    expect(migration).toContain("return found");
  });

  test("backfills approved reviews without duplicating their records", () => {
    expect(migration).toMatch(
      /update public\.portal_review_versions\s+set kind = 'delivery'\s+where status = 'approved'/,
    );
    expect(migration).not.toContain("insert into public.portal_review_versions");
  });

  test("keeps the RPC restricted to authenticated portal users", () => {
    expect(migration).toContain("pcu.id = auth.uid()");
    expect(migration).toContain("pcu.status = 'active'");
    expect(migration).toContain("from public");
    expect(migration).toContain("to authenticated");
  });
});
