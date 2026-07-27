import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useFinanceiroSupa } from "@/lib/hooks/useFinanceiro";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useComercial } from "@/lib/hooks/useComercial";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
import { isProjetoAtivo, isProjetoConcluidoOuPausado } from "@/lib/mock/projetos";
import { temAcesso, type Permissoes } from "@/lib/permissoes";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  EmptyWallet,
  MoneyRecive,
  Kanban,
  TrendUp,
  Calendar,
  TickCircle,
  Notification,
  Setting2,
  ArrowLeft2,
  ArrowRight2,
  MagicStar,
  Add,
  Flash,
  ArrowRight,
} from "iconsax-react";
import type { Icon as IcIcon } from "iconsax-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  isSameMonth,
  eachDayOfInterval,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { PersonalizeSheet } from "@/components/dashboard/personalize-sheet";
import { widgetRegistry } from "@/lib/dashboard/widget-catalog";
import { MembroDashboard } from "@/components/dashboard/membro-dashboard";
import { loadState, saveState, type PersistedState } from "@/lib/dashboard/storage";
import type { WidgetSize } from "@/lib/dashboard/types";
import { loadMetas, progressoMes } from "@/lib/mock/metas";
import { useAuth } from "@/lib/auth";
import { responderAssistant } from "@/lib/assistant/engine";

// Gráfico (recharts ~100KB) carregado sob demanda — dashboard pinta antes
const AnalyticChart = lazy(() => import("@/components/dashboard/analytic-chart"));

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Mapa categoria do widget → módulo de permissão
const CATEGORIA_MODULO: Record<string, keyof Permissoes | null> = {
  Financeiro: "financeiro",
  Comercial: "comercial",
  Operacional: "projetos",
  Pessoal: null,
  Inteligência: null,
};

