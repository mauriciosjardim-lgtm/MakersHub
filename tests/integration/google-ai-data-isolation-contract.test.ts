import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260915120000_isolate_google_calendar_data_from_mcp.sql",
  "utf8",
).toLowerCase();

describe("Google Workspace data isolation from third-party AI clients", () => {
  test("MCP reads and mutations exclude every Google-linked event", () => {
    for (const functionName of [
      "mcp_listar_eventos",
      "mcp_atualizar_evento",
      "mcp_excluir_evento",
    ]) {
      const start = migration.indexOf(`create or replace function public.${functionName}`);
      expect(start).toBeGreaterThanOrEqual(0);
      const nextFunction = migration.indexOf("create or replace function public.", start + 1);
      const definition = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);

      expect(definition).toContain("not exists");
      expect(definition).toContain("public.google_calendar_event_links");
      expect(definition).toContain("g.empresa_id = v_empresa");
      expect(definition).toContain("g.local_event_id = e.id");
    }
  });

  test("the isolation lookup has a tenant-scoped supporting index", () => {
    expect(migration).toContain(
      "on public.google_calendar_event_links (empresa_id, local_event_id)",
    );
  });
});
