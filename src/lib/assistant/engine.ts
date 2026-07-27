import type { Projeto, Tarefa } from "@/lib/mock/projetos";
import { isProjetoAtivo } from "@/lib/mock/projetos";
import type { Evento } from "@/lib/mock/agenda";
import type { Lancamento } from "@/lib/mock/financeiro";
import type { Lead, Empresa } from "@/lib/mock/comercial";

export type AssistantDados = {
  projetos: Projeto[]; tarefas: Tarefa[]; eventos?: Evento[];
  lancamentos?: Lancamento[]; leads?: Lead[]; empresas?: Empresa[];
  podeFinanceiro?: boolean; podeComercial?: boolean;
};

const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const noMes = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); const h = new Date(); return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear(); };
const nosProximosDias = (iso: string | undefined, dias: number) => { if (!iso) return false; const t = +new Date(iso); const agora = Date.now(); return t >= agora && t <= agora + dias * 86400000; };

export function responderAssistant(pergunta: string, d: AssistantDados): string {
  const q = norm(pergunta.trim());
  if (!q) return "Escreva uma pergunta sobre a operação.";
  const agora = new Date();
  const ativos = d.projetos.filter(isProjetoAtivo);
  const abertas = d.tarefas.filter(t => !t.concluida);
  const concluidas = d.tarefas.filter(t => t.concluida);
  const atrasadas = abertas.filter(t => t.prazo && new Date(t.prazo) < agora);
  const proximas = abertas.filter(t => t.prazo && new Date(t.prazo) >= agora).sort((a, b) => +new Date(a.prazo!) - +new Date(b.prazo!));

  const projetoCitado = d.projetos.find(p => q.includes(norm(p.nome)) || q.includes(norm(p.cliente)));
  if (projetoCitado) {
    const ts = d.tarefas.filter(t => t.projetoId === projetoCitado.id); const pend = ts.filter(t => !t.concluida); const atr = pend.filter(t => t.prazo && new Date(t.prazo) < agora);
    return `${projetoCitado.nome}, de ${projetoCitado.cliente}, está com ${projetoCitado.progresso}% de avanço. São ${pend.length} tarefas abertas${atr.length ? ` e ${atr.length} atrasadas` : " e nenhuma atrasada"}.`;
  }

  if (q.includes("quem") && (q.includes("mais tarefa") || q.includes("sobrecarreg"))) {
    const carga = abertas.reduce<Record<string, number>>((acc, t) => { const r = t.responsavel || "Sem responsável"; acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const ranking = Object.entries(carga).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return ranking.length ? `Maior carga atual: ${ranking.map(([n, total]) => `${n} (${total})`).join(", ")}.` : "Não há tarefas abertas para comparar a carga da equipe.";
  }
  if (q.includes("atras") || q.includes("atencao") || q.includes("urgente")) return atrasadas.length ? `${atrasadas.length} tarefa${atrasadas.length === 1 ? " exige" : "s exigem"} atenção. As primeiras são: ${atrasadas.slice(0, 3).map(t => `“${t.titulo}”`).join(", ")}.` : "Tudo em dia: nenhuma tarefa atrasada agora.";
  if (q.includes("conclu") || q.includes("finaliz")) return `${concluidas.length} tarefas estão concluídas e ${abertas.length} continuam abertas.`;
  if (q.includes("essa semana") || q.includes("esta semana") || q.includes("proximos 7")) { const ts = abertas.filter(t => nosProximosDias(t.prazo, 7)); return ts.length ? `${ts.length} tarefas vencem nos próximos 7 dias: ${ts.slice(0, 4).map(t => t.titulo).join(", ")}.` : "Nenhuma tarefa vence nos próximos 7 dias."; }
  if (q.includes("proximo") || q.includes("depois") || q.includes("passo")) return proximas[0] ? `O próximo movimento é “${proximas[0].titulo}”, com ${proximas[0].responsavel}, em ${new Date(proximas[0].prazo!).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : "Não há próximos passos agendados.";
  if (q.includes("projeto") || q.includes("producao")) return `${ativos.length} produções estão ativas, com ${abertas.length} tarefas abertas. ${atrasadas.length ? `${atrasadas.length} precisam de atenção.` : "A operação está no ritmo."}`;

  const eventos = d.eventos ?? [];
  if (q.includes("agenda") || q.includes("evento") || q.includes("gravacao") || q.includes("captacao") || q.includes("reuniao")) {
    const hoje = eventos.filter(e => mesmoDia(new Date(e.inicio), agora));
    const semana = eventos.filter(e => nosProximosDias(e.inicio, 7));
    const base = q.includes("hoje") ? hoje : semana;
    const filtrados = q.includes("gravacao") || q.includes("captacao") ? base.filter(e => e.tipo === "gravacao") : q.includes("reuniao") ? base.filter(e => e.tipo === "reuniao") : base;
    return filtrados.length ? `${filtrados.length} compromisso${filtrados.length === 1 ? "" : "s"}: ${filtrados.slice(0, 4).map(e => `${e.titulo} (${new Date(e.inicio).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })})`).join(", ")}.` : "Não encontrei compromissos nesse período.";
  }

  if (q.match(/fatur|receita|entrou|lucro|custo|despesa|receber|pagar|financeir|inadimpl/)) {
    if (!d.podeFinanceiro) return "Você não possui permissão para consultar informações financeiras.";
    const ls = d.lancamentos ?? []; const mes = ls.filter(l => noMes(l.pagamentoEm || l.vencimento));
    const receitas = mes.filter(l => l.tipo === "receita" && l.status === "pago").reduce((s, l) => s + l.valor, 0);
    const custos = mes.filter(l => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + l.valor, 0);
    const receber = ls.filter(l => l.tipo === "receita" && l.status !== "pago").reduce((s, l) => s + l.valor, 0);
    const pagar = ls.filter(l => l.tipo === "despesa" && l.status !== "pago").reduce((s, l) => s + l.valor, 0);
    if (q.includes("receber") || q.includes("inadimpl")) return `Há ${brl(receber)} em receitas ainda não recebidas.`;
    if (q.includes("pagar")) return `Há ${brl(pagar)} em despesas ainda não pagas.`;
    if (q.includes("custo") || q.includes("despesa")) return `As despesas pagas neste mês somam ${brl(custos)}.`;
    if (q.includes("lucro") || q.includes("margem")) return `O resultado realizado do mês é ${brl(receitas - custos)}: ${brl(receitas)} de receita menos ${brl(custos)} de custos.`;
    return `A receita recebida neste mês é ${brl(receitas)}. O resultado após custos está em ${brl(receitas - custos)}.`;
  }

  if (q.match(/lead|pipeline|comercial|oportunidade|negociacao|cliente quente/)) {
    if (!d.podeComercial) return "Você não possui permissão para consultar informações comerciais.";
    const leads = d.leads ?? []; const emAberto = leads.filter(l => !["fechado", "perdido"].includes(l.etapa));
    const valor = emAberto.reduce((s, l) => s + l.valor, 0); const quentes = emAberto.filter(l => l.temperatura === "quente");
    if (q.includes("quente")) return `${quentes.length} leads estão quentes, somando ${brl(quentes.reduce((s, l) => s + l.valor, 0))} em oportunidades.`;
    return `O pipeline possui ${emAberto.length} oportunidades abertas, no valor total de ${brl(valor)}. ${quentes.length} estão quentes.`;
  }

  return `Posso consultar projetos, tarefas, equipe, agenda, gravações, financeiro e pipeline comercial. Tente perguntar “o que exige atenção?”, “quanto faturei este mês?” ou “quem está com mais tarefas?”.`;
}
