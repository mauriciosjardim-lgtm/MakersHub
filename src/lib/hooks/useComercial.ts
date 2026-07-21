import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getEmpresaId } from "@/lib/empresaId";
import { dbErro } from "@/lib/dbError";
import { registerSessionDisposer } from "@/lib/sessionScope";
import type {
  EtapaJornada, Temperatura, TimelineTipo,
  Empresa, Contato, Lead, TimelineEvent, Tarefa, ProximaAcao,
} from "@/lib/mock/comercial";
import { ETAPAS, labelEtapa } from "@/lib/mock/comercial";

// re-exporta constantes/helpers para que componentes só importem daqui
export { ETAPAS, labelEtapa };
export type { EtapaJornada, Temperatura, TimelineTipo, Empresa, Contato, Lead, TimelineEvent, Tarefa, ProximaAcao };

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
    s >= 85 ? "Altíssima chance de fechamento" :
    s >= 70 ? "Grande chance de fechamento" :
    s >= 50 ? "Boa chance — manter ritmo" :
    s >= 30 ? "Em desenvolvimento" :
    "Início de jornada";
  return { score: s, estrelas, rotulo };
}

// ─── converters ──────────────────────────────────────────────────────────────

function rowToEmpresa(r: any): Empresa {
  return {
    id: r.id, nome: r.nome, segmento: r.segmento, cidade: r.cidade,
    site: r.site ?? undefined, instagram: r.instagram ?? undefined, observacoes: r.observacoes ?? undefined,
    accentColor: r.accent_color ?? undefined,
  };
}

function rowToContato(r: any): Contato {
  return {
    id: r.id, empresaId: r.cliente_id, nome: r.nome, cargo: r.cargo,
    email: r.email, telefone: r.telefone, principal: r.principal ?? false,
  };
}

function rowToLead(r: any): Lead {
  return {
    id: r.id, empresaId: r.cliente_id, contatoId: r.contato_id,
    etapa: r.etapa as EtapaJornada, valor: Number(r.valor),
    responsavel: r.responsavel, temperatura: r.temperatura as Temperatura,
    origem: r.origem, proximaAcao: r.proxima_acao ?? null,
    observacoes: r.observacoes ?? undefined, criadoEm: r.criado_em,
    propostasIds: [], contratosIds: [], projetosIds: [], lancamentosIds: [],
  };
}

function rowToTimeline(r: any): TimelineEvent {
  return {
    id: r.id, leadId: r.lead_id, tipo: r.tipo as TimelineTipo,
    titulo: r.titulo, descricao: r.descricao ?? undefined,
    quando: r.quando, autor: r.autor,
  };
}

function rowToTarefa(r: any): Tarefa {
  return {
    id: r.id, leadId: r.lead_id, titulo: r.titulo,
    responsavel: r.responsavel, prazo: r.prazo, feita: r.feita ?? false,
  };
}

// ─── store global ────────────────────────────────────────────────────────────

type Store = {
  empresas: Empresa[];
  contatos: Contato[];
  leads: Lead[];
  timeline: TimelineEvent[];
  tarefas: Tarefa[];
  loading: boolean;
};

let store: Store = { empresas: [], contatos: [], leads: [], timeline: [], tarefas: [], loading: true };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const setStore = (patch: Partial<Store>) => { store = { ...store, ...patch }; emit(); };

let initialized = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function init() {
  if (initialized) return;
  initialized = true;

  const [e, c, l, tl, ta] = await Promise.all([
    supabase.from("clientes_comercial").select("*").order("nome"),
    supabase.from("contatos_comercial").select("*").order("nome"),
    supabase.from("leads").select("*").order("criado_em", { ascending: false }),
    supabase.from("timeline_lead").select("*").order("quando", { ascending: false }),
    supabase.from("tarefas_lead").select("*").order("prazo"),
  ]);

  setStore({
    empresas: (e.data ?? []).map(rowToEmpresa),
    contatos: (c.data ?? []).map(rowToContato),
    leads: (l.data ?? []).map(rowToLead),
    timeline: (tl.data ?? []).map(rowToTimeline),
    tarefas: (ta.data ?? []).map(rowToTarefa),
    loading: false,
  });

  channel = supabase.channel("comercial_realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "clientes_comercial" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "contatos_comercial" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "timeline_lead" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_lead" }, refresh)
    .subscribe();
}

async function refresh() {
  const [e, c, l, tl, ta] = await Promise.all([
    supabase.from("clientes_comercial").select("*").order("nome"),
    supabase.from("contatos_comercial").select("*").order("nome"),
    supabase.from("leads").select("*").order("criado_em", { ascending: false }),
    supabase.from("timeline_lead").select("*").order("quando", { ascending: false }),
    supabase.from("tarefas_lead").select("*").order("prazo"),
  ]);
  setStore({
    empresas: (e.data ?? []).map(rowToEmpresa),
    contatos: (c.data ?? []).map(rowToContato),
    leads: (l.data ?? []).map(rowToLead),
    timeline: (tl.data ?? []).map(rowToTimeline),
    tarefas: (ta.data ?? []).map(rowToTarefa),
  });
}

