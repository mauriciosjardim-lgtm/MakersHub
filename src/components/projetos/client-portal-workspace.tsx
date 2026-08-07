import { useState, type CSSProperties } from "react";
import { Eye, ExternalLink, KeyRound, PackageCheck, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Projeto } from "@/lib/mock/projetos";
import { portalSlug } from "@/lib/portal-cliente";
import { cn } from "@/lib/utils";
import { ClientPortalProjectPanel, type ClientPortalMetrics } from "./client-portal-panel";
import { ClientPortalUsersPanel } from "./client-portal-users-panel";

type WorkspaceView = "status" | "approvals" | "deliveries" | "access";

const NAVIGATION: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof Eye;
}> = [
  {
    id: "status",
    label: "Visão do cliente",
    icon: Eye,
  },
  {
    id: "approvals",
    label: "Aprovações",
    icon: Send,
  },
  {
    id: "deliveries",
    label: "Entregas",
    icon: PackageCheck,
  },
  {
    id: "access",
    label: "Acessos",
    icon: KeyRound,
  },
];

function PortalNavigation({
  view,
  onChange,
}: {
  view: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}) {
  return (
    <nav
      className="kb-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-1.5"
      aria-label="Gestão da área do cliente"
    >
      {NAVIGATION.map((item) => {
        const Icon = item.icon;
        const selected = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "group relative flex h-11 min-w-[150px] flex-1 items-center gap-2.5 rounded-xl border px-2.5 text-left transition-[color,border-color,background-color,box-shadow]",
              selected
                ? "border-[color-mix(in_srgb,var(--workspace-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_9%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
                : "border-transparent text-muted-foreground hover:border-white/[.08] hover:bg-white/[.03] hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-xl border transition-[color,border-color,background-color,box-shadow]",
                selected
                  ? "border-current/25 bg-background/45 text-[var(--workspace-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_20px_-13px_currentColor]"
                  : "border-white/[.07] bg-white/[.025] text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span
              className={cn(
                "truncate text-sm font-bold",
                selected ? "text-foreground" : "text-inherit",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function ClientPortalWorkspace({
  project,
  clientId = project.clienteId,
  clientName = project.cliente,
  onMetricsChange,
}: {
  project: Projeto;
  clientId?: string;
  clientName?: string;
  onMetricsChange?: (metrics: ClientPortalMetrics) => void;
}) {
  const [view, setView] = useState<WorkspaceView>("status");
  const navigation = <PortalNavigation view={view} onChange={setView} />;

  return (
    <section
      className="kb-client-workspace relative overflow-hidden rounded-2xl border border-white/[.075] bg-white/[.022] shadow-[0_24px_70px_-52px_rgba(0,0,0,.9)]"
      style={{ "--workspace-accent": "var(--primary)" } as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden">
        <div className="absolute -left-28 -top-44 size-80 rounded-full bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)] blur-3xl" />
      </div>

      <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/[.07] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_11%,transparent)] text-[var(--workspace-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_0_24px_-15px_var(--workspace-accent)]">
            <Play className="ml-0.5 size-[18px] fill-current" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-bold text-foreground">
              Portal do cliente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-center">
          <Button
            variant="outline"
            asChild
            className="h-10 rounded-xl border-white/[.08] bg-white/[.025] px-4 font-semibold"
          >
            <a href={`/portal/${portalSlug(project.cliente)}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Ver experiência
            </a>
          </Button>
        </div>
      </header>

      <div className="relative p-3 sm:p-4">
        {view === "access" ? (
          <ClientPortalUsersPanel
            clientId={clientId}
            clientName={clientName}
            navigation={navigation}
          />
        ) : (
          <ClientPortalProjectPanel
            project={project}
            showAccessBanner={false}
            view={view}
            navigation={navigation}
            onMetricsChange={onMetricsChange}
          />
        )}
      </div>
    </section>
  );
}
