import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useFinanceiroSupa } from "@/lib/hooks/useFinanceiro";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useComercial } from "@/lib/hooks/useComercial";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
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
import { RedesignWidgetCard } from "@/components/redesign/redesign-widget-card";
import { PersonalizeSheet } from "@/components/dashboard/personalize-sheet";
import { widgetRegistry } from "@/lib/dashboard/widget-catalog";
import { MembroDashboard } from "@/components/dashboard/membro-dashboard";
import { loadState, saveState, type PersistedState } from "@/lib/dashboard/storage";
import type { WidgetSize } from "@/lib/dashboard/types";
import { loadMetas, progressoMes } from "@/lib/mock/metas";
import { isProjetoConcluidoOuPausado } from "@/lib/mock/projetos";
import { useAuth } from "@/lib/auth";

const AnalyticChart = lazy(() => import("@/components/dashboard/analytic-chart"));

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const CATEGORIA_MODULO: Record<string, keyof Permissoes | null> = {
  Financeiro: "financeiro",
  Comercial: "comercial",
  Operacional: "projetos",
  Pessoal: null,
  Inteligência: null,
};

export function RedesignCockpit() {
  const { usuario } = useAuth();
  const role = (usuario as any)?.role ?? "admin";

  // Para preview isolado de admin
  return <RedesignAdminDashboard />;
}

function RedesignAdminDashboard() {
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

  if (!state) return <div className="p-8 text-sm text-muted-foreground">Carregando cockpit…</div>;
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#90F826]/80">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 font-display text-[1.85rem] font-bold tracking-tight text-foreground sm:text-[2.2rem] transition-redesign">
            {greet()}
            {nome}.
          </h1>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-1/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-[#90F826]/30 hover:text-foreground data-[active=true]:border-[#90F826]/30 data-[active=true]:bg-[#90F826]/10 data-[active=true]:text-[#90F826] shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          data-active={editing}
        >
          <Setting2 size={14} color="currentColor" variant="Linear" />
          {editing ? "Concluir" : "Personalizar Cockpit"}
        </button>
      </div>

      {/* KPI Strip */}
      <KpiStrip podeVerFinanceiro={podeVer("financeiro")} podeVerProjetos={podeVer("projetos")} />

      {/* Hero: chart + agenda */}
      {(podeVer("financeiro") || podeVer("agenda")) && (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            podeVer("financeiro") && podeVer("agenda") && "lg:grid-cols-[1fr_340px]",
          )}
        >
          {podeVer("financeiro") && (
            <div className="glass-panel-premium hover-redesign-card p-4 sm:p-5 flex flex-col justify-between min-h-[340px]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Desempenho Financeiro
                </p>
                <h3 className="text-lg font-bold mt-1 text-foreground">Receitas vs Custos</h3>
              </div>
              <div className="flex-1 mt-4">
                <Suspense
                  fallback={<div className="h-[240px] animate-pulse rounded-xl bg-surface-2/40" />}
                >
                  <AnalyticChart />
                </Suspense>
              </div>
            </div>
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
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#90F826]/80">
                Seus Indicadores
              </span>
              {editing && (
                <Button
                  onClick={() => setPersonalizing(true)}
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow font-semibold transition"
                >
                  <Add size={14} color="currentColor" variant="Linear" /> Adicionar Widget
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
                    <RedesignWidgetCard
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
        <div className="grid place-items-center rounded-2xl border border-dashed border-border/80 px-6 py-14 text-center glass-panel-premium">
          <MagicStar
            size={24}
            color="currentColor"
            variant="Linear"
            className="mb-3 text-primary animate-pulse"
          />
          <p className="text-sm font-semibold">Adicione widgets ao cockpit</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Personalize o que aparece aqui embaixo
          </p>
          <Button
            onClick={() => setPersonalizing(true)}
            className="mt-4 h-9 gap-2 rounded-xl bg-primary px-4 text-sm text-primary-foreground hover:bg-primary-glow font-semibold"
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
    <div className="group flex h-full items-center gap-3.5 glass-panel-premium hover-redesign-card p-3.5 sm:gap-4 sm:p-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] sm:size-12 sm:rounded-2xl transition group-hover:bg-primary/10">
        <Icon size={20} color="var(--color-primary)" variant="Linear" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-0.5 whitespace-nowrap font-display text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-[#90F826]">{sub}</p>}
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
        <div className="glass-panel-premium p-3.5 sm:p-4 hover-redesign-card">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] sm:size-12 sm:rounded-2xl">
              <TrendUp size={20} color="var(--color-primary)" variant="Linear" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Meta do mês
              </p>
              <p className="mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                {metaPct.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{
                width: `${Math.min(100, metaPct)}%`,
                boxShadow: "0 0 10px oklch(0.88 0.22 130 / 0.5)",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between items-center text-[11px] text-muted-foreground">
            <span>{brl(p.realizado)} realizado</span>
            <span>meta {brl(p.atingiuMeta ? p.superMeta : p.meta)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar Panel
// ---------------------------------------------------------------------------

function CalendarPanel() {
  const hoje = new Date();
  const { eventos } = useAgendaSupa();
  const [mesRef, setMesRef] = useState(hoje);

  const inicio = startOfMonth(mesRef);
  const fim = endOfMonth(mesRef);
  const dias = eachDayOfInterval({ start: inicio, end: fim });

  const diasComEvento = new Set(
    eventos
      .filter((e) => isSameMonth(new Date(e.inicio), mesRef))
      .map((e) => new Date(e.inicio).getDate()),
  );

  const offset = (inicio.getDay() + 6) % 7;

  const proximosEventos = eventos
    .filter((e) => new Date(e.inicio) >= hoje)
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    .slice(0, 3);

  return (
    <div className="glass-panel-premium p-5 hover-redesign-card">
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
            <div
              key={n}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-[11px] leading-none transition",
                ehHoje
                  ? "bg-primary font-bold text-primary-foreground shadow-[0_0_8px_var(--primary)]"
                  : "cursor-pointer text-foreground/70 hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              {n}
              {temEvento && !ehHoje && (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </div>
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
                <p className="truncate text-[11px] text-foreground/80 font-medium">{e.titulo}</p>
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
        className="mt-3 block text-center text-[11px] text-muted-foreground hover:text-primary font-medium"
      >
        Ver agenda completa →
      </Link>
    </div>
  );
}
