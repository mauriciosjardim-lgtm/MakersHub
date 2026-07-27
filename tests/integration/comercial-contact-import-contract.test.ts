import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260727140000_importacao_contatos_atomica.sql",
  "utf8",
);
const hook = readFileSync("src/lib/hooks/useComercial.ts", "utf8");

describe("contrato da importação segura de contatos", () => {
  test("deriva o tenant da sessão e serializa importações concorrentes", () => {
    expect(migration).toContain("v_empresa_id uuid := public.minha_empresa_id()");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).not.toContain("p_empresa_id");
  });

  test("limita o payload e restringe a RPC a usuários autenticados", () => {
    expect(migration).toContain("jsonb_array_length(p_contatos) > 5000");
    expect(migration).toContain(
      "revoke all on function public.importar_contatos_comercial(jsonb, text) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.importar_contatos_comercial(jsonb, text) to authenticated",
    );
  });

  test("o frontend usa uma única chamada transacional", () => {
    expect(hook).toContain('supabase.rpc("importar_contatos_comercial"');
    expect(hook).not.toContain("Empresa não encontrada durante a importação");
  });
});
