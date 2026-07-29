// MakersHub — Mock store do módulo Comercial
// Em memória, com subscribe para reatividade. Sem persistência.

import { useSyncExternalStore } from "react";

export type EtapaJornada =
  | "novo"
  | "diagnostico"
  | "reuniao"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export type Temperatura = "frio" | "morno" | "quente";

export interface Empresa {
  id: string;
  nome: string;
  segmento: string;
  cidade: string;
  site?: string;
  instagram?: string;
  observacoes?: string;
  accentColor?: string;
  arquivado?: boolean;
  status?: "prospect" | "cliente" | "inativo";
}

export interface Contato {
  id: string;
  empresaId: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  principal?: boolean;
}

export type TimelineTipo =
  | "criado"
  | "ligacao"
  | "reuniao"
  | "whatsapp"
  | "email"
  | "proposta_enviada"
  | "observacao"
  | "etapa_mudou"
  | "fechado"
  | "perdido"
  | "arquivado"
  | "restaurado";

export interface TimelineEvent {
  id: string;
  leadId: string;
  tipo: TimelineTipo;
  titulo: string;
  descricao?: string;
  quando: string; // ISO
  autor: string;
}

export interface Tarefa {
  id: string;
  leadId: string;
  titulo: string;
  responsavel: string;
  prazo: string;
  feita: boolean;
}

export interface ProximaAcao {
  titulo: string;
  data: string; // ISO
}

export interface Lead {
  id: string;
  empresaId: string;
  contatoId: string;
  etapa: EtapaJornada;
  valor: number;
  responsavel: string;
  temperatura: Temperatura;
  origem: string;
  proximaAcao: ProximaAcao | null;
  observacoes?: string;
  criadoEm: string;
  arquivadoEm?: string;
  arquivadoPor?: string;
  motivoArquivamento?: string;
  etapaAntesArquivar?: EtapaJornada;
  // Relacionamentos mock
  propostasIds: string[];
  contratosIds: string[];
  projetosIds: string[];
  lancamentosIds: string[];
}

// ---------- Seed ----------
const today = new Date();
const d = (offset: number, h = 9) => {
  const x = new Date(today);
  x.setDate(x.getDate() + offset);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};

const empresasSeed: Empresa[] = [
  {
    id: "e1",
    nome: "Nova Marca Bebidas",
    segmento: "Bebidas",
    cidade: "São Paulo, SP",
    instagram: "@novamarca",
    site: "novamarca.com",
  },
  {
    id: "e2",
    nome: "Studio Olympus",
    segmento: "Produção musical",
    cidade: "Rio de Janeiro, RJ",
    instagram: "@studioolympus",
  },
  {
    id: "e3",
    nome: "Vibe Cosméticos",
    segmento: "Beleza",
    cidade: "São Paulo, SP",
    instagram: "@vibe.oficial",
    site: "vibe.com.br",
  },
  {
    id: "e4",
    nome: "Atlas Imóveis",
    segmento: "Imobiliária",
    cidade: "Belo Horizonte, MG",
    site: "atlasimoveis.com",
  },
  {
    id: "e5",
    nome: "Fresh Burger Co.",
    segmento: "Alimentação",
    cidade: "Joinville, SC",
    instagram: "@freshburgerco",
  },
  {
    id: "e6",
    nome: "Orbital Tech",
    segmento: "Tecnologia",
    cidade: "São Paulo, SP",
    site: "orbital.tech",
  },
  { id: "e7", nome: "REMAX Premier", segmento: "Imobiliária", cidade: "Curitiba, PR" },
  { id: "e8", nome: "Casa Boa Construtora", segmento: "Construção", cidade: "Goiânia, GO" },
  {
    id: "e9",
    nome: "Estúdio Lume",
    segmento: "Arquitetura",
    cidade: "Porto Alegre, RS",
    instagram: "@estudiolume",
  },
  {
    id: "e10",
    nome: "Banda Coraline",
    segmento: "Música",
    cidade: "São Paulo, SP",
    instagram: "@bandacoraline",
  },
];

