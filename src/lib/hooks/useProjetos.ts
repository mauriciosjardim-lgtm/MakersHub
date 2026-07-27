import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getEmpresaId } from "@/lib/empresaId";
import { dbErro } from "@/lib/dbError";
import { registerSessionDisposer } from "@/lib/sessionScope";
import type {
  FaseProjeto,
  Prioridade,
  StatusEntregavel,
  TipoEntregavel,
  Projeto,
  Tarefa,
  Marco,
  Entregavel,
} from "@/lib/mock/projetos";
import {
  FASES_PADRAO,
  parseFaseToken,
  faseParaId,
  fasesParaIds,
  serializarFaseToken,
} from "@/lib/mock/projetos";
import { agendaActions } from "./useAgenda";
import { calcularPercentualFluxo } from "@/lib/projetos/progresso";
import { planejarRemocaoFaseGlobal } from "@/lib/projetos/fluxo";

const tipoAgendaDaTarefa = (status?: string) =>
  status === "captacao"
    ? ("gravacao" as const)
    : status === "edicao"
      ? ("edicao" as const)
      : status === "entrega"
        ? ("entrega" as const)
        : ("tarefa" as const);

// ─── helpers de conversão snake_case ↔ camelCase ───────────────────────────

function normalizarFluxo(fases?: unknown) {
  if (!Array.isArray(fases)) return [...FASES_PADRAO];

  const normalizadas = normalizarFluxoComLabel(fases);
  return normalizadas.length ? normalizadas : [...FASES_PADRAO];
}

function rowToProjeto(r: any): Projeto {
  return {
    id: r.id,
    nome: r.nome,
    cliente: r.cliente,
    clienteId: r.cliente_id ?? undefined,
    descricao: r.descricao ?? undefined,
    fase: r.fase as FaseProjeto,
    progresso: r.progresso,
    fases: normalizarFluxo(r.fases),
    equipe: r.equipe ?? [],
    dataInicio: r.data_inicio,
    dataEntrega: r.data_entrega ?? undefined,
    arquivado: r.arquivado ?? false,
    valor: Number(r.valor),
    cor: r.cor ?? "primary",
    criadoEm: r.criado_em,
    notas: r.notas ?? undefined,
    links: Array.isArray(r.links) ? r.links : [],
    portalVisible: r.portal_visible ?? false,
    portalPhase: r.portal_phase ?? "preparacao",
    portalProgress: r.portal_progress ?? 0,
    portalUpdate: r.portal_update ?? undefined,
    portalNextMilestone: r.portal_next_milestone ?? undefined,
    portalCoverUrl: r.portal_cover_url ?? undefined,
    portalUpdatedAt: r.portal_updated_at ?? undefined,
  };
}

function rowToTarefa(r: any): Tarefa {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    concluida: r.concluida ?? false,
    responsavel: r.responsavel,
    prazo: r.prazo ?? undefined,
    prioridade: r.prioridade as Prioridade,
    prazoFim: r.prazo_fim ?? undefined,
    diaTodo: r.dia_todo ?? false,
    link: r.link ?? undefined,
    criadoEm: r.criado_em,
  };
}

function rowToMarco(r: any): Marco {
  return { id: r.id, projetoId: r.projeto_id, titulo: r.titulo, data: r.data, status: r.status };
}

function rowToEntregavel(r: any): Entregavel {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    titulo: r.titulo,
    tipo: r.tipo as TipoEntregavel,
    status: r.status as StatusEntregavel,
    link: r.link ?? undefined,
    notas: r.notas ?? undefined,
    criadoEm: r.criado_em,
  };
}

// ─── estado global reativo ──────────────────────────────────────────────────

type Store = {
  projetos: Projeto[];
  tarefas: Tarefa[];
  marcos: Marco[];
  entregaveis: Entregavel[];
  loading: boolean;
};

