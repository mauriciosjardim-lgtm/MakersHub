// MakersHub — Métricas de Performance da Produtora
// Deriva indicadores dos stores existentes (financeiro, comercial, projetos).
// Campos marcados como "estimativa" ou "null" (sem fonte real ainda).

import { calcularMetricas, serieMensal, resumoFinanceiroMes, fmtBRL } from "./financeiro";
import { useFinanceiroSupa } from "@/lib/hooks/useFinanceiro";
import { useComercial, type EtapaJornada } from "@/lib/hooks/useComercial";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { loadMetas, progressoMes } from "./metas";
import { isProjetoAtivo, isProjetoConcluidoOuPausado } from "@/lib/mock/projetos";

export { fmtBRL };

export interface DeltaInfo {
  atual: number;
  anterior: number;
  deltaPct: number;
}

const delta = (atual: number, anterior: number): DeltaInfo => ({
  atual,
  anterior,
  deltaPct: anterior ? ((atual - anterior) / anterior) * 100 : 0,
});

/* ============ Visão Geral ============ */
export function useVisaoGeral() {
  // Performance = consolidado da empresa; o seletor de carteira só afeta o módulo Financeiro.
  const { lancamentos: lancs } = useFinanceiroSupa({ somenteEmpresa: true });
  const com = useComercial((s) => s);
  const pj = useProjetos();

  // Valores "do mês" pela competência (vencimento) — mesma fonte da Dashboard.
  const resumo = resumoFinanceiroMes(lancs);
  const progresso = progressoMes(loadMetas(), lancs);
  const receitaMes = resumo.receita;
  const lucroMes = resumo.lucro;
  const margemMes = resumo.margem;
  const projetosAtivos = pj.projetos.filter(isProjetoAtivo).length;
  const projetosCriticos = pj.projetos.filter((p) => {
    const diasAteEntrega = p.dataEntrega
      ? (new Date(p.dataEntrega).getTime() - Date.now()) / 86400000
      : Number.POSITIVE_INFINITY;
    return diasAteEntrega < 7 && p.progresso < 60;
  }).length;
  const clientesAtivos = new Set(
    pj.projetos.filter((p) => !isProjetoConcluidoOuPausado(p)).map((p) => p.cliente),
  ).size;

  const leadsFechados = com.leads.filter((l) => l.etapa === "fechado").length;
  const leadsPerdidos = com.leads.filter((l) => l.etapa === "perdido").length;
  const taxaConversao =
    leadsFechados + leadsPerdidos ? (leadsFechados / (leadsFechados + leadsPerdidos)) * 100 : 0;
  const ticketMedio = leadsFechados
    ? com.leads.filter((l) => l.etapa === "fechado").reduce((s, l) => s + l.valor, 0) /
      leadsFechados
    : 0;

  // Meta idêntica à Dashboard (progressoMes já aplica competência por vencimento).
  const pctMeta = progresso.atingiuMeta ? progresso.pctSuper : progresso.pctMeta;
  const metaExibida = progresso.atingiuMeta ? progresso.superMeta : progresso.meta;

  const saudeFinanceira = Math.min(100, Math.max(0, margemMes * 2));
  const saudeOperacional = Math.min(100, Math.max(0, 100 - projetosCriticos * 20));
  const saudeComercial = Math.min(100, Math.max(0, taxaConversao * 1.2));
  const saudeMeta = Math.min(100, pctMeta);
  const saudeEmpresa = Math.round(
    (saudeFinanceira + saudeOperacional + saudeComercial + saudeMeta) / 4,
  );

  return {
    receitaMes,
    lucroMes,
    margemMes,
    projetosAtivos,
    projetosCriticos,
    clientesAtivos,
    taxaConversao,
    ticketMedio,
    meta: metaExibida,
    pctMeta,
    saudeEmpresa,
    saudeFinanceira,
    saudeOperacional,
    saudeComercial,
    saudeMeta,
  };
}

