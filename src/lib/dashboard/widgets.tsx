import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  FolderKanban,
  AlertTriangle,
  Calendar as CalendarIcon,
  Video,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  Activity,
  Repeat,
  Trophy,
  Bell,
} from "lucide-react";
import { lazy, useEffect, useState } from "react";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useFinanceiroSupa } from "@/lib/hooks/useFinanceiro";
import { resumoFinanceiroMes } from "@/lib/mock/financeiro";
import { useComercial } from "@/lib/hooks/useComercial";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
import { listarPropostas, type Proposta } from "@/lib/propostas";
import { isProjetoConcluidoOuPausado } from "@/lib/mock/projetos";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// -- small primitives ----------------------------------------------------------
function Stat({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-400"
        : "text-foreground";
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <Icon className="size-3.5 opacity-60" />
      </div>
      <div className="space-y-1">
        <div className={`font-display text-2xl font-semibold tracking-tight ${toneClass}`}>
          {value}
        </div>
        {delta && <div className="text-xs text-muted-foreground">{delta}</div>}
        {hint && <div className="text-[11px] text-muted-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}

function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

// -- helpers ------------------------------------------------------------------

function useLancamentos() {
  // Dashboard = visão consolidada da empresa. O seletor de carteira só afeta o módulo Financeiro.
  const { lancamentos } = useFinanceiroSupa({ somenteEmpresa: true });
  return lancamentos;
}

// -- financial widgets --------------------------------------------------------

const ReceitaMes = () => {
  const lancs = useLancamentos();
  const { receita } = resumoFinanceiroMes(lancs);
  return <Stat icon={Wallet} label="Receita do mês" value={brl(receita)} tone="positive" />;
};

const LucroMes = () => {
  const lancs = useLancamentos();
  const { lucro, margem } = resumoFinanceiroMes(lancs);
  return (
    <Stat
      icon={TrendingUp}
      label="Lucro do mês"
      value={brl(lucro)}
      delta={`Margem ${margem.toFixed(1)}%`}
      tone="positive"
    />
  );
};

const ReceitaRecorrente = () => {
  const lancs = useLancamentos();
  const v = lancs
    .filter((l) => l.tipo === "receita" && l.status === "previsto")
    .reduce((s, l) => s + l.valor, 0);
  return (
    <Stat icon={Repeat} label="A receber (previsto)" value={brl(v)} hint="Lançamentos futuros" />
  );
};

const Pipeline = () => {
  const leads = useComercial((s) => s.leads);
  const ativos = leads.filter((l) => !["fechado", "perdido"].includes(l.etapa));
  const total = ativos.reduce((s, l) => s + l.valor, 0);
  return (
    <Stat
      icon={Target}
      label="Pipeline comercial"
      value={brl(total)}
      delta={`${ativos.length} oportunidades`}
    />
  );
};

const ProjetosAtivos = () => {
  const { projetos, tarefas } = useProjetos();
  const ativos = projetos.filter((p) => !isProjetoConcluidoOuPausado(p));
  const pendentes = tarefas.filter((t) => !t.concluida).length;
  return (
    <Stat
      icon={FolderKanban}
      label="Projetos ativos"
      value={String(ativos.length)}
      hint={`${pendentes} tarefas em aberto`}
    />
  );
};

const ProjetosCriticos = () => {
  const { projetos } = useProjetos();
  const criticos = projetos.filter(
    (p) =>
      p.progresso < 30 ||
      (p.dataEntrega && new Date(p.dataEntrega) < new Date(Date.now() + 7 * 86400000)),
  );
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Projetos críticos</span>
        <AlertTriangle className="size-3.5 text-amber-400" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {criticos.length === 0 ? (
          <Empty msg="Nada crítico. Respira." />
        ) : (
          criticos.map((p) => (
            <ListRow key={p.id}>
              <div className="size-2 rounded-full bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{p.nome}</div>
                {p.dataEntrega && (
                  <div className="text-[11px] text-muted-foreground">
                    Entrega {new Date(p.dataEntrega).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{p.progresso}%</div>
            </ListRow>
          ))
        )}
      </div>
    </div>
  );
};

const ContasReceber = () => {
  const lancs = useLancamentos();
  const v = lancs
    .filter((l) => l.tipo === "receita" && l.status === "previsto")
    .reduce((s, l) => s + l.valor, 0);
  return (
    <Stat
      icon={ArrowDownCircle}
      label="Contas a receber"
      value={brl(v)}
      hint="Próximos 30 dias"
      tone="positive"
    />
  );
};

const ContasPagar = () => {
  const lancs = useLancamentos();
  const v = lancs
    .filter((l) => l.tipo === "despesa" && l.status === "previsto")
    .reduce((s, l) => s + l.valor, 0);
  return (
    <Stat
      icon={ArrowUpCircle}
      label="Contas a pagar"
      value={brl(v)}
      hint="Próximos 30 dias"
      tone="warning"
    />
  );
};

const FaturamentoGrafico = lazy(() => import("@/components/dashboard/faturamento-widget"));

const MeuDia = () => {
  const hoje = new Date();
  const { tarefas } = useProjetos();
  const { eventos } = useAgendaSupa();
  const tarefasHoje = tarefas.filter(
    (t) => t.prazo && new Date(t.prazo).toDateString() === hoje.toDateString() && !t.concluida,
  );
  const eventosHoje = eventos.filter(
    (e) => new Date(e.inicio).toDateString() === hoje.toDateString(),
  );
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Meu dia
          </div>
          <div className="text-[11px] text-muted-foreground/70">
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {tarefasHoje.length + eventosHoje.length} itens
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {eventosHoje.map((e) => (
          <ListRow key={e.id}>
            <CalendarIcon className="size-3.5 text-primary" />
            <div className="min-w-0 flex-1 truncate text-sm">{e.titulo}</div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.inicio).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </ListRow>
        ))}
        {tarefasHoje.map((t) => (
          <ListRow key={t.id}>
            <CheckCircle2 className="size-3.5 text-muted-foreground" />
            <div className="min-w-0 flex-1 truncate text-sm">{t.titulo}</div>
            <div className="text-[11px] text-muted-foreground">{t.responsavel}</div>
          </ListRow>
        ))}
        {tarefasHoje.length + eventosHoje.length === 0 && <Empty msg="Nada agendado para hoje." />}
      </div>
    </div>
  );
};

const Agenda = () => {
  const { eventos } = useAgendaSupa();
  const prox = [...eventos]
    .filter((e) => new Date(e.inicio) >= new Date())
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    .slice(0, 5);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Próximos compromissos</span>
        <CalendarIcon className="size-3.5 opacity-60" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {prox.length === 0 ? (
          <Empty msg="Nada agendado." />
        ) : (
          prox.map((e) => (
            <ListRow key={e.id}>
              <div className="w-10 shrink-0 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">
                  {new Date(e.inicio).toLocaleDateString("pt-BR", { month: "short" })}
                </div>
                <div className="font-display text-base font-semibold leading-none">
                  {new Date(e.inicio).getDate()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.titulo}</div>
                <div className="text-[11px] text-muted-foreground">
                  {e.tipo}
                  {e.local ? ` · ${e.local}` : ""}
                </div>
              </div>
            </ListRow>
          ))
        )}
      </div>
    </div>
  );
};

const Followups = () => {
  const leads = useComercial((s) => s.leads);
  const empresas = useComercial((s) => s.empresas);
  const pend = leads.filter(
    (l) => l.proximaAcao && new Date(l.proximaAcao.data) <= new Date(Date.now() + 86400000),
  );
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Follow-ups</span>
        <Bell className="size-3.5 opacity-60" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {pend.map((l) => {
          const empresa = empresas.find((e) => e.id === l.empresaId);
          return (
            <ListRow key={l.id}>
              <div className="size-2 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{empresa?.nome}</div>
                <div className="text-[11px] text-muted-foreground">{l.proximaAcao?.titulo}</div>
              </div>
            </ListRow>
          );
        })}
        {pend.length === 0 && <Empty msg="Nenhum follow-up urgente." />}
      </div>
    </div>
  );
};

const TarefasPendentes = () => {
  const { tarefas } = useProjetos();
  const pend = tarefas
    .filter((t) => !t.concluida)
    .sort((a, b) => +new Date(a.prazo ?? "9999") - +new Date(b.prazo ?? "9999"));
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Tarefas pendentes</span>
        <span className="text-foreground">{pend.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {pend.slice(0, 6).map((t) => (
          <ListRow key={t.id}>
            <div
              className={`size-2 rounded-full ${t.prioridade === "urgente" ? "bg-red-400" : t.prioridade === "alta" ? "bg-amber-400" : "bg-muted-foreground/40"}`}
            />
            <div className="min-w-0 flex-1 truncate text-sm">{t.titulo}</div>
            <Clock className="size-3 text-muted-foreground" />
            {t.prazo && (
              <span className="text-[11px] text-muted-foreground">
                {new Date(t.prazo).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            )}
          </ListRow>
        ))}
        {pend.length === 0 && <Empty msg="Tudo em dia!" />}
      </div>
    </div>
  );
};

const ProximasGravacoes = () => {
  const { eventos } = useAgendaSupa();
  const grav = eventos
    .filter((e) => e.tipo === "gravacao" && new Date(e.inicio) >= new Date())
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Próximas gravações</span>
        <Video className="size-3.5 opacity-60" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {grav.length === 0 ? (
          <Empty msg="Nenhuma captação agendada." />
        ) : (
          grav.map((e) => (
            <ListRow key={e.id}>
              <Video className="size-3.5 text-primary" />
              <div className="min-w-0 flex-1 truncate text-sm">{e.titulo}</div>
              <span className="text-[11px] text-muted-foreground">
                {new Date(e.inicio).toLocaleDateString("pt-BR")}
              </span>
            </ListRow>
          ))
        )}
      </div>
    </div>
  );
};

const PropostasAguardando = () => {
  const [propostas, setPropostas] = useState<Proposta[] | null>(null);
  useEffect(() => {
    listarPropostas()
      .then(setPropostas)
      .catch(() => setPropostas([]));
  }, []);
  const aguardando = (propostas ?? []).filter((p) => p.status === "enviada");
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Propostas aguardando</span>
        <FileText className="size-3.5 opacity-60" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {propostas === null ? null : aguardando.length === 0 ? (
          <Empty msg="Nenhuma proposta aguardando resposta." />
        ) : (
          aguardando.map((p) => (
            <ListRow key={p.id}>
              <FileText className="size-3.5 text-primary" />
              <div className="min-w-0 flex-1 truncate text-sm">
                {p.cliente_nome || p.titulo_projeto}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {p.enviada_em ? new Date(p.enviada_em).toLocaleDateString("pt-BR") : "—"}
              </span>
            </ListRow>
          ))
        )}
      </div>
    </div>
  );
};