export function resetComercialStore() {
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  initialized = false;
  store = { empresas: [], contatos: [], leads: [], timeline: [], tarefas: [], loading: true };
  emit();
}
registerSessionDisposer(resetComercialStore);

// ─── hook ────────────────────────────────────────────────────────────────────

export function useComercialSupa() {
  const [snap, setSnap] = useState(store);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) init(); });
    const update = () => setSnap({ ...store });
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return snap;
}

// selector-style hook (compatível com o padrão useComercial(s => s.leads))
export function useComercial<T>(selector: (s: Store) => T): T {
  const snap = useComercialSupa();
  return selector(snap);
}

// ─── getters (leem do store global — funcionam após init()) ──────────────────

export const getEmpresa = (id: string) => store.empresas.find(e => e.id === id);
export const getContato = (id: string) => store.contatos.find(c => c.id === id);
export const getContatosDaEmpresa = (clienteId: string) => store.contatos.filter(c => c.empresaId === clienteId);
export const getTimelineDoLead = (leadId: string) =>
  store.timeline.filter(t => t.leadId === leadId).sort((a, b) => b.quando.localeCompare(a.quando));
export const getTarefasDoLead = (leadId: string) =>
  store.tarefas.filter(t => t.leadId === leadId).sort((a, b) => a.prazo.localeCompare(b.prazo));
export const getOrigensUnicas = () => Array.from(new Set(store.leads.map(l => l.origem).filter(Boolean)));
export const getResponsaveisUnicos = () => Array.from(new Set(store.leads.map(l => l.responsavel).filter(Boolean)));

// ─── actions ─────────────────────────────────────────────────────────────────

