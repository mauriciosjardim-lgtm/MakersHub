import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { getEmpresaId } from "@/lib/empresaId";
import { dbErro } from "@/lib/dbError";
import { registerSessionDisposer } from "@/lib/sessionScope";
import type { TipoEvento, RefTipo, Evento } from "@/lib/mock/agenda";

type EventRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  dia_todo: boolean;
  tipo: string;
  local: string | null;
  participantes: string[] | null;
  criado_em: string;
  ref_tipo: string | null;
  ref_id: string | null;
};
function rowToEvento(r: EventRow): Evento {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    inicio: r.inicio,
    fim: r.fim,
    diaTodo: r.dia_todo ?? false,
    tipo: r.tipo as TipoEvento,
    local: r.local ?? undefined,
    participantes: r.participantes ?? undefined,
    criadoEm: r.criado_em,
    refTipo: (r.ref_tipo as RefTipo) ?? undefined,
    refId: r.ref_id ?? undefined,
  };
}

// ─── store global ────────────────────────────────────────────────────────────

let eventos: Evento[] = [];
let loading = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let initialized = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function init() {
  if (initialized) return;
  initialized = true;
  const { data } = await supabase.from("eventos").select("*").order("inicio", { ascending: true });
  eventos = (data ?? []).map(rowToEvento);
  loading = false;
  emit();

  channel = supabase
    .channel("eventos_realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, async () => {
      const { data: fresh } = await supabase
        .from("eventos")
        .select("*")
        .order("inicio", { ascending: true });
      eventos = (fresh ?? []).map(rowToEvento);
      emit();
    })
    .subscribe();
}

export function resetAgendaStore() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  initialized = false;
  eventos = [];
  loading = true;
  emit();
}
registerSessionDisposer(resetAgendaStore);

async function enrollCreatedEvent(eventId: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const response = await fetch("/api/integrations/google-calendar/sync/enroll", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eventIds: [eventId] }),
  });
  // The server owns the rollout allowlist. A normal user who is not enabled
  // should not see an error after successfully creating a local event.
  if (response.status === 403) return;
  if (!response.ok) throw new Error("google_calendar_enroll_failed");
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useAgendaSupa() {
  const [snap, setSnap] = useState({ eventos, loading });
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) init();
    });
    const update = () => setSnap({ eventos: [...eventos], loading });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return snap;
}

// ─── actions ─────────────────────────────────────────────────────────────────

export const agendaActions = {
  async criar(input: Omit<Evento, "id" | "criadoEm">) {
    const empresa_id = await getEmpresaId();
    const { data, error } = await supabase
      .from("eventos")
      .insert({
        empresa_id,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        inicio: input.inicio,
        fim: input.fim,
        dia_todo: input.diaTodo ?? false,
        tipo: input.tipo,
        local: input.local ?? null,
        participantes: input.participantes ?? null,
        ref_tipo: input.refTipo ?? null,
        ref_id: input.refId ?? null,
      })
      .select()
      .single();
    if (dbErro(error, "criar evento")) return null;
    if (data) {
      eventos = [...eventos, rowToEvento(data)].sort((a, b) => a.inicio.localeCompare(b.inicio));
      emit();
      if (!input.refTipo) {
        try {
          await enrollCreatedEvent(data.id);
        } catch (error) {
          console.warn("Não foi possível incluir o evento na sincronização do Google.", error);
        }
      }
    }
    return data;
  },

  async atualizar(id: string, patch: Partial<Evento>) {
    const payload: Database["public"]["Tables"]["eventos"]["Update"] = {};
    if (patch.titulo !== undefined) payload.titulo = patch.titulo;
    if (patch.descricao !== undefined) payload.descricao = patch.descricao;
    if (patch.inicio !== undefined) payload.inicio = patch.inicio;
    if (patch.fim !== undefined) payload.fim = patch.fim;
    if (patch.diaTodo !== undefined) payload.dia_todo = patch.diaTodo;
    if (patch.tipo !== undefined) payload.tipo = patch.tipo;
    if (patch.local !== undefined) payload.local = patch.local;
    if (patch.participantes !== undefined) payload.participantes = patch.participantes;
    if (patch.refTipo !== undefined) payload.ref_tipo = patch.refTipo;
    if (patch.refId !== undefined) payload.ref_id = patch.refId;
    const { error } = await supabase.from("eventos").update(payload).eq("id", id);
    if (dbErro(error, "atualizar evento")) return;
    eventos = eventos.map((e) => (e.id === id ? { ...e, ...patch } : e));
    emit();
  },

  async remover(id: string) {
    const { error } = await supabase.from("eventos").delete().eq("id", id);
    if (dbErro(error, "remover evento")) return;
    eventos = eventos.filter((e) => e.id !== id);
    emit();
  },

  async upsertPorRef(
    refTipo: RefTipo,
    refId: string,
    input: Omit<Evento, "id" | "criadoEm" | "refTipo" | "refId">,
  ) {
    // Não depende do cache da Agenda: tarefas podem ser editadas antes de esta tela
    // carregar. Consultar o banco evita criar outro evento para a mesma referência.
    const empresa_id = await getEmpresaId();
    const { data: encontrados, error } = await supabase
      .from("eventos")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("ref_tipo", refTipo)
      .eq("ref_id", refId)
      .limit(1);
    if (dbErro(error, "localizar evento vinculado")) return;
    const existente =
      encontrados?.[0] ?? eventos.find((e) => e.refTipo === refTipo && e.refId === refId);
    if (existente) {
      await this.atualizar(existente.id, { ...input, refTipo, refId });
      return existente.id;
    }
    const criado = await this.criar({ ...input, refTipo, refId });
    return criado?.id;
  },

  async removerPorRef(refTipo: RefTipo, refId: string) {
    const existente = eventos.find((e) => e.refTipo === refTipo && e.refId === refId);
    if (existente) await this.remover(existente.id);
  },

  listarPorRef(refTipo: RefTipo, refId: string) {
    return eventos.filter((e) => e.refTipo === refTipo && e.refId === refId);
  },
};

// Refresh imported events only for the session that started the sync request.
export async function refreshAgenda(userId: string) {
  const before = await supabase.auth.getSession();
  if (before.data.session?.user.id !== userId) return;
  const { data, error } = await supabase.from("eventos").select("*").order("inicio");
  const after = await supabase.auth.getSession();
  if (error || after.data.session?.user.id !== userId) return;
  eventos = (data ?? []).map(rowToEvento);
  emit();
}