const contatosSeed: Contato[] = [
  {
    id: "ct1",
    empresaId: "e1",
    nome: "Marina Costa",
    cargo: "Diretora de Marketing",
    email: "marina@novamarca.com",
    telefone: "+55 11 99812-3344",
    principal: true,
  },
  {
    id: "ct2",
    empresaId: "e1",
    nome: "Tiago Reis",
    cargo: "Coordenador de Brand",
    email: "tiago@novamarca.com",
    telefone: "+55 11 99123-4421",
  },
  {
    id: "ct3",
    empresaId: "e2",
    nome: "Rafael Andrade",
    cargo: "Produtor Executivo",
    email: "rafa@olympus.tv",
    telefone: "+55 21 99654-8821",
    principal: true,
  },
  {
    id: "ct4",
    empresaId: "e3",
    nome: "Beatriz Lemos",
    cargo: "Head de Conteúdo",
    email: "bia@vibe.com.br",
    telefone: "+55 11 98123-7766",
    principal: true,
  },
  {
    id: "ct5",
    empresaId: "e3",
    nome: "Henrique Sá",
    cargo: "Social Media",
    email: "henrique@vibe.com.br",
    telefone: "+55 11 98221-7711",
  },
  {
    id: "ct6",
    empresaId: "e4",
    nome: "Carlos Menezes",
    cargo: "CEO",
    email: "carlos@atlas.com",
    telefone: "+55 31 99887-2210",
    principal: true,
  },
  {
    id: "ct7",
    empresaId: "e5",
    nome: "Júlia Tavares",
    cargo: "Marketing",
    email: "julia@freshburger.com",
    telefone: "+55 47 98456-1199",
    principal: true,
  },
  {
    id: "ct8",
    empresaId: "e6",
    nome: "Henrique Paiva",
    cargo: "CMO",
    email: "henrique@orbital.tech",
    telefone: "+55 11 99001-4488",
    principal: true,
  },
  {
    id: "ct9",
    empresaId: "e7",
    nome: "João Silva",
    cargo: "Corretor sênior",
    email: "joao@remaxpremier.com",
    telefone: "+55 41 99812-7755",
    principal: true,
  },
  {
    id: "ct10",
    empresaId: "e7",
    nome: "Maria Oliveira",
    cargo: "Diretora",
    email: "maria@remaxpremier.com",
    telefone: "+55 41 98321-6644",
  },
  {
    id: "ct11",
    empresaId: "e7",
    nome: "Pedro Costa",
    cargo: "Marketing",
    email: "pedro@remaxpremier.com",
    telefone: "+55 41 98712-3398",
  },
  {
    id: "ct12",
    empresaId: "e8",
    nome: "Ana Resende",
    cargo: "Sócia",
    email: "ana@casaboa.com",
    telefone: "+55 62 99311-2244",
    principal: true,
  },
  {
    id: "ct13",
    empresaId: "e9",
    nome: "Luiza Krieger",
    cargo: "Arquiteta titular",
    email: "luiza@estudiolume.com",
    telefone: "+55 51 98876-1133",
    principal: true,
  },
  {
    id: "ct14",
    empresaId: "e10",
    nome: "Diego Falcão",
    cargo: "Vocalista / Manager",
    email: "diego@bandacoraline.com",
    telefone: "+55 11 98112-4477",
    principal: true,
  },
];

