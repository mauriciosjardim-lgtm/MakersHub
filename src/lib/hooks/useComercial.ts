import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getEmpresaId } from "@/lib/empresaId";
import { dbErro } from "@/lib/dbError";
import { registerSessionDisposer } from "@/lib/sessionScope";
import type { Database, Json } from "@/lib/database.types";
import type {
  EtapaJornada,
  Temperatura,
  TimelineTipo,
  Empresa,
  Contato,
  Lead as MockLead,
  TimelineEvent,
  Tarefa,
  ProximaAcao,
} from "@/lib/mock/comercial";
import { ETAPAS, labelEtapa } from "@/lib/mock/comercial";
import {
  chaveContato,
  normalizarTexto,
  valorContatoOuVazio,
  type ContatoImportado,
} from "@/lib/comercial/contatos-importacao";
import {
  etapasComLabels,
  normalizarLabelsEtapas,
  type LabelsEtapasComercial,
} from "@/lib/comercial/etapas";

type EmpresaRow = Database["public"]["Tables"]["clientes_comercial"]["Row"];
type EmpresaUpdate = Database["public"]["Tables"]["clientes_comercial"]["Update"];
type ContatoRow = Database["public"]["Tables"]["contatos_comercial"]["Row"];
type ContatoUpdate = Database["public"]["Tables"]["contatos_comercial"]["Update"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type TimelineRow = Database["public"]["Tables"]["timeline_lead"]["Row"];
type TarefaRow = Database["public"]["Tables"]["tarefas_lead"]["Row"];
type LeadLinkRow = Pick<
  Database["public"]["Tables"]["comercial_lead_links"]["Row"],
  "lead_id" | "tipo" | "entidade_id"
>;

// re-exporta constantes/helpers para que componentes só importem daqui
export { ETAPAS, labelEtapa };
export type Lead = MockLead & { arquivado?: boolean };
export type {
  EtapaJornada,
  Temperatura,
  TimelineTipo,
  Empresa,
  Contato,
  TimelineEvent,
  Tarefa,
  ProximaAcao,
};

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function leadScore(lead: Lead): { score: number; estrelas: number; rotulo: string } {
  let s = 25;
  if (lead.temperatura === "quente") s += 30;
  else if (lead.temperatura === "morno") s += 15;
  if (lead.proximaAcao) s += 15;
  if (lead.valor >= 30000) s += 12;
  else if (lead.valor >= 15000) s += 6;
  if (lead.etapa === "negociacao") s += 18;
  else if (lead.etapa === "proposta") s += 12;
  else if (lead.etapa === "reuniao") s += 8;
  else if (lead.etapa === "diagnostico") s += 4;
  if (lead.etapa === "fechado") s = 100;
  if (lead.etapa === "perdido") s = Math.min(s, 20);
  s = Math.max(0, Math.min(100, s));
  const estrelas = Math.max(1, Math.min(5, Math.round(s / 20)));
  const rotulo =
    s >= 85
      ? "Altíssima chance de fechamento"
      : s >= 70
        ? "Grande chance de fechamento"
        : s >= 50
          ? "Boa chance — manter ritmo"
          : s >= 30
            ? "Em desenvolvimento"
            : "Início de jornada";
  return { score: s, estrelas, rotulo };
}

// ─── converters ──────────────────────────────────────────────────────────────

function rowToEmpresa(r: EmpresaRow): Empresa {
  return {
    id: r.id,
    nome: r.nome,
    segmento: r.segmento,
    cidade: r.cidade,
    site: r.site ?? undefined,
    instagram: r.instagram ?? undefined,
    observacoes: r.observacoes ?? undefined,
    accentColor: r.accent_color ?? undefined,
    arquivado: r.arquivado ?? false,
    status: r.status ?? "prospect",
  };
}

function rowToContato(r: ContatoRow): Contato {
  return {
    id: r.id,
    empresaId: r.cliente_id,
    nome: r.nome,
    cargo: r.cargo,
    email: r.email,
    telefone: r.telefone,
    principal: r.principal ?? false,
  };
}

function rowToProximaAcao(value: Json): ProximaAcao | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.titulo === "string" &&
    typeof value.data === "string"
  ) {
    return { titulo: value.titulo, data: value.data };
  }
  return null;
}

