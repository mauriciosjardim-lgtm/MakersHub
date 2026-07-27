// Fonte ÚNICA de cálculo de progresso e saúde de projeto.
// A UI (listagem e tela interna) deve consumir daqui — nunca duplicar as regras.
import type { Projeto, Tarefa } from "@/lib/mock/projetos";
import { FASES_PADRAO, faseParaId, fasesParaIds } from "@/lib/mock/projetos";

export type SaudeProjeto = "saudavel" | "atencao" | "atrasado" | "pausado";

export interface ResumoProgresso {
  percentual: number;
  concluidas: number;
  total: number;
  atrasadas: number;
  saude: SaudeProjeto;
  label: string;
}

const LABELS: Record<SaudeProjeto, string> = {
  saudavel: "No ritmo",
  atencao: "Atenção",
  atrasado: "Atrasado",
  pausado: "Pausado",
};

// Classes utilitárias por saúde — reaproveitadas pelos componentes.
export const SAUDE_ESTILO: Record<SaudeProjeto, { barra: string; badge: string }> = {
  saudavel: { barra: "bg-primary", badge: "border-primary/40 bg-primary/10 text-primary" },
  atencao: { barra: "bg-amber-400", badge: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  atrasado: {
    barra: "bg-destructive",
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  pausado: {
    barra: "bg-muted-foreground",
    badge: "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
  },
};

// Progresso operacional: cada tarefa avança proporcionalmente conforme percorre
// as colunas do fluxo. Conclusão vale 100%, independentemente da coluna.
export function calcularPercentualFluxo(projeto: Projeto, tarefas: Tarefa[]): number {
  const ts = tarefas.filter((t) => t.projetoId === projeto.id);
  if (!ts.length) return 0;
  const fases = fasesParaIds(projeto.fases?.length ? projeto.fases : FASES_PADRAO);
  const ultimo = Math.max(1, fases.length - 1);
  const soma = ts.reduce((total, tarefa) => {
    const statusId = faseParaId(tarefa.status);
    if (tarefa.concluida || statusId === "concluida") return total + 1;
    const indice = fases.indexOf(statusId);
    return total + (indice < 0 ? 0 : Math.min(1, Math.max(0, indice / ultimo)));
  }, 0);
  return Math.round((soma / ts.length) * 100);
}

// Datas date-only (YYYY-MM-DD) devem ser lidas ao meio-dia local para não
// escorregar de dia por causa do fuso/UTC.
function parseDataLocal(valor?: string | null): Date | null {
  if (!valor) return null;
  const d = new Date(valor.slice(0, 10) + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function calcularResumoProgresso(
  projeto: Projeto,
  tarefas: Tarefa[],
  hoje: Date = new Date(),
): ResumoProgresso {
  const ts = tarefas.filter((t) => t.projetoId === projeto.id);
  const total = ts.length;
  const concluidas = ts.filter((t) => t.concluida).length;
  const percentual = calcularPercentualFluxo(projeto, tarefas);

  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);

  const atrasadas = ts.filter((t) => {
    if (t.concluida || !t.prazo) return false;
    const prazo = parseDataLocal(t.prazo);
    return prazo !== null && prazo < inicioHoje;
  }).length;

  let saude: SaudeProjeto;
  if (projeto.fase === "pausado") {
    saude = "pausado";
  } else if (atrasadas > 0) {
    saude = "atrasado";
  } else {
    const entrega = parseDataLocal(projeto.dataEntrega);
    let atencao = false;
    if (entrega) {
      const dias = Math.ceil((entrega.getTime() - inicioHoje.getTime()) / 86400000);
      if (dias <= 7 && percentual < 70) atencao = true;
    }
    saude = atencao ? "atencao" : "saudavel";
  }

  return { percentual, concluidas, total, atrasadas, saude, label: LABELS[saude] };
}

// Só aceita http/https — nunca javascript:, data: ou protocolos desconhecidos.
// URL inválida devolve null (a UI ignora sem quebrar).
export function linkSeguro(raw?: string): { href: string; dominio: string } | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { href: u.href, dominio: u.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