let store: Store = { projetos: [], tarefas: [], marcos: [], entregaveis: [], loading: true };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const setStore = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  emit();
};

let initialized = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function init() {
  if (initialized) return;
  initialized = true;

  const [p, t, m, e] = await Promise.all([
    supabase.from("projetos").select("*").order("criado_em", { ascending: false }),
    supabase.from("tarefas").select("*").order("criado_em", { ascending: true }),
    supabase.from("marcos").select("*").order("data", { ascending: true }),
    supabase.from("entregaveis").select("*").order("criado_em", { ascending: true }),
  ]);

  const tarefasCarregadas = (t.data ?? []).map(rowToTarefa);
  const projetosCarregados = (p.data ?? []).map(rowToProjeto);
  setStore({
    projetos: projetosCarregados.map((projeto) => ({
      ...projeto,
      progresso: calcularPercentualFluxo(projeto, tarefasCarregadas),
    })),
    tarefas: tarefasCarregadas,
    marcos: (m.data ?? []).map(rowToMarco),
    entregaveis: (e.data ?? []).map(rowToEntregavel),
    loading: false,
  });

  // Tempo real — aplicação INCREMENTAL por evento (sem refetch completo).
  // Cada evento atualiza só o registro afetado e recalcula o progresso do
  // projeto correspondente. Dedup por id evita duplicar o que já foi inserido
  // otimisticamente pelas actions.
  channel = supabase
    .channel("projetos_realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "projetos" }, handleProjetoEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, handleTarefaEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "marcos" }, handleMarcoEvent)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "entregaveis" },
      handleEntregavelEvent,
    )
    .subscribe();
}

// Recalcula o progresso de um projeto a partir do estado atual do store.
// Devolve o array de projetos (novo se mudou, mesmo se idêntico).
function projetosComProgresso(
  projetos: Projeto[],
  tarefas: Tarefa[],
  projetoId?: string,
): Projeto[] {
  if (!projetoId) return projetos;
  const projeto = projetos.find((p) => p.id === projetoId);
  const prog = projeto ? calcularPercentualFluxo(projeto, tarefas) : 0;
  return projetos.map((p) =>
    p.id === projetoId && p.progresso !== prog ? { ...p, progresso: prog } : p,
  );
}

function handleTarefaEvent(payload: any) {
  const { eventType, new: nw, old } = payload;
  let tarefas = store.tarefas;
  let projetoId: string | undefined;

  if (eventType === "INSERT") {
    projetoId = nw.projeto_id;
    if (tarefas.some((t) => t.id === nw.id)) return; // já inserido otimisticamente
    tarefas = [...tarefas, rowToTarefa(nw)];
  } else if (eventType === "UPDATE") {
    projetoId = nw.projeto_id;
    const mapped = rowToTarefa(nw);
    const atual = tarefas.find((t) => t.id === nw.id);
    if (atual && JSON.stringify(atual) === JSON.stringify(mapped)) return; // idêntico → sem re-render
    tarefas = atual ? tarefas.map((t) => (t.id === nw.id ? mapped : t)) : [...tarefas, mapped];
  } else if (eventType === "DELETE") {
    const rec = tarefas.find((t) => t.id === old.id);
    if (!rec) return;
    projetoId = rec.projetoId;
    tarefas = tarefas.filter((t) => t.id !== old.id);
  }

  const projetos = projetosComProgresso(store.projetos, tarefas, projetoId);
  store = { ...store, tarefas, projetos };
  emit();
}

