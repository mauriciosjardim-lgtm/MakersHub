import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronsUpDown,
  FolderKanban,
  MonitorPlay,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  const pending = reviews.filter((review) => review.status === "pending");
  const changes = reviews.filter((review) => review.status === "changes_requested");
  const deliveries = reviews.filter(
    (review) => review.kind === "delivery" && review.status !== "archived",
  );
  const published = activeProjects.filter((project) => project.portalVisible);
  const clientReviews = selectedClient
    ? reviews.filter((review) => clientProjects.some((project) => project.id === review.projectId))
    : [];
  const clientPending = clientReviews.filter((review) => review.status === "pending").length;
  const clientChanges = clientReviews.filter(
    (review) => review.status === "changes_requested",
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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <MonitorPlay className="size-4" />
            <span className="text-[10px] font-semibold uppercase tracking-[.18em]">
              Makers Members
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Central do cliente
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            Crie acessos, escolha o que será publicado e acompanhe aprovações e entregas.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface-1/35 sm:w-auto sm:grid-cols-4">
          <CompactMetric
            label="Publicados"
            value={dataLoading ? "—" : published.length}
            tone="text-primary"
          />
          <CompactMetric
            label="Aguardando"
            value={dataLoading ? "—" : pending.length}
            tone="text-warning"
          />
          <CompactMetric
            label="Ajustes"
            value={dataLoading ? "—" : changes.length}
            tone="text-destructive"
          />
          <CompactMetric
            label="Entregas"
            value={dataLoading ? "—" : deliveries.length}
            tone="text-success"
          />
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-1/35">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,hsl(var(--primary)/.09),transparent_32%)]" />
        <div className="relative grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-5">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
                  <UsersRound className="size-3.5" />
                  Cliente ativo
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Pesquise e troque de portal sem sair desta tela.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/25 px-2.5 py-1 text-[9px] text-muted-foreground">
                {dataLoading ? "Carregando…" : `${canonicalClients.length} clientes`}
              </span>
            </div>

            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientPickerOpen}
                  className="h-auto w-full justify-between rounded-xl border-border/80 bg-background/35 px-3 py-3 text-left hover:border-primary/30 hover:bg-surface-2/45"
                  disabled={dataLoading || canonicalClients.length === 0}
                >
                  {selectedClient ? (
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-black shadow-lg"
                        style={{
                          backgroundColor: selectedClient.accentColor || "var(--primary)",
                        }}
                      >
                        {initials(selectedClient.nome)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {selectedClient.nome}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                          {clientProjects.length} projeto
                          {clientProjects.length === 1 ? "" : "s"} · {clientPending + clientChanges}{" "}
                          pendência
                          {clientPending + clientChanges === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
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
                            className="gap-3 rounded-lg px-2.5 py-2.5"
                          >
                            <span
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-[9px] font-bold text-black"
                              style={{
                                backgroundColor: client.accentColor || "var(--primary)",
                              }}
                            >
                              {initials(client.nome)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {client.nome}
                              </span>
                              <span className="mt-0.5 block text-[9px] text-muted-foreground">
                                {projects.length} projeto{projects.length === 1 ? "" : "s"} ·{" "}
                                {projects.filter((project) => project.portalVisible).length}{" "}
                                publicado
                                {projects.filter((project) => project.portalVisible).length === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </span>
                            {reviewCount > 0 && (
                              <span className="rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-bold text-black">
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

          {selectedClient && (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <SelectionMetric label="Projetos" value={clientProjects.length} />
              <SelectionMetric
                label="Publicados"
                value={clientProjects.filter((project) => project.portalVisible).length}
                tone="text-success"
              />
              <SelectionMetric
                label="Pendências"
                value={clientPending + clientChanges}
                tone={clientPending + clientChanges > 0 ? "text-warning" : "text-muted-foreground"}
              />
              <Button variant="outline" size="sm" asChild className="ml-1">
                <a href={`/projetos/${selectedClient.id}`}>
                  Abrir workspace <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </section>

      {selectedClient && (
        <main className="min-w-0 space-y-4">
          {selectedProject ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface-1/35 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
                  <div>
                    <p className="text-sm font-semibold">Projetos deste cliente</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Selecione o projeto que deseja publicar ou enviar para aprovação.
                    </p>
                  </div>
                  <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-[9px] font-medium text-muted-foreground">
                    {clientProjects.filter((project) => project.portalVisible).length}/
                    {clientProjects.length} publicados
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {clientProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        "min-w-[180px] shrink-0 rounded-xl border p-3 text-left text-xs transition",
                        selectedProject.id === project.id
                          ? "border-primary/40 bg-primary/[0.08]"
                          : "border-border/60 bg-card/35 text-muted-foreground hover:border-primary/20",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "truncate font-medium",
                            selectedProject.id === project.id && "text-foreground",
                          )}
                        >
                          {project.nome}
                        </span>
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            project.portalVisible ? "bg-success" : "bg-muted-foreground/35",
                          )}
                        />
                      </span>
                      <span className="mt-2 block text-[9px]">
                        {project.portalVisible ? "Visível no portal" : "Oculto do cliente"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <ClientPortalWorkspace
                key={selectedClient.id}
                project={selectedProject}
                clientId={selectedClient.id}
                clientName={selectedClient.nome}
              />
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-surface-1/20 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
                  <FolderKanban className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium">
                  {selectedClient?.nome || "Este cliente"} ainda não possui projetos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abra o workspace do cliente para criar o primeiro projeto.
                </p>
                {selectedClient && (
                  <a
                    href={`/projetos/${selectedClient.id}`}
                    className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Abrir cliente
                  </a>
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="min-w-0 border-b border-r border-border/60 px-3 py-2.5 text-center even:border-r-0 sm:min-w-[82px] sm:border-b-0 sm:even:border-r sm:last:border-r-0">
      <p className={cn("font-display text-lg font-semibold tabular-nums", tone)}>{value}</p>
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function SelectionMetric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="min-w-[72px] rounded-xl border border-border/65 bg-background/25 px-3 py-2 text-center">
      <p className={cn("font-display text-base font-semibold tabular-nums", tone)}>{value}</p>
      <p className="mt-0.5 text-[7px] uppercase tracking-[.14em] text-muted-foreground">{label}</p>
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