const leadsSeed: Lead[] = [
  {
    id: "L1",
    empresaId: "e1",
    contatoId: "ct1",
    etapa: "negociacao",
    valor: 48000,
    responsavel: "Você",
    temperatura: "quente",
    origem: "Instagram",
    proximaAcao: { titulo: "Enviar proposta revisada", data: d(0, 16) },
    observacoes: "Quer rodar campanha de verão em janeiro. Tem urgência.",
    criadoEm: d(-12),
    propostasIds: ["p1"],
    contratosIds: ["k2"],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L2",
    empresaId: "e2",
    contatoId: "ct3",
    etapa: "reuniao",
    valor: 22000,
    responsavel: "Ana",
    temperatura: "morno",
    origem: "Indicação",
    proximaAcao: { titulo: "Call de diagnóstico", data: d(1, 10) },
    criadoEm: d(-6),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L3",
    empresaId: "e4",
    contatoId: "ct6",
    etapa: "proposta",
    valor: 65000,
    responsavel: "Você",
    temperatura: "quente",
    origem: "Site",
    proximaAcao: { titulo: "Apresentar proposta — tour 360 lançamento", data: d(2, 14) },
    observacoes: "Lançamento previsto para abril. Precisa de tour 360 + reels.",
    criadoEm: d(-18),
    propostasIds: [],
    contratosIds: [],
    projetosIds: ["pr4"],
    lancamentosIds: [],
  },
  {
    id: "L4",
    empresaId: "e6",
    contatoId: "ct8",
    etapa: "diagnostico",
    valor: 38000,
    responsavel: "Você",
    temperatura: "morno",
    origem: "LinkedIn",
    proximaAcao: { titulo: "Follow-up por e-mail", data: d(-1, 11) },
    criadoEm: d(-9),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L5",
    empresaId: "e7",
    contatoId: "ct9",
    etapa: "novo",
    valor: 12000,
    responsavel: "Ana",
    temperatura: "frio",
    origem: "Indicação",
    proximaAcao: { titulo: "Mandar apresentação institucional", data: d(0, 18) },
    criadoEm: d(-1),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L6",
    empresaId: "e8",
    contatoId: "ct12",
    etapa: "novo",
    valor: 26000,
    responsavel: "Você",
    temperatura: "morno",
    origem: "Site",
    proximaAcao: null,
    criadoEm: d(-2),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L7",
    empresaId: "e9",
    contatoId: "ct13",
    etapa: "negociacao",
    valor: 18500,
    responsavel: "Ana",
    temperatura: "quente",
    origem: "Instagram",
    proximaAcao: { titulo: "Fechar valor por reel", data: d(1, 15) },
    criadoEm: d(-22),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L8",
    empresaId: "e10",
    contatoId: "ct14",
    etapa: "proposta",
    valor: 9500,
    responsavel: "Você",
    temperatura: "morno",
    origem: "WhatsApp",
    proximaAcao: { titulo: "Acompanhar leitura da proposta", data: d(0, 17) },
    criadoEm: d(-4),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
  {
    id: "L9",
    empresaId: "e3",
    contatoId: "ct4",
    etapa: "fechado",
    valor: 32000,
    responsavel: "Você",
    temperatura: "quente",
    origem: "Indicação",
    proximaAcao: null,
    observacoes: "Conta retomada — Q1 fechado.",
    criadoEm: d(-30),
    propostasIds: ["p2"],
    contratosIds: ["k1"],
    projetosIds: ["pr1"],
    lancamentosIds: ["f1", "f2"],
  },
  {
    id: "L10",
    empresaId: "e5",
    contatoId: "ct7",
    etapa: "reuniao",
    valor: 18500,
    responsavel: "Ana",
    temperatura: "morno",
    origem: "Instagram",
    proximaAcao: { titulo: "Reunião de briefing — Reels Pack", data: d(2, 9) },
    criadoEm: d(-3),
    propostasIds: ["p3"],
    contratosIds: [],
    projetosIds: ["pr3"],
    lancamentosIds: [],
  },
  {
    id: "L11",
    empresaId: "e4",
    contatoId: "ct6",
    etapa: "perdido",
    valor: 14000,
    responsavel: "Você",
    temperatura: "frio",
    origem: "Site",
    proximaAcao: null,
    observacoes: "Sem budget esse trimestre.",
    criadoEm: d(-45),
    propostasIds: [],
    contratosIds: [],
    projetosIds: [],
    lancamentosIds: [],
  },
];

const timelineSeed: TimelineEvent[] = [
  {
    id: "tl1",
    leadId: "L1",
    tipo: "criado",
    titulo: "Lead criado",
    quando: d(-12, 10),
    autor: "Você",
  },
  {
    id: "tl2",
    leadId: "L1",
    tipo: "whatsapp",
    titulo: "WhatsApp enviado",
    descricao: "Mandei material institucional e cases.",
    quando: d(-11, 15),
    autor: "Você",
  },
  {
    id: "tl3",
    leadId: "L1",
    tipo: "reuniao",
    titulo: "Reunião concluída",
    descricao: "Briefing inicial — campanha de verão.",
    quando: d(-8, 14),
    autor: "Você",
  },
  {
    id: "tl4",
    leadId: "L1",
    tipo: "proposta_enviada",
    titulo: "Proposta enviada",
    descricao: "R$ 48.000 — Campanha Verão",
    quando: d(-3, 11),
    autor: "Você",
  },
  {
    id: "tl5",
    leadId: "L1",
    tipo: "ligacao",
    titulo: "Ligação realizada",
    descricao: "Marina pediu ajustes na proposta.",
    quando: d(-1, 16),
    autor: "Você",
  },
  {
    id: "tl6",
    leadId: "L1",
    tipo: "etapa_mudou",
    titulo: "Movido para Negociação",
    quando: d(-1, 16),
    autor: "Você",
  },
  {
    id: "tl7",
    leadId: "L2",
    tipo: "criado",
    titulo: "Lead criado",
    quando: d(-6, 9),
    autor: "Ana",
  },
  {
    id: "tl8",
    leadId: "L2",
    tipo: "email",
    titulo: "E-mail enviado",
    descricao: "Apresentação inicial.",
    quando: d(-5, 14),
    autor: "Ana",
  },
  {
    id: "tl9",
    leadId: "L3",
    tipo: "criado",
    titulo: "Lead criado",
    quando: d(-18, 10),
    autor: "Você",
  },
  {
    id: "tl10",
    leadId: "L3",
    tipo: "reuniao",
    titulo: "Reunião concluída",
    descricao: "Diagnóstico inicial.",
    quando: d(-10, 11),
    autor: "Você",
  },
  {
    id: "tl11",
    leadId: "L3",
    tipo: "observacao",
    titulo: "Observação adicionada",
    descricao: "Cliente quer fechar pacote anual.",
    quando: d(-7, 18),
    autor: "Você",
  },
];

const tarefasSeed: Tarefa[] = [
  {
    id: "tk1",
    leadId: "L1",
    titulo: "Revisar proposta com novos valores",
    responsavel: "Você",
    prazo: d(0, 18),
    feita: false,
  },
  {
    id: "tk2",
    leadId: "L1",
    titulo: "Confirmar reunião de fechamento",
    responsavel: "Você",
    prazo: d(2, 10),
    feita: false,
  },
  {
    id: "tk3",
    leadId: "L3",
    titulo: "Montar apresentação visual",
    responsavel: "Ana",
    prazo: d(1, 17),
    feita: true,
  },
];

// ---------- Store reativo ----------
type State = {
  empresas: Empresa[];
  contatos: Contato[];
  leads: Lead[];
  timeline: TimelineEvent[];
  tarefas: Tarefa[];
};

let state: State = {
  empresas: empresasSeed,
  contatos: contatosSeed,
  leads: leadsSeed,
  timeline: timelineSeed,
  tarefas: tarefasSeed,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getSnapshot = () => state;

export function useComercial<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export const comercial = {
  moverEtapa(leadId: string, etapa: EtapaJornada) {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa === etapa) return;
    const anterior = lead.etapa;
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === leadId ? { ...l, etapa } : l)),
      timeline: [
        ...state.timeline,
        {
          id: `tl-${Date.now()}`,
          leadId,
          tipo: "etapa_mudou",
          titulo: `Movido de ${labelEtapa(anterior)} → ${labelEtapa(etapa)}`,
          quando: new Date().toISOString(),
          autor: "Você",
        },
      ],
    };
    emit();
  },
  addEvento(
    leadId: string,
    ev: Omit<TimelineEvent, "id" | "leadId" | "quando" | "autor"> & {
      quando?: string;
      autor?: string;
    },
  ) {
    state = {
      ...state,
      timeline: [
        ...state.timeline,
        {
          id: `tl-${Date.now()}`,
          leadId,
          quando: ev.quando ?? new Date().toISOString(),
          autor: ev.autor ?? "Você",
          tipo: ev.tipo,
          titulo: ev.titulo,
          descricao: ev.descricao,
        },
      ],
    };
    emit();
  },
  addTarefa(leadId: string, titulo: string, prazo: string, responsavel = "Você") {
    state = {
      ...state,
      tarefas: [
        ...state.tarefas,
        { id: `tk-${Date.now()}`, leadId, titulo, responsavel, prazo, feita: false },
      ],
    };
    emit();
  },
  toggleTarefa(id: string) {
    state = {
      ...state,
      tarefas: state.tarefas.map((t) => (t.id === id ? { ...t, feita: !t.feita } : t)),
    };
    emit();
  },
  setProximaAcao(leadId: string, acao: ProximaAcao | null) {
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === leadId ? { ...l, proximaAcao: acao } : l)),
    };
    emit();
  },
  setObservacoes(leadId: string, observacoes: string) {
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === leadId ? { ...l, observacoes } : l)),
    };
    emit();
  },
  setTemperatura(leadId: string, temperatura: Temperatura) {
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === leadId ? { ...l, temperatura } : l)),
    };
    emit();
  },
  updateLead(
    leadId: string,
    patch: Partial<Pick<Lead, "valor" | "responsavel" | "origem" | "temperatura">>,
  ) {
    state = { ...state, leads: state.leads.map((l) => (l.id === leadId ? { ...l, ...patch } : l)) };
    emit();
  },
  updateEmpresa(empresaId: string, patch: Partial<Omit<Empresa, "id">>) {
    state = {
      ...state,
      empresas: state.empresas.map((e) => (e.id === empresaId ? { ...e, ...patch } : e)),
    };
    emit();
  },
  updateContato(contatoId: string, patch: Partial<Omit<Contato, "id" | "empresaId">>) {
    state = {
      ...state,
      contatos: state.contatos.map((c) => (c.id === contatoId ? { ...c, ...patch } : c)),
    };
    emit();
  },
  addContato(empresaId: string, dados: Omit<Contato, "id" | "empresaId">) {
    const id = `C${Date.now()}`;
    state = { ...state, contatos: [...state.contatos, { id, empresaId, ...dados }] };
    emit();
    return id;
  },
  criarLead(input: {
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
    const empresaId = `E${Date.now()}`;
    const contatoId = `C${Date.now()}`;
    const leadId = `L${Date.now()}`;
    const novaEmpresa: Empresa = {
      id: empresaId,
      nome: input.empresaNome,
      segmento: input.segmento || "Não informado",
      cidade: input.cidade || "Não informado",
    };
    const novoContato: Contato = {
      id: contatoId,
      empresaId,
      nome: input.contatoNome,
      cargo: "—",
      email: input.contatoEmail || "—",
      telefone: input.contatoTelefone || "—",
      principal: true,
    };
    const novoLead: Lead = {
      id: leadId,
      empresaId,
      contatoId,
      etapa: "novo",
      valor: input.valor,
      responsavel: input.responsavel,
      temperatura: input.temperatura,
      origem: input.origem,
      proximaAcao: null,
      criadoEm: new Date().toISOString(),
      propostasIds: [],
      contratosIds: [],
      projetosIds: [],
      lancamentosIds: [],
    };
    state = {
      ...state,
      empresas: [...state.empresas, novaEmpresa],
      contatos: [...state.contatos, novoContato],
      leads: [...state.leads, novoLead],
      timeline: [
        ...state.timeline,
        {
          id: `tl-${Date.now()}`,
          leadId,
          tipo: "criado",
          titulo: "Lead criado",
          descricao: input.empresaNome,
          quando: new Date().toISOString(),
          autor: input.responsavel,
        },
      ],
    };
    emit();
    return leadId;
  },
};

