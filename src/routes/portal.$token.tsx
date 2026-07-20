import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  CalendarClock,
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
  Headphones,
  Home,
  Images,
  Loader2,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Milestone,
  PlayCircle,
  RotateCcw,
  AlertTriangle,
  Video,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPublicClientPortal,
  portalCoverUrl,
  portalDisplayProgress,
  portalSlug,
  respondPortalReview,
  type ClientPortalSnapshot,
  type PortalDeliverable,
  type PortalProject,
} from "@/lib/portal-cliente";
import { portalSupabase } from "@/lib/portal-supabase";
import { cn } from "@/lib/utils";

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
  | "tools"
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
  tools: {
    eyebrow: "Ferramentas",
    title: "Tudo pronto para produzir.",
    description: "Prepare a gravação, compartilhe pendências e revise entregas com segurança.",
  },
  contracts: {
    eyebrow: "Contratos",
    title: "Documentos e assinaturas.",
    description: "Consulte contratos, acompanhe assinaturas e baixe as versões finais.",
  },
};

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

function viewFromHash(): PortalView {
  if (typeof window === "undefined") return "overview";
  const candidate = window.location.hash.replace("#", "") as PortalView;
  return candidate in VIEW_TITLES && candidate !== "tools" ? candidate : "overview";
}