function rowToLead(r: LeadRow): Lead {
  return {
    id: r.id,
    empresaId: r.cliente_id,
    contatoId: r.contato_id,
    etapa: r.etapa as EtapaJornada,
    valor: Number(r.valor),
    responsavel: r.responsavel,
    temperatura: r.temperatura as Temperatura,
    origem: r.origem,
    proximaAcao: rowToProximaAcao(r.proxima_acao),
    observacoes: r.observacoes ?? undefined,
    criadoEm: r.criado_em,
    arquivado: r.arquivado ?? false,
    arquivadoEm: r.arquivado_em ?? (r.arquivado ? r.criado_em : undefined),
    arquivadoPor: r.arquivado_por ?? undefined,
    motivoArquivamento: r.motivo_arquivamento ?? undefined,
    etapaAntesArquivar: r.etapa_antes_arquivar ?? undefined,
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  };
}

function relacionarLeads(
  rows: LeadRow[],
  links: LeadLinkRow[],
  propostas: { id: string; lead_id: string | null }[],
) {
  const porLead = new Map<
    string,
    Pick<Lead, "propostasIds" | "contratosIds" | "projetosIds" | "lancamentosIds">
  >();
  const rel = (leadId: string) => {
    const atual = porLead.get(leadId);
    if (atual) return atual;
    const novo = {
      propostasIds: [] as string[],
      contratosIds: [] as string[],
      projetosIds: [] as string[],
      lancamentosIds: [] as string[],
    };
    porLead.set(leadId, novo);
    return novo;
  };

  for (const proposta of propostas) {
    if (proposta.lead_id) rel(proposta.lead_id).propostasIds.push(proposta.id);
  }
  for (const link of links) {
    const destino = rel(link.lead_id);
    if (link.tipo === "proposta" && !destino.propostasIds.includes(link.entidade_id))
      destino.propostasIds.push(link.entidade_id);
    if (link.tipo === "contrato") destino.contratosIds.push(link.entidade_id);
    if (link.tipo === "projeto") destino.projetosIds.push(link.entidade_id);
    if (link.tipo === "financeiro") destino.lancamentosIds.push(link.entidade_id);
  }

  return rows.map((row) => ({ ...rowToLead(row), ...rel(row.id) }));
}

function rowToTimeline(r: TimelineRow): TimelineEvent {
  return {
    id: r.id,
    leadId: r.lead_id,
    tipo: r.tipo as TimelineTipo,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    quando: r.quando,
    autor: r.autor,
  };
}

function rowToTarefa(r: TarefaRow): Tarefa {
  return {
    id: r.id,
    leadId: r.lead_id,
    titulo: r.titulo,
    responsavel: r.responsavel,
    prazo: r.prazo,
    feita: r.feita ?? false,
  };
}

// ─── store global ────────────────────────────────────────────────────────────

type Store = {
  empresas: Empresa[];
  contatos: Contato[];
  leads: Lead[];
  leadsArquivados: Lead[];
  etapasLabels: LabelsEtapasComercial;
  timeline: TimelineEvent[];
  tarefas: Tarefa[];
  loading: boolean;
  error: string | null;
};

