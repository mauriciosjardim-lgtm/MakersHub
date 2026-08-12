import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  Loader2,
  MessageSquareText,
  Milestone,
  PlayCircle,
  Plus,
  RotateCcw,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  DocumentText1,
  Element3,
  FolderOpen as FolderOpenIcon,
  Gallery,
  LogoutCurve,
  ShieldTick,
  TickCircle,
  VideoPlay,
  type Icon as IconsaxIcon,
} from "iconsax-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getPublicClientPortal,
  portalAccentColor,
  portalCoverUrl,
  portalDeliverableAfterDecision,
  portalDisplayProgress,
  portalSlug,
  respondPortalReview,
  type ClientPortalSnapshot,
  type PortalDeliverable,
  type PortalProject,
} from "@/lib/portal-cliente";
import { portalSupabase } from "@/lib/portal-supabase";
import { getReviewEmbedUrl } from "@/lib/client-reviews";
import { cn } from "@/lib/utils";
import {
  isValidClientAdjustmentTimecode,
  maskClientAdjustmentTimecode,
  normalizeClientAdjustmentTimecode,
} from "@/lib/client-adjustments";

export const Route = createFileRoute("/portal/$token")({
  ssr: false,
  component: ClientPortalPage,
});

type PortalView =
  | "overview"
  | "production"
  | "approvals"
  | "deliveries"
  | "resources"
  | "contracts";

const VIEW_TITLES: Record<PortalView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Visão geral",
    title: "Seu projeto, sem ruído.",
    description: "O que está acontecendo agora, o que depende de você e o que vem em seguida.",
  },
  production: {
    eyebrow: "Produção atual",
    title: "Acompanhe cada etapa.",
    description: "Cronograma, progresso e marcos da produção em andamento.",
  },
  approvals: {
    eyebrow: "Central de aprovações",
    title: "Decida com clareza.",
    description: "Revise os materiais pendentes e acompanhe tudo o que já foi aprovado.",
  },
  deliveries: {
    eyebrow: "Arquivo de entregas",
    title: "Tudo no lugar certo.",
    description: "Acesse materiais entregues, organizados por ano e mês.",
  },
  resources: {
    eyebrow: "Central de arquivos",
    title: "Documentos úteis.",
    description: "Briefings, guias, cronogramas e arquivos compartilhados pela equipe.",
  },
  contracts: {
    eyebrow: "Contratos",
    title: "Documentos e assinaturas.",
    description: "Consulte contratos, acompanhe assinaturas e baixe as versões finais.",
  },
};

const PORTAL_MENU: Array<{
  id: PortalView;
  label: string;
  shortLabel: string;
  icon: IconsaxIcon;
}> = [
  { id: "overview", label: "Visão geral", shortLabel: "Início", icon: Element3 },
  { id: "production", label: "Produção atual", shortLabel: "Produção", icon: VideoPlay },
  { id: "approvals", label: "Aprovações", shortLabel: "Aprovações", icon: TickCircle },
  { id: "deliveries", label: "Entregas", shortLabel: "Entregas", icon: Gallery },
  { id: "resources", label: "Arquivos úteis", shortLabel: "Arquivos", icon: FolderOpenIcon },
  { id: "contracts", label: "Contratos", shortLabel: "Contratos", icon: DocumentText1 },
];

const PHASES: Record<string, string> = {
  briefing: "Briefing",
  pre: "Pré-produção",
  pre_producao: "Pré-produção",
  captacao: "Captação",
  edicao: "Edição",
  editando: "Editando",
  preparacao: "Preparação",
  planejamento: "Planejamento",
  producao: "Produção",
  aguardando_aprovacao: "Aguardando aprovação",
  ajustes: "Ajustes",
  aprovado: "Aprovado",
  entregue: "Entregue",
  revisao: "Revisão",
  entrega: "Entrega",
  concluido: "Concluído",
  concluida: "Concluído",
  pausado: "Pausado",
};

const DELIVERABLE_STATUS: Record<string, { label: string; classes: string }> = {
  pendente: { label: "Pendente", classes: "bg-white/5 text-white/50" },
  em_producao: { label: "Em produção", classes: "bg-blue-400/10 text-blue-300" },
  revisao: { label: "Aguardando aprovação", classes: "bg-amber-400/10 text-amber-300" },
  ajustes: { label: "Ajustes solicitados", classes: "bg-red-400/10 text-red-300" },
  aprovado: { label: "Aprovado", classes: "bg-lime-400/10 text-lime-300" },
  entregue: { label: "Entregue", classes: "bg-lime-400/10 text-lime-300" },
};