function handleProjetoEvent(payload: any) {
  const { eventType, new: nw, old } = payload;
  let { projetos, tarefas, marcos, entregaveis } = store;

  if (eventType === "INSERT") {
    if (projetos.some((p) => p.id === nw.id)) return;
    projetos = [rowToProjeto(nw), ...projetos];
  } else if (eventType === "UPDATE") {
    const atual = projetos.find((p) => p.id === nw.id);
    const mapped = rowToProjeto(nw);
    if (atual && JSON.stringify(atual) === JSON.stringify(mapped)) return;
    projetos = atual ? projetos.map((p) => (p.id === nw.id ? mapped : p)) : [mapped, ...projetos];
  } else if (eventType === "DELETE") {
    if (!projetos.some((p) => p.id === old.id)) return;
    projetos = projetos.filter((p) => p.id !== old.id);
    tarefas = tarefas.filter((t) => t.projetoId !== old.id);
    marcos = marcos.filter((m) => m.projetoId !== old.id);
    entregaveis = entregaveis.filter((e) => e.projetoId !== old.id);
  }

  store = { ...store, projetos, tarefas, marcos, entregaveis };
  emit();
}

function handleMarcoEvent(payload: any) {
  const { eventType, new: nw, old } = payload;
  let marcos = store.marcos;
  if (eventType === "INSERT") {
    if (marcos.some((m) => m.id === nw.id)) return;
    marcos = [...marcos, rowToMarco(nw)];
  } else if (eventType === "UPDATE") {
    const mapped = rowToMarco(nw);
    const atual = marcos.find((m) => m.id === nw.id);
    if (atual && JSON.stringify(atual) === JSON.stringify(mapped)) return;
    marcos = atual ? marcos.map((m) => (m.id === nw.id ? mapped : m)) : [...marcos, mapped];
  } else if (eventType === "DELETE") {
    if (!marcos.some((m) => m.id === old.id)) return;
    marcos = marcos.filter((m) => m.id !== old.id);
  }
  store = { ...store, marcos };
  emit();
}

function handleEntregavelEvent(payload: any) {
  const { eventType, new: nw, old } = payload;
  let entregaveis = store.entregaveis;
  if (eventType === "INSERT") {
    if (entregaveis.some((e) => e.id === nw.id)) return;
    entregaveis = [...entregaveis, rowToEntregavel(nw)];
  } else if (eventType === "UPDATE") {
    const mapped = rowToEntregavel(nw);
    const atual = entregaveis.find((e) => e.id === nw.id);
    if (atual && JSON.stringify(atual) === JSON.stringify(mapped)) return;
    entregaveis = atual
      ? entregaveis.map((e) => (e.id === nw.id ? mapped : e))
      : [...entregaveis, mapped];
  } else if (eventType === "DELETE") {
    if (!entregaveis.some((e) => e.id === old.id)) return;
    entregaveis = entregaveis.filter((e) => e.id !== old.id);
  }
  store = { ...store, entregaveis };
  emit();
}

export function resetProjetosStore() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  initialized = false;
  store = { projetos: [], tarefas: [], marcos: [], entregaveis: [], loading: true };
  emit();
}
registerSessionDisposer(resetProjetosStore);

// ─── hook ───────────────────────────────────────────────────────────────────

export function useProjetos() {
  const [snap, setSnap] = useState(store);
  useEffect(() => {
    // Só inicializa se houver sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) init();
    });
    const update = () => setSnap({ ...store });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return snap;
}

// ─── actions ────────────────────────────────────────────────────────────────

function calcProgresso(projetoId: string): number {
  const projeto = store.projetos.find((p) => p.id === projetoId);
  return projeto ? calcularPercentualFluxo(projeto, store.tarefas) : 0;
}

function normalizarFluxoComLabel(fases?: string[]) {
  const base = fases ?? [];
  return base
    .map((fase) => {
      const parsed = parseFaseToken(fase);
      if (!parsed.id) return "";
      return serializarFaseToken(parsed.id, parsed.label);
    })
    .filter(Boolean);
}

