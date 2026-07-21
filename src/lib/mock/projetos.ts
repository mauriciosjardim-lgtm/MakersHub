// MakersHub — Mock store de Projetos
// Sincroniza automaticamente tarefas com prazo e marcos na Agenda genérica.

import { useSyncExternalStore } from "react";
import { Film, Camera, FileText, Palette, Headphones, Paperclip, type LucideIcon } from "lucide-react";
import { agendaActions, type TipoEvento } from "./agenda";

export type FaseProjeto = "briefing" | "pre" | "captacao" | "edicao" | "revisao" | "entrega" | "concluido" | "pausado";
export type StatusTarefa = string; // dinâmico — corresponde às fases do projeto
export type Prioridade = "baixa" | "media" | "alta" | "urgente";
export type StatusMarco = "pendente" | "concluido";
export type TipoEntregavel = "video" | "foto" | "doc" | "design" | "audio" | "outro";
export type StatusEntregavel = "pendente" | "em_revisao" | "aprovado" | "entregue";

export interface ProjetoLink {
  id: string;
  label: string;
  url: string;
}

export const FASES_PADRAO = ["briefing", "pre_producao", "captacao", "edicao", "revisao", "entrega", "concluida"];

export const CORES_PROJETO = ["#90F826", "#66B8FF", "#BD8CFF", "#F0B34B", "#FF737A", "#46D6B1", "#FF8FD1", "#8AA2FF", "#F58B4C", "#B6D94C"];
const CORES_LEGADAS: Record<string, string> = { primary: "#90F826", info: "#66B8FF", warning: "#F0B34B", success: "#46D6B1" };
export const resolverCorProjeto = (cor?: string, identidade = "") => {
  if (cor?.startsWith("#")) return cor;
  // "primary" era o valor padrão de todos os projetos antigos. Enquanto o
  // usuário não escolhe uma cor, distribuímos uma identidade estável por ID.
  if (!cor || cor === "primary") {
    let hash = 0;
    for (const c of identidade) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return CORES_PROJETO[hash % CORES_PROJETO.length];
  }
  return CORES_LEGADAS[cor] ?? CORES_PROJETO[0];
};

export interface Projeto {
  id: string;
  nome: string;
  cliente: string;
  clienteId?: string;
  descricao?: string;
  fase: FaseProjeto;
  progresso: number;
  fases?: string[]; // colunas do kanban — ordenadas, editáveis por projeto
  equipe: string[];
  dataInicio: string;
  dataEntrega?: string | null;
  arquivado?: boolean;
  valor: number;
  cor: string;
  criadoEm: string;
  notas?: string;
  links?: ProjetoLink[];
  portalVisible?: boolean;
  portalPhase?: string;
  portalProgress?: number;
  portalUpdate?: string;
  portalNextMilestone?: string;
  portalCoverUrl?: string;
  portalUpdatedAt?: string;
}

export interface Tarefa {
  id: string;
  projetoId: string;
  titulo: string;
  descricao?: string;
  status: StatusTarefa; // fase/coluna do kanban
  concluida: boolean;   // toggle independente da fase
  responsavel: string;
  prazo?: string;
  prazoFim?: string;
  diaTodo?: boolean;
  prioridade: Prioridade;
  link?: string;        // URL de referência (Drive, Frame.io, Vimeo, doc…)
  criadoEm: string;
}

export interface Marco {
  id: string;
  projetoId: string;
  titulo: string;
  data: string;
  status: StatusMarco;
}

export interface Entregavel {
  id: string;
  projetoId: string;
  titulo: string;
  tipo: TipoEntregavel;
  status: StatusEntregavel;
  link?: string;        // URL do drive / dropbox / vimeo etc
  notas?: string;
  criadoEm: string;
}