function ClientPortalPage() {
  const { token } = Route.useParams();
  const [portal, setPortal] = useState<ClientPortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
      setNotFound(true);
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
  ) => {
    if (
      decision === "approved" &&
      !confirm(
        `Aprovar definitivamente “${deliverable.title}” (${deliverable.version_label || "versão atual"})?`,
      )
    )
      return;
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
        decision === "approved" ? "Material aprovado" : "Alterações enviadas para a produtora",
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
                      ? {
                          ...item,
                          status: decision === "approved" ? "aprovado" : "ajustes",
                          client_feedback: feedback || null,
                          decided_at: new Date().toISOString(),
                        }
                      : item,
                  ),
                })),
              }
            : current,
        );
      } else {
        await load();
      }
    } catch {
      toast.error("Não foi possível registrar sua decisão");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#080a09] text-white">
        <Loader2 className="size-7 animate-spin text-[#a3ff2b]" />
      </div>
    );
  }

  if (notFound || !portal) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#080a09] px-6 text-center text-white">
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

  const accent = portal.company.accent_color || "#a3ff2b";
  const title = VIEW_TITLES[view];

  return (
    <div
      className="min-h-[100dvh] bg-[#080a09] text-white"
      style={{ "--portal-accent": accent } as React.CSSProperties}
    >
      <PortalSidebar
        portal={portal}
        project={activeProject}
        activeView={view}
        onNavigate={navigate}
        onSignOut={signOut}
        signingOut={signingOut}
        accent={accent}
      />

      <div className="min-w-0 lg:pl-[272px]">
        <PortalTopbar
          portal={portal}
          view={view}
          onNavigate={navigate}
          onSignOut={signOut}
          signingOut={signingOut}
          accent={accent}
        />

        <main className="mx-auto max-w-[1380px] px-5 py-8 md:px-8 md:py-10 xl:px-12">
          <PageHeading
            title={title}
            clientName={portal.client.responsible_name || portal.client.name}
            accent={accent}
          />

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
          {view === "approvals" && activeProject && (
            <ApprovalsView
              project={activeProject}
              approvingId={approvingId}
              onRespond={respond}
              accent={accent}
            />
          )}
          {view === "deliveries" && (
            <DeliveriesArchive portal={portal} onNavigate={navigate} accent={accent} />
          )}
          {view === "resources" && <ResourcesView portal={portal} accent={accent} />}
          {view === "tools" && <ToolsView token={token} accent={accent} />}
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
  accent,
}: {
  portal: ClientPortalSnapshot;
  project?: PortalProject;
  activeView: PortalView;
  onNavigate: (view: PortalView) => void;
  onSignOut: () => void;
  signingOut: boolean;
  accent: string;
}) {
  const approvals =
    project?.deliverables.filter((item) => item.kind !== "delivery" && item.status === "revisao")
      .length ?? 0;
  const menu: Array<{
    id: PortalView;
    label: string;
    icon: typeof Home;
    badge?: number;
    disabled?: boolean;
  }> = [
    { id: "overview", label: "Visão geral", icon: Home },
    { id: "production", label: "Produção atual", icon: Video },
    { id: "approvals", label: "Aprovações", icon: ClipboardCheck, badge: approvals },
    { id: "deliveries", label: "Entregas", icon: Images },
    { id: "resources", label: "Arquivos úteis", icon: FolderOpen },
    { id: "tools", label: "Ferramentas", icon: Wrench, disabled: true },
    { id: "contracts", label: "Contratos", icon: FileCheck2 },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-white/[0.07] bg-[#0a0c0a] p-5 lg:flex">
      <div className="flex items-center gap-3 px-2 py-1">
        {portal.company.logo_url ? (
          <img src={portal.company.logo_url} alt="" className="size-10 rounded-xl object-contain" />
        ) : (
          <div
            className="grid size-10 place-items-center rounded-xl text-sm font-black text-black"
            style={{ backgroundColor: accent }}
          >
            {portal.company.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold tracking-tight">{portal.company.name}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[.2em] text-white/28">
            Área do cliente
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
        <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-[11px] font-semibold">
          {portal.client.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{portal.client.name}</p>
          <p className="mt-1 truncate text-[10px] text-white/32">
            {project ? PHASES[project.phase] || project.phase : "Cliente"}
          </p>
        </div>
      </div>

      <p className="mb-2 mt-7 px-3 text-[9px] uppercase tracking-[.18em] text-white/22">Menu</p>
      <nav className="space-y-1">
        {menu.map(({ id, label, icon: Icon, badge, disabled }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => !disabled && onNavigate(id)}
              disabled={disabled}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium transition",
                disabled
                  ? "cursor-not-allowed text-white/24"
                  : active
                    ? "text-black"
                    : "text-white/42 hover:bg-white/[0.04] hover:text-white/78",
              )}
              style={active ? { backgroundColor: accent } : undefined}
            >
              <Icon className="size-4" />
              <span>{label}</span>
              {disabled ? (
                <span className="ml-auto rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[8px] font-semibold uppercase tracking-[.1em] text-white/28">
                  Em breve
                </span>
              ) : badge ? (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[9px]",
                    active ? "bg-black/10" : "bg-[var(--portal-accent)] text-black",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mb-3 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-[11px] text-white/38 transition hover:bg-white/[0.04] hover:text-white/75 disabled:cursor-wait disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LogOut className="size-3.5" />
          )}
          {signingOut ? "Saindo…" : "Sair da conta"}
        </button>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-40"
                style={{ backgroundColor: accent }}
              />
              <span
                className="relative inline-flex size-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
            </span>
            <span className="text-[9px] uppercase tracking-[.15em] text-white/38">
              Equipe online
            </span>
          </div>
          <p className="mt-3 text-xs font-medium">Podemos ajudar?</p>
          <button className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-[11px] text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            <Headphones className="size-3.5" /> Falar com a equipe
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 px-2 text-[9px] uppercase tracking-[.13em] text-white/18">
          <LockKeyhole className="size-3" /> Ambiente privado
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
  accent,
}: {
  portal: ClientPortalSnapshot;
  view: PortalView;
  onNavigate: (view: PortalView) => void;
  onSignOut: () => void;
  signingOut: boolean;
  accent: string;
}) {
  const mobileViews: Array<{ id: PortalView; disabled?: boolean }> = [
    { id: "overview" },
    { id: "production" },
    { id: "approvals" },
    { id: "deliveries" },
    { id: "resources" },
    { id: "tools", disabled: true },
    { id: "contracts" },
  ];
  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#080a09]/90 px-5 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <div
            className="grid size-8 place-items-center rounded-lg text-xs font-black text-black lg:hidden"
            style={{ backgroundColor: accent }}
          >
            {portal.company.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[.16em] text-white/25">Área do cliente</p>
            <p className="mt-0.5 text-xs font-medium">{VIEW_TITLES[view].eyebrow}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-[11px] text-white/45 transition hover:bg-white/[0.04] sm:flex">
            <MessageSquareText className="size-3.5" /> Falar com a equipe
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/42 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
          </button>
          <span className="grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold">
            {portal.client.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
      </header>
      <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.05] bg-[#080a09] px-5 py-3 lg:hidden">
        {mobileViews.map(({ id, disabled }) => (
          <button
            key={id}
            type="button"
            onClick={() => !disabled && onNavigate(id)}
            disabled={disabled}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[10px]",
              disabled
                ? "cursor-not-allowed border-white/[0.06] text-white/20"
                : id === view
                  ? "border-transparent text-black"
                  : "border-white/10 text-white/38",
            )}
            style={id === view ? { backgroundColor: accent } : undefined}
          >
            {VIEW_TITLES[id].eyebrow}
            {disabled && <span className="ml-1.5 text-[8px] uppercase">Em breve</span>}
          </button>
        ))}
      </nav>
    </>
  );
}

function PageHeading({
  title,
  clientName,
  accent,
}: {
  title: { eyebrow: string; title: string; description: string };
  clientName: string;
  accent: string;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/[0.06] pb-7">
      <div>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <p className="text-[10px] font-medium uppercase tracking-[.18em] text-white/32">
            {title.eyebrow}
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] md:text-5xl">
          {title.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/38">{title.description}</p>
      </div>
      <p className="text-xs text-white/28">Olá, {clientName}.</p>
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
  const approvals = project.deliverables.filter(
    (item) => item.kind !== "delivery" && item.status === "revisao",
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
            className="portal-overview-folder group relative min-h-[188px] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-[var(--portal-accent)]/25 hover:bg-white/[0.03]"
          >
            <div className="portal-folder portal-folder-lime mt-3 origin-top-left scale-[.9]">
              <span />
            </div>
            <ChevronRight className="absolute right-4 top-4 size-3.5 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-[var(--portal-accent)]" />
            <div className="mt-5">
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
  project,
  approvingId,
  onRespond,
  accent,
}: {
  project: PortalProject;
  approvingId: string | null;
  onRespond: (
    item: PortalDeliverable,
    decision: "approved" | "changes_requested",
    feedback?: string,
  ) => void;
  accent: string;
}) {
  const pending = project.deliverables.filter(
    (item) => item.kind !== "delivery" && item.status === "revisao",
  );
  const history = project.deliverables.filter(
    (item) =>
      item.kind !== "delivery" &&
      (item.status === "aprovado" || item.status === "entregue" || item.status === "ajustes"),
  );
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Aguardando sua decisão</h2>
            <p className="mt-1 text-xs text-white/28">
              Você pode aprovar vários conteúdos do mesmo ciclo separadamente.
            </p>
          </div>
          <span className="rounded-full bg-[var(--portal-accent)] px-2.5 py-1 text-xs font-bold text-black">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <EmptyPanel
            icon={CheckCircle2}
            title="Nenhuma aprovação pendente"
            description="Você está em dia com a equipe."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
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
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
          {history.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-4">
              {item.status === "ajustes" ? (
                <MessageSquareText className="size-4 text-red-300" />
              ) : (
                <CheckCircle2 className="size-4" style={{ color: accent }} />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              <span className="text-[10px] uppercase tracking-[.12em] text-white/25">
                {item.status === "ajustes" ? "Alterações solicitadas" : "Aprovado"}
              </span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-white/30 hover:bg-white/[0.05] hover:text-white"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ApprovalCard({
  item,
  approving,
  onRespond,
  accent,
  cover,
}: {
  item: PortalDeliverable;
  approving: boolean;
  onRespond: (
    item: PortalDeliverable,
    decision: "approved" | "changes_requested",
    feedback?: string,
  ) => void;
  accent: string;
  cover?: string | null;
}) {
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.025] transition hover:border-[var(--portal-accent)]/25">
      <div className="relative aspect-video overflow-hidden bg-black">
        {item.embed_url ? (
          <iframe
            src={item.embed_url}
            title={`${item.title} ${item.version_label || ""}`}
            className="absolute inset-0 size-full"
            allow="autoplay; fullscreen"
          />
        ) : cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,255,43,.08),transparent_55%),#0c0e0c]" />
        )}
        {!item.embed_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/35" />
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-amber-300 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-300" />
            </span>
            Aguardando aprovação
          </span>
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[.12em] text-white/60 backdrop-blur-sm">
            {item.version_label || item.type}
          </span>
        </div>
        {!item.embed_url && item.url && (
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
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[.12em] text-white/28">
          {item.content_cycle && <span>{item.content_cycle}</span>}
          {item.due_at && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" /> Aprovar até {formatDate(item.due_at)}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold tracking-[-.02em]">{item.title}</h3>
        {item.notes && <p className="mt-2 text-xs leading-5 text-white/45">{item.notes}</p>}
        {requestingChanges ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
            <label className="text-[10px] uppercase tracking-[.13em] text-white/35">
              O que precisa mudar?
            </label>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex.: trocar a cena de 00:08 e reduzir o tamanho do logo..."
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[var(--portal-accent)]/35"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setRequestingChanges(false)}
                className="h-9 flex-1 rounded-xl border border-white/10 text-xs text-white/45"
              >
                Cancelar
              </button>
              <button
                disabled={!feedback.trim() || approving}
                onClick={() => onRespond(item, "changes_requested", feedback)}
                className="h-9 flex-1 rounded-xl bg-white text-xs font-semibold text-black disabled:opacity-40"
              >
                Enviar alterações
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setRequestingChanges(true)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
            >
              <MessageSquareText className="size-3.5" /> Solicitar ajustes
            </button>
            <button
              disabled={approving}
              onClick={() => onRespond(item, "approved")}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold text-black shadow-[0_8px_24px_-8px_var(--portal-accent)] transition hover:brightness-105 disabled:opacity-50"
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
        )}
      </div>
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