let store: Store = {
  empresas: [],
  contatos: [],
  leads: [],
  leadsArquivados: [],
  etapasLabels: {},
  timeline: [],
  tarefas: [],
  loading: true,
  error: null,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const setStore = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  emit();
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

let initialized = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function init() {
  if (initialized) return;
  initialized = true;
  setStore({ loading: true, error: null });

  try {
    const [e, c, l, tl, ta, cfg, links, propostas] = await Promise.all([
      supabase.from("clientes_comercial").select("*").order("nome"),
      supabase.from("contatos_comercial").select("*").order("nome"),
      supabase.from("leads").select("*").order("criado_em", { ascending: false }),
      supabase.from("timeline_lead").select("*").order("quando", { ascending: false }),
      supabase.from("tarefas_lead").select("*").order("prazo"),
      supabase.from("configuracao_comercial").select("etapas_labels").maybeSingle(),
      supabase.from("comercial_lead_links").select("lead_id,tipo,entidade_id"),
      supabase.from("propostas").select("id,lead_id").not("lead_id", "is", null),
    ]);
    const queryError =
      e.error ??
      c.error ??
      l.error ??
      tl.error ??
      ta.error ??
      cfg.error ??
      links.error ??
      propostas.error;
    if (queryError) throw queryError;
    const todosLeads = relacionarLeads(l.data ?? [], links.data ?? [], propostas.data ?? []);

    setStore({
      empresas: (e.data ?? []).map(rowToEmpresa),
      contatos: (c.data ?? []).map(rowToContato),
      leads: todosLeads.filter((lead) => !lead.arquivado),
      leadsArquivados: todosLeads.filter((lead) => lead.arquivado),
      etapasLabels: normalizarLabelsEtapas(cfg.data?.etapas_labels),
      timeline: (tl.data ?? []).map(rowToTimeline),
      tarefas: (ta.data ?? []).map(rowToTarefa),
      loading: false,
      error: null,
    });

    channel = supabase
      .channel("comercial_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes_comercial" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contatos_comercial" },
        refresh,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_lead" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_lead" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracao_comercial" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comercial_lead_links" },
        refresh,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas" }, refresh)
      .subscribe();
  } catch (error) {
    initialized = false;
    setStore({
      loading: false,
      error: errorMessage(error, "Não foi possível carregar os clientes."),
    });
  }
}

async function refresh() {
  try {
    const [e, c, l, tl, ta, cfg, links, propostas] = await Promise.all([
      supabase.from("clientes_comercial").select("*").order("nome"),
      supabase.from("contatos_comercial").select("*").order("nome"),
      supabase.from("leads").select("*").order("criado_em", { ascending: false }),
      supabase.from("timeline_lead").select("*").order("quando", { ascending: false }),
      supabase.from("tarefas_lead").select("*").order("prazo"),
      supabase.from("configuracao_comercial").select("etapas_labels").maybeSingle(),
      supabase.from("comercial_lead_links").select("lead_id,tipo,entidade_id"),
      supabase.from("propostas").select("id,lead_id").not("lead_id", "is", null),
    ]);
    const queryError =
      e.error ??
      c.error ??
      l.error ??
      tl.error ??
      ta.error ??
      cfg.error ??
      links.error ??
      propostas.error;
    if (queryError) throw queryError;
    const todosLeads = relacionarLeads(l.data ?? [], links.data ?? [], propostas.data ?? []);
    setStore({
      empresas: (e.data ?? []).map(rowToEmpresa),
      contatos: (c.data ?? []).map(rowToContato),
      leads: todosLeads.filter((lead) => !lead.arquivado),
      leadsArquivados: todosLeads.filter((lead) => lead.arquivado),
      etapasLabels: normalizarLabelsEtapas(cfg.data?.etapas_labels),
      timeline: (tl.data ?? []).map(rowToTimeline),
      tarefas: (ta.data ?? []).map(rowToTarefa),
      error: null,
    });
  } catch (error) {
    setStore({ error: errorMessage(error, "Não foi possível atualizar os clientes.") });
  }
}

export function resetComercialStore() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  initialized = false;
  store = {
    empresas: [],
    contatos: [],
    leads: [],
    leadsArquivados: [],
    etapasLabels: {},
    timeline: [],
    tarefas: [],
    loading: true,
    error: null,
  };
  emit();
}
registerSessionDisposer(resetComercialStore);

// ─── hook ────────────────────────────────────────────────────────────────────

async function retryComercial() {
  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }
  initialized = false;
  await init();
}

export function useComercialSupa() {
  const [snap, setSnap] = useState(store);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) init();
    });
    const update = () => setSnap({ ...store });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return { ...snap, retry: retryComercial };
}

// selector-style hook (compatível com o padrão useComercial(s => s.leads))
export function useComercial<T>(selector: (s: Store) => T): T {
  const snap = useComercialSupa();
  return selector(snap);
}

