import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { ArrowRight2, Box, Clock, Edit2, Monitor, Profile2User, TickCircle } from "iconsax-react";
import type { Icon as IconsaxIcon } from "iconsax-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientPortalWorkspace } from "@/components/projetos/client-portal-workspace";
import { ProjetosErrorState } from "@/components/projetos/projetos-error-state";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useComercialSupa } from "@/lib/hooks/useComercial";
import { listClientReviews, type ClientReview } from "@/lib/client-reviews";
import { normalizeClientName, projectBelongsToClient } from "@/lib/projetos/cliente";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/area-cliente")({
  component: ClientAreaManager,
});

function ClientAreaManager() {
  const { projetos, loading, error, retry } = useProjetos();
  const {
    empresas: clients,
    loading: clientsLoading,
    error: clientsError,
    retry: retryClients,
  } = useComercialSupa();
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      setReviews(await listClientReviews());
    } catch (loadError) {
      setReviewsError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar as aprovações.",
      );
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const activeProjects = useMemo(
    () => projetos.filter((project) => !project.arquivado),
    [projetos],
  );
  const canonicalClients = useMemo(() => {
    const unique = new Map<string, (typeof clients)[number]>();

    clients
      .filter((client) => !client.arquivado)
      .forEach((client) => {
        const key = normalizeClientName(client.nome);
        const current = unique.get(key);
        const clientHasLinkedProject = activeProjects.some((project) =>
          projectBelongsToClient(project, client),
        );
        const currentHasLinkedProject = current
          ? activeProjects.some((project) => projectBelongsToClient(project, current))
          : false;

        if (!current || (clientHasLinkedProject && !currentHasLinkedProject)) {
          unique.set(key, client);
        }
      });

    return [...unique.values()];
  }, [activeProjects, clients]);
  const selectedClient = canonicalClients.find((client) => client.id === selectedClientId);
  const clientProjects = selectedClient
    ? activeProjects.filter((project) => projectBelongsToClient(project, selectedClient))
    : [];
  const selectedProject =
    clientProjects.find((project) => project.id === selectedProjectId) ?? clientProjects[0];
  const clientReviews = selectedClient
    ? reviews.filter((review) => clientProjects.some((project) => project.id === review.projectId))
    : [];
  const clientPending = clientReviews.filter((review) => review.status === "pending").length;
  const clientChanges = clientReviews.filter(
    (review) => review.status === "changes_requested",
  ).length;
  const clientDeliveries = clientReviews.filter(
    (review) => review.kind === "delivery" && review.status !== "archived",
  ).length;
  const dataLoading = loading || clientsLoading || reviewsLoading;
  const dataError = error || clientsError || reviewsError;

  if (dataError) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <ProjetosErrorState
          message={dataError}
          onRetry={async () => {
            await Promise.all([retry(), retryClients(), loadReviews()]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="project-kanban-ambient mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 md:px-8 md:py-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-.035em]">Área do cliente</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Aprovações, entregas e acessos em um só lugar.
          </p>
        </div>
      </header>

      <section
        className="kb-project-nav relative overflow-hidden rounded-2xl"
        style={
          {
            "--active-client": "var(--primary)",
          } as React.CSSProperties
        }
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,color-mix(in_srgb,var(--active-client)_8%,transparent),transparent_34%)]" />
        <div className="relative flex flex-col gap-2 p-2 lg:flex-row lg:items-center">
          <div className="w-full shrink-0 lg:w-[360px] xl:w-[420px]">
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientPickerOpen}
                  className="h-12 w-full justify-between rounded-xl border-transparent bg-transparent px-2.5 text-left hover:border-[color-mix(in_srgb,var(--active-client)_30%,transparent)] hover:bg-white/[.035]"
                  disabled={dataLoading || canonicalClients.length === 0}
                >
                  {selectedClient ? (
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-ui)] text-xs font-bold text-[var(--primary-fg)]">
                        {initials(selectedClient.nome)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-bold">
                          {selectedClient.nome}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {clientProjects.length} projeto
                          {clientProjects.length === 1 ? "" : "s"} · {clientPending + clientChanges}{" "}
                          pendência
                          {clientPending + clientChanges === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {dataLoading ? "Carregando clientes…" : "Selecione um cliente"}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-3 size-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(520px,calc(100vw-2rem))] overflow-hidden p-0"
              >
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup heading="Portais de clientes">
                      {canonicalClients.map((client) => {
                        const projects = activeProjects.filter((project) =>
                          projectBelongsToClient(project, client),
                        );
                        const reviewCount = reviews.filter(
                          (review) =>
                            (review.status === "pending" ||
                              review.status === "changes_requested") &&
                            projects.some((project) => project.id === review.projectId),
                        ).length;
                        return (
                          <CommandItem
                            key={client.id}
                            value={`${client.nome} ${projects.map((project) => project.nome).join(" ")}`}
                            onSelect={() => {
                              setSelectedClientId(client.id);
                              setSelectedProjectId(null);
                              setClientPickerOpen(false);
                            }}
                            className="gap-3 rounded-xl px-3 py-3"
                          >
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-ui)] text-xs font-bold text-[var(--primary-fg)]">
                              {initials(client.nome)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">
                                {client.nome}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {projects.length} projeto{projects.length === 1 ? "" : "s"} ·{" "}
                                {projects.filter((project) => project.portalVisible).length}{" "}
                                publicado
                                {projects.filter((project) => project.portalVisible).length === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </span>
                            {reviewCount > 0 && (
                              <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-black">
                                {reviewCount}
                              </span>
                            )}
                            <Check
                              className={cn(
                                "size-4 text-primary",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedClient && selectedProject && (
            <nav
              className="kb-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
              aria-label="Projetos deste cliente"
            >
              {clientProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    "flex h-11 min-w-[148px] flex-1 items-center justify-between gap-3 rounded-xl border px-3 text-left transition-[color,border-color,background-color,box-shadow]",
                    selectedProject.id === project.id
                      ? "border-[color-mix(in_srgb,var(--active-client)_42%,transparent)] bg-[color-mix(in_srgb,var(--active-client)_8%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
                      : "border-transparent text-muted-foreground hover:border-white/[.1] hover:bg-white/[.03]",
                  )}
                >
                  <span
                    className={cn(
                      "truncate text-[13px] font-bold",
                      selectedProject.id === project.id && "text-[var(--active-client)]",
                    )}
                  >
                    {project.nome}
                  </span>
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      project.portalVisible
                        ? "bg-success shadow-[0_0_12px_-2px_currentColor]"
                        : "bg-muted-foreground/35",
                    )}
                  />
                </button>
              ))}
            </nav>
          )}

          {selectedClient && (
            <div className="flex shrink-0 items-center lg:justify-end">
              <Button
                variant="outline"
                onClick={() => setClientDetailsOpen(true)}
                className="h-11 rounded-xl border-white/[.08] bg-white/[.025] px-4 font-semibold"
              >
                <Profile2User size={18} color="currentColor" variant="Bulk" />
                Detalhes do cliente
              </Button>
            </div>
          )}
        </div>
      </section>

      {selectedClient && (
        <main className="min-w-0 space-y-4">
          {selectedProject ? (
            <div className="space-y-4">
              <ClientPortalWorkspace
                key={selectedClient.id}
                project={selectedProject}
                clientId={selectedClient.id}
                clientName={selectedClient.nome}
              />
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-white/[.09] bg-white/[.018] px-6 text-center">
              <div>
                <span className="kb-workspace-icon mx-auto grid size-14 place-items-center rounded-2xl">
                  <FolderKanban className="size-6" />
                </span>
                <p className="mt-4 font-display text-lg font-bold">
                  {selectedClient?.nome || "Este cliente"} ainda não possui projetos
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Abra o workspace do cliente para criar o primeiro projeto.
                </p>
                {selectedClient && (
                  <a
                    href={`/projetos/${selectedClient.id}`}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                  >
                    Abrir projetos <ArrowRight2 size={15} color="currentColor" variant="Linear" />
                  </a>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {!selectedClient && !dataLoading && (
        <section className="grid min-h-[340px] place-items-center rounded-2xl border border-dashed border-white/[.09] bg-white/[.015] px-6 py-10 text-center">
          <div className="max-w-xl">
            <span className="kb-workspace-icon mx-auto grid size-16 place-items-center rounded-2xl">
              <Monitor size={28} color="currentColor" variant="Bulk" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-[-.02em]">
              Escolha um cliente para começar
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Você poderá definir o que aparece no portal, enviar materiais para aprovação,
              organizar entregas e administrar os acessos.
            </p>
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-3">
              {[
                ["01", "Publicar status"],
                ["02", "Receber aprovações"],
                ["03", "Liberar entregas"],
              ].map(([step, label]) => (
                <div
                  key={step}
                  className="rounded-xl border border-white/[.065] bg-white/[.02] p-3"
                >
                  <span className="text-xs font-bold text-primary">{step}</span>
                  <p className="mt-1 text-[13px] font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedClient && (
        <Dialog open={clientDetailsOpen} onOpenChange={setClientDetailsOpen}>
          <DialogContent
            className="kb-form-dialog max-h-[90vh] max-w-2xl overflow-y-auto p-0"
            style={
              {
                "--active-client": "var(--primary)",
              } as React.CSSProperties
            }
          >
            <DialogHeader className="border-b border-white/[.07] px-6 pb-5 pt-6 text-left">
              <div className="flex items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--primary-ui)] text-sm font-bold text-[var(--primary-fg)] shadow-[0_18px_36px_-22px_var(--primary)]">
                  {initials(selectedClient.nome)}
                </span>
                <div className="min-w-0">
                  <DialogTitle className="font-display text-2xl font-bold tracking-[-.025em]">
                    Detalhes do cliente
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm">
                    {selectedClient.nome}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <PortalMetric
                  icon={Box}
                  label="Projetos"
                  value={clientProjects.length}
                  tone="text-foreground"
                />
                <PortalMetric
                  icon={TickCircle}
                  label="Publicados"
                  value={clientProjects.filter((project) => project.portalVisible).length}
                  tone="text-success"
                />
                <PortalMetric
                  icon={Clock}
                  label="Aguardando"
                  value={clientPending}
                  tone="text-warning"
                />
                <PortalMetric
                  icon={Edit2}
                  label="Ajustes"
                  value={clientChanges}
                  tone="text-destructive"
                />
                <PortalMetric
                  icon={Box}
                  label="Entregas"
                  value={clientDeliveries}
                  tone="text-info"
                />
                <PortalMetric
                  icon={Monitor}
                  label="Ocultos"
                  value={clientProjects.filter((project) => !project.portalVisible).length}
                  tone="text-muted-foreground"
                />
              </div>

              <section className="overflow-hidden rounded-2xl border border-white/[.075] bg-white/[.025]">
                <div className="flex items-center justify-between gap-3 border-b border-white/[.07] px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="kb-workspace-icon grid size-9 place-items-center rounded-xl text-[var(--active-client)]">
                      <Box size={18} color="currentColor" variant="Bulk" />
                    </span>
                    <p className="font-display text-sm font-bold">Projetos do cliente</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {clientProjects.length} no total
                  </span>
                </div>
                <div className="divide-y divide-white/[.06] px-4">
                  {clientProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{project.nome}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {project.portalVisible ? "Disponível no portal" : "Oculto do cliente"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          project.portalVisible ? "bg-success" : "bg-muted-foreground/35",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex justify-end border-t border-white/[.07] px-6 py-4">
              <Button asChild className="h-10 rounded-xl px-4 font-bold">
                <a href={`/projetos/${selectedClient.id}`}>
                  Abrir projetos <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PortalMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: IconsaxIcon;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3.5 shadow-[0_18px_44px_-38px_rgba(0,0,0,.9)]">
      <span
        className={cn(
          "kb-workspace-icon grid size-10 shrink-0 place-items-center rounded-xl",
          tone,
        )}
      >
        <Icon size={21} color="currentColor" variant="Bulk" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 font-display text-xl font-bold tabular-nums", tone)}>{value}</p>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
