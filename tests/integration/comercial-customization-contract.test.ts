import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260727130000_jornada_comercial_personalizavel.sql",
  "utf8",
);

describe("contrato da Jornada Comercial personalizável", () => {
  test("arquivamento é reversível, indexado e preserva os leads", () => {
    expect(migration).toContain(
      "add column if not exists arquivado boolean not null default false",
    );
    expect(migration).toContain("leads_empresa_arquivado_etapa_idx");
    expect(migration).not.toContain("delete from public.leads");
  });

  test("nomes das etapas são isolados por empresa com RLS", () => {
    expect(migration).toContain("create table if not exists public.configuracao_comercial");
    expect(migration).toContain("empresa_id uuid primary key");
    expect(migration).toContain("etapas_labels jsonb not null");
    expect(migration).toContain(
      "alter table public.configuracao_comercial enable row level security",
    );
    expect(migration).toContain("empresa_id = public.minha_empresa_id()");
  });
});