const ClientesAtivos = () => {
  const empresas = useComercial((s) => s.empresas);
  return (
    <Stat
      icon={Users}
      label="Clientes no CRM"
      value={String(empresas.length)}
      hint="Total de empresas cadastradas"
    />
  );
};

const UltimasAtividades = () => {
  const timeline = useComercial((s) => s.timeline);
  const empresas = useComercial((s) => s.empresas);
  const leads = useComercial((s) => s.leads);
  const recentes = [...timeline].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 8);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Últimas atividades</span>
        <Activity className="size-3.5 opacity-60" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {recentes.length === 0 ? (
          <Empty msg="Nenhuma atividade ainda." />
        ) : (
          recentes.map((n) => {
            const lead = leads.find((l) => l.id === n.leadId);
            const empresa = empresas.find((e) => e.id === lead?.empresaId);
            return (
              <ListRow key={n.id}>
                <div className="size-2 rounded-full bg-primary/60" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{n.titulo}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {empresa?.nome} · {n.autor}
                  </div>
                </div>
              </ListRow>
            );
          })
        )}
      </div>
    </div>
  );
};

const LeadsQuentes = () => {
  const leads = useComercial((s) => s.leads);
  const empresas = useComercial((s) => s.empresas);
  const quentes = leads
    .filter((l) => ["negociacao", "proposta"].includes(l.etapa))
    .sort((a, b) => b.valor - a.valor);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Leads quentes</span>
        <span className="text-foreground">{brl(quentes.reduce((s, l) => s + l.valor, 0))}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {quentes.length === 0 ? (
          <Empty msg="Nenhum lead em negociação." />
        ) : (
          quentes.map((l) => {
            const empresa = empresas.find((e) => e.id === l.empresaId);
            return (
              <ListRow key={l.id}>
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-medium">
                  {empresa?.nome.slice(0, 2).toUpperCase() ?? "??"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{empresa?.nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {l.proximaAcao?.titulo ?? l.etapa}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-primary">{brl(l.valor)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l.etapa}
                  </div>
                </div>
              </ListRow>
            );
          })
        )}
      </div>
    </div>
  );
};

const IndicadoresFinanceiros = () => {
  const lancs = useLancamentos();
  const { receita: faturamento, despesas: custos, lucro, margem } = resumoFinanceiroMes(lancs);
  const previsto = lancs
    .filter((l) => l.tipo === "receita" && l.status === "previsto")
    .reduce((s, l) => s + l.valor, 0);
  return (
    <div className="grid h-full grid-cols-2 gap-4">
      <Stat icon={Wallet} label="Faturamento" value={brl(faturamento)} tone="positive" />
      <Stat
        icon={TrendingUp}
        label="Lucro"
        value={brl(lucro)}
        hint={`Margem ${margem.toFixed(1)}%`}
        tone="positive"
      />
      <Stat icon={ArrowDownCircle} label="A receber" value={brl(previsto)} />
      <Stat icon={TrendingDown} label="Custos" value={brl(custos)} tone="warning" />
    </div>
  );
};

const Metas = () => (
  <div className="flex h-full flex-col gap-3">
    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
      <span>Metas do mês</span>
      <Trophy className="size-3.5 opacity-60" />
    </div>
    {[
      { label: "Faturamento", value: 68, target: "R$ 80.000" },
      { label: "Novos contratos", value: 50, target: "4 contratos" },
      { label: "Margem líquida", value: 82, target: "35%" },
    ].map((g) => (
      <div key={g.label} className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-foreground">{g.label}</span>
          <span className="text-muted-foreground">{g.target}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary" style={{ width: `${g.value}%` }} />
        </div>
      </div>
    ))}
  </div>
);

const Assistant = () => (
  <div className="flex h-full flex-col gap-3">
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      <Sparkles className="size-3.5 text-primary" /> MakersHub Assistant
      <span className="ml-auto rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
        Em breve
      </span>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">
      Pergunte sobre projetos, leads, financeiro ou peça para gerar uma proposta.
    </p>
    <div className="mt-auto rounded-lg border border-border/60 bg-surface-1/60 px-3 py-2 text-xs text-muted-foreground/80">
      "Quais projetos estão atrasados?"
    </div>
  </div>
);

export const widgetComponents: Record<string, React.ComponentType> = {
  "receita-mes": ReceitaMes,
  "lucro-mes": LucroMes,
  "receita-recorrente": ReceitaRecorrente,
  "contas-receber": ContasReceber,
  "contas-pagar": ContasPagar,
  "faturamento-grafico": FaturamentoGrafico,
  "indicadores-financeiros": IndicadoresFinanceiros,
  pipeline: Pipeline,
  "leads-quentes": LeadsQuentes,
  "propostas-aguardando": PropostasAguardando,
  "clientes-ativos": ClientesAtivos,
  followups: Followups,
  "projetos-ativos": ProjetosAtivos,
  "projetos-criticos": ProjetosCriticos,
  "tarefas-pendentes": TarefasPendentes,
  "proximas-gravacoes": ProximasGravacoes,
  "meu-dia": MeuDia,
  agenda: Agenda,
  "ultimas-atividades": UltimasAtividades,
  metas: Metas,
  assistant: Assistant,
};