export function useEtapasComercial() {
  const labels = useComercial((snapshot) => snapshot.etapasLabels);
  return etapasComLabels(labels);
}

// ─── getters (leem do store global — funcionam após init()) ──────────────────

export const getEmpresa = (id: string) => store.empresas.find((e) => e.id === id);
export const getContato = (id: string) => store.contatos.find((c) => c.id === id);
export const getContatosDaEmpresa = (clienteId: string) =>
  store.contatos.filter((c) => c.empresaId === clienteId);
export const getTimelineDoLead = (leadId: string) =>
  store.timeline
    .filter((t) => t.leadId === leadId)
    .sort((a, b) => b.quando.localeCompare(a.quando));
export const getTarefasDoLead = (leadId: string) =>
  store.tarefas.filter((t) => t.leadId === leadId).sort((a, b) => a.prazo.localeCompare(b.prazo));
export const getOrigensUnicas = () =>
  Array.from(new Set(store.leads.map((l) => l.origem).filter(Boolean)));
export const getResponsaveisUnicos = () =>
  Array.from(new Set(store.leads.map((l) => l.responsavel).filter(Boolean)));
export const getLabelEtapa = (etapa: EtapaJornada) =>
  store.etapasLabels[etapa] ?? labelEtapa(etapa);

function atualizarLeadNasColecoes(leadId: string, atualizar: (lead: Lead) => Lead) {
  setStore({
    leads: store.leads.map((lead) => (lead.id === leadId ? atualizar(lead) : lead)),
    leadsArquivados: store.leadsArquivados.map((lead) =>
      lead.id === leadId ? atualizar(lead) : lead,
    ),
  });
}

// ─── actions ─────────────────────────────────────────────────────────────────