// ---------- Lead Score ----------
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

// ---------- Helpers ----------
export const ETAPAS: { id: EtapaJornada; label: string; cor: string }[] = [
  { id: "novo", label: "Novo Lead", cor: "var(--primary)" },
  { id: "diagnostico", label: "Diagnóstico", cor: "var(--primary)" },
  { id: "reuniao", label: "Reunião", cor: "var(--primary)" },
  { id: "proposta", label: "Proposta Enviada", cor: "var(--primary)" },
  { id: "negociacao", label: "Negociação", cor: "var(--primary)" },
  { id: "fechado", label: "Fechado", cor: "var(--success)" },
  { id: "perdido", label: "Perdido", cor: "var(--destructive)" },
];

export const labelEtapa = (e: EtapaJornada) => ETAPAS.find((x) => x.id === e)?.label ?? e;

export const getEmpresa = (id: string) => state.empresas.find((e) => e.id === id);
export const getContato = (id: string) => state.contatos.find((c) => c.id === id);
export const getContatosDaEmpresa = (empresaId: string) =>
  state.contatos.filter((c) => c.empresaId === empresaId);
export const getTimelineDoLead = (leadId: string) =>
  state.timeline
    .filter((t) => t.leadId === leadId)
    .sort((a, b) => b.quando.localeCompare(a.quando));
export const getTarefasDoLead = (leadId: string) =>
  state.tarefas.filter((t) => t.leadId === leadId).sort((a, b) => a.prazo.localeCompare(b.prazo));

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const getOrigensUnicas = () =>
  Array.from(new Set(state.leads.map((l) => l.origem).filter(Boolean)));
export const getResponsaveisUnicos = () =>
  Array.from(new Set(state.leads.map((l) => l.responsavel).filter(Boolean)));