/* ============ Comercial ============ */
export function usePerformanceComercial() {
  const com = useComercial((s) => s);
  const novos = com.leads.length;
  const ganhos = com.leads.filter((l) => l.etapa === "fechado").length;
  const perdidos = com.leads.filter((l) => l.etapa === "perdido").length;
  const propostasEnviadas = com.leads.filter((l) =>
    ["proposta", "negociacao", "fechado", "perdido"].includes(l.etapa),
  ).length;
  const conversao = ganhos + perdidos ? (ganhos / (ganhos + perdidos)) * 100 : 0;
  const ticketMedio = ganhos
    ? com.leads.filter((l) => l.etapa === "fechado").reduce((s, l) => s + l.valor, 0) / ganhos
    : 0;
  const emNegociacao = com.leads
    .filter((l) => !["fechado", "perdido"].includes(l.etapa))
    .reduce((s, l) => s + l.valor, 0);

  const etapas: { id: EtapaJornada; label: string; qtd: number; valor: number }[] = [
    { id: "novo", label: "Novo Lead", qtd: 0, valor: 0 },
    { id: "diagnostico", label: "Diagnóstico", qtd: 0, valor: 0 },
    { id: "reuniao", label: "Reunião", qtd: 0, valor: 0 },
    { id: "proposta", label: "Proposta", qtd: 0, valor: 0 },
    { id: "negociacao", label: "Negociação", qtd: 0, valor: 0 },
    { id: "fechado", label: "Fechado", qtd: 0, valor: 0 },
  ];
  for (const l of com.leads) {
    const e = etapas.find((x) => x.id === l.etapa);
    if (e) {
      e.qtd++;
      e.valor += l.valor;
    }
  }

  return {
    novos,
    ganhos,
    perdidos,
    propostasEnviadas,
    conversao,
    ticketMedio,
    emNegociacao,
    etapas,
  };
}

/* ============ Produção ============ */
export function usePerformanceProducao() {
  const pj = useProjetos();
  const ativos = pj.projetos.filter((p) => !isProjetoConcluidoOuPausado(p)).length;
  const concluidos = pj.projetos.filter((p) => p.arquivado || p.fase === "concluido").length;
  const atrasados = pj.projetos.filter(
    (p) =>
      p.dataEntrega &&
      new Date(p.dataEntrega) < new Date() &&
      !p.arquivado &&
      p.fase !== "concluido",
  ).length;
  const tarefasConcluidas = pj.tarefas.filter((t) => t.concluida).length;
  const tarefasPendentes = pj.tarefas.filter((t) => !t.concluida).length;

  const porColab = new Map<string, number>();
  pj.projetos.forEach((p) => p.equipe.forEach((c) => porColab.set(c, (porColab.get(c) || 0) + 1)));
  const colaboradores = Array.from(porColab.entries())
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  return { ativos, concluidos, atrasados, tarefasConcluidas, tarefasPendentes, colaboradores };
}

/* ============ Financeiro ============ */
export function usePerformanceFinanceiro() {
  const { lancamentos: lancs } = useFinanceiroSupa({ somenteEmpresa: true });
  const m = calcularMetricas(lancs);
  return { ...m };
}

/* ============ Clientes ============ */
export function usePerformanceClientes() {
  const pj = useProjetos();
  const { lancamentos: lancs } = useFinanceiroSupa({ somenteEmpresa: true });

  const map = new Map<string, { nome: string; receita: number; projetos: number; lucro: number }>();
  pj.projetos.forEach((p) => {
    const e = map.get(p.cliente) || { nome: p.cliente, receita: 0, projetos: 0, lucro: 0 };
    e.projetos++;
    e.receita += p.valor;
    map.set(p.cliente, e);
  });
  lancs.forEach((l) => {
    if (!l.cliente) return;
    const e = map.get(l.cliente);
    if (!e) return;
    if (l.tipo === "receita") e.lucro += l.valor;
    else e.lucro -= l.valor;
  });
  const arr = Array.from(map.values());
  return {
    porReceita: [...arr].sort((a, b) => b.receita - a.receita),
    porLucro: [...arr].sort((a, b) => b.lucro - a.lucro),
    total: arr.length,
  };
}

