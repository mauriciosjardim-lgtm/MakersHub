import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260729144700_crm_comercial_reliability.sql",
  "utf8",
);
const simplifiedClosing = readFileSync(
  "supabase/migrations/20260729193000_simplificar_fechamento_comercial.sql",
  "utf8",
);
const directDeletion = readFileSync(
  "supabase/migrations/20260729171159_exclusao_direta_leads.sql",
  "utf8",
);
const hook = readFileSync("src/lib/hooks/useComercial.ts", "utf8");
const board = readFileSync("src/components/comercial/jornada-board.tsx", "utf8");
const closingModal = readFileSync("src/components/comercial/fechar-modal.tsx", "utf8");
const leadDrawer = readFileSync("src/components/comercial/lead-drawer.tsx", "utf8");
const deleteDialog = readFileSync("src/components/comercial/excluir-lead-dialog.tsx", "utf8");
const deleteRecordDialog = readFileSync(
  "src/components/comercial/excluir-registro-dialog.tsx",
  "utf8",
);
const companiesRoute = readFileSync("src/routes/comercial.empresas.tsx", "utf8");
const contactsRoute = readFileSync("src/routes/comercial.contatos.tsx", "utf8");

describe("contrato de confiabilidade do CRM Comercial", () => {
  test("fecha o lead por uma única RPC transacional e idempotente", () => {
    expect(simplifiedClosing).toContain("function public.fechar_lead_comercial(");
    expect(simplifiedClosing).toContain("security definer");
    expect(simplifiedClosing).toContain("for update");
    expect(simplifiedClosing).toContain("comercial_lead_links");
    expect(hook).toContain('supabase.rpc("fechar_lead_comercial"');
  });

  test("restringe o fechamento à sessão e à permissão Comercial", () => {
    expect(simplifiedClosing).toContain("auth.uid() is null");
    expect(simplifiedClosing).toContain("not public.tem_permissao('comercial')");
    expect(simplifiedClosing).toContain("revoke all on function public.fechar_lead_comercial(");
    expect(simplifiedClosing).toContain("from public, anon");
  });

  test("oferece somente a integração opcional com Projetos", () => {
    expect(closingModal).toContain("Você deseja criar o cliente na seção de Projetos?");
    expect(closingModal).toContain("Deixar para depois");
    expect(closingModal).toContain("Sim, criar em Projetos");
    expect(closingModal).not.toContain("<Checkbox");
    expect(closingModal).not.toContain("Nenhuma proposta, contrato, cobrança ou onboarding");
    expect(closingModal).not.toContain("Nada foi criado fora do CRM");
    expect(hook).toContain("p_criar_proposta: false");
    expect(hook).toContain("p_criar_contrato: false");
    expect(hook).toContain("p_criar_cobranca: false");
    expect(hook).toContain("p_promover_cliente: false");
    expect(hook).toContain("p_agendar_onboarding: false");
    expect(hook).not.toContain('supabase.from("propostas")');
    expect(hook).toContain('.eq("tipo", "projeto")');
    expect(simplifiedClosing).toContain("insert into public.projetos");
    expect(simplifiedClosing).not.toContain("insert into public.propostas");
    expect(simplifiedClosing).not.toContain("insert into public.contracts");
    expect(simplifiedClosing).not.toContain("insert into public.financeiro");
    expect(simplifiedClosing).not.toContain("insert into public.eventos");
  });

  test("arquiva, restaura e permite exclusão segura em qualquer etapa", () => {
    expect(hook).toContain('supabase.rpc("arquivar_lead_comercial"');
    expect(hook).toContain('supabase.rpc("restaurar_lead_comercial"');
    expect(hook).toContain('supabase.rpc("excluir_lead_comercial"');
    expect(directDeletion).toContain("create or replace function public.excluir_lead_comercial");
    expect(directDeletion).not.toContain("Arquive o lead antes de exclui-lo");
    expect(board).toContain("Arquivadas");
    expect(board).toContain("Restaurar");
    expect(board).toContain("onDelete={setLeadParaExcluir}");
    expect(leadDrawer).toContain('label="Excluir"');
    expect(deleteDialog).toContain("Excluir oportunidade definitivamente");
    expect(deleteDialog).toContain('placeholder="EXCLUIR"');
  });

  test("oferece exclusão nos cadastros de empresas e contatos", () => {
    expect(companiesRoute).toContain("Excluir empresa definitivamente");
    expect(companiesRoute).toContain("leadsArquivados");
    expect(companiesRoute).toContain("comercial.removerEmpresa");
    expect(contactsRoute).toContain("Excluir contato definitivamente");
    expect(contactsRoute).toContain("comercial.removerContato");
    expect(hook).toContain('.from("contatos_comercial").delete()');
    expect(deleteRecordDialog).toContain('placeholder="EXCLUIR"');
    expect(deleteRecordDialog).toContain("Boolean(bloqueio)");
  });
});