export const comercial = {
  async moverEtapa(leadId: string, etapa: EtapaJornada) {
    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) return false;
    if (lead.etapa === etapa) return true;
    const { error } = await supabase.rpc("mover_lead_comercial", {
      p_lead_id: leadId,
      p_etapa: etapa,
    });
    if (dbErro(error, "mover etapa do lead")) return false;
    await refresh();
    return true;
  },

  async addEvento(
    leadId: string,
    ev: Omit<TimelineEvent, "id" | "leadId" | "quando" | "autor"> & {
      quando?: string;
      autor?: string;
    },
  ) {
    const quando = ev.quando ?? new Date().toISOString();
    const autor = ev.autor ?? "Você";
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("timeline_lead")
      .insert({
        empresa_id,
        lead_id: leadId,
        tipo: ev.tipo,
        titulo: ev.titulo,
        descricao: ev.descricao ?? null,
        quando,
        autor,
      })
      .select()
      .single();
    if (dbErro(error, "registrar evento")) return false;
    if (data) {
      setStore({ timeline: [rowToTimeline(data), ...store.timeline] });
    }
    return true;
  },

  async addTarefa(leadId: string, titulo: string, prazo: string, responsavel = "Você") {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("tarefas_lead")
      .insert({
        empresa_id,
        lead_id: leadId,
        titulo,
        responsavel,
        prazo,
        feita: false,
      })
      .select()
      .single();
    if (dbErro(error, "criar tarefa do lead")) return false;
    if (data) setStore({ tarefas: [...store.tarefas, rowToTarefa(data)] });
    return true;
  },

  async toggleTarefa(id: string) {
    const atual = store.tarefas.find((t) => t.id === id);
    if (!atual) return false;
    const { error } = await supabase
      .from("tarefas_lead")
      .update({ feita: !atual.feita })
      .eq("id", id);
    if (dbErro(error, "atualizar atividade")) return false;
    setStore({ tarefas: store.tarefas.map((t) => (t.id === id ? { ...t, feita: !t.feita } : t)) });
    return true;
  },

  async setProximaAcao(leadId: string, acao: ProximaAcao | null) {
    const { error } = await supabase
      .from("leads")
      .update({ proxima_acao: acao as unknown as import("@/lib/database.types").Json })
      .eq("id", leadId);
    if (dbErro(error, "salvar próxima ação")) return false;
    atualizarLeadNasColecoes(leadId, (lead) => ({ ...lead, proximaAcao: acao }));
    return true;
  },

  async setObservacoes(leadId: string, observacoes: string) {
    const { error } = await supabase.from("leads").update({ observacoes }).eq("id", leadId);
    if (dbErro(error, "salvar observações")) return false;
    atualizarLeadNasColecoes(leadId, (lead) => ({ ...lead, observacoes }));
    return true;
  },

  async setTemperatura(leadId: string, temperatura: Temperatura) {
    const { error } = await supabase.from("leads").update({ temperatura }).eq("id", leadId);
    if (dbErro(error, "atualizar temperatura")) return false;
    atualizarLeadNasColecoes(leadId, (lead) => ({ ...lead, temperatura }));
    return true;
  },

  async updateLead(
    leadId: string,
    patch: Partial<Pick<Lead, "valor" | "responsavel" | "origem" | "temperatura">>,
  ) {
    const payload: LeadUpdate = {};
    if (patch.valor !== undefined) payload.valor = patch.valor;
    if (patch.responsavel !== undefined) payload.responsavel = patch.responsavel;
    if (patch.origem !== undefined) payload.origem = patch.origem;
    if (patch.temperatura !== undefined) payload.temperatura = patch.temperatura;
    const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
    if (dbErro(error, "atualizar lead")) return false;
    atualizarLeadNasColecoes(leadId, (lead) => ({ ...lead, ...patch }));
    return true;
  },

  async updateEmpresa(empresaId: string, patch: Partial<Omit<Empresa, "id">>) {
    const payload: EmpresaUpdate = {};
    if (patch.nome !== undefined) payload.nome = patch.nome;
    if (patch.segmento !== undefined) payload.segmento = patch.segmento;
    if (patch.cidade !== undefined) payload.cidade = patch.cidade;
    if (patch.site !== undefined) payload.site = patch.site;
    if (patch.instagram !== undefined) payload.instagram = patch.instagram;
    if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes;
    if (patch.accentColor !== undefined) payload.accent_color = patch.accentColor;
    if (patch.arquivado !== undefined) payload.arquivado = patch.arquivado;
    const { error } = await supabase.from("clientes_comercial").update(payload).eq("id", empresaId);
    if (dbErro(error, "atualizar empresa")) return false;
    setStore({
      empresas: store.empresas.map((e) => (e.id === empresaId ? { ...e, ...patch } : e)),
    });
    return true;
  },

  async removerEmpresa(empresaId: string) {
    const { error } = await supabase.from("clientes_comercial").delete().eq("id", empresaId);
    if (dbErro(error, "excluir empresa")) return false;
    setStore({
      empresas: store.empresas.filter((empresa) => empresa.id !== empresaId),
      contatos: store.contatos.filter((contato) => contato.empresaId !== empresaId),
    });
    return true;
  },

  async arquivarEmpresa(empresaId: string, arquivado: boolean) {
    const { error } = await supabase
      .from("clientes_comercial")
      .update({ arquivado })
      .eq("id", empresaId);
    if (dbErro(error, arquivado ? "arquivar cliente" : "restaurar cliente")) return false;
    setStore({
      empresas: store.empresas.map((empresa) =>
        empresa.id === empresaId ? { ...empresa, arquivado } : empresa,
      ),
    });
    return true;
  },

  // Cria um cliente direto (sem lead/contato) — usado pelo módulo Projetos,
  // onde o cliente já é conhecido e vira produção logo de cara.
  async criarCliente(input: { nome: string; accentColor?: string }) {
    const empresa_id = await getEmpresaId();
    const nome = input.nome.trim();
    const existenteLocal = store.empresas.find(
      (empresa) => empresa.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"),
    );
    if (existenteLocal) return existenteLocal;

    const { data: existentes, error: lookupError } = await supabase
      .from("clientes_comercial")
      .select("*")
      .eq("empresa_id", empresa_id)
      .ilike("nome", nome)
      .limit(1);
    if (dbErro(lookupError, "buscar cliente")) return null;
    if (existentes?.[0]) {
      const existente = rowToEmpresa(existentes[0]);
      if (!store.empresas.some((empresa) => empresa.id === existente.id)) {
        setStore({ empresas: [...store.empresas, existente] });
      }
      return existente;
    }

    const { data, error } = await supabase
      .from("clientes_comercial")
      .insert({
        empresa_id,
        nome,
        segmento: "Não informado",
        cidade: "Não informado",
        accent_color: input.accentColor ?? null,
      })
      .select()
      .single();
    if (dbErro(error, "criar cliente") || !data) return null;
    setStore({ empresas: [...store.empresas, rowToEmpresa(data)] });
    return rowToEmpresa(data);
  },

  // Digitar o nome do cliente continua sendo o fluxo normal (Projetos);
  // por trás dos panos reaproveita ou cria o cadastro em clientes_comercial,
  // sem exigir nenhuma tela extra do usuário.
  async encontrarOuCriarCliente(nome: string) {
    const alvo = nome.trim();
    if (!alvo) return null;
    const existente = store.empresas.find((e) => e.nome.toLowerCase() === alvo.toLowerCase());
    if (existente) return existente;
    return comercial.criarCliente({ nome: alvo });
  },

  async updateContato(contatoId: string, patch: Partial<Omit<Contato, "id" | "empresaId">>) {
    const payload: ContatoUpdate = {};
    if (patch.nome !== undefined) payload.nome = patch.nome;
    if (patch.cargo !== undefined) payload.cargo = patch.cargo;
    if (patch.email !== undefined) payload.email = patch.email;
    if (patch.telefone !== undefined) payload.telefone = patch.telefone;
    if (patch.principal !== undefined) payload.principal = patch.principal;
    const { error } = await supabase.from("contatos_comercial").update(payload).eq("id", contatoId);
    if (dbErro(error, "atualizar contato")) return false;
    setStore({
      contatos: store.contatos.map((c) => (c.id === contatoId ? { ...c, ...patch } : c)),
    });
    return true;
  },

  async addContato(clienteId: string, dados: Omit<Contato, "id" | "empresaId">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("contatos_comercial")
      .insert({
        empresa_id,
        cliente_id: clienteId,
        nome: dados.nome,
        cargo: dados.cargo,
        email: dados.email,
        telefone: dados.telefone,
        principal: dados.principal ?? false,
      })
      .select()
      .single();
    if (dbErro(error, "adicionar contato")) return null;
    if (data) setStore({ contatos: [...store.contatos, rowToContato(data)] });
    return data?.id ?? null;
  },

  async criarContatoAvulso(input: {
    empresaNome: string;
    nome: string;
    cargo?: string;
    email?: string;
    telefone?: string;
    principal?: boolean;
  }) {
    const empresaNome = input.empresaNome.trim();
    const nome = input.nome.trim();
    if (!empresaNome || !nome) return null;

    const empresa = await comercial.encontrarOuCriarCliente(empresaNome);
    if (!empresa) return null;

    const contatoNormalizado: ContatoImportado = {
      nome,
      empresa: empresa.nome,
      cargo: valorContatoOuVazio(input.cargo) || "—",
      email: valorContatoOuVazio(input.email) || "—",
      telefone: valorContatoOuVazio(input.telefone) || "—",
      principal: input.principal ?? false,
    };
    const chave = chaveContato(contatoNormalizado);
    const existente = store.contatos.find((contato) => {
      const empresaDoContato = store.empresas.find((item) => item.id === contato.empresaId);
      return (
        empresaDoContato && chaveContato({ ...contato, empresa: empresaDoContato.nome }) === chave
      );
    });
    if (existente) return { id: existente.id, existente: true };

    const id = await comercial.addContato(empresa.id, {
      nome: contatoNormalizado.nome,
      cargo: contatoNormalizado.cargo,
      email: contatoNormalizado.email,
      telefone: contatoNormalizado.telefone,
      principal:
        contatoNormalizado.principal ||
        !store.contatos.some((contato) => contato.empresaId === empresa.id),
    });
    return id ? { id, existente: false } : null;
  },

  async importarContatos(contatos: ContatoImportado[], modo: "ignorar" | "atualizar" = "ignorar") {
    const { data, error } = await supabase.rpc("importar_contatos_comercial", {
      p_contatos: contatos as unknown as Json,
      p_modo: modo,
    });
    if (dbErro(error, "importar contatos") || !data || typeof data !== "object") return null;
    const resultado = data as {
      importados?: number;
      atualizados?: number;
      ignorados?: number;
      empresasCriadas?: number;
    };
    await refresh();
    return {
      importados: Number(resultado.importados ?? 0),
      atualizados: Number(resultado.atualizados ?? 0),
      ignorados: Number(resultado.ignorados ?? 0),
      empresasCriadas: Number(resultado.empresasCriadas ?? 0),
    };
  },

  async criarLead(input: {
    empresaNome: string;
    contatoNome: string;
    contatoEmail?: string;
    contatoTelefone?: string;
    valor: number;
    responsavel: string;
    temperatura: Temperatura;
    origem: string;
    cidade?: string;
    segmento?: string;
  }) {
    const { data, error } = await supabase.rpc("criar_lead_comercial", {
      p_empresa_nome: input.empresaNome,
      p_contato_nome: input.contatoNome,
      p_contato_email: input.contatoEmail || null,
      p_contato_telefone: input.contatoTelefone || null,
      p_valor: input.valor,
      p_responsavel: input.responsavel,
      p_temperatura: input.temperatura,
      p_origem: input.origem,
      p_cidade: input.cidade || null,
      p_segmento: input.segmento || null,
    });
    if (dbErro(error, "criar lead") || !data?.lead_id) return null;
    await refresh();
    return data.lead_id;
  },

  async renomearEtapa(etapa: EtapaJornada, novoLabel: string) {
    const texto = novoLabel.trim().slice(0, 40);
    const labels: LabelsEtapasComercial = { ...store.etapasLabels };
    if (!texto || texto === ETAPAS.find((item) => item.id === etapa)?.label) delete labels[etapa];
    else labels[etapa] = texto;

    const empresa_id = await getEmpresaId();
    const { error } = await supabase.from("configuracao_comercial").upsert(
      {
        empresa_id,
        etapas_labels: labels as Json,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    if (dbErro(error, "renomear etapa comercial")) return false;
    setStore({ etapasLabels: labels });
    return true;
  },

  async arquivarLead(leadId: string, motivo?: string) {
    const { error } = await supabase.rpc("arquivar_lead_comercial", {
      p_lead_id: leadId,
      p_motivo: motivo?.trim() || null,
    });
    if (dbErro(error, "arquivar lead")) return false;
    await refresh();
    return true;
  },

  async restaurarLead(leadId: string) {
    const { error } = await supabase.rpc("restaurar_lead_comercial", {
      p_lead_id: leadId,
    });
    if (dbErro(error, "restaurar lead")) return false;
    await refresh();
    return true;
  },

  async removerLead(leadId: string) {
    const { error } = await supabase.rpc("excluir_lead_comercial", { p_lead_id: leadId });
    if (dbErro(error, "excluir lead")) return false;
    await refresh();
    return true;
  },

  async fecharLead(
    leadId: string,
    opcoes: {
      proposta: boolean;
      contrato: boolean;
      projeto: boolean;
      cobranca: boolean;
      cliente: boolean;
      onboarding: boolean;
    },
  ) {
    const { data, error } = await supabase.rpc("fechar_lead_comercial", {
      p_lead_id: leadId,
      p_criar_proposta: opcoes.proposta,
      p_criar_contrato: opcoes.contrato,
      p_criar_projeto: opcoes.projeto,
      p_criar_cobranca: opcoes.cobranca,
      p_promover_cliente: opcoes.cliente,
      p_agendar_onboarding: opcoes.onboarding,
    });
    if (dbErro(error, "fechar lead")) return null;
    await refresh();
    return data;
  },
};