function formatDate(value: string | null) {
  if (!value) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function driveThumbnailUrl(fileId?: string | null) {
  const id = fileId?.trim();
  if (!id || !/^[\w-]{10,}$/.test(id)) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
}

function portalInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function viewFromHash(): PortalView {
  if (typeof window === "undefined") return "overview";
  const candidate = window.location.hash.replace("#", "") as PortalView;
  return candidate in VIEW_TITLES ? candidate : "overview";
}

function ClientPortalPage() {
  const { token } = Route.useParams();
  const [portal, setPortal] = useState<ClientPortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [view, setView] = useState<PortalView>("overview");
  const [signingOut, setSigningOut] = useState(false);

  useLayoutEffect(() => {
    if (/^[a-f0-9]{24,64}$/i.test(token)) {
      window.history.replaceState(
        window.history.state,
        "",
        `/portal/acesso${window.location.hash}`,
      );
    }
  }, [token]);

  const load = useCallback(async () => {
    let redirectingToLogin = false;
    setLoadError(null);
    setNotFound(false);
    try {
      if (!(import.meta.env.DEV && token === "preview")) {
        const {
          data: { session },
        } = await portalSupabase.auth.getSession();
        if (!session) {
          redirectingToLogin = true;
          const next = `${window.location.pathname}${window.location.hash}`;
          window.location.replace(`/portal/login?next=${encodeURIComponent(next)}`);
          return;
        }
      }
      const snapshot = await getPublicClientPortal(token);
      if (!snapshot) {
        setNotFound(true);
        return;
      }
      setPortal(snapshot);
      setActiveProjectId((current) => current ?? snapshot.projects[0]?.id ?? null);
      if (!(import.meta.env.DEV && token === "preview")) {
        const prettyPath = `/portal/${portalSlug(snapshot.client.name)}`;
        if (window.location.pathname !== prettyPath) {
          window.history.replaceState(
            window.history.state,
            "",
            `${prettyPath}${window.location.hash}`,
          );
        }
      }
    } catch {
      setLoadError(
        "Não foi possível carregar o portal agora. Sua conta e seus arquivos continuam seguros.",
      );
    } finally {
      if (!redirectingToLogin) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const activeProject = useMemo(
    () => portal?.projects.find((project) => project.id === activeProjectId) ?? portal?.projects[0],
    [activeProjectId, portal],
  );

  const navigate = (next: PortalView) => {
    setView(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await portalSupabase.auth.signOut({ scope: "local" });
    } finally {
      window.location.replace("/portal/login");
    }
  };

  const respond = async (
    deliverable: PortalDeliverable,
    decision: "approved" | "changes_requested",
    feedback?: string,
  ): Promise<boolean> => {
    setApprovingId(deliverable.id);
    try {
      const success = await respondPortalReview(
        token,
        deliverable.review_id || deliverable.id,
        decision,
        feedback,
        portal?.client.responsible_name || portal?.client.name,
      );
      if (!success) throw new Error("Não foi possível registrar");
      toast.success(
        decision === "approved"
          ? "Material aprovado e liberado em Entregas"
          : "Alterações enviadas para a produtora",
      );
      if (import.meta.env.DEV && token === "preview") {
        setPortal((current) =>
          current
            ? {
                ...current,
                projects: current.projects.map((project) => ({
                  ...project,
                  deliverables: project.deliverables.map((item) =>
                    item.id === deliverable.id
                      ? portalDeliverableAfterDecision(item, decision, feedback)
                      : item,
                  ),
                })),
              }
            : current,
        );
      } else {
        await load();
      }
      return true;
    } catch {
      toast.error("Não foi possível registrar sua decisão");
      return false;
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background text-foreground">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center text-foreground">
        <div className="max-w-sm">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.06]">
            <AlertTriangle className="size-6 text-amber-300" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Não foi possível carregar o portal</h1>
          <p className="mt-2 text-sm leading-6 text-white/40">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-xs font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !portal) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center text-foreground">
        <div>
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/5">
            <FolderOpen className="size-6 text-white/40" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Portal indisponível</h1>
          <p className="mt-2 max-w-sm text-sm text-white/40">
            Este link foi desativado ou não existe. Solicite um novo acesso à sua produtora.
          </p>
        </div>
      </div>
    );
  }

  const accent = portalAccentColor(portal.company.accent_color);
  const title = VIEW_TITLES[view];

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground"
      style={{ "--portal-accent": accent } as React.CSSProperties}
    >
      <PortalSidebar
        portal={portal}
        project={activeProject}
        activeView={view}
        onNavigate={navigate}
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <div className="min-w-0 lg:pl-[272px]">
        <PortalTopbar
          portal={portal}
          view={view}
          onNavigate={navigate}
          onSignOut={signOut}
          signingOut={signingOut}
        />

        <main className="mx-auto max-w-[1380px] px-4 pb-28 pt-6 sm:px-5 md:px-8 md:pt-10 lg:pb-10 xl:px-12">
          <PageHeading title={title} accent={accent} />

          {view === "overview" && (
            <OverviewView
              portal={portal}
              project={activeProject}
              onNavigate={navigate}
              accent={accent}
            />
          )}
          {view === "production" && (
            <ProductionView
              portal={portal}
              project={activeProject}
              activeProjectId={activeProjectId}
              setActiveProjectId={setActiveProjectId}
              accent={accent}
            />
          )}
          {view === "approvals" && (
            <ApprovalsView
              projects={portal.projects}
              approvingId={approvingId}
              onRespond={respond}
              accent={accent}
            />
          )}
          {view === "deliveries" && (
            <DeliveriesArchive portal={portal} onNavigate={navigate} accent={accent} />
          )}
          {view === "resources" && <ResourcesView portal={portal} accent={accent} />}
          {view === "contracts" && <ContractsView portal={portal} accent={accent} />}
        </main>
      </div>
    </div>
  );
}

function PortalSidebar({
  portal,
  project,
  activeView,
  onNavigate,
  onSignOut,
  signingOut,
}: {
  portal: ClientPortalSnapshot;
  project?: PortalProject;
  activeView: PortalView;
  onNavigate: (view: PortalView) => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const approvals = portal.projects.reduce(
    (total, item) =>
      total +
      item.deliverables.filter(
        (deliverable) => deliverable.kind !== "delivery" && deliverable.status === "revisao",
      ).length,
    0,
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        {portal.company.logo_url ? (
          <img src={portal.company.logo_url} alt="" className="size-10 rounded-xl object-contain" />
        ) : (
          <div className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_0_24px_-5px_var(--primary)]">
            {portal.company.name.slice(0, 1).toUpperCase()}
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-semibold tracking-tight">
            {portal.company.name}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[.16em] text-muted-foreground/65">
            Área do cliente
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">
          {portalInitials(portal.client.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{portal.client.name}</p>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {project ? PHASES[project.phase] || project.phase : "Cliente"}
          </p>
        </div>
      </div>

      <p className="mb-2 mt-6 px-3 text-[10px] uppercase tracking-[.12em] text-muted-foreground/70">
        Navegação
      </p>
      <nav className="space-y-1">
        {PORTAL_MENU.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          const badge = id === "approvals" ? approvals : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium transition-all duration-200 hover:translate-x-0.5",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                size={22}
                color="currentColor"
                variant={active ? "Bulk" : "TwoTone"}
                className="shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              <span>{label}</span>
              {badge ? (
                <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[9px] font-bold text-primary-foreground">
                  {badge}
                </span>
              ) : null}
              {active && !badge && (
                <span className="ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mb-3 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-[11px] text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:cursor-wait disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LogoutCurve size={18} color="currentColor" variant="TwoTone" />
          )}
          {signingOut ? "Saindo…" : "Sair da conta"}
        </button>
        <p className="mt-3 flex items-center gap-2 border-t border-sidebar-border px-2 pt-4 text-[9px] uppercase tracking-[.13em] text-muted-foreground/50">
          <ShieldTick size={14} color="currentColor" variant="TwoTone" /> Ambiente privado
        </p>
      </div>
    </aside>
  );
}

function PortalTopbar({
  portal,
  view,
  onNavigate,
  onSignOut,
  signingOut,
}: {
  portal: ClientPortalSnapshot;
  view: PortalView;
  onNavigate: (view: PortalView) => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:h-16 sm:px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-black text-primary-foreground shadow-[0_0_18px_-5px_var(--primary)] lg:hidden">
            {portal.company.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground/60">
              Área do cliente
            </p>
            <p className="mt-0.5 text-xs font-medium">{VIEW_TITLES[view].eyebrow}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="grid size-9 place-items-center rounded-xl border border-border bg-surface-1/50 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-wait disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogoutCurve size={18} color="currentColor" variant="TwoTone" />
            )}
          </button>
          <span className="grid size-9 place-items-center rounded-xl border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">
            {portalInitials(portal.client.name)}
          </span>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-sidebar-border bg-sidebar/95 px-1 pt-1.5 pb-[max(.4rem,env(safe-area-inset-bottom))] shadow-[0_-18px_45px_-28px_rgba(0,0,0,.95)] backdrop-blur-xl lg:hidden">
        {PORTAL_MENU.map(({ id, shortLabel, icon: Icon }) => {
          const active = id === view;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[8px] font-medium transition",
                active
                  ? "text-sidebar-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              )}
              <Icon size={20} color="currentColor" variant={active ? "Bulk" : "TwoTone"} />
              <span className="max-w-full truncate">{shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

function PageHeading({
  title,
  accent,
}: {
  title: { eyebrow: string; title: string; description: string };
  accent: string;
}) {
  return (
    <header className="mb-6 border-b border-white/[0.07] pb-5 md:mb-8 md:pb-7">
      <div>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <p className="text-[10px] font-medium uppercase tracking-[.18em] text-white/45">
            {title.eyebrow}
          </p>
        </div>
        <h1 className="mt-2.5 text-[2rem] font-semibold leading-[1.05] tracking-[-.045em] md:mt-3 md:text-5xl">
          {title.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">{title.description}</p>
      </div>
    </header>
  );
}

function OverviewView({
  portal,
  project,
  onNavigate,
  accent,
}: {
  portal: ClientPortalSnapshot;
  project?: PortalProject;
  onNavigate: (view: PortalView) => void;
  accent: string;
}) {
  if (!project) return <EmptyState />;
  const approvals = portal.projects.flatMap((item) =>
    item.deliverables.filter(
      (deliverable) => deliverable.kind !== "delivery" && deliverable.status === "revisao",
    ),
  );
  const changesRequested = project.deliverables.filter(
    (item) => item.kind !== "delivery" && item.status === "ajustes",
  );
  const displayPhase = changesRequested.length > 0 ? "ajustes" : project.phase;
  const displayProgress = portalDisplayProgress(project.progress, displayPhase);
  const nextMilestone = project.milestones.find((item) => item.status !== "concluido");
  return (
    <div className="space-y-5">
      {approvals.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigate("approvals")}
          aria-label={`Abrir ${approvals.length} ${approvals.length === 1 ? "material pendente" : "materiais pendentes"} de aprovação`}
          className="portal-approval-alert group relative flex w-full overflow-hidden rounded-3xl border border-[var(--portal-accent)]/25 p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/70 md:items-center md:p-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,color-mix(in_srgb,var(--portal-accent)_18%,transparent),transparent_32%)]" />
          <AlertTriangle className="relative mt-0.5 size-6 shrink-0 text-[var(--portal-accent)] md:size-7" />
          <div className="relative ml-4 min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--portal-accent)]">
              Sua atenção é necessária
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-.035em] md:text-2xl">
              {approvals.length === 1
                ? "1 material aguarda sua aprovação"
                : `${approvals.length} materiais aguardam sua aprovação`}
            </h2>
            <p className="mt-1 text-xs text-white/38">
              Revise os vídeos para que a produção continue sem atrasos.
            </p>
          </div>
          <div className="relative ml-4 hidden items-center gap-3 md:flex">
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[.14em] text-white/25">Próximo prazo</p>
              <p className="mt-1 text-xs font-medium text-white/65">
                {formatDate(approvals.find((item) => item.due_at)?.due_at || null)}
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-full bg-[var(--portal-accent)] text-black transition group-hover:scale-105">
              <ChevronRight className="size-4" />
            </span>
          </div>
        </button>
      )}

      {approvals.length === 0 && changesRequested.length > 0 && (
        <section className="flex items-start gap-4 rounded-3xl border border-blue-300/15 bg-blue-300/[0.055] p-5 md:p-6">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-blue-200" />
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-200">
              Alterações recebidas
            </p>
            <h2 className="mt-2 text-lg font-semibold">Sua solicitação já está com a produtora</h2>
            <p className="mt-1 text-xs leading-5 text-white/40">
              O progresso do projeto foi preservado. Uma nova versão aparecerá aqui quando estiver
              pronta para revisão.
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.45fr_.55fr]">
        <button
          type="button"
          onClick={() => onNavigate(approvals.length > 0 ? "approvals" : "production")}
          aria-label={
            approvals.length > 0
              ? `Revisar materiais de ${project.name}`
              : `Ver andamento de ${project.name}`
          }
          className="portal-hero group relative flex min-h-[360px] w-full flex-col justify-end overflow-hidden rounded-3xl border border-white/[0.08] text-left outline-none transition hover:border-white/[0.16] focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/70 md:min-h-[420px]"
        >
          <img
            src={portalCoverUrl(project.cover_url)}
            alt=""
            className="absolute inset-0 size-full scale-105 object-cover transition duration-[1.2s] ease-out group-hover:scale-110"
          />
          <div className="portal-hero-scrim absolute inset-0" />
          <div className="portal-stage-grain absolute inset-0 opacity-40" />
          <span className="portal-scanline absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="relative p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-accent)]/30 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--portal-accent)] backdrop-blur-sm">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--portal-accent)] opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-[var(--portal-accent)]" />
                  </span>
                  {PHASES[displayPhase] || displayPhase}
                </span>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.05] tracking-[-.045em] md:text-[2.6rem]">
                  {project.name}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                  {project.description}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-5xl font-semibold tracking-[-.06em] tabular-nums md:text-6xl">
                  {displayProgress}
                  <span className="text-2xl text-white/40">%</span>
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-white/40">
                  concluído
                </p>
              </div>
            </div>
            <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/[0.12]">
              <div
                className="h-full rounded-full shadow-[0_0_16px_var(--portal-accent)] transition-[width] duration-700"
                style={{ width: `${displayProgress}%`, backgroundColor: accent }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[.14em] text-white/45">
              <span className="flex flex-wrap gap-x-5 gap-y-2">
                <span>Início · {formatDate(project.start_date)}</span>
                <span>Entrega · {formatDate(project.due_date)}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[var(--portal-accent)] transition group-hover:gap-3">
                {approvals.length > 0
                  ? `Revisar ${approvals.length} ${approvals.length === 1 ? "material" : "materiais"}`
                  : "Ver andamento"}
                <ChevronRight className="size-3.5" />
              </span>
            </div>
          </div>
        </button>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <SummaryCard
            label="Aguardando você"
            value={approvals.length}
            detail="materiais para aprovar"
            icon={ClipboardCheck}
            onClick={() => onNavigate("approvals")}
          />
          <SummaryCard
            label="Arquivos disponíveis"
            value={portal.files.length}
            detail="documentos úteis"
            icon={FolderOpen}
            onClick={() => onNavigate("resources")}
          />
        </div>
      </section>

      <OverviewFolderStrip
        portal={portal}
        project={project}
        onNavigate={onNavigate}
        accent={accent}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => onNavigate("production")}
          className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition hover:bg-white/[0.035]"
        >
          <div className="flex items-center gap-2 text-[var(--portal-accent)]">
            <Milestone className="size-4" />
            <span className="text-[10px] uppercase tracking-[.15em]">Próximo marco</span>
          </div>
          <p className="mt-4 text-lg font-semibold">
            {nextMilestone?.title || "Cronograma em atualização"}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {nextMilestone
              ? formatDate(nextMilestone.date)
              : "A equipe publicará as próximas datas."}
          </p>
          <ChevronRight className="ml-auto mt-4 size-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[var(--portal-accent)]" />
        </button>
        <button
          onClick={() => onNavigate("deliveries")}
          className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition hover:bg-white/[0.035]"
        >
          <div className="flex items-center gap-2 text-[var(--portal-accent)]">
            <FolderOpen className="size-4" />
            <span className="text-[10px] uppercase tracking-[.15em]">Arquivo de entregas</span>
          </div>
          <p className="mt-4 text-lg font-semibold">Materiais organizados por período</p>
          <p className="mt-1 text-xs text-white/30">
            Encontre rapidamente tudo o que já foi entregue.
          </p>
          <ChevronRight className="ml-auto mt-4 size-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[var(--portal-accent)]" />
        </button>
      </section>
    </div>
  );
}

function OverviewFolderStrip({
  portal,
  project,
  onNavigate,
  accent,
}: {
  portal: ClientPortalSnapshot;
  project: PortalProject;
  onNavigate: (view: PortalView) => void;
  accent: string;
}) {
  const delivered = project.deliverables.filter(
    (item) =>
      item.kind === "delivery" && (item.status === "aprovado" || item.status === "entregue"),
  );
  const monthLabel = (value: string | null | undefined) => {
    if (!value) return "Período atual";
    const normalized = value.includes("T") ? value : `${value}T12:00:00Z`;
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(normalized));
  };
  const latestDelivered = delivered
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];

  const folders: Array<{
    title: string;
    detail: string;
    meta: string;
    view: PortalView;
  }> = [
    {
      title: monthLabel(project.due_date),
      detail: `${project.deliverables.length} materiais no ciclo`,
      meta: "Produção atual",
      view: "production",
    },
    {
      title: latestDelivered ? monthLabel(latestDelivered.created_at) : "Entregas finais",
      detail: `${delivered.length} ${delivered.length === 1 ? "arquivo liberado" : "arquivos liberados"}`,
      meta: "Arquivo de entregas",
      view: "deliveries",
    },
    {
      title: "Documentos",
      detail: `${portal.files.length} ${portal.files.length === 1 ? "arquivo útil" : "arquivos úteis"}`,
      meta: "Guias e briefings",
      view: "resources",
    },
    {
      title: "Contratos",
      detail: `${portal.contracts.length} ${portal.contracts.length === 1 ? "documento" : "documentos"}`,
      meta: "Assinaturas e versões",
      view: "contracts",
    },
  ];

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.012] p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4" style={{ color: accent }} />
            <p className="text-[9px] font-medium uppercase tracking-[.18em] text-white/28">
              Acesso rápido
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-[-.025em]">Seus materiais</h2>
        </div>
        <button
          onClick={() => onNavigate("deliveries")}
          className="inline-flex items-center gap-1.5 text-[10px] text-white/28 transition hover:text-[var(--portal-accent)]"
        >
          Ver arquivo completo <ChevronRight className="size-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <button
            key={`${folder.title}-${folder.view}`}
            onClick={() => onNavigate(folder.view)}
            className="portal-overview-folder group relative min-h-40 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018] p-3.5 text-left transition duration-300 hover:-translate-y-1 hover:border-[var(--portal-accent)]/25 hover:bg-white/[0.03] sm:min-h-[188px] sm:p-4"
          >
            <div className="portal-folder portal-folder-lime mt-2 origin-top-left scale-[.75] sm:mt-3 sm:scale-[.9]">
              <span />
            </div>
            <ChevronRight className="absolute right-4 top-4 size-3.5 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-[var(--portal-accent)]" />
            <div className="mt-2 sm:mt-5">
              <h3 className="text-sm font-semibold capitalize">{folder.title}</h3>
              <p className="mt-1 text-[10px] text-white/30">{folder.detail}</p>
              <p className="mt-2 text-[8px] uppercase tracking-[.14em] text-white/18">
                {folder.meta}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof ClipboardCheck;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="portal-summary-card group relative flex min-h-40 flex-col overflow-hidden rounded-3xl border border-white/[0.08] p-5 text-left transition duration-300"
    >
      <div className="portal-summary-glow absolute inset-0" />
      <Icon className="portal-summary-watermark absolute -bottom-5 -right-3 size-32 stroke-[1]" />

      <div className="relative flex items-start justify-between">
        <span className="portal-summary-icon grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[var(--portal-accent)]">
          <Icon className="size-4" />
        </span>
        <span className="grid size-8 place-items-center rounded-full border border-white/[0.06] text-white/20 transition duration-300 group-hover:border-[var(--portal-accent)]/25 group-hover:text-[var(--portal-accent)]">
          <ChevronRight className="size-3.5 transition duration-300 group-hover:translate-x-0.5" />
        </span>
      </div>

      <div className="relative mt-auto pt-5">
        <p className="text-[9px] font-medium uppercase tracking-[.17em] text-white/30">{label}</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="text-[2.6rem] font-semibold leading-none tracking-[-.07em] text-[var(--portal-accent)] tabular-nums">
            {String(value).padStart(2, "0")}
          </p>
          <p className="pb-1 text-[11px] text-white/32">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function ProductionView({
  portal,
  project,
  activeProjectId,
  setActiveProjectId,
  accent,
}: {
  portal: ClientPortalSnapshot;
  project?: PortalProject;
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  accent: string;
}) {
  if (!project) return <EmptyState />;
  const displayProgress = portalDisplayProgress(project.progress, project.phase);
  return (
    <div className="space-y-5">
      {portal.projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {portal.projects.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveProjectId(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs",
                item.id === activeProjectId
                  ? "border-transparent text-black"
                  : "border-white/10 text-white/40",
              )}
              style={item.id === activeProjectId ? { backgroundColor: accent } : undefined}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[.15em] text-[var(--portal-accent)]">
              {PHASES[project.phase] || project.phase}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.04em] md:text-4xl">
              {project.name}
            </h2>
          </div>
          <p className="text-4xl font-semibold">
            {displayProgress}
            <span className="text-lg text-white/25">%</span>
          </p>
        </div>
        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{ width: `${displayProgress}%`, backgroundColor: accent }}
          />
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <MilestonesPanel project={project} accent={accent} />
        <ProductionStatus project={project} accent={accent} />
      </div>
    </div>
  );
}

function MilestonesPanel({ project, accent }: { project: PortalProject; accent: string }) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
      <h3 className="text-sm font-semibold">Cronograma</h3>
      <ol className="mt-6 space-y-1">
        {project.milestones.map((item, index) => {
          const done = item.status === "concluido";
          return (
            <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < project.milestones.length - 1 && (
                <span className="absolute left-[9px] top-6 h-[calc(100%-12px)] w-px bg-white/10" />
              )}
              {done ? (
                <CheckCircle2
                  className="relative z-10 mt-0.5 size-[19px] shrink-0"
                  style={{ color: accent }}
                />
              ) : (
                <Circle className="relative z-10 mt-0.5 size-[19px] shrink-0 fill-[#080a09] text-white/20" />
              )}
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div>
                  <p
                    className={cn("text-sm", done ? "text-white/35 line-through" : "text-white/80")}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] text-white/25">{formatDate(item.date)}</p>
                </div>
                <span className="text-[9px] uppercase tracking-[.12em] text-white/22">
                  {done ? "Concluído" : "Próximo"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProductionStatus({ project, accent }: { project: PortalProject; accent: string }) {
  const statuses = [
    {
      label: "Em produção",
      count: project.deliverables.filter((item) => item.status === "em_producao").length,
    },
    {
      label: "Em revisão",
      count: project.deliverables.filter((item) => item.status === "revisao").length,
    },
    {
      label: "Aprovados",
      count: project.deliverables.filter(
        (item) => item.status === "aprovado" || item.status === "entregue",
      ).length,
    },
  ];
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
      <h3 className="text-sm font-semibold">Materiais da produção</h3>
      <div className="mt-5 space-y-3">
        {statuses.map((item, index) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] p-4"
          >
            <span
              className="grid size-9 place-items-center rounded-xl bg-white/[0.04] text-xs font-semibold"
              style={index === 2 ? { color: accent } : undefined}
            >
              {item.count}
            </span>
            <span className="text-sm text-white/55">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApprovalsView({
  projects,
  approvingId,
  onRespond,
  accent,
}: {
  projects: PortalProject[];
  approvingId: string | null;
  onRespond: (
    item: PortalDeliverable,
    decision: "approved" | "changes_requested",
    feedback?: string,
  ) => Promise<boolean>;
  accent: string;
}) {
  const items = projects.flatMap((project) =>
    project.deliverables.map((item) => ({ item, project })),
  );
  const pending = items.filter(({ item }) => item.kind !== "delivery" && item.status === "revisao");
  const history = items.filter(
    ({ item }) =>
      item.kind !== "delivery" &&
      (item.status === "aprovado" || item.status === "entregue" || item.status === "ajustes"),
  );
  const totalReviews = pending.length + history.length;
  const completedPercentage =
    totalReviews > 0 ? Math.round((history.length / totalReviews) * 100) : 100;
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Aguardando sua decisão</h2>
            <p className="mt-1 text-xs text-white/45">
              Revise cada material separadamente. Seu progresso fica salvo.
            </p>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-label="Progresso das aprovações"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completedPercentage}
            >
              <div
                className="h-full rounded-full bg-[var(--portal-accent)] transition-[width] duration-500"
                style={{ width: `${completedPercentage}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 sm:mt-0 sm:shrink-0">
            <strong className="text-2xl font-semibold tracking-[-.04em] text-white">
              {pending.length}
            </strong>
            <span className="text-[10px] uppercase tracking-[.14em] text-white/40">pendentes</span>
          </div>
        </div>
        {pending.length === 0 ? (
          <EmptyPanel
            icon={CheckCircle2}
            title="Nenhuma aprovação pendente"
            description="Você está em dia com a equipe."
          />
        ) : (
          <div className="space-y-4">
            {pending.map(({ item, project }, index) => (
              <ApprovalCard
                key={item.id}
                item={item}
                priority={index === 0}
                approving={approvingId === item.id}
                onRespond={onRespond}
                accent={accent}
                cover={portalCoverUrl(project.cover_url)}
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-4 text-sm font-semibold">Histórico de aprovações</h2>
        {history.length === 0 ? (
          <EmptyPanel
            icon={ClipboardCheck}
            title="O histórico começa aqui"
            description="As decisões dos seus projetos aparecerão nesta seção."
          />
        ) : (
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
            {history.map(({ item, project }) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                {item.status === "ajustes" ? (
                  <MessageSquareText className="size-4 text-red-300" />
                ) : (
                  <CheckCircle2 className="size-4" style={{ color: accent }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.title}</span>
                  {projects.length > 1 && (
                    <span className="mt-0.5 block truncate text-[9px] text-white/25">
                      {project.name}
                    </span>
                  )}
                </span>
                <span className="hidden text-[10px] uppercase tracking-[.12em] text-white/25 sm:inline">
                  {item.status === "ajustes" ? "Alterações solicitadas" : "Aprovado"}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${item.title}`}
                    className="rounded-lg p-2 text-white/30 hover:bg-white/[0.05] hover:text-white"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ApprovalCard({
  item,
  priority,
  approving,
  onRespond,
  accent,
  cover,
}: {
  item: PortalDeliverable;
  priority: boolean;
  approving: boolean;
  onRespond: (
    item: PortalDeliverable,
    decision: "approved" | "changes_requested",
    feedback?: string,
  ) => Promise<boolean>;
  accent: string;
  cover?: string | null;
}) {
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [adjustmentPoints, setAdjustmentPoints] = useState([
    { id: "initial", time: "", change: "" },
  ]);
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSlow, setPreviewSlow] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(priority);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [useNativeMobilePlayer, setUseNativeMobilePlayer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches &&
      Boolean(item.drive_file_id),
  );
  const thumbnail = driveThumbnailUrl(item.drive_file_id);
  const poster = thumbnailFailed ? cover : thumbnail || cover;
  const embedUrl = item.embed_url || (item.url ? getReviewEmbedUrl(item.url) : null);
  const nativeVideoUrl = item.drive_file_id
    ? `/api/portal/media/${encodeURIComponent(item.drive_file_id)}`
    : null;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const syncPlayer = () => setUseNativeMobilePlayer(media.matches && Boolean(nativeVideoUrl));
    syncPlayer();
    media.addEventListener("change", syncPlayer);
    return () => media.removeEventListener("change", syncPlayer);
  }, [nativeVideoUrl]);

  useEffect(() => {
    setPreviewReady(false);
    setPreviewSlow(false);
    setPreviewRequested(priority);
    setThumbnailFailed(false);
  }, [item.drive_file_id, embedUrl, priority, useNativeMobilePlayer]);

  useEffect(() => {
    if (useNativeMobilePlayer || !embedUrl || !previewRequested || previewReady) return;
    const timeout = window.setTimeout(() => setPreviewSlow(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, [embedUrl, previewReady, previewRequested, useNativeMobilePlayer]);

  const requestChanges = async () => {
    const validPoints = adjustmentPoints.filter((point) => point.change.trim());
    const hasInvalidTime = validPoints.some(
      (point) => point.time.trim() && !isValidClientAdjustmentTimecode(point.time),
    );
    if (validPoints.length === 0 || hasInvalidTime || approving) return;
    const feedback = [
      "AJUSTES SOLICITADOS",
      ...validPoints.map(
        (point, index) => `${index + 1}. [${point.time.trim() || "Geral"}] ${point.change.trim()}`,
      ),
    ].join("\n");
    const success = await onRespond(item, "changes_requested", feedback);
    if (success) {
      setAdjustmentPoints([{ id: "initial", time: "", change: "" }]);
      setRequestingChanges(false);
    }
  };

  const updateAdjustmentPoint = (id: string, field: "time" | "change", value: string) => {
    setAdjustmentPoints((current) =>
      current.map((point) => (point.id === id ? { ...point, [field]: value } : point)),
    );
  };

  const addAdjustmentPoint = () => {
    setAdjustmentPoints((current) => [
      ...current,
      { id: `point-${Date.now()}-${current.length}`, time: "", change: "" },
    ]);
  };

  const removeAdjustmentPoint = (id: string) => {
    setAdjustmentPoints((current) => current.filter((point) => point.id !== id));
  };

  const hasAdjustment = adjustmentPoints.some((point) => point.change.trim());
  const hasInvalidAdjustmentTime = adjustmentPoints.some(
    (point) => point.time.trim() && !isValidClientAdjustmentTimecode(point.time),
  );

  const approve = async () => {
    if (approving) return;
    const success = await onRespond(item, "approved");
    if (success) setConfirmingApproval(false);
  };

  return (
    <article
      className="group grid overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.025] transition hover:border-[var(--portal-accent)]/25 lg:grid-cols-[minmax(360px,.95fr)_minmax(0,1.05fr)]"
      aria-busy={approving}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black lg:self-start">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading={priority ? "eager" : "lazy"}
            onError={() => {
              if (thumbnail) setThumbnailFailed(true);
            }}
            className="absolute inset-0 size-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(144,248,38,.06),transparent_55%),#0c0e0c]" />
        )}
        {useNativeMobilePlayer && nativeVideoUrl && previewRequested ? (
          <video
            src={nativeVideoUrl}
            poster={poster || undefined}
            controls
            playsInline
            preload={priority ? "metadata" : "none"}
            className="absolute inset-0 size-full bg-black object-contain"
            onLoadedMetadata={() => setPreviewReady(true)}
            onCanPlay={() => setPreviewReady(true)}
            onLoadedData={() => setPreviewReady(true)}
          />
        ) : embedUrl && previewRequested ? (
          <iframe
            src={embedUrl}
            title={`${item.title} ${item.version_label || ""}`}
            className={cn(
              "absolute inset-0 size-full transition-opacity duration-300",
              previewReady ? "opacity-100" : "opacity-0",
            )}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading={priority ? "eager" : "lazy"}
            onLoad={() => setPreviewReady(true)}
          />
        ) : null}
        {!useNativeMobilePlayer && embedUrl && previewRequested && !previewReady && (
          <div
            className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
          >
            <div className="flex max-w-[80%] flex-col items-center text-center">
              <span className="grid size-12 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                <Loader2 className="size-5 animate-spin text-[var(--portal-accent)]" />
              </span>
              <p className="mt-3 text-xs font-medium text-white/70">
                {previewSlow ? "O Google Drive está demorando um pouco" : "Preparando o preview"}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-white/35">
                {previewSlow
                  ? "Você pode continuar navegando enquanto o vídeo carrega."
                  : "Conectando ao Google Drive…"}
              </p>
              {previewSlow && item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto mt-3 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                >
                  Abrir direto no Drive
                </a>
              )}
            </div>
          </div>
        )}
        {(!embedUrl || !previewRequested) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/35" />
        )}
        {embedUrl && !previewRequested && (
          <button
            type="button"
            onClick={() => setPreviewRequested(true)}
            className="absolute inset-0 grid place-items-center"
            aria-label={`Carregar preview de ${item.title}`}
          >
            <span className="flex flex-col items-center">
              <span className="grid size-16 place-items-center rounded-full bg-black/45 ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:ring-[var(--portal-accent)]/60">
                <PlayCircle className="size-8 text-white" />
              </span>
              <span className="mt-3 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
                Carregar vídeo
              </span>
            </span>
          </button>
        )}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 items-start justify-between gap-2 p-3",
            embedUrl && previewRequested ? "hidden sm:flex" : "flex",
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.14em] text-amber-200 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-300" />
            </span>
            Aguardando aprovação
          </span>
          <span className="max-w-[40%] truncate rounded-full bg-black/60 px-2.5 py-1 text-[8px] font-medium uppercase tracking-[.12em] text-white/70 backdrop-blur-sm">
            {item.version_label || item.type}
          </span>
        </div>
        {!embedUrl && item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 grid place-items-center"
          >
            <span className="grid size-16 place-items-center rounded-full bg-black/35 ring-1 ring-white/25 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:ring-[var(--portal-accent)]/60">
              <PlayCircle className="size-8 text-white" />
            </span>
          </a>
        )}
      </div>
      <div className="flex h-full min-w-0 flex-col justify-between p-5 sm:p-6 lg:p-8">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[.18em] text-[var(--portal-accent)]">
            <span className="size-1.5 rounded-full bg-[var(--portal-accent)]" />
            {embedUrl && previewRequested && (
              <span className="rounded-full bg-white/[0.05] px-2 py-1 text-white/45 sm:hidden">
                {item.version_label || item.type}
              </span>
            )}
            Material para aprovação
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] uppercase tracking-[.13em] text-white/38">
            {item.content_cycle && <span>{item.content_cycle}</span>}
            {item.due_at && (
              <>
                {item.content_cycle && <span className="size-0.5 rounded-full bg-white/20" />}
                <span>Aprovar até {formatDate(item.due_at)}</span>
              </>
            )}
          </div>
          <h3 className="mt-2 max-w-2xl text-xl font-semibold leading-7 tracking-[-.035em] sm:text-2xl">
            {item.title}
          </h3>
          {item.notes && <p className="mt-2 text-xs leading-5 text-white/55">{item.notes}</p>}
        </div>
        {requestingChanges ? (
          <div className="mt-8 border-l-2 border-[var(--portal-accent)] pl-4">
            <p className="text-xs font-medium text-white/80">Quadro de ajustes aberto</p>
            <p className="mt-1 text-[11px] leading-5 text-white/38">
              Revise o vídeo e organize cada alteração no quadro abaixo.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <div className="mb-3">
              <p className="text-xs font-medium text-white/70">Registre sua decisão</p>
              <p className="mt-1 text-[11px] leading-4 text-white/35">
                Aprove o material ou indique pontos objetivos para a equipe.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRequestingChanges(true)}
                disabled={approving}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
              >
                <MessageSquareText className="size-3.5" /> Solicitar ajustes
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={() => setConfirmingApproval(true)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold text-black shadow-[0_8px_20px_-14px_var(--portal-accent)] transition hover:brightness-105 disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {approving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}{" "}
                Aprovar
              </button>
            </div>
          </div>
        )}
      </div>
      {requestingChanges && (
        <section className="border-t border-white/[0.08] bg-black/20 p-4 sm:p-6 lg:col-span-2 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--portal-accent)]/20 bg-[var(--portal-accent)]/[0.07] text-[var(--portal-accent)]">
                <MessageSquareText className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[-.01em] text-white">
                  Quadro de ajustes
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/40">
                  Um ponto por alteração. O tempo é opcional para ajustes gerais.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] uppercase tracking-[.1em] text-white/40">
              {adjustmentPoints.length} {adjustmentPoints.length === 1 ? "ponto" : "pontos"}
            </span>
          </div>
          {hasInvalidAdjustmentTime && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-200/80"
            >
              Revise o tempo destacado. Use MM:SS ou HH:MM:SS.
            </p>
          )}

          <div className="mt-5 space-y-3">
            {adjustmentPoints.map((point, index) => (
              <div
                key={point.id}
                className="relative grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 pr-12 sm:grid-cols-[40px_112px_minmax(0,1fr)] sm:items-start sm:p-4 sm:pr-14"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-[10px] font-semibold tabular-nums text-white/50 sm:mt-5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <label className="block">
                  <span className="flex h-3 items-center gap-1 text-[9px] font-medium uppercase tracking-[.12em] text-white/38">
                    <Clock3 className="size-3" /> Tempo
                  </span>
                  <input
                    value={point.time}
                    onChange={(event) =>
                      updateAdjustmentPoint(
                        point.id,
                        "time",
                        maskClientAdjustmentTimecode(event.target.value),
                      )
                    }
                    onBlur={() =>
                      updateAdjustmentPoint(
                        point.id,
                        "time",
                        normalizeClientAdjustmentTimecode(point.time),
                      )
                    }
                    inputMode="numeric"
                    placeholder="00:08"
                    maxLength={8}
                    aria-label={`Tempo do ponto ${index + 1}`}
                    aria-invalid={
                      point.time.trim() && !isValidClientAdjustmentTimecode(point.time)
                        ? true
                        : undefined
                    }
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-black/20 px-3 text-base tabular-nums text-white outline-none placeholder:text-white/20 sm:text-sm",
                      point.time.trim() && !isValidClientAdjustmentTimecode(point.time)
                        ? "border-red-400/45 focus:border-red-300/70"
                        : "border-white/10 focus:border-[var(--portal-accent)]/45",
                    )}
                  />
                </label>
                <label className="block">
                  <span className="flex h-3 items-center text-[9px] font-medium uppercase tracking-[.12em] text-white/38">
                    Alteração
                  </span>
                  <textarea
                    value={point.change}
                    onChange={(event) =>
                      updateAdjustmentPoint(point.id, "change", event.target.value)
                    }
                    rows={1}
                    autoFocus={index === 0}
                    placeholder="Descreva exatamente o que deve mudar."
                    aria-label={`Alteração do ponto ${index + 1}`}
                    className="mt-2 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-base leading-5 text-white outline-none placeholder:text-white/20 focus:border-[var(--portal-accent)]/45 sm:h-11 sm:min-h-11 sm:text-sm"
                  />
                </label>
                {adjustmentPoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAdjustmentPoint(point.id)}
                    aria-label={`Remover ponto ${index + 1}`}
                    className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-white/25 transition hover:bg-red-400/10 hover:text-red-300 sm:top-4 sm:right-4"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={addAdjustmentPoint}
              disabled={approving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white sm:justify-start"
            >
              <Plus className="size-3.5" /> Adicionar ponto
            </button>
            <div className="flex gap-2 sm:min-w-[360px]">
              <button
                type="button"
                onClick={() => setRequestingChanges(false)}
                disabled={approving}
                className="h-10 flex-1 rounded-xl border border-white/10 px-4 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!hasAdjustment || hasInvalidAdjustmentTime || approving}
                onClick={() => void requestChanges()}
                className="h-10 flex-1 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
              >
                {approving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Enviando…
                  </span>
                ) : (
                  "Enviar alterações"
                )}
              </button>
            </div>
          </div>
        </section>
      )}
      <AlertDialog open={confirmingApproval} onOpenChange={setConfirmingApproval}>
        <AlertDialogContent className="border-white/[0.09] bg-[#101210] text-white shadow-2xl sm:rounded-3xl">
          <AlertDialogHeader>
            <div
              className="mb-2 grid size-11 place-items-center rounded-2xl text-black"
              style={{ backgroundColor: accent }}
            >
              <CheckCircle2 className="size-5" />
            </div>
            <AlertDialogTitle className="text-xl tracking-[-.025em]">
              Confirmar aprovação
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-white/45">
              Você está aprovando <strong className="font-medium text-white">{item.title}</strong>,{" "}
              {item.version_label || "na versão atual"}. A produtora receberá sua decisão e o
              material ficará disponível em Entregas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs text-white/42">
            Verifique se imagem, texto, áudio e informações estão corretos antes de confirmar.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={approving}
              className="border-white/10 bg-transparent text-white/55 hover:bg-white/[0.05] hover:text-white"
            >
              Revisar novamente
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={approving}
              onClick={(event) => {
                event.preventDefault();
                void approve();
              }}
              className="text-black hover:brightness-105"
              style={{ backgroundColor: accent }}
            >
              {approving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Confirmando…
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Confirmar aprovação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function DeliveriesArchive({
  portal,
  onNavigate,
  accent,
}: {
  portal: ClientPortalSnapshot;
  onNavigate: (view: PortalView) => void;
  accent: string;
}) {
  const delivered = portal.projects.flatMap((project) =>
    project.deliverables
      .filter(
        (item) =>
          item.kind === "delivery" && (item.status === "aprovado" || item.status === "entregue"),
      )
      .map((item) => ({
        ...item,
        projectId: project.id,
        project: project.name,
        fallbackDate: project.due_date || project.start_date,
      })),
  );
  const groups = new Map<string, typeof delivered>();
  delivered.forEach((item) => {
    const date = new Date(item.created_at || `${item.fallbackDate}T12:00:00Z`);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  const availableYears = [...new Set([...groups.keys()].map((key) => key.slice(0, 4)))]
    .sort()
    .reverse();
  const [selectedYear, setSelectedYear] = useState("");
  const activeYear = availableYears.includes(selectedYear)
    ? selectedYear
    : availableYears[0] || String(new Date().getFullYear());
  const months = [...groups.entries()]
    .filter(([key]) => key.startsWith(activeYear))
    .sort(([a], [b]) => b.localeCompare(a));
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {availableYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                year === activeYear
                  ? "bg-[var(--portal-accent)] text-black"
                  : "border border-white/[0.08] text-white/35 hover:bg-white/[0.04] hover:text-white/65",
              )}
            >
              {year}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/25">{delivered.length} materiais entregues</span>
      </div>
      {months.length === 0 ? (
        <EmptyPanel
          icon={FolderOpen}
          title="Nenhuma entrega arquivada"
          description="Os materiais aparecerão aqui quando a produtora liberar a entrega final."
        />
      ) : (
        <div className="space-y-8">
          {months.map(([key, items]) => {
            const [year, month] = key.split("-");
            const label = new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              timeZone: "UTC",
            }).format(new Date(`${year}-${month}-15T12:00:00Z`));
            const projects = new Map<string, typeof items>();
            items.forEach((item) => {
              projects.set(item.projectId, [...(projects.get(item.projectId) || []), item]);
            });
            return (
              <section key={key}>
                <div className="mb-4 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[var(--portal-accent)]">
                      {year}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold capitalize">{label}</h2>
                  </div>
                  <span className="text-[10px] text-white/25">
                    {items.length} {items.length === 1 ? "material" : "materiais"}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {[...projects.entries()].map(([projectId, projectItems]) => (
                    <ArchiveFolder
                      key={`${key}-${projectId}`}
                      title={projectItems[0]?.project || "Projeto"}
                      items={projectItems}
                      accent={accent}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onNavigate("resources")}
        className="mt-8 inline-flex items-center gap-2 text-xs text-white/35 hover:text-[var(--portal-accent)]"
      >
        Procurando documentos e briefings? Ir para Arquivos úteis{" "}
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

function ArchiveFolder({
  title,
  items,
  accent,
}: {
  title: string;
  items: Array<PortalDeliverable & { project: string }>;
  accent: string;
}) {
  return (
    <article className="portal-folder-card rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:-translate-y-1 hover:border-[var(--portal-accent)]/30">
      <div className="portal-folder portal-folder-lime">
        <span />
      </div>
      <h3 className="mt-10 text-base font-semibold capitalize">{title}</h3>
      <p className="mt-1 text-xs text-white/32">
        {items.length} {items.length === 1 ? "arquivo" : "arquivos"}
      </p>
      <div className="mt-5 space-y-1 border-t border-white/[0.06] pt-3">
        {items.map((item) =>
          item.url ? (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/file flex min-h-9 items-center gap-2 rounded-lg px-2 text-[11px] text-white/40 transition hover:bg-white/[0.04] hover:text-white/75"
            >
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <Download
                className="size-3.5 shrink-0 opacity-55 transition group-hover/file:opacity-100"
                style={{ color: accent }}
              />
            </a>
          ) : (
            <div
              key={item.id}
              className="flex min-h-9 items-center rounded-lg px-2 text-[11px] text-white/22"
            >
              <span className="truncate">{item.title}</span>
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function ResourcesView({ portal, accent }: { portal: ClientPortalSnapshot; accent: string }) {
  return portal.files.length === 0 ? (
    <EmptyPanel
      icon={FolderOpen}
      title="Nenhum arquivo compartilhado"
      description="Briefings, guias e cronogramas aparecerão aqui."
    />
  ) : (
    <div className="grid gap-3 md:grid-cols-2">
      {portal.files.map((file) => (
        <a
          key={file.id}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--portal-accent)]/[0.08]">
            <FileText className="size-4" style={{ color: accent }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-white/25">
              {file.category}
            </p>
          </div>
          <Download className="size-4 text-white/20 transition group-hover:text-[var(--portal-accent)]" />
        </a>
      ))}
    </div>
  );
}

const CHECKLISTS = [
  {
    id: "pre",
    title: "Pré-gravação",
    description: "Prepare tudo antes da equipe chegar.",
    items: [
      "Briefing final aprovado",
      "Local e acesso confirmados",
      "Talentos e autorizações alinhados",
      "Roteiro disponível para todos",
      "Objetos de cena separados",
    ],
  },
  {
    id: "day",
    title: "Dia de gravação",
    description: "Um último check antes do REC.",
    items: [
      "Baterias carregadas",
      "Cartões formatados",
      "Áudio monitorado",
      "Luz e balanço de branco conferidos",
      "Backup definido",
    ],
  },
  {
    id: "delivery",
    title: "Revisão e entrega",
    description: "Aprove com mais segurança.",
    items: [
      "Textos e nomes revisados",
      "Logos corretos",
      "Trilha e direitos conferidos",
      "Formatos de exportação definidos",
      "Responsável pela aprovação avisado",
    ],
  },
];

function ToolsView({ token, accent }: { token: string; accent: string }) {
  const storageKey = `mh_portal_checklists_${token}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch {
      setChecked({});
    }
  }, [storageKey]);

  const saveChecked = (next: Record<string, boolean>) => {
    setChecked(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const toggle = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    saveChecked(next);
  };

  const resetList = (listId: string) => {
    const next = Object.fromEntries(
      Object.entries(checked).filter(([key]) => !key.startsWith(`${listId}-`)),
    );
    saveChecked(next);
    toast.success("Checklist reiniciado");
  };

  const totalItems = CHECKLISTS.reduce((total, list) => total + list.items.length, 0);
  const totalDone = CHECKLISTS.reduce(
    (total, list) => total + list.items.filter((_, index) => checked[`${list.id}-${index}`]).length,
    0,
  );
  const overallProgress = Math.round((totalDone / totalItems) * 100);
  const nextList =
    CHECKLISTS.find((list) => list.items.some((_, index) => !checked[`${list.id}-${index}`])) ||
    CHECKLISTS[CHECKLISTS.length - 1];

  const continueChecklist = () => {
    document
      .getElementById(`checklist-${nextList.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const copyPendingItems = async () => {
    const sections = CHECKLISTS.map((list) => {
      const pending = list.items.filter((_, index) => !checked[`${list.id}-${index}`]);
      if (pending.length === 0) return null;
      return `${list.title}\n${pending.map((item) => `☐ ${item}`).join("\n")}`;
    }).filter(Boolean);
    const text =
      sections.length > 0
        ? `Checklist de produção\n\n${sections.join("\n\n")}`
        : "Checklist de produção concluído. Tudo pronto por aqui.";
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Pendências copiadas", {
        description: "Agora é só colar no WhatsApp ou no grupo da equipe.",
      });
    } catch {
      toast.error("Não foi possível copiar a lista");
    }
  };

  const reviewPoints = [
    {
      title: "Texto e informações",
      description: "Nomes, datas, preços, contatos e legendas estão corretos?",
    },
    {
      title: "Marca e identidade",
      description: "Logos, cores, produtos e grafismos estão na versão certa?",
    },
    {
      title: "Imagem e áudio",
      description: "Falas, trilha, volume e imagens representam bem a marca?",
    },
    {
      title: "Formato e destino",
      description: "Duração, proporção e canal de publicação estão alinhados?",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--portal-accent)]/20 bg-white/[0.025] p-5 md:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,color-mix(in_srgb,var(--portal-accent)_15%,transparent),transparent_34%)]" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[var(--portal-accent)]/20 bg-[var(--portal-accent)]/[0.07]"
              style={{ color: accent }}
            >
              {overallProgress === 100 ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <ClipboardCheck className="size-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--portal-accent)]">
                Seu preparo
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-.035em] md:text-2xl">
                {overallProgress === 100
                  ? "Tudo conferido. Pode seguir."
                  : `${totalItems - totalDone} itens ainda pedem atenção`}
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/38">
                O progresso fica salvo neste dispositivo para você continuar depois.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={continueChecklist}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--portal-accent)] px-5 text-xs font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/60"
          >
            {overallProgress === 100 ? "Rever checklist" : "Continuar checklist"}
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[.13em] text-white/30">
            <span>
              {totalDone} de {totalItems} concluídos
            </span>
            <span className="font-semibold text-[var(--portal-accent)]">{overallProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full shadow-[0_0_14px_var(--portal-accent)] transition-all duration-500"
              style={{ width: `${overallProgress}%`, backgroundColor: accent }}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {CHECKLISTS.map((list, listIndex) => {
          const done = list.items.filter((_, index) => checked[`${list.id}-${index}`]).length;
          const status =
            done === list.items.length ? "Concluído" : done > 0 ? "Em andamento" : "A fazer";
          return (
            <section
              id={`checklist-${list.id}`}
              key={list.id}
              className="scroll-mt-24 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/[0.13]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="grid size-8 place-items-center rounded-lg bg-[var(--portal-accent)]/[0.08] text-xs font-semibold"
                      style={{ color: accent }}
                    >
                      0{listIndex + 1}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.1em]",
                        done === list.items.length
                          ? "bg-[var(--portal-accent)]/[0.1] text-[var(--portal-accent)]"
                          : "bg-white/[0.045] text-white/35",
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{list.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/30">{list.description}</p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-white/25">
                  {done}/{list.items.length}
                </span>
              </div>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(done / list.items.length) * 100}%`, backgroundColor: accent }}
                />
              </div>
              <div className="mt-4 space-y-1">
                {list.items.map((item, index) => {
                  const key = `${list.id}-${index}`;
                  return (
                    <label
                      key={key}
                      className="group/item flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-xs text-white/52 transition hover:bg-white/[0.035]"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked[key])}
                        onChange={() => toggle(key)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "grid size-[18px] shrink-0 place-items-center rounded-md border transition",
                          checked[key]
                            ? "border-transparent text-black"
                            : "border-white/15 group-hover/item:border-white/30",
                        )}
                        style={checked[key] ? { backgroundColor: accent } : undefined}
                      >
                        {checked[key] && <Check className="size-3" />}
                      </span>
                      <span
                        className={cn("leading-5", checked[key] && "text-white/24 line-through")}
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>
              {done > 0 && (
                <button
                  type="button"
                  onClick={() => resetList(list.id)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-white/25 transition hover:text-white/55"
                >
                  <RotateCcw className="size-3" />
                  Reiniciar esta etapa
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--portal-accent)]/[0.08]">
              <Copy className="size-4" style={{ color: accent }} />
            </span>
            <span className="text-[9px] uppercase tracking-[.14em] text-white/24">Ação rápida</span>
          </div>
          <h2 className="mt-5 text-lg font-semibold">Leve as pendências para a equipe</h2>
          <p className="mt-2 text-xs leading-5 text-white/35">
            Copie apenas o que ainda falta e envie no WhatsApp, no grupo da gravação ou onde
            preferir.
          </p>
          <button
            type="button"
            onClick={copyPendingItems}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-xs font-medium text-white/65 transition hover:border-[var(--portal-accent)]/30 hover:text-white"
          >
            <Copy className="size-3.5" />
            Copiar itens pendentes
          </button>
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[var(--portal-accent)]">
                Guia de aprovação
              </p>
              <h2 className="mt-2 text-lg font-semibold">Antes de aprovar um material</h2>
            </div>
            <p className="max-w-xs text-xs leading-5 text-white/30">
              Quatro pontos evitam retrabalho e deixam o feedback mais objetivo.
            </p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {reviewPoints.map((point, index) => (
              <div
                key={point.title}
                className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--portal-accent)]/[0.09] text-[10px] font-semibold"
                    style={{ color: accent }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-white/70">{point.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/30">{point.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ContractsView({ portal, accent }: { portal: ClientPortalSnapshot; accent: string }) {
  return portal.contracts.length === 0 ? (
    <EmptyPanel
      icon={FileCheck2}
      title="Nenhum contrato disponível"
      description="Os documentos aparecerão aqui quando forem publicados."
    />
  ) : (
    <div className="space-y-3">
      {portal.contracts.map((contract) => {
        const href = contract.signature_url || contract.pdf_url;
        return (
          <div
            key={contract.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--portal-accent)]/[0.08]">
              <FileCheck2 className="size-4" style={{ color: accent }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{contract.title}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-white/25">
                {contract.signed_at ? "Assinado" : "Aguardando assinatura"}
              </p>
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/48 hover:bg-white/[0.04]"
              >
                <ExternalLink className="size-3.5" /> Abrir documento
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center">
      <div>
        <Icon className="mx-auto size-6 text-white/22" />
        <h2 className="mt-4 text-sm font-semibold">{title}</h2>
        <p className="mt-2 text-xs text-white/30">{description}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <EmptyPanel
      icon={Clock3}
      title="Tudo pronto para começar"
      description="Assim que o primeiro projeto for publicado, o andamento aparecerá aqui."
    />
  );
}