// Recalcula a partir do store JÁ atualizado, pinta a barra na hora e só então
// persiste — sem esperar o evento Realtime. O handler Realtime que vier depois
// verá o mesmo valor e será ignorado (guard de igualdade), evitando re-render duplo.
async function atualizarProgresso(projetoId: string) {
  const prog = calcProgresso(projetoId);
  setStore({
    projetos: store.projetos.map((p) => (p.id === projetoId ? { ...p, progresso: prog } : p)),
  });
  await supabase.from("projetos").update({ progresso: prog }).eq("id", projetoId);
}

export const projetosActions = {
  async criarProjeto(input: Omit<Projeto, "id" | "criadoEm" | "progresso">) {
    const empresa_id = await getEmpresaId();
    const payload = {
      empresa_id,
      nome: input.nome,
      cliente: input.cliente,
      cliente_id: input.clienteId ?? null,
      descricao: input.descricao,
      fase: input.fase ?? "briefing",
      fases: normalizarFluxoComLabel(input.fases ?? [...FASES_PADRAO]),
      equipe: input.equipe,
      data_inicio: input.dataInicio,
      data_entrega: input.dataEntrega ?? null,
      arquivado: input.arquivado ?? false,
      valor: input.valor,
      cor: input.cor,
      notas: input.notas,
      progresso: 0,
    } as any;
    const { data, error } = await supabase.from("projetos").insert(payload).select().single();
    if (dbErro(error, "criar projeto")) return null;
    if (data) setStore({ projetos: [rowToProjeto(data), ...store.projetos] });
    return data;
  },

  async atualizarProjeto(id: string, input: Partial<Omit<Projeto, "id" | "criadoEm">>) {
    const payload: any = {};
    if (input.nome !== undefined) payload.nome = input.nome;
    if (input.cliente !== undefined) payload.cliente = input.cliente;
    if (input.clienteId !== undefined) payload.cliente_id = input.clienteId;
    if (input.descricao !== undefined) payload.descricao = input.descricao;
    if (input.fase !== undefined) payload.fase = input.fase;
    if (input.fases !== undefined) payload.fases = normalizarFluxoComLabel(input.fases);
    if (input.equipe !== undefined) payload.equipe = input.equipe;
    if (input.dataInicio !== undefined) payload.data_inicio = input.dataInicio;
    if (input.dataEntrega !== undefined) payload.data_entrega = input.dataEntrega;
    if (input.arquivado !== undefined) payload.arquivado = input.arquivado;
    if (input.valor !== undefined) payload.valor = input.valor;
    if (input.cor !== undefined) payload.cor = input.cor;
    if (input.notas !== undefined) payload.notas = input.notas;
    if (input.progresso !== undefined) payload.progresso = input.progresso;
    if (input.portalVisible !== undefined) payload.portal_visible = input.portalVisible;
    if (input.portalPhase !== undefined) payload.portal_phase = input.portalPhase;
    if (input.portalProgress !== undefined) payload.portal_progress = input.portalProgress;
    if (input.portalUpdate !== undefined) payload.portal_update = input.portalUpdate || null;
    if (input.portalNextMilestone !== undefined)
      payload.portal_next_milestone = input.portalNextMilestone || null;
    if (input.portalCoverUrl !== undefined) payload.portal_cover_url = input.portalCoverUrl || null;
    if (
      input.portalVisible !== undefined ||
      input.portalPhase !== undefined ||
      input.portalProgress !== undefined ||
      input.portalUpdate !== undefined ||
      input.portalNextMilestone !== undefined ||
      input.portalCoverUrl !== undefined
    ) {
      payload.portal_updated_at = new Date().toISOString();
    }
    const { error } = await supabase.from("projetos").update(payload).eq("id", id);
    if (dbErro(error, "atualizar projeto")) return false;
    setStore({
      projetos: store.projetos.map((p) =>
        p.id === id
          ? {
              ...p,
              ...input,
              ...(input.fases !== undefined ? { fases: normalizarFluxo(input.fases) } : {}),
            }
          : p,
      ),
    });
    return true;
  },

  // Renomeia um cliente em todos os projetos que o referenciam (campo texto
  // livre). Usado no cabeçalho do workspace do cliente ("Editar cliente").
  async renomearCliente(nomeAntigo: string, nomeNovo: string) {
    const novo = nomeNovo.trim();
    if (!novo || novo === nomeAntigo) return;
    const alvos = store.projetos.filter(
      (p) => p.cliente.toLowerCase() === nomeAntigo.toLowerCase(),
    );
    const empresa_id = await getEmpresaId();
    const { error } = await supabase
      .from("projetos")
      .update({ cliente: novo })
      .eq("empresa_id", empresa_id)
      .ilike("cliente", nomeAntigo);
    if (dbErro(error, "renomear cliente")) return;
    setStore({
      projetos: store.projetos.map((p) =>
        alvos.some((a) => a.id === p.id) ? { ...p, cliente: novo } : p,
      ),
    });
  },

  async removerProjeto(id: string) {
    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (dbErro(error, "remover projeto")) return false;
    setStore({
      projetos: store.projetos.filter((p) => p.id !== id),
      tarefas: store.tarefas.filter((t) => t.projetoId !== id),
      marcos: store.marcos.filter((m) => m.projetoId !== id),
      entregaveis: store.entregaveis.filter((e) => e.projetoId !== id),
    });
    return true;
  },

  async criarTarefa(input: Omit<Tarefa, "id" | "criadoEm">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("tarefas")
      .insert({
        empresa_id,
        projeto_id: input.projetoId,
        titulo: input.titulo,
        descricao: input.descricao,
        status: input.status,
        concluida: input.concluida ?? false,
        responsavel: input.responsavel,
        prazo: input.prazo,
        prioridade: input.prioridade,
        prazo_fim: input.prazoFim,
        dia_todo: input.diaTodo ?? false,
        link: input.link?.trim() || null,
      })
      .select()
      .single();
    if (dbErro(error, "criar tarefa")) return;
    if (data) {
      const nova = rowToTarefa(data);
      setStore({ tarefas: [...store.tarefas, nova] });
      await atualizarProgresso(input.projetoId);
      if (nova.prazo) {
        await agendaActions.upsertPorRef("tarefa", nova.id, {
          titulo: nova.titulo,
          tipo: tipoAgendaDaTarefa(nova.status),
          inicio: nova.prazo,
          fim: nova.diaTodo ? nova.prazo! : (nova.prazoFim ?? nova.prazo!),
          diaTodo: nova.diaTodo ?? false,
          participantes: nova.responsavel ? [nova.responsavel] : undefined,
        });
      }
    }
  },

  async atualizarTarefa(id: string, input: Partial<Omit<Tarefa, "id" | "criadoEm">>) {
    const tarefa = store.tarefas.find((t) => t.id === id);
    const projeto = tarefa ? store.projetos.find((p) => p.id === tarefa.projetoId) : undefined;
    const fases = fasesParaIds(projeto?.fases ?? [...FASES_PADRAO]);

    // Normaliza a sincronia fase (Kanban) ↔ checkbox (concluída) num só lugar.
    const norm: Partial<Omit<Tarefa, "id" | "criadoEm">> = { ...input };
    if (input.status !== undefined) {
      // Fase é autoritativa (drag-and-drop ou seleção de fase no modal).
      norm.concluida = input.status === "concluida";
    } else if (input.concluida !== undefined) {
      // Checkbox é autoritativo.
      if (input.concluida) {
        norm.status = "concluida";
      } else if (tarefa?.status === "concluida") {
        // Desmarcou estando em "Concluída" → volta pra fase imediatamente anterior.
        const idx = fases.indexOf("concluida");
        norm.status = idx > 0 ? fases[idx - 1] : "entrega";
      }
    }

    const payload: any = {};
    if (norm.titulo !== undefined) payload.titulo = norm.titulo;
    if (norm.descricao !== undefined) payload.descricao = norm.descricao;
    if (norm.status !== undefined) payload.status = norm.status;
    if (norm.concluida !== undefined) payload.concluida = norm.concluida;
    if (norm.responsavel !== undefined) payload.responsavel = norm.responsavel;
    if (norm.prazo !== undefined) payload.prazo = norm.prazo;
    if (norm.prazoFim !== undefined) payload.prazo_fim = norm.prazoFim;
    if (norm.diaTodo !== undefined) payload.dia_todo = norm.diaTodo;
    if (norm.prioridade !== undefined) payload.prioridade = norm.prioridade;
    if (norm.link !== undefined) payload.link = norm.link?.trim() || null;
    const { error } = await supabase.from("tarefas").update(payload).eq("id", id);
    if (dbErro(error, "atualizar tarefa")) return false;

    const localPatch: Partial<Tarefa> = { ...norm };
    if (norm.link !== undefined) localPatch.link = norm.link?.trim() || undefined;
    setStore({ tarefas: store.tarefas.map((t) => (t.id === id ? { ...t, ...localPatch } : t)) });

    // Recalcula/persiste progresso na hora quando a conclusão realmente mudou.
    if (
      tarefa &&
      ((norm.concluida !== undefined && norm.concluida !== tarefa.concluida) ||
        (norm.status !== undefined && norm.status !== tarefa.status))
    ) {
      await atualizarProgresso(tarefa.projetoId);
    }
    if (
      input.prazo !== undefined ||
      input.prazoFim !== undefined ||
      input.diaTodo !== undefined ||
      input.status !== undefined
    ) {
      const prazoAtual = input.prazo !== undefined ? input.prazo : tarefa?.prazo;
      if (prazoAtual) {
        const titulo = input.titulo ?? tarefa?.titulo ?? "";
        const responsavel = input.responsavel ?? tarefa?.responsavel;
        await agendaActions.upsertPorRef("tarefa", id, {
          titulo,
          tipo: tipoAgendaDaTarefa(input.status ?? tarefa?.status),
          inicio: prazoAtual,
          fim: input.diaTodo ? prazoAtual : (input.prazoFim ?? tarefa?.prazoFim ?? prazoAtual),
          diaTodo: input.diaTodo ?? tarefa?.diaTodo ?? false,
          participantes: responsavel ? [responsavel] : undefined,
        });
      } else {
        await agendaActions.removerPorRef("tarefa", id);
      }
    }
    return true;
  },

  async removerTarefa(id: string) {
    const tarefa = store.tarefas.find((t) => t.id === id);
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (dbErro(error, "remover tarefa")) return false;
    setStore({ tarefas: store.tarefas.filter((t) => t.id !== id) });
    if (tarefa) await atualizarProgresso(tarefa.projetoId);
    await agendaActions.removerPorRef("tarefa", id);
    return true;
  },

  async criarMarco(input: Omit<Marco, "id">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("marcos")
      .insert({
        empresa_id,
        projeto_id: input.projetoId,
        titulo: input.titulo,
        data: input.data,
        status: input.status,
      })
      .select()
      .single();
    if (dbErro(error, "criar marco")) return;
    if (data) setStore({ marcos: [...store.marcos, rowToMarco(data)] });
  },

  async atualizarMarco(id: string, input: Partial<Omit<Marco, "id">>) {
    const payload: any = {};
    if (input.titulo !== undefined) payload.titulo = input.titulo;
    if (input.data !== undefined) payload.data = input.data;
    if (input.status !== undefined) payload.status = input.status;
    const { error } = await supabase.from("marcos").update(payload).eq("id", id);
    if (dbErro(error, "atualizar marco")) return;
    setStore({ marcos: store.marcos.map((m) => (m.id === id ? { ...m, ...input } : m)) });
  },

  async removerMarco(id: string) {
    const { error } = await supabase.from("marcos").delete().eq("id", id);
    if (dbErro(error, "remover marco")) return false;
    setStore({ marcos: store.marcos.filter((m) => m.id !== id) });
    return true;
  },

  async criarEntregavel(input: Omit<Entregavel, "id" | "criadoEm">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("entregaveis")
      .insert({
        empresa_id,
        projeto_id: input.projetoId,
        titulo: input.titulo,
        tipo: input.tipo,
        status: input.status,
        link: input.link,
        notas: input.notas,
      })
      .select()
      .single();
    if (dbErro(error, "criar entregável")) return;
    if (data) setStore({ entregaveis: [...store.entregaveis, rowToEntregavel(data)] });
  },

  async atualizarEntregavel(id: string, input: Partial<Omit<Entregavel, "id" | "criadoEm">>) {
    const payload: any = {};
    if (input.titulo !== undefined) payload.titulo = input.titulo;
    if (input.tipo !== undefined) payload.tipo = input.tipo;
    if (input.status !== undefined) payload.status = input.status;
    if (input.link !== undefined) payload.link = input.link;
    if (input.notas !== undefined) payload.notas = input.notas;
    const { error } = await supabase.from("entregaveis").update(payload).eq("id", id);
    if (dbErro(error, "atualizar entregável")) return;
    setStore({ entregaveis: store.entregaveis.map((e) => (e.id === id ? { ...e, ...input } : e)) });
  },

  async removerEntregavel(id: string) {
    const { error } = await supabase.from("entregaveis").delete().eq("id", id);
    if (dbErro(error, "remover entregável")) return false;
    setStore({ entregaveis: store.entregaveis.filter((e) => e.id !== id) });
    return true;
  },

  async adicionarFase(projetoId: string, fase: string) {
    const projeto = store.projetos.find((p) => p.id === projetoId);
    if (!projeto) return;
    const fluxoAtual = projeto.fases ?? [...FASES_PADRAO];
    const ids = fasesParaIds(fluxoAtual);
    const faseId = fase.toLowerCase().replace(/\s+/g, "_");
    if (ids.includes(faseId)) return;
    const idx = ids.indexOf("concluida");
    const novas = [...fluxoAtual];
    if (idx >= 0) novas.splice(idx, 0, serializarFaseToken(faseId, fase));
    else novas.push(serializarFaseToken(faseId, fase));
    await this.atualizarProjeto(projetoId, { fases: novas });
  },

  async moverFase(projetoId: string, fase: string, direcao: -1 | 1) {
    const projeto = store.projetos.find((p) => p.id === projetoId);
    if (!projeto) return;
    const fases = [...(projeto.fases ?? [...FASES_PADRAO])];
    const idx = fases.findIndex((f) => faseParaId(f) === faseParaId(fase));
    const novoIdx = idx + direcao;
    if (idx < 0 || novoIdx < 0 || novoIdx >= fases.length) return;
    [fases[idx], fases[novoIdx]] = [fases[novoIdx], fases[idx]];
    await this.atualizarProjeto(projetoId, { fases });
  },

  async removerFase(projetoId: string, fase: string) {
    const projeto = store.projetos.find((p) => p.id === projetoId);
    if (!projeto) return;
    const fases = projeto.fases ?? [...FASES_PADRAO];
    const idx = fases.findIndex((f) => faseParaId(f) === faseParaId(fase));
    const ids = fasesParaIds(fases);
    const fallback = ids[idx - 1] ?? "concluida";
    // move tarefas da fase removida
    const alvoId = faseParaId(fase);
    const afetadas = store.tarefas.filter(
      (t) => t.projetoId === projetoId && faseParaId(t.status) === alvoId,
    );
    await Promise.all(afetadas.map((t) => this.atualizarTarefa(t.id, { status: fallback })));
    await this.atualizarProjeto(projetoId, {
      fases: fases.filter((f) => faseParaId(f) !== alvoId),
    });
  },

  async removerFaseDeTodos(fase: string) {
    const alvoId = faseParaId(fase);
    if (!alvoId || alvoId === "concluida") return false;

    const plano = planejarRemocaoFaseGlobal(store.projetos, store.tarefas, alvoId);
    if (plano.projetos.length === 0) return false;

    const tarefasAtualizadas = await Promise.all(
      plano.tarefas.map((tarefa) =>
        this.atualizarTarefa(tarefa.tarefaId, { status: tarefa.status }),
      ),
    );
    if (tarefasAtualizadas.some((resultado) => resultado === false)) return false;

    const projetosAtualizados = await Promise.all(
      plano.projetos.map((projeto) =>
        this.atualizarProjeto(projeto.projetoId, {
          fases: projeto.fases,
        }),
      ),
    );
    if (projetosAtualizados.some((resultado) => resultado === false)) return false;

    return {
      projetos: plano.projetos.length,
      tarefas: plano.tarefas.length,
    };
  },

  async replicarFluxoParaTodos(projetoId: string) {
    const origem = store.projetos.find((p) => p.id === projetoId);
    if (!origem) return false;
    const fluxoOrigem = origem.fases ?? [...FASES_PADRAO];
    const fluxoOrigemIds = fasesParaIds(fluxoOrigem);
    const alvos = store.projetos.filter((p) => p.id !== projetoId);
    const fluxos = new Map<string, string[]>();

    // Nunca deixa uma tarefa órfã: etapas exclusivas de outro projeto são
    // preservadas antes de "Concluída" ao aplicar o fluxo compartilhado.
    for (const projeto of alvos) {
      const usadas = store.tarefas
        .filter((t) => t.projetoId === projeto.id)
        .map((t) => t.status)
        .map((fase) => faseParaId(fase))
        .filter((faseId) => !fluxoOrigemIds.includes(faseId));
      const novas = [...fluxoOrigem];
      const final = novas.findIndex((fase) => faseParaId(fase) === "concluida");
      const extras = [...new Set(usadas.map((faseId) => serializarFaseToken(faseId)))];
      novas.splice(final >= 0 ? final : novas.length, 0, ...extras);
      fluxos.set(projeto.id, novas);
    }

    const resultados = await Promise.all(
      alvos.map((projeto) =>
        supabase
          .from("projetos")
          .update({ fases: fluxos.get(projeto.id) })
          .eq("id", projeto.id),
      ),
    );
    const erro = resultados.find((resultado) => resultado.error)?.error;
    if (dbErro(erro ?? null, "replicar fluxo de produção")) return false;
    setStore({
      projetos: store.projetos.map((projeto) => ({
        ...projeto,
        fases: fluxos.get(projeto.id) ?? projeto.fases,
      })),
    });
    return true;
  },

  async adicionarLink(projetoId: string, label: string, url: string) {
    const projeto = store.projetos.find((p) => p.id === projetoId);
    if (!projeto) return false;
    const links = [
      ...(projeto.links ?? []),
      { id: crypto.randomUUID(), label: label.trim(), url: url.trim() },
    ];
    const { error } = await supabase.from("projetos").update({ links }).eq("id", projetoId);
    if (dbErro(error, "salvar link do projeto")) return false;
    setStore({ projetos: store.projetos.map((p) => (p.id === projetoId ? { ...p, links } : p)) });
    return true;
  },

  async removerLink(projetoId: string, linkId: string) {
    const projeto = store.projetos.find((p) => p.id === projetoId);
    if (!projeto) return false;
    const links = (projeto.links ?? []).filter((l) => l.id !== linkId);
    const { error } = await supabase.from("projetos").update({ links }).eq("id", projetoId);
    if (dbErro(error, "remover link do projeto")) return false;
    setStore({ projetos: store.projetos.map((p) => (p.id === projetoId ? { ...p, links } : p)) });
    return true;
  },
};