export const comercial = {
  async moverEtapa(leadId: string, etapa: EtapaJornada) {
    const lead = store.leads.find(l => l.id === leadId);
    if (!lead || lead.etapa === etapa) return;
    const anterior = lead.etapa;
    const empresa_id = await getEmpresaId();
    const [upd, ins] = await Promise.all([
      supabase.from("leads").update({ etapa }).eq("id", leadId),
      supabase.from("timeline_lead").insert({
        empresa_id, lead_id: leadId, tipo: "etapa_mudou",
        titulo: `Movido de ${labelEtapa(anterior)} → ${labelEtapa(etapa)}`,
        quando: new Date().toISOString(), autor: "Você",
      }),
    ]);
    if (dbErro(upd.error ?? ins.error, "mover etapa do lead")) return;
    setStore({
      leads: store.leads.map(l => l.id === leadId ? { ...l, etapa } : l),
      timeline: [
        ...store.timeline,
        { id: `tl-${Date.now()}`, leadId, tipo: "etapa_mudou", titulo: `Movido de ${labelEtapa(anterior)} → ${labelEtapa(etapa)}`, quando: new Date().toISOString(), autor: "Você" },
      ],
    });
  },

  async addEvento(leadId: string, ev: Omit<TimelineEvent, "id" | "leadId" | "quando" | "autor"> & { quando?: string; autor?: string }) {
    const quando = ev.quando ?? new Date().toISOString();
    const autor = ev.autor ?? "Você";
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase.from("timeline_lead").insert({
      empresa_id, lead_id: leadId, tipo: ev.tipo, titulo: ev.titulo, descricao: ev.descricao ?? null, quando, autor,
    }).select().single();
    if (dbErro(error, "registrar evento")) return;
    if (data) {
      setStore({ timeline: [rowToTimeline(data), ...store.timeline] });
    }
  },

  async addTarefa(leadId: string, titulo: string, prazo: string, responsavel = "Você") {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase.from("tarefas_lead").insert({
      empresa_id, lead_id: leadId, titulo, responsavel, prazo, feita: false,
    }).select().single();
    if (dbErro(error, "criar tarefa do lead")) return;
    if (data) setStore({ tarefas: [...store.tarefas, rowToTarefa(data)] });
  },

  async toggleTarefa(id: string) {
    const atual = store.tarefas.find(t => t.id === id);
    if (!atual) return;
    await supabase.from("tarefas_lead").update({ feita: !atual.feita }).eq("id", id);
    setStore({ tarefas: store.tarefas.map(t => t.id === id ? { ...t, feita: !t.feita } : t) });
  },

  async setProximaAcao(leadId: string, acao: ProximaAcao | null) {
    await supabase.from("leads").update({ proxima_acao: acao as unknown as import("@/lib/database.types").Json }).eq("id", leadId);
    setStore({ leads: store.leads.map(l => l.id === leadId ? { ...l, proximaAcao: acao } : l) });
  },

  async setObservacoes(leadId: string, observacoes: string) {
    await supabase.from("leads").update({ observacoes }).eq("id", leadId);
    setStore({ leads: store.leads.map(l => l.id === leadId ? { ...l, observacoes } : l) });
  },

  async setTemperatura(leadId: string, temperatura: Temperatura) {
    await supabase.from("leads").update({ temperatura }).eq("id", leadId);
    setStore({ leads: store.leads.map(l => l.id === leadId ? { ...l, temperatura } : l) });
  },

  async updateLead(leadId: string, patch: Partial<Pick<Lead, "valor" | "responsavel" | "origem" | "temperatura">>) {
    const payload: any = {};
    if (patch.valor !== undefined) payload.valor = patch.valor;
    if (patch.responsavel !== undefined) payload.responsavel = patch.responsavel;
    if (patch.origem !== undefined) payload.origem = patch.origem;
    if (patch.temperatura !== undefined) payload.temperatura = patch.temperatura;
    await supabase.from("leads").update(payload).eq("id", leadId);
    setStore({ leads: store.leads.map(l => l.id === leadId ? { ...l, ...patch } : l) });
  },

  async updateEmpresa(empresaId: string, patch: Partial<Omit<Empresa, "id">>) {
    const payload: any = {};
    if (patch.nome !== undefined) payload.nome = patch.nome;
    if (patch.segmento !== undefined) payload.segmento = patch.segmento;
    if (patch.cidade !== undefined) payload.cidade = patch.cidade;
    if (patch.site !== undefined) payload.site = patch.site;
    if (patch.instagram !== undefined) payload.instagram = patch.instagram;
    if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes;
    if (patch.accentColor !== undefined) payload.accent_color = patch.accentColor;
    await supabase.from("clientes_comercial").update(payload).eq("id", empresaId);
    setStore({ empresas: store.empresas.map(e => e.id === empresaId ? { ...e, ...patch } : e) });
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

    const { data, error } = await supabase.from("clientes_comercial").insert({
      empresa_id, nome,
      segmento: "Não informado", cidade: "Não informado",
      accent_color: input.accentColor ?? null,
    }).select().single();
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
    const existente = store.empresas.find(e => e.nome.toLowerCase() === alvo.toLowerCase());
    if (existente) return existente;
    return comercial.criarCliente({ nome: alvo });
  },

  async updateContato(contatoId: string, patch: Partial<Omit<Contato, "id" | "empresaId">>) {
    const payload: any = {};
    if (patch.nome !== undefined) payload.nome = patch.nome;
    if (patch.cargo !== undefined) payload.cargo = patch.cargo;
    if (patch.email !== undefined) payload.email = patch.email;
    if (patch.telefone !== undefined) payload.telefone = patch.telefone;
    if (patch.principal !== undefined) payload.principal = patch.principal;
    await supabase.from("contatos_comercial").update(payload).eq("id", contatoId);
    setStore({ contatos: store.contatos.map(c => c.id === contatoId ? { ...c, ...patch } : c) });
  },

  async addContato(clienteId: string, dados: Omit<Contato, "id" | "empresaId">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase.from("contatos_comercial").insert({
      empresa_id, cliente_id: clienteId, nome: dados.nome, cargo: dados.cargo,
      email: dados.email, telefone: dados.telefone, principal: dados.principal ?? false,
    }).select().single();
    if (dbErro(error, "adicionar contato")) return;
    if (data) setStore({ contatos: [...store.contatos, rowToContato(data)] });
    return data?.id;
  },

  async criarLead(input: {
    empresaNome: string; contatoNome: string; contatoEmail?: string; contatoTelefone?: string;
    valor: number; responsavel: string; temperatura: Temperatura; origem: string;
    cidade?: string; segmento?: string;
  }) {
    const empresa_id = await getEmpresaId();

    // 1. criar cliente
    const { data: clienteData, error: e1 } = await supabase.from("clientes_comercial").insert({
      empresa_id, nome: input.empresaNome, segmento: input.segmento || "Não informado",
      cidade: input.cidade || "Não informado",
    }).select().single();
    if (dbErro(e1, "criar cliente") || !clienteData) return null;

    // 2. criar contato
    const { data: contatoData, error: e2 } = await supabase.from("contatos_comercial").insert({
      empresa_id, cliente_id: clienteData.id, nome: input.contatoNome, cargo: "—",
      email: input.contatoEmail || "—", telefone: input.contatoTelefone || "—", principal: true,
    }).select().single();
    if (dbErro(e2, "criar contato") || !contatoData) return null;

    // 3. criar lead
    const { data: leadData, error: e3 } = await supabase.from("leads").insert({
      empresa_id, cliente_id: clienteData.id, contato_id: contatoData.id, etapa: "novo",
      valor: input.valor, responsavel: input.responsavel,
      temperatura: input.temperatura, origem: input.origem,
    }).select().single();
    if (dbErro(e3, "criar lead") || !leadData) return null;

    // 4. criar evento de timeline
    await supabase.from("timeline_lead").insert({
      empresa_id, lead_id: leadData.id, tipo: "criado", titulo: "Lead criado",
      descricao: input.empresaNome, quando: new Date().toISOString(), autor: input.responsavel,
    });

    setStore({
      empresas: [...store.empresas, rowToEmpresa(clienteData)],
      contatos: [...store.contatos, rowToContato(contatoData)],
      leads: [rowToLead(leadData), ...store.leads],
    });

    return leadData.id as string;
  },

  async removerLead(leadId: string) {
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (dbErro(error, "remover lead")) return;
    setStore({ leads: store.leads.filter(l => l.id !== leadId) });
  },
};