export const FASES: Record<FaseProjeto, { label: string; classe: string; dot: string }> = {
  briefing:  { label: "Briefing",  classe: "border-info/40 bg-info/10 text-info",          dot: "bg-info" },
  pre:       { label: "Pré-produção", classe: "border-warning/40 bg-warning/10 text-warning", dot: "bg-warning" },
  captacao:  { label: "Captação",  classe: "border-primary/40 bg-primary/10 text-primary",  dot: "bg-primary" },
  edicao:    { label: "Edição",    classe: "border-purple-400/40 bg-purple-400/10 text-purple-300", dot: "bg-purple-400" },
  revisao:   { label: "Revisão",   classe: "border-amber-400/40 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  entrega:   { label: "Entrega",   classe: "border-success/40 bg-success/10 text-success", dot: "bg-success" },
  concluido: { label: "Concluído", classe: "border-muted-foreground/30 bg-muted/20 text-muted-foreground", dot: "bg-muted-foreground" },
  pausado:   { label: "Pausado",   classe: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

// Estilos para fases conhecidas; fases customizadas recebem estilo padrão
export const FASE_ESTILOS: Record<string, { label: string; classe: string }> = {
  briefing:     { label: "Briefing",      classe: "border-info/40 bg-info/10 text-info" },
  pre_producao: { label: "Pré-produção",  classe: "border-warning/40 bg-warning/10 text-warning" },
  captacao:     { label: "Captação",      classe: "border-primary/40 bg-primary/10 text-primary" },
  edicao:       { label: "Edição",        classe: "border-purple-400/40 bg-purple-400/10 text-purple-300" },
  revisao:      { label: "Revisão",       classe: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  entrega:      { label: "Entrega",       classe: "border-success/40 bg-success/10 text-success" },
  concluida:    { label: "Concluída",     classe: "border-muted-foreground/30 bg-muted/20 text-muted-foreground" },
};
export const formatarNomeFase = (fase: string) => {
  const nome = fase.replaceAll("_", " ").trim();
  return nome ? nome.charAt(0).toLocaleUpperCase("pt-BR") + nome.slice(1) : fase;
};

export const getFaseInfo = (fase: string) =>
  FASE_ESTILOS[fase] ?? { label: formatarNomeFase(fase), classe: "border-border bg-surface-2 text-muted-foreground" };

// Mantido por compatibilidade com tarefa-modal
export const STATUS_TAREFA = FASE_ESTILOS;

export const PRIORIDADES: Record<Prioridade, { label: string; classe: string }> = {
  baixa:   { label: "Baixa",   classe: "text-muted-foreground" },
  media:   { label: "Média",   classe: "text-info" },
  alta:    { label: "Alta",    classe: "text-warning" },
  urgente: { label: "Urgente", classe: "text-destructive" },
};

export const TIPOS_ENTREGAVEL: Record<TipoEntregavel, { label: string }> = {
  video:  { label: "Vídeo" },
  foto:   { label: "Foto" },
  doc:    { label: "Documento" },
  design: { label: "Design" },
  audio:  { label: "Áudio" },
  outro:  { label: "Outro" },
};

export const TIPO_ENTREGAVEL_ICONS: Record<TipoEntregavel, LucideIcon> = {
  video:  Film,
  foto:   Camera,
  doc:    FileText,
  design: Palette,
  audio:  Headphones,
  outro:  Paperclip,
};

export const STATUS_ENTREGAVEL: Record<StatusEntregavel, { label: string; classe: string }> = {
  pendente:    { label: "Pendente",    classe: "border-border bg-surface-2 text-muted-foreground" },
  em_revisao:  { label: "Em revisão",  classe: "border-warning/40 bg-warning/10 text-warning" },
  aprovado:    { label: "Aprovado",    classe: "border-info/40 bg-info/10 text-info" },
  entregue:    { label: "Entregue",    classe: "border-success/40 bg-success/10 text-success" },
};

const now = new Date();
const d = (offset: number) => { const x = new Date(now); x.setDate(x.getDate() + offset); x.setHours(10, 0, 0, 0); return x.toISOString(); };

let projetos: Projeto[] = [
  { id: "pr1", nome: "Vibe Q1 — Conteúdo mensal", cliente: "Vibe Cosméticos", descricao: "Pacote de 12 reels + 4 carrosséis por mês.", fase: "captacao", progresso: 0, fases: [...FASES_PADRAO], equipe: ["Você", "Ana", "Pedro"], dataInicio: d(-20), dataEntrega: d(18), valor: 32000, cor: "primary", criadoEm: d(-25),
    notas: "Cliente prefere edições com cortes secos. Aprovação sempre via WhatsApp do Bruno (gerente de mkt).",
    links: [
      { id: "ln1", label: "Pasta raiz no Drive", url: "https://drive.google.com/drive/folders/example-vibe" },
      { id: "ln2", label: "Brief Q1 (PDF)", url: "https://drive.google.com/file/d/example-brief" },
    ],
  },
  { id: "pr2", nome: "Olympus — Documentário curto", cliente: "Studio Olympus", descricao: "Documentário de 15min sobre nova marca.", fase: "edicao", progresso: 0, fases: [...FASES_PADRAO], equipe: ["Você", "Lucas"], dataInicio: d(-30), dataEntrega: d(7), valor: 26500, cor: "info", criadoEm: d(-32), links: [{ id: "ln3", label: "Raw footage", url: "https://drive.google.com/drive/folders/example-olympus" }] },
  { id: "pr3", nome: "Fresh Burger — Reels Pack", cliente: "Fresh Burger Co.", descricao: "8 reels para campanha de lançamento.", fase: "briefing", progresso: 0, fases: [...FASES_PADRAO], equipe: ["Ana"], dataInicio: d(-2), dataEntrega: d(30), valor: 18500, cor: "warning", criadoEm: d(-3) },
  { id: "pr4", nome: "Atlas — Tour 360 lançamento", cliente: "Atlas Imóveis", descricao: "Tour virtual + vídeo institucional.", fase: "pre", progresso: 0, fases: [...FASES_PADRAO], equipe: ["Você", "Pedro", "Lucas"], dataInicio: d(-10), dataEntrega: d(22), valor: 65000, cor: "success", criadoEm: d(-12) },
];

let tarefas: Tarefa[] = [
  // pr1 — Vibe Q1 (Captação) — 2 concluídas = 50%
  { id: "tk1",  projetoId: "pr1", titulo: "Reunião de kickoff com o cliente",      status: "briefing",     concluida: true,  responsavel: "Você",  prioridade: "alta",    criadoEm: d(-20) },
  { id: "tk8",  projetoId: "pr1", titulo: "Roteiro e pauta de março",              status: "pre_producao", concluida: true,  responsavel: "Ana",   prioridade: "media",   criadoEm: d(-15) },
  { id: "tk9",  projetoId: "pr1", titulo: "Decupagem das captações de ontem",      status: "captacao",     concluida: false, responsavel: "Pedro", prazo: d(0),  prioridade: "alta",  criadoEm: d(-2) },
  { id: "tk2",  projetoId: "pr1", titulo: "Roteiro pauta abril",                   status: "pre_producao", concluida: false, responsavel: "Ana",   prazo: d(2),  prioridade: "media", criadoEm: d(-1) },
  // pr2 — Olympus (Edição) — 3 concluídas = 60%
  { id: "tk10", projetoId: "pr2", titulo: "Captação principal — dia 1",            status: "captacao",     concluida: true,  responsavel: "Você",  prioridade: "alta",    criadoEm: d(-28) },
  { id: "tk11", projetoId: "pr2", titulo: "Captação — dia 2 e backup footage",     status: "captacao",     concluida: true,  responsavel: "Lucas", prioridade: "media",   criadoEm: d(-20) },
  { id: "tk12", projetoId: "pr2", titulo: "Primeiro corte — montagem offline",     status: "edicao",       concluida: true,  responsavel: "Lucas", prioridade: "alta",    criadoEm: d(-10) },
  { id: "tk3",  projetoId: "pr2", titulo: "Color grading episódio 02",             status: "edicao",       concluida: false, responsavel: "Lucas", prazo: d(1),  prioridade: "alta",  criadoEm: d(-3) },
  { id: "tk4",  projetoId: "pr2", titulo: "Aprovação cliente — corte final",       status: "revisao",      concluida: false, responsavel: "Você",  prazo: d(3),  prioridade: "media", criadoEm: d(-1) },
  // pr3 — Fresh Burger (Briefing) — 0 concluídas = 0%
  { id: "tk5",  projetoId: "pr3", titulo: "Reunião de briefing",                   status: "briefing",     concluida: false, responsavel: "Ana",   prazo: d(1),  prioridade: "alta",  criadoEm: d(-1) },
  { id: "tk13", projetoId: "pr3", titulo: "Envio de proposta criativa",            status: "briefing",     concluida: false, responsavel: "Você",  prazo: d(4),  prioridade: "media", criadoEm: d(-1) },
  // pr4 — Atlas (Pré-produção) — 1 concluída = 25%
  { id: "tk14", projetoId: "pr4", titulo: "Reunião de alinhamento com Atlas",      status: "briefing",     concluida: true,  responsavel: "Você",  prioridade: "alta",    criadoEm: d(-10) },
  { id: "tk6",  projetoId: "pr4", titulo: "Locação — visita técnica",              status: "pre_producao", concluida: false, responsavel: "Você",  prazo: d(0),  prioridade: "urgente", criadoEm: d(-2) },
  { id: "tk7",  projetoId: "pr4", titulo: "Casting de apresentador",               status: "pre_producao", concluida: false, responsavel: "Pedro", prazo: d(5),  prioridade: "media", criadoEm: d(-1) },
  { id: "tk15", projetoId: "pr4", titulo: "Storyboard e plano de câmera",          status: "pre_producao", concluida: false, responsavel: "Lucas", prazo: d(7),  prioridade: "media", criadoEm: d(-1) },
];

let marcos: Marco[] = [
  { id: "mk1", projetoId: "pr1", titulo: "Entrega lote 1 — Vibe", data: d(8), status: "pendente" },
  { id: "mk2", projetoId: "pr1", titulo: "Entrega final — Vibe", data: d(18), status: "pendente" },
  { id: "mk3", projetoId: "pr2", titulo: "Corte final Olympus", data: d(7), status: "pendente" },
  { id: "mk4", projetoId: "pr4", titulo: "Captação principal Atlas", data: d(12), status: "pendente" },
];

let entregaveis: Entregavel[] = [
  { id: "en1", projetoId: "pr1", titulo: "Reel #01 — Hidratante Vibe", tipo: "video", status: "aprovado", link: "https://drive.google.com/file/d/example-reel-01", notas: "Versão final aprovada pelo Bruno em 02/04.", criadoEm: d(-10) },
  { id: "en2", projetoId: "pr1", titulo: "Reel #02 — Skincare matinal", tipo: "video", status: "em_revisao", link: "https://drive.google.com/file/d/example-reel-02", criadoEm: d(-5) },
  { id: "en3", projetoId: "pr1", titulo: "Carrossel — Lançamento sérum", tipo: "design", status: "pendente", criadoEm: d(-2) },
  { id: "en4", projetoId: "pr2", titulo: "Corte 1 — Documentário Olympus", tipo: "video", status: "em_revisao", link: "https://drive.google.com/file/d/example-olympus-v1", criadoEm: d(-6) },
  { id: "en5", projetoId: "pr2", titulo: "Trilha sonora original", tipo: "audio", status: "entregue", link: "https://drive.google.com/file/d/example-trilha", criadoEm: d(-15) },
];

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => listeners.forEach(l => l());

interface Snap { projetos: Projeto[]; tarefas: Tarefa[]; marcos: Marco[]; entregaveis: Entregavel[] }
let snap: Snap = { projetos, tarefas, marcos, entregaveis };
const rebuildSnap = () => { snap = { projetos, tarefas, marcos, entregaveis }; };
const snapshot = () => snap;

export const useProjetos = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/* ============== Sync com agenda ============== */
const tarefaParaEvento = (t: Tarefa, projeto?: Projeto): Omit<import("./agenda").Evento, "id" | "criadoEm" | "refTipo" | "refId"> => {
  const inicio = new Date(t.prazo!);
  const fim = new Date(inicio); fim.setHours(inicio.getHours() + 1);
  return {
    titulo: `${t.titulo}${projeto ? ` · ${projeto.nome}` : ""}`,
    descricao: t.descricao,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    tipo: "tarefa" satisfies TipoEvento,
    participantes: [t.responsavel],
  };
};

const marcoParaEvento = (m: Marco, projeto?: Projeto): Omit<import("./agenda").Evento, "id" | "criadoEm" | "refTipo" | "refId"> => {
  const inicio = new Date(m.data);
  const fim = new Date(inicio); fim.setHours(inicio.getHours() + 1);
  return {
    titulo: `🚩 ${m.titulo}${projeto ? ` · ${projeto.nome}` : ""}`,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    tipo: "entrega" satisfies TipoEvento,
  };
};

const syncTarefa = (t: Tarefa) => {
  const projeto = projetos.find(p => p.id === t.projetoId);
  if (t.prazo && t.status !== "concluida") {
    agendaActions.upsertPorRef("tarefa", t.id, tarefaParaEvento(t, projeto));
  } else {
    agendaActions.removerPorRef("tarefa", t.id);
  }
};

const syncMarco = (m: Marco) => {
  const projeto = projetos.find(p => p.id === m.projetoId);
  if (m.status !== "concluido") {
    agendaActions.upsertPorRef("marco", m.id, marcoParaEvento(m, projeto));
  } else {
    agendaActions.removerPorRef("marco", m.id);
  }
};

// Sync inicial — popula a agenda com tarefas/marcos do seed
tarefas.forEach(syncTarefa);
marcos.forEach(syncMarco);

/* ============== Helpers ============== */
const recalcProgresso = (projetoId: string): number => {
  const ts = tarefas.filter(t => t.projetoId === projetoId);
  if (ts.length === 0) return 0;
  const feitas = ts.filter(t => t.concluida).length;
  return Math.round((feitas / ts.length) * 100);
};

const aplicarProgresso = () => {
  projetos = projetos.map(p => ({
    ...p,
    fases: p.fases ?? [...FASES_PADRAO],
    progresso: recalcProgresso(p.id),
  }));
};

aplicarProgresso();
rebuildSnap();

/* ============== Actions ============== */
export const projetosActions = {
  criarProjeto(input: Omit<Projeto, "id" | "criadoEm" | "progresso">) {
    const novo: Projeto = { ...input, fases: input.fases ?? [...FASES_PADRAO], id: `pr${Date.now()}`, criadoEm: new Date().toISOString(), progresso: 0 };
    projetos = [...projetos, novo];
    rebuildSnap(); emit();
    return novo;
  },
  atualizarProjeto(id: string, patch: Partial<Projeto>) {
    projetos = projetos.map(p => (p.id === id ? { ...p, ...patch } : p));
    aplicarProgresso();
    // re-sync títulos de eventos (nome do projeto pode ter mudado)
    tarefas.filter(t => t.projetoId === id).forEach(syncTarefa);
    marcos.filter(m => m.projetoId === id).forEach(syncMarco);
    rebuildSnap(); emit();
  },
  removerProjeto(id: string) {
    tarefas.filter(t => t.projetoId === id).forEach(t => agendaActions.removerPorRef("tarefa", t.id));
    marcos.filter(m => m.projetoId === id).forEach(m => agendaActions.removerPorRef("marco", m.id));
    projetos = projetos.filter(p => p.id !== id);
    tarefas = tarefas.filter(t => t.projetoId !== id);
    marcos = marcos.filter(m => m.projetoId !== id);
    rebuildSnap(); emit();
  },

  criarTarefa(input: Omit<Tarefa, "id" | "criadoEm">) {
    const nova: Tarefa = { ...input, concluida: input.concluida ?? false, id: `tk${Date.now()}`, criadoEm: new Date().toISOString() };
    tarefas = [...tarefas, nova];
    syncTarefa(nova);
    aplicarProgresso();
    rebuildSnap(); emit();
    return nova;
  },
  atualizarTarefa(id: string, patch: Partial<Tarefa>) {
    tarefas = tarefas.map(t => (t.id === id ? { ...t, ...patch } : t));
    const t = tarefas.find(x => x.id === id);
    if (t) syncTarefa(t);
    aplicarProgresso();
    rebuildSnap(); emit();
  },
  removerTarefa(id: string) {
    agendaActions.removerPorRef("tarefa", id);
    tarefas = tarefas.filter(t => t.id !== id);
    aplicarProgresso();
    rebuildSnap(); emit();
  },

  criarMarco(input: Omit<Marco, "id">) {
    const novo: Marco = { ...input, id: `mk${Date.now()}` };
    marcos = [...marcos, novo];
    syncMarco(novo);
    rebuildSnap(); emit();
    return novo;
  },
  atualizarMarco(id: string, patch: Partial<Marco>) {
    marcos = marcos.map(m => (m.id === id ? { ...m, ...patch } : m));
    const m = marcos.find(x => x.id === id);
    if (m) syncMarco(m);
    rebuildSnap(); emit();
  },
  removerMarco(id: string) {
    agendaActions.removerPorRef("marco", id);
    marcos = marcos.filter(m => m.id !== id);
    rebuildSnap(); emit();
  },

  criarEntregavel(input: Omit<Entregavel, "id" | "criadoEm">) {
    const novo: Entregavel = { ...input, id: `en${Date.now()}`, criadoEm: new Date().toISOString() };
    entregaveis = [...entregaveis, novo];
    rebuildSnap(); emit();
    return novo;
  },
  atualizarEntregavel(id: string, patch: Partial<Entregavel>) {
    entregaveis = entregaveis.map(e => (e.id === id ? { ...e, ...patch } : e));
    rebuildSnap(); emit();
  },
  removerEntregavel(id: string) {
    entregaveis = entregaveis.filter(e => e.id !== id);
    rebuildSnap(); emit();
  },

  adicionarFase(projetoId: string, fase: string) {
    projetos = projetos.map(p => {
      if (p.id !== projetoId) return p;
      const fases = p.fases ?? [...FASES_PADRAO];
      const key = fase.toLowerCase().replace(/\s+/g, "_");
      if (fases.includes(key)) return p;
      const idx = fases.indexOf("concluida");
      const novas = [...fases];
      idx >= 0 ? novas.splice(idx, 0, key) : novas.push(key);
      if (!FASE_ESTILOS[key]) FASE_ESTILOS[key] = { label: fase, classe: "border-border bg-surface-2 text-muted-foreground" };
      return { ...p, fases: novas };
    });
    rebuildSnap(); emit();
  },
  moverFase(projetoId: string, fase: string, direcao: -1 | 1) {
    projetos = projetos.map(p => {
      if (p.id !== projetoId) return p;
      const fases = p.fases ?? [...FASES_PADRAO];
      const idx = fases.indexOf(fase);
      const novoIdx = idx + direcao;
      if (idx < 0 || novoIdx < 0 || novoIdx >= fases.length) return p;
      const novas = [...fases];
      [novas[idx], novas[novoIdx]] = [novas[novoIdx], novas[idx]];
      return { ...p, fases: novas };
    });
    rebuildSnap(); emit();
  },
  removerFase(projetoId: string, fase: string) {
    projetos = projetos.map(p => {
      if (p.id !== projetoId) return p;
      const fases = p.fases ?? [...FASES_PADRAO];
      const idx = fases.indexOf(fase);
      const fallback = fases[idx - 1] ?? "concluida";
      tarefas = tarefas.map(t => t.projetoId === projetoId && t.status === fase ? { ...t, status: fallback } : t);
      return { ...p, fases: fases.filter(f => f !== fase) };
    });
    rebuildSnap(); emit();
  },
  adicionarLink(projetoId: string, label: string, url: string) {
    const link: ProjetoLink = { id: `ln${Date.now()}`, label, url };
    projetos = projetos.map(p => p.id === projetoId ? { ...p, links: [...(p.links ?? []), link] } : p);
    rebuildSnap(); emit();
  },
  removerLink(projetoId: string, linkId: string) {
    projetos = projetos.map(p => p.id === projetoId ? { ...p, links: (p.links ?? []).filter(l => l.id !== linkId) } : p);
    rebuildSnap(); emit();
  },
};

export const getProjeto = (id: string) => projetos.find(p => p.id === id);
export const getTarefasDoProjeto = (id: string) => tarefas.filter(t => t.projetoId === id);
export const getMarcosDoProjeto = (id: string) => marcos.filter(m => m.projetoId === id);
export const getEntregaveisDoProjeto = (id: string) => entregaveis.filter(e => e.projetoId === id);