export function Dashboard() {
  const { usuario } = useAuth();
  const role = (usuario as any)?.role ?? "admin";
  // Membros têm uma dashboard própria, focada nas tarefas deles.
  // Dispatcher fino: evita hooks condicionais no cockpit do admin.
  if (role !== "admin") return <MembroDashboard />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { usuario } = useAuth();
  const role = (usuario as any)?.role ?? "admin";
  const permissoes = ((usuario as any)?.permissoes as Partial<Permissoes> | null) ?? null;
  const podeVer = (modulo: keyof Permissoes) => role === "admin" || temAcesso(permissoes, modulo);

  const [state, setState] = useState<PersistedState | null>(null);
  const [editing, setEditing] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);

  useEffect(() => {
    setState(loadState());
  }, []);
  const persist = (next: PersistedState) => {
    setState(next);
    saveState(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const active = useMemo(
    () => state?.layouts.find((l) => l.id === state.activeId) ?? state?.layouts[0],
    [state],
  );

  if (!state) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!active) return null;

  const updateActive = (
    fn: (
      l: import("@/lib/dashboard/types").DashboardLayout,
    ) => import("@/lib/dashboard/types").DashboardLayout,
  ) => persist({ ...state, layouts: state.layouts.map((l) => (l.id === active.id ? fn(l) : l)) });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    updateActive((l) => {
      const oi = l.widgets.findIndex((w) => w.id === a.id);
      const ni = l.widgets.findIndex((w) => w.id === over.id);
      return { ...l, widgets: arrayMove(l.widgets, oi, ni) };
    });
  };

  const addWidget = (type: string) => {
    const meta = widgetRegistry[type];
    if (!meta) return;
    updateActive((l) => ({
      ...l,
      widgets: [
        ...l.widgets,
        { id: `${type}-${Math.random().toString(36).slice(2, 8)}`, type, size: meta.defaultSize },
      ],
    }));
  };

  const removeWidget = (id: string) =>
    updateActive((l) => ({ ...l, widgets: l.widgets.filter((w) => w.id !== id) }));
  const resizeWidget = (id: string, size: WidgetSize) =>
    updateActive((l) => ({
      ...l,
      widgets: l.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
    }));

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const nome = usuario?.nome ? `, ${usuario.nome.split(" ")[0]}` : "";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:space-y-6 sm:py-7 md:px-8 md:py-9">
      {/* Greeting */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 font-display text-[1.75rem] font-bold tracking-tight text-foreground sm:text-[2rem]">
            {greet()}
            {nome}.
          </h1>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-1/60 px-3.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
          data-active={editing}
        >
          <Setting2 size={14} color="currentColor" variant="Linear" />
          {editing ? "Concluir" : "Personalizar"}
        </button>
      </div>

      {/* KPI Strip */}
      <KpiStrip podeVerFinanceiro={podeVer("financeiro")} podeVerProjetos={podeVer("projetos")} />

      {/* Assistant — inteligência como parte da primeira leitura do cockpit */}
      <AssistantSpotlight />

      {/* Hero: chart + agenda */}
      {(podeVer("financeiro") || podeVer("agenda")) && (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            podeVer("financeiro") && podeVer("agenda") && "lg:grid-cols-[1fr_320px]",
          )}
        >
          {podeVer("financeiro") && (
            <Suspense
              fallback={
                <div className="h-[290px] animate-pulse rounded-2xl border border-white/[0.06] bg-surface-1/50" />
              }
            >
              <AnalyticChart />
            </Suspense>
          )}
          {podeVer("agenda") && <CalendarPanel />}
        </div>
      )}

      {/* Widget grid — filtrado por permissões */}
      {(() => {
        const visibleWidgets = active.widgets.filter((w) => {
          const meta = widgetRegistry[w.type];
          if (!meta) return true;
          const modulo = CATEGORIA_MODULO[meta.category] ?? null;
          if (!modulo) return true;
          return podeVer(modulo);
        });
        return visibleWidgets.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Widgets
              </span>
              {editing && (
                <Button
                  onClick={() => setPersonalizing(true)}
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-glow"
                >
                  <Add size={12} color="currentColor" variant="Linear" /> Widget
                </Button>
              )}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleWidgets.map((w) => w.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-12 gap-4">
                  {visibleWidgets.map((w) => (
                    <WidgetCard
                      key={w.id}
                      widget={w}
                      editing={editing}
                      onRemove={() => removeWidget(w.id)}
                      onResize={(s) => resizeWidget(w.id, s)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        ) : null;
      })()}

      {active.widgets.length === 0 && editing && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <MagicStar
            size={20}
            color="currentColor"
            variant="Linear"
            className="mb-3 text-primary"
          />
          <p className="text-sm font-semibold">Adicione widgets ao cockpit</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Personalize o que aparece aqui embaixo
          </p>
          <Button
            onClick={() => setPersonalizing(true)}
            className="mt-4 h-9 gap-2 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary-glow"
          >
            <Add size={14} color="currentColor" variant="Linear" /> Adicionar widget
          </Button>
        </div>
      )}

      <PersonalizeSheet
        open={personalizing}
        onOpenChange={setPersonalizing}
        widgets={active.widgets}
        onAdd={addWidget}
      />
    </div>
  );
}

function AssistantSpotlight() {
  const { projetos, tarefas } = useProjetos();
  const { eventos } = useAgendaSupa();
  const { lancamentos } = useFinanceiroSupa({ somenteEmpresa: true });
  const leads = useComercial((s) => s.leads);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("Pergunte sobre projetos, tarefas ou próximos passos.");
  const ativos = projetos.filter(isProjetoAtivo).length;
  const abertas = tarefas.filter((t) => !t.concluida);
  const atrasadas = abertas.filter((t) => t.prazo && new Date(t.prazo) < new Date()).length;
  const blocos = Array.from({ length: 35 }, (_, i) => {
    const x = i % 7;
    const y = Math.floor(i / 7);
    const distancia = Math.abs(x - 3) + Math.abs(y - 2);
    return {
      i,
      ativo: distancia < 3 || i % 9 === 0,
      opacidade: Math.max(0.18, 1 - distancia * 0.2),
    };
  });

  const responder = () => {
    if (!pergunta.trim()) return;
    setResposta(
      responderAssistant(pergunta, {
        projetos,
        tarefas,
        eventos,
        lancamentos,
        leads,
        podeFinanceiro: true,
        podeComercial: true,
      }),
    );
    setPergunta("");
  };

  return (
    <div
      style={{ boxShadow: "0 18px 70px -45px color-mix(in srgb, var(--primary) 50%, transparent)" }}
      className="group relative overflow-hidden rounded-3xl border border-primary/15 bg-[#0d0f0f] transition duration-300 hover:border-primary/30"
    >
      <div
        style={{
          background:
            "radial-gradient(circle at 78% 50%, color-mix(in srgb, var(--primary) 11%, transparent), transparent 34%)",
        }}
        className="pointer-events-none absolute inset-0"
      />
      <div className="relative grid min-h-[190px] gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_420px] lg:items-center lg:px-8">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_28px_-10px_var(--primary)]">
            <Flash size={23} color="currentColor" variant="Bulk" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">
                MakersHub Assistant
              </p>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                Beta
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Sua produtora, <span className="text-primary">pensando junto.</span>
            </h2>
            <p className="mt-3 min-h-5 text-xs text-white/50">{resposta}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                responder();
              }}
              className="mt-4 flex max-w-xl gap-2"
            >
              <input
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                placeholder="Pergunte ao Assistant…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-xs text-white outline-none transition placeholder:text-white/30 focus:border-primary/35 focus:bg-white/[0.07]"
              />
              <button
                type="submit"
                className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:scale-105"
              >
                <ArrowRight size={17} color="currentColor" />
              </button>
            </form>
            <Link
              to="/assistant"
              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-white/35 transition hover:text-primary"
            >
              Abrir experiência completa <ArrowRight size={11} color="currentColor" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {blocos.map(({ i, ativo, opacidade }) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 18}ms`, opacity: ativo ? opacidade : 0.12 }}
                className={`assistant-tile aspect-[1.65] rounded-[4px] border ${ativo ? "border-primary/30 bg-primary" : "border-white/[0.06] bg-white/[0.03]"}`}
              />
            ))}
          </div>
          <div className="grid gap-2 border-l border-white/[0.07] pl-4 text-right">
            <CompactStat label="Ativos" value={ativos} />
            <CompactStat label="Abertas" value={abertas.length} />
            <CompactStat label="Atenção" value={atrasadas} alert={atrasadas > 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactStat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wider text-white/30">{label}</p>
      <p
        className={`font-display text-lg font-semibold ${alert ? "text-amber-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Strip
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  href,
}: {
  icon: IcIcon;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  href?: string;
}) {
  const inner = (
    <div className="group flex h-full items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-surface-1/70 p-3.5 transition hover:border-primary/20 hover:bg-surface-2/70 sm:gap-4 sm:p-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] sm:size-12 sm:rounded-2xl">
        <Icon size={20} color="var(--color-primary)" variant="Linear" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 whitespace-nowrap font-display text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link to={href as any} className="block h-full">
      {inner}
    </Link>
  ) : (
    <div className="h-full">{inner}</div>
  );
}

