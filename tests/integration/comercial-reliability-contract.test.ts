import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260729144700_crm_comercial_reliability.sql",
  "utf8",
);
const hook = readFileSync("src/lib/hooks/useComercial.ts", "utf8");
const board = readFileSync("src/components/comercial/jornada-board.tsx", "utf8");

describe("contrato de confiabilidade do CRM Comercial", () => {
  test("fecha o lead por uma única RPC transacional e idempotente", () => {
    expect(migration).toContain("function public.fechar_lead_comercial(");
    expect(migration).toContain("security definer");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("on conflict do nothing");
    expect(hook).toContain('supabase.rpc("fechar_lead_comercial"');
  });

  test("restringe o fechamento à sessão e à permissão Comercial", () => {
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("not public.tem_permissao('comercial')");
    expect(migration).toContain(
      "revoke all on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon",
    );
  });

  test("arquiva, restaura e só permite exclusão depois do arquivamento", () => {
    expect(hook).toContain('supabase.rpc("arquivar_lead_comercial"');
    expect(hook).toContain('supabase.rpc("restaurar_lead_comercial"');
    expect(hook).toContain('supabase.rpc("excluir_lead_comercial"');
    expect(migration).toContain("if v_arquivado_em is null then");
    expect(board).toContain("Arquivadas");
    expect(board).toContain("Restaurar");
    expect(board).toContain("Excluir definitivamente");
  });
});