/* ============ Equipe ============ */
export function usePerformanceEquipe() {
  const pj = useProjetos();
  const equipe = new Map<
    string,
    { nome: string; projetos: number; tarefasFeitas: number; tarefasPendentes: number }
  >();
  pj.projetos.forEach((p) =>
    p.equipe.forEach((c) => {
      const e = equipe.get(c) || { nome: c, projetos: 0, tarefasFeitas: 0, tarefasPendentes: 0 };
      e.projetos++;
      equipe.set(c, e);
    }),
  );
  pj.tarefas.forEach((t) => {
    const e = equipe.get(t.responsavel);
    if (!e) return;
    if (t.concluida) e.tarefasFeitas++;
    else e.tarefasPendentes++;
  });
  return Array.from(equipe.values()).sort(
    (a, b) => b.tarefasFeitas + b.projetos - (a.tarefasFeitas + a.projetos),
  );
}

/* ============ Crescimento ============ */
export function usePerformanceCrescimento() {
  const { lancamentos: lancs } = useFinanceiroSupa({ somenteEmpresa: true });
  const serie = serieMensal(lancs);

  const last = serie[serie.length - 1];
  const prev = serie[serie.length - 2];
  return {
    serie: serie.map((s) => ({ mes: s.label, receita: s.receita, lucro: s.saldo })),
    receita: delta(last.receita, prev.receita),
    lucro: delta(last.saldo, prev.saldo),
  };
}

/* ============ Insights ============ */
export interface Insight {
  id: string;
  tipo: "positivo" | "alerta" | "neutro";
  titulo: string;
  descricao: string;
}

export function useInsights(): Insight[] {
  const vg = useVisaoGeral();
  const com = useComercial((s) => s);
  const insights: Insight[] = [];

  const temDados = com.leads.length > 0 || vg.receitaMes > 0 || vg.projetosAtivos > 0;
  if (!temDados) return [];

  if (vg.pctMeta >= 100)
    insights.push({
      id: "meta",
      tipo: "positivo",
      titulo: "Meta do mês atingida 🎯",
      descricao: `Você bateu ${vg.pctMeta.toFixed(0)}% da meta — parabéns.`,
    });
  else if (vg.pctMeta >= 70)
    insights.push({
      id: "meta",
      tipo: "positivo",
      titulo: "Caminho certo para a meta",
      descricao: `Projetando fechar o mês em ${vg.pctMeta.toFixed(0)}% da meta.`,
    });
  else if (vg.receitaMes > 0)
    insights.push({
      id: "meta",
      tipo: "alerta",
      titulo: "Meta sob risco",
      descricao: `Apenas ${vg.pctMeta.toFixed(0)}% da meta atingida este mês.`,
    });

  const propostasAbertas = com.leads.filter(
    (l) => l.etapa === "proposta" || l.etapa === "negociacao",
  ).length;
  if (propostasAbertas > 0)
    insights.push({
      id: "propostas",
      tipo: "neutro",
      titulo: `${propostasAbertas} proposta(s) em aberto`,
      descricao: "Acompanhe de perto para acelerar o fechamento.",
    });

  if (vg.projetosCriticos > 0)
    insights.push({
      id: "criticos",
      tipo: "alerta",
      titulo: `${vg.projetosCriticos} projeto(s) em estado crítico`,
      descricao: "Prazo curto e progresso abaixo de 60%.",
    });

  const decididos = com.leads.filter((l) => l.etapa === "fechado" || l.etapa === "perdido").length;
  if (decididos >= 3 && vg.taxaConversao < 50)
    insights.push({
      id: "conversao",
      tipo: "alerta",
      titulo: `Conversão em ${vg.taxaConversao.toFixed(0)}%`,
      descricao: "Reveja a qualificação de leads na entrada do funil.",
    });
  else if (decididos >= 3 && vg.taxaConversao >= 70)
    insights.push({
      id: "conversao",
      tipo: "positivo",
      titulo: `Boa conversão: ${vg.taxaConversao.toFixed(0)}%`,
      descricao: "Seu funil está convertendo bem — mantenha o ritmo.",
    });

  return insights;
}