function KpiStrip({
  podeVerFinanceiro,
  podeVerProjetos,
}: {
  podeVerFinanceiro: boolean;
  podeVerProjetos: boolean;
}) {
  const { lancamentos } = useFinanceiroSupa({ somenteEmpresa: true });
  const leads = useComercial((s) => s.leads);
  const { projetos } = useProjetos();
  const hoje = new Date();

  // Mesmo critério da página Financeiro: agrupa por vencimento do período (não por data
  // de pagamento) — senão um lançamento vencido em julho mas pago em outro mês some daqui
  // mesmo aparecendo como "recebido" na página Financeiro.
  const receita = lancamentos
    .filter(
      (l) =>
        l.tipo === "receita" &&
        l.status === "recebido" &&
        isSameMonth(new Date(l.vencimento.slice(0, 10) + "T12:00:00"), hoje),
    )
    .reduce((s, l) => s + l.valor, 0);

  const leadsAtivos = leads.filter((l) => !["fechado", "perdido"].includes(l.etapa));
  const pipeline = leadsAtivos.reduce((s, l) => s + l.valor, 0);
  const projetosAtivos = projetos.filter((p) => !isProjetoConcluidoOuPausado(p)).length;
  const p = progressoMes(loadMetas(), lancamentos);
  const metaPct = p.atingiuMeta ? p.pctSuper : p.pctMeta;

  const totalCards = (podeVerFinanceiro ? 2 : 0) + (podeVerProjetos ? 1 : 0);

  return (
    <div
      className={cn(
        "grid gap-3",
        totalCards === 1 && "grid-cols-1 max-w-xs",
        totalCards === 2 && "grid-cols-1 sm:grid-cols-2",
        totalCards >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {podeVerFinanceiro && (
        <KpiCard
          icon={EmptyWallet}
          label="Receita do mês"
          value={brl(receita)}
          href="/financeiro"
        />
      )}
      {podeVerProjetos && (
        <KpiCard
          icon={Kanban}
          label="Projetos ativos"
          value={String(projetosAtivos)}
          href="/projetos"
        />
      )}
      {podeVerFinanceiro && (
        <div className="rounded-2xl border border-white/[0.06] bg-surface-1/70 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] sm:size-12 sm:rounded-2xl">
              <TrendUp size={20} color="var(--color-primary)" variant="Linear" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Meta do mês</p>
              <p className="mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                {metaPct.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${Math.min(100, metaPct)}%`, boxShadow: "0 0 8px var(--primary)" }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {brl(p.realizado)} · meta {brl(p.atingiuMeta ? p.superMeta : p.meta)}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytic Chart
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calendar Panel
// ---------------------------------------------------------------------------

function CalendarPanel() {
  const hoje = new Date();
  const { eventos } = useAgendaSupa();
  const [mesRef, setMesRef] = useState(hoje);
  const navigate = useNavigate();

  const inicio = startOfMonth(mesRef);
  const fim = endOfMonth(mesRef);
  const dias = eachDayOfInterval({ start: inicio, end: fim });

  const diasComEvento = new Set(
    eventos
      .filter((e) => isSameMonth(new Date(e.inicio), mesRef))
      .map((e) => new Date(e.inicio).getDate()),
  );

  // Monday-first offset: Mon=0 … Sun=6
  const offset = (inicio.getDay() + 6) % 7;

  const proximosEventos = eventos
    .filter((e) => new Date(e.inicio) >= hoje)
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    .slice(0, 3);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-1/70 p-5">
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-sm font-semibold capitalize tracking-tight">
          {format(mesRef, "MMMM yyyy", { locale: ptBR })}
        </p>
        <div className="flex gap-0.5">
          <button
            onClick={() => setMesRef((m) => addMonths(m, -1))}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft2 size={14} color="currentColor" variant="Linear" />
          </button>
          <button
            onClick={() => setMesRef((m) => addMonths(m, 1))}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight2 size={14} color="currentColor" variant="Linear" />
          </button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-muted-foreground/50">
            {d}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: offset }, (_, i) => (
          <div key={`pre-${i}`} />
        ))}
        {dias.map((dia) => {
          const n = dia.getDate();
          const ehHoje = isToday(dia);
          const temEvento = diasComEvento.has(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                sessionStorage.setItem("makershub:agenda:cursor", dia.toISOString());
                navigate({ to: "/agenda" });
              }}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-[11px] leading-none",
                ehHoje
                  ? "bg-primary font-bold text-primary-foreground"
                  : "cursor-pointer text-foreground/70 hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              {n}
              {temEvento && !ehHoje && (
                <span className="absolute bottom-0.5 left-1/2 size-0.5 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Upcoming events */}
      {proximosEventos.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-border/40 pt-3">
          {proximosEventos.map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <Calendar
                size={12}
                color="currentColor"
                variant="Linear"
                className="mt-0.5 shrink-0 text-primary"
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] text-foreground/80">{e.titulo}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(e.inicio), "d MMM, HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/agenda"
        className="mt-3 block text-center text-[11px] text-muted-foreground hover:text-primary"
      >
        Ver agenda →
      </Link>
    </div>
  );
}
