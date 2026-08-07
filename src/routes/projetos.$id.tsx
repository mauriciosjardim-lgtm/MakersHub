import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState, useEffect, useRef, type CSSProperties } from "react";
import {
  Archive,
  ArchiveRestore,
  Circle,
  Clock3,
  Ellipsis,
  MessageSquareText,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import {
  ArrowLeft2,
  Add,
  Edit2,
  Calendar,
  Profile2User,
  DollarCircle,
  TickCircle,
  Flag,
  Export,
  Link2,
  Trash,
  DocumentText1,
  DocumentDownload,
  ArrowRight2,
  CloseCircle,
} from "iconsax-react";
import type { Icon as IconsaxIcon } from "iconsax-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type CollisionDetection,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  fasesParaIds,
  faseParaId,
  PRIORIDADES,
  TIPOS_ENTREGAVEL,
  TIPO_ENTREGAVEL_ICONS,
  STATUS_ENTREGAVEL,
  getFaseInfo,
  serializarFaseToken,
  type Tarefa,
  type Marco,
  type Entregavel,
  type StatusTarefa,
  type StatusEntregavel,
  type FaseProjeto,
  type Projeto,
} from "@/lib/mock/projetos";
import { useProjetos, projetosActions } from "@/lib/hooks/useProjetos";
import { calcularResumoProgresso, SAUDE_ESTILO, linkSeguro } from "@/lib/projetos/progresso";
import {
  findProjectClient,
  normalizeClientName,
  projectBelongsToClient,
} from "@/lib/projetos/cliente";
import { ProjetoModal } from "@/components/projetos/projeto-modal";
import { TarefaModal } from "@/components/projetos/tarefa-modal";
import { MarcoModal } from "@/components/projetos/marco-modal";
import { EntregavelModal } from "@/components/projetos/entregavel-modal";
import { ClientPortalWorkspace } from "@/components/projetos/client-portal-workspace";
import type { ClientPortalMetrics } from "@/components/projetos/client-portal-panel";
import {
  ProjetosErrorState,
  ProjetosLoadingState,
} from "@/components/projetos/projetos-error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useComercialSupa } from "@/lib/hooks/useComercial";
import { toast } from "sonner";

export const Route = createFileRoute("/projetos/$id")({ component: ProjetoDetalhe });

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
};

const kanbanDropAnimation: DropAnimation = {
  duration: 150,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
};

const projectTabClassName =
  "h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-semibold text-[var(--kb-text-muted)] shadow-none transition-[color,border-color] data-[state=active]:border-[var(--primary-ui)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--kb-text)] data-[state=active]:shadow-none";

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProjetoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { projetos, tarefas, marcos, entregaveis, loading, error, retry } = useProjetos();
  const {
    empresas: crmClients,
    loading: crmLoading,
    error: crmError,
    retry: retryCrm,
  } = useComercialSupa();
  const directProject = projetos.find((p) => p.id === id);
  const clientRecord =
    crmClients.find((client) => client.id === id) ??
    (directProject ? findProjectClient(directProject, crmClients) : undefined);
  const clientName = clientRecord?.nome ?? directProject?.cliente;
  const projetosDoCliente = clientName
    ? projetos
        .filter(
          (project) =>
            project.id === directProject?.id ||
            (clientRecord
              ? projectBelongsToClient(project, clientRecord)
              : !project.clienteId &&
                normalizeClientName(project.cliente) === normalizeClientName(clientName)),
        )
        .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
    : [];
  const projeto = directProject ?? projetosDoCliente[0];
  const [novoProjeto, setNovoProjeto] = useState(false);

  useEffect(() => {
    const pendingClientId = sessionStorage.getItem("makershub:novo-projeto-cliente");
    if (pendingClientId && (pendingClientId === id || pendingClientId === clientRecord?.id)) {
      sessionStorage.removeItem("makershub:novo-projeto-cliente");
      setNovoProjeto(true);
    }
  }, [id, clientRecord?.id]);

  if (loading || crmLoading) {
    return <ProjetosLoadingState />;
  }

  if (error || crmError) {
    return (
      <ProjetosErrorState
        message={error || crmError}
        onRetry={async () => {
          await Promise.all([retry(), retryCrm()]);
        }}
      />
    );
  }

  if (!clientName) {
    return (
      <div className="space-y-3">
        <Link
          to="/projetos"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft2 size={12} color="currentColor" variant="Linear" /> Voltar
        </Link>
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Projeto não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center px-1">
        <Link
          to="/projetos"
          className="inline-flex h-10 items-center gap-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <span className="kb-nav-icon grid size-9 place-items-center rounded-xl">
            <ArrowLeft2 size={18} color="currentColor" variant="Linear" />
          </span>
          Todos os clientes
        </Link>
      </div>

      {projeto && (
        <nav
          className="kb-project-nav flex min-w-0 items-stretch overflow-hidden rounded-2xl"
          aria-label={`Projetos de ${clientName}`}
        >
          <div className="flex w-[190px] shrink-0 flex-col justify-center border-r border-white/[.07] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-[var(--kb-text-faint)]">
              Projetos
            </span>
            <strong className="mt-0.5 truncate font-display text-sm font-bold text-[var(--kb-text)]">
              {clientName}
            </strong>
          </div>
          <div className="kb-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-2">
            {projetosDoCliente.map((item) => {
              const resumo = calcularResumoProgresso(item, tarefas);
              const ativo = item.id === projeto.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate({ to: "/projetos/$id", params: { id: item.id } })}
                  className={cn(
                    "flex h-11 min-w-[170px] items-center justify-between gap-3 rounded-xl border px-3 text-left transition-[color,border-color,background-color]",
                    ativo
                      ? "border-[color:color-mix(in_oklch,var(--primary)_30%,transparent)] bg-[var(--primary-soft)] text-[var(--kb-text)]"
                      : "border-transparent text-[var(--kb-text-muted)] hover:border-white/[.08] hover:bg-white/[.035] hover:text-[var(--kb-text)]",
                    item.arquivado && "opacity-55",
                  )}
                  aria-current={ativo ? "page" : undefined}
                >
                  <span className="min-w-0 truncate text-[13px] font-bold">{item.nome}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-bold tabular-nums",
                      ativo ? "text-[var(--primary-ink)]" : "text-[var(--kb-text-faint)]",
                    )}
                  >
                    {resumo.percentual}%
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setNovoProjeto(true)}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-dashed border-white/[.1] px-3 text-[13px] font-semibold text-[var(--kb-text-muted)] transition hover:border-[color:color-mix(in_oklch,var(--primary)_30%,transparent)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)]"
            >
              <Add size={18} color="currentColor" variant="Linear" /> Novo projeto
            </button>
          </div>
        </nav>
      )}

      {projeto ? (
        <ProjetoConteudo
          projeto={projeto}
          projetos={projetos}
          tarefas={tarefas}
          marcos={marcos}
          entregaveis={entregaveis}
        />
      ) : (
        <EmptyClientWorkspace clientName={clientName} onCreate={() => setNovoProjeto(true)} />
      )}

      <ProjetoModal
        open={novoProjeto}
        onClose={() => setNovoProjeto(false)}
        clienteInicial={clientName}
        clienteIdInicial={clientRecord?.id}
      />
    </div>
  );
}

function EmptyClientWorkspace({
  clientName,
  onCreate,
}: {
  clientName: string;
  onCreate: () => void;
}) {
  return (
    <div className="grid min-h-[460px] place-items-center rounded-xl border border-dashed border-border bg-surface-1/25 p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Add size={24} color="currentColor" variant="Linear" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold">{clientName} está pronto</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Agora crie o primeiro projeto deste cliente. Cada projeto terá seu próprio fluxo, tarefas,
          entregas e revisões.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          <Add size={16} color="currentColor" variant="Linear" /> Criar primeiro projeto
        </Button>
      </div>
    </div>
  );
}

function ProjectPortalMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  tone: string;
}) {
  return (
    <div className="flex h-16 min-w-[132px] items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.035] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_16px_30px_-28px_rgba(0,0,0,.9)]">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl border bg-current/[.07] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_24px_-16px_currentColor]",
          tone,
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <strong className="block font-display text-xl font-bold leading-none text-foreground tabular-nums">
          {value ?? "—"}
        </strong>
        <span className="mt-1.5 block truncate text-[9px] font-bold uppercase tracking-[.11em] text-[var(--kb-text-muted)]">
          {label}
        </span>
      </span>
    </div>
  );
}

function ProjectPortalIndicators({ metrics }: { metrics: ClientPortalMetrics | null }) {
  return (
    <div className="order-3 flex w-full min-w-0 gap-2.5 overflow-x-auto pt-1 animate-in fade-in-0 slide-in-from-right-4 zoom-in-95 duration-300 motion-reduce:animate-none xl:order-none xl:w-auto xl:pt-0">
      <ProjectPortalMetric
        icon={Clock3}
        label="Aguardando"
        value={metrics?.pending ?? null}
        tone="border-warning/25 text-warning"
      />
      <ProjectPortalMetric
        icon={MessageSquareText}
        label="Ajustes"
        value={metrics?.changes ?? null}
        tone="border-destructive/25 text-destructive"
      />
      <ProjectPortalMetric
        icon={PackageCheck}
        label="Entregas"
        value={metrics?.deliveries ?? null}
        tone="border-success/25 text-success"
      />
    </div>
  );
}

function ProjetoConteudo({
  projeto,
  projetos,
  tarefas,
  marcos,
  entregaveis,
}: {
  projeto: Projeto;
  projetos: Projeto[];
  tarefas: Tarefa[];
  marcos: Marco[];
  entregaveis: Entregavel[];
}) {
  const { usuario } = useAuth();
  const podeVerValor = usuario?.role === "admin";
  const id = projeto.id;
  const [activeTab, setActiveTab] = useState("tarefas");
  const [portalMetricsSnapshot, setPortalMetricsSnapshot] = useState<{
    projectId: string;
    metrics: ClientPortalMetrics;
  } | null>(null);
  const [editandoProjeto, setEditandoProjeto] = useState(false);
  const [detalhesProjeto, setDetalhesProjeto] = useState(false);
  const [confirmarReplicacao, setConfirmarReplicacao] = useState(false);
  const [replicandoFluxo, setReplicandoFluxo] = useState(false);
  const [tarefaModal, setTarefaModal] = useState<{
    open: boolean;
    tarefa?: Tarefa | null;
    faseInicial?: string;
  }>({
    open: false,
  });
  const [marcoModal, setMarcoModal] = useState<{ open: boolean; marco?: Marco | null }>({
    open: false,
  });
  const [entregavelModal, setEntregavelModal] = useState<{
    open: boolean;
    entregavel?: Entregavel | null;
  }>({ open: false });

  const minhasTarefas = tarefas.filter((t) => t.projetoId === id);
  const projetoConcluido = minhasTarefas.length > 0 && minhasTarefas.every((t) => t.concluida);
  const meusMarcos = marcos.filter((m) => m.projetoId === id);
  const meusEntregaveis = entregaveis.filter((e) => e.projetoId === id);
  const portalMetrics =
    portalMetricsSnapshot?.projectId === id ? portalMetricsSnapshot.metrics : null;
  const handlePortalMetricsChange = useCallback(
    (metrics: ClientPortalMetrics) => setPortalMetricsSnapshot({ projectId: id, metrics }),
    [id],
  );

  return (
    <div
      className={cn(
        "project-kanban-ambient min-w-0 space-y-3 transition-opacity",
        projeto.arquivado && "opacity-60 hover:opacity-90",
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-5 px-1 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[2rem] font-bold leading-[1.08] tracking-[-.035em] md:text-[2.35rem]">
            {projeto.nome}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center text-sm text-[var(--kb-text-muted)]">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="size-2 rounded-full bg-[var(--primary-ui)] shadow-[0_0_14px_-2px_var(--primary)]" />
              {projeto.arquivado ? "Projeto fechado" : "Em produção"}
            </span>
          </div>
        </div>
        {activeTab === "cliente" && <ProjectPortalIndicators metrics={portalMetrics} />}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setDetalhesProjeto(true)}
            className="h-11 rounded-xl border-white/[.09] bg-white/[.035] px-4 text-sm font-semibold hover:border-[color:color-mix(in_oklch,var(--primary)_25%,transparent)] hover:bg-[var(--primary-soft)]"
          >
            <DocumentText1
              size={19}
              color="currentColor"
              variant="Bulk"
              className="text-[var(--primary-ink)]"
            />
            Detalhes do projeto
          </Button>
          <Button
            onClick={() => setTarefaModal({ open: true })}
            className="h-11 rounded-xl bg-[var(--primary-ui)] px-4 text-sm font-bold text-[var(--primary-fg)] shadow-[0_14px_30px_-18px_var(--primary)] hover:bg-[var(--primary-ink)]"
          >
            <Add size={20} color="currentColor" variant="Linear" /> Nova tarefa
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="max-w-full overflow-x-auto pt-1">
          <TabsList className="h-auto w-max min-w-full justify-start rounded-none border-b border-white/[.07] bg-transparent p-0">
            <TabsTrigger className={projectTabClassName} value="tarefas">
              Fluxo de produção ({minhasTarefas.length})
            </TabsTrigger>
            <TabsTrigger className={projectTabClassName} value="cliente">
              Área do cliente
            </TabsTrigger>
            <TabsTrigger className={projectTabClassName} value="info">
              Links e notas
            </TabsTrigger>
            <TabsTrigger className={projectTabClassName} value="equipe">
              Equipe
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tarefas" className="mt-3">
          <div className="grid items-stretch gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_292px]">
            <section className="order-2 flex min-w-0 flex-col min-[1180px]:order-1">
              <div className="mb-4 px-1">
                <p className="text-sm leading-relaxed text-[var(--kb-text-muted)]">
                  Arraste os cards entre as etapas ou clique para editar.
                </p>
              </div>
              <KanbanTarefas
                tarefas={minhasTarefas}
                todasTarefas={tarefas}
                projetos={projetos}
                projetoId={projeto.id}
                fases={projeto.fases ?? []}
                onEditar={(t) => setTarefaModal({ open: true, tarefa: t })}
                onNovaTarefa={(faseInicial) => setTarefaModal({ open: true, faseInicial })}
                onSolicitarReplicacao={() => setConfirmarReplicacao(true)}
              />
            </section>
            <PainelContexto projeto={projeto} tarefas={minhasTarefas} marcos={meusMarcos} />
          </div>
        </TabsContent>

        <TabsContent value="entregaveis" className="mt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Cada item representa um vídeo, foto, doc ou peça que você precisa entregar — com link
              pro Drive e status.
            </p>
            <Button size="sm" onClick={() => setEntregavelModal({ open: true })}>
              <Add size={16} color="currentColor" variant="Linear" /> Novo entregável
            </Button>
          </div>
          <ListaEntregaveis
            entregaveis={meusEntregaveis}
            onEditar={(e) => setEntregavelModal({ open: true, entregavel: e })}
          />
        </TabsContent>

        <TabsContent value="marcos" className="mt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Marcos importantes do projeto. Sempre aparecem na Agenda.
            </p>
            <Button size="sm" onClick={() => setMarcoModal({ open: true })}>
              <Add size={16} color="currentColor" variant="Linear" /> Novo marco
            </Button>
          </div>
          <ListaMarcos
            marcos={meusMarcos}
            onEditar={(m) => setMarcoModal({ open: true, marco: m })}
          />
        </TabsContent>

        <TabsContent value="cliente" className="mt-3">
          <ClientPortalWorkspace project={projeto} onMetricsChange={handlePortalMetricsChange} />
        </TabsContent>

        <TabsContent value="info" className="mt-3">
          <InfoProjeto projeto={projeto} />
        </TabsContent>

        <TabsContent value="equipe" className="mt-3">
          <section className="kb-workspace-panel p-5 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="kb-workspace-icon grid size-11 shrink-0 place-items-center rounded-xl">
                  <Profile2User size={22} color="currentColor" variant="Bulk" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-[-.02em]">
                    Equipe do projeto
                  </h3>
                  <p className="mt-0.5 text-[13px] text-[var(--kb-text-muted)]">
                    Quem participa da produção e o que está sob responsabilidade de cada pessoa.
                  </p>
                </div>
              </div>
              <span className="kb-workspace-count">
                {projeto.equipe.length} {projeto.equipe.length === 1 ? "pessoa" : "pessoas"}
              </span>
            </header>

            {projeto.equipe.length === 0 ? (
              <div className="kb-workspace-empty mt-5 flex min-h-60 flex-col items-center justify-center px-5 text-center">
                <span className="kb-workspace-empty-icon grid size-14 place-items-center rounded-2xl">
                  <Profile2User size={27} color="currentColor" variant="Bulk" />
                </span>
                <h4 className="mt-4 font-display text-base font-bold">
                  Monte a equipe deste projeto
                </h4>
                <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--kb-text-muted)]">
                  Gerencie os membros da sua produtora nas Configurações e depois escolha quem
                  participa nos detalhes do projeto.
                </p>
                <Button
                  variant="outline"
                  asChild
                  className="mt-4 h-10 rounded-xl border-white/[.09] bg-white/[.035] px-4 font-semibold hover:bg-[var(--primary-soft)]"
                >
                  <Link to="/configuracoes" hash="equipe">
                    <Profile2User size={17} color="currentColor" variant="Linear" /> Adicionar
                    equipe
                    <ArrowRight2 size={15} color="currentColor" variant="Linear" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projeto.equipe.map((m, i) => {
                  const abertas = minhasTarefas.filter(
                    (t) => t.responsavel === m && t.status !== "concluida",
                  ).length;
                  return (
                    <article key={i} className="kb-team-card flex items-center gap-3.5 p-4">
                      <div className="kb-team-avatar grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold">
                        {m
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{m}</p>
                        <p className="mt-1 text-[12px] text-[var(--kb-text-muted)]">
                          {abertas} tarefa{abertas === 1 ? "" : "s"} aberta
                          {abertas === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="kb-team-stat tabular-nums">{abertas}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <ProjetoDetalhesDialog
        open={detalhesProjeto}
        onOpenChange={setDetalhesProjeto}
        projeto={projeto}
        tarefas={minhasTarefas}
        podeVerValor={podeVerValor}
        podeAlterarArquivo={projetoConcluido || Boolean(projeto.arquivado)}
        onEditar={() => {
          setDetalhesProjeto(false);
          setEditandoProjeto(true);
        }}
      />

      <ProjetoModal
        open={editandoProjeto}
        onClose={() => setEditandoProjeto(false)}
        projeto={projeto}
      />
      <TarefaModal
        open={tarefaModal.open}
        onClose={() => setTarefaModal({ open: false })}
        projetoId={projeto.id}
        tarefa={tarefaModal.tarefa}
        fases={projeto.fases ?? []}
        faseInicial={tarefaModal.faseInicial ?? faseParaId(projeto.fases?.[0] ?? "briefing")}
      />
      <MarcoModal
        open={marcoModal.open}
        onClose={() => setMarcoModal({ open: false })}
        projetoId={projeto.id}
        marco={marcoModal.marco}
      />
      <EntregavelModal
        open={entregavelModal.open}
        onClose={() => setEntregavelModal({ open: false })}
        projetoId={projeto.id}
        entregavel={entregavelModal.entregavel}
      />
      <Dialog
        open={confirmarReplicacao}
        onOpenChange={(open) => !replicandoFluxo && setConfirmarReplicacao(open)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              Aplicar este fluxo aos demais clientes?
            </DialogTitle>
            <DialogDescription>
              Você atualizou o fluxo deste projeto. Se preferir, a mudança pode ficar somente aqui.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={replicandoFluxo}
              onClick={() => setConfirmarReplicacao(false)}
            >
              Manter só neste cliente
            </Button>
            <Button
              disabled={replicandoFluxo}
              onClick={async () => {
                setReplicandoFluxo(true);
                const ok = await projetosActions.replicarFluxoParaTodos(projeto.id);
                setReplicandoFluxo(false);
                if (ok) {
                  toast.success("Fluxo replicado para os demais projetos.");
                  setConfirmarReplicacao(false);
                } else {
                  toast.error("Não foi possível replicar o fluxo no momento.");
                }
              }}
            >
              {replicandoFluxo ? "Aplicando…" : "Sim, replicar fluxo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumoProgresso({ projeto, tarefas }: { projeto: Projeto; tarefas: Tarefa[] }) {
  const r = calcularResumoProgresso(projeto, tarefas);
  const saude = SAUDE_ESTILO[r.saude];
  const proxima = tarefas
    .filter((t) => !t.concluida && t.prazo)
    .sort((a, b) => +new Date(a.prazo!) - +new Date(b.prazo!))[0];

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--kb-text-muted)]">Progresso geral</span>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-lg border px-2 py-1 text-xs font-semibold", saude.badge)}>
            {r.label}
          </span>
          <span className="font-display text-2xl font-bold tabular-nums">{r.percentual}%</span>
        </div>
      </div>
      <Progress
        value={r.percentual}
        indicatorClassName="bg-[var(--primary-ui)]"
        className="mt-3 h-1.5 bg-[var(--kb-border)]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-relaxed text-[var(--kb-text-muted)]">
        <span>
          {r.concluidas} de {r.total} tarefas concluídas
        </span>
        {r.atrasadas > 0 && (
          <span className="font-medium text-destructive">
            {r.atrasadas} atrasada{r.atrasadas > 1 ? "s" : ""}
          </span>
        )}
        {proxima && (
          <span className="inline-flex items-center gap-1.5">
            <Calendar
              size={15}
              color="currentColor"
              variant="Bulk"
              className="text-[var(--primary-ink)]"
            />
            Próxima: {proxima.titulo} ·{" "}
            {format(new Date(proxima.prazo!), "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}

function ProjetoDetalhesDialog({
  open,
  onOpenChange,
  projeto,
  tarefas,
  podeVerValor,
  podeAlterarArquivo,
  onEditar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto;
  tarefas: Tarefa[];
  podeVerValor: boolean;
  podeAlterarArquivo: boolean;
  onEditar: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/[.1] bg-[oklch(0.18_0.008_260/.96)] p-0 shadow-[0_32px_90px_-38px_rgba(0,0,0,.95)] backdrop-blur-2xl">
        <DialogHeader className="border-b border-white/[.07] px-6 pb-5 pt-6 text-left">
          <div className="flex items-start gap-3.5">
            <span className="kb-detail-icon grid size-11 shrink-0 place-items-center rounded-xl">
              <DocumentText1 size={22} color="currentColor" variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-2xl font-bold tracking-[-.025em]">
                Detalhes do projeto
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed">
                {projeto.nome} · {projeto.cliente}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4 sm:col-span-2">
            <ResumoProgresso projeto={projeto} tarefas={tarefas} />
          </section>

          <DetalheProjetoItem
            icon={Calendar}
            label="Início"
            valor={format(new Date(projeto.dataInicio), "dd MMM yyyy", { locale: ptBR })}
            complemento={formatDistanceToNow(new Date(projeto.dataInicio), {
              locale: ptBR,
              addSuffix: true,
            })}
          />
          <DetalheProjetoItem
            icon={Calendar}
            label="Prazo geral"
            valor={
              projeto.dataEntrega
                ? format(new Date(projeto.dataEntrega), "dd MMM yyyy", { locale: ptBR })
                : "Sem prazo definido"
            }
          />
          {podeVerValor && (
            <DetalheProjetoItem
              icon={DollarCircle}
              label="Valor"
              valor={`R$ ${projeto.valor.toLocaleString("pt-BR")}`}
            />
          )}
          <DetalheProjetoItem
            icon={Profile2User}
            label="Equipe"
            valor={`${projeto.equipe.length} pessoa${projeto.equipe.length === 1 ? "" : "s"}`}
            complemento={projeto.equipe.length ? projeto.equipe.join(", ") : "Ainda sem equipe"}
          />
          <DetalheProjetoItem
            icon={Flag}
            label="Etapas"
            valor={`${projeto.fases?.length ?? 0} etapas no fluxo`}
          />
          <DetalheProjetoItem
            icon={TickCircle}
            label="Status"
            valor={projeto.arquivado ? "Projeto fechado" : "Em produção"}
          />

          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[.09em] text-[var(--kb-text-faint)]">
              Sobre o projeto
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--kb-text-muted)]">
              {projeto.descricao || "Nenhuma descrição adicionada a este projeto."}
            </p>
          </section>
        </div>

        <DialogFooter className="border-t border-white/[.07] px-6 py-4 sm:justify-between">
          <div>
            {podeAlterarArquivo && (
              <Button
                variant="ghost"
                className="h-10 text-sm text-[var(--kb-text-muted)] hover:text-[var(--kb-text)]"
                onClick={async () => {
                  const fechar = !projeto.arquivado;
                  if (
                    fechar &&
                    !confirm(
                      `Fechar o projeto "${projeto.nome}"? As informações continuarão disponíveis.`,
                    )
                  )
                    return;
                  await projetosActions.atualizarProjeto(projeto.id, { arquivado: fechar });
                }}
              >
                {projeto.arquivado ? (
                  <ArchiveRestore className="size-[18px]" />
                ) : (
                  <Archive className="size-[18px]" />
                )}
                {projeto.arquivado ? "Reabrir projeto" : "Fechar projeto"}
              </Button>
            )}
          </div>
          <Button
            onClick={onEditar}
            className="h-10 rounded-xl bg-[var(--primary-ui)] px-4 text-sm font-bold text-[var(--primary-fg)] hover:bg-[var(--primary-ink)]"
          >
            <Edit2 size={18} color="currentColor" variant="Bulk" /> Editar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheProjetoItem({
  icon: Icon,
  label,
  valor,
  complemento,
}: {
  icon: typeof IconsaxIcon;
  label: string;
  valor: string;
  complemento?: string;
}) {
  return (
    <div className="flex min-h-24 items-start gap-3 rounded-2xl border border-white/[.08] bg-white/[.035] p-4">
      <span className="kb-detail-icon grid size-10 shrink-0 place-items-center rounded-xl">
        <Icon size={20} color="currentColor" variant="Bulk" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--kb-text-faint)]">
          {label}
        </p>
        <p className="mt-1 font-display text-[15px] font-bold leading-snug text-[var(--kb-text)]">
          {valor}
        </p>
        {complemento && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--kb-text-muted)]">
            {complemento}
          </p>
        )}
      </div>
    </div>
  );
}

function PainelContexto({
  projeto,
  tarefas,
  marcos,
}: {
  projeto: Projeto;
  tarefas: Tarefa[];
  marcos: Marco[];
}) {
  const agenda = [
    ...tarefas
      .filter((tarefa) => !tarefa.concluida && tarefa.prazo)
      .map((tarefa) => ({
        id: `tarefa-${tarefa.id}`,
        titulo: tarefa.titulo,
        data: tarefa.prazo!,
        detalhe: tarefa.responsavel,
      })),
    ...marcos
      .filter((marco) => marco.status === "pendente")
      .map((marco) => ({
        id: `marco-${marco.id}`,
        titulo: marco.titulo,
        data: marco.data,
        detalhe: "Marco do projeto",
      })),
  ]
    .sort((a, b) => +new Date(a.data) - +new Date(b.data))
    .slice(0, 3);

  const links = (projeto.links ?? [])
    .flatMap((link) => {
      const seguro = linkSeguro(link.url);
      return seguro ? [{ ...link, seguro }] : [];
    })
    .slice(0, 3);

  return (
    <aside className="kb-context-panel order-1 grid gap-3 md:grid-cols-2 min-[1180px]:order-2 min-[1180px]:flex min-[1180px]:h-full min-[1180px]:flex-col">
      <section className="kb-glass-shell rounded-2xl p-4">
        <ResumoProgresso projeto={projeto} tarefas={tarefas} />
      </section>

      <section className="kb-glass-shell rounded-2xl p-4 min-[1180px]:flex-1">
        <div className="flex items-center gap-3">
          <span className="kb-detail-icon grid size-10 shrink-0 place-items-center rounded-xl">
            <Calendar size={20} color="currentColor" variant="Bulk" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold">Próximos passos</h3>
            <p className="mt-0.5 text-xs text-[var(--kb-text-muted)]">O que pede atenção agora.</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {agenda.map((item, index) => (
            <div key={item.id} className="relative border-l border-white/[.08] pl-4">
              <span
                className={cn(
                  "absolute -left-[4.5px] top-1.5 size-2 rounded-full",
                  index === 0
                    ? "bg-[var(--primary-ui)] shadow-[0_0_12px_-2px_var(--primary)]"
                    : "bg-[var(--kb-text-faint)]",
                )}
              />
              <p className="text-xs font-semibold uppercase tracking-[.06em] text-[var(--kb-text-faint)]">
                {format(new Date(item.data), "dd MMM · HH:mm", { locale: ptBR })}
              </p>
              <p className="mt-1 text-[13px] font-bold leading-snug text-[var(--kb-text)]">
                {item.titulo}
              </p>
              <p className="mt-1 text-xs text-[var(--kb-text-muted)]">{item.detalhe}</p>
            </div>
          ))}
          {!agenda.length && (
            <p className="text-xs leading-relaxed text-[var(--kb-text-muted)]">
              Nenhum prazo pendente.
            </p>
          )}
        </div>

        <div className="my-4 h-px bg-white/[.07]" />

        <div className="flex items-center gap-2.5">
          <Link2
            size={18}
            color="currentColor"
            variant="Bulk"
            className="text-[var(--primary-ink)]"
          />
          <h3 className="font-display text-sm font-bold">Acessos rápidos</h3>
        </div>
        <div className="mt-3 space-y-1.5">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.seguro.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 text-[13px] font-semibold text-[var(--kb-text-muted)] transition hover:border-[color:color-mix(in_oklch,var(--primary)_24%,transparent)] hover:bg-[var(--primary-soft)] hover:text-[var(--kb-text)]"
            >
              <span className="truncate">{link.label}</span>
              <Export size={16} color="currentColor" variant="Linear" className="shrink-0" />
            </a>
          ))}
          {!links.length && (
            <p className="rounded-xl border border-dashed border-white/[.08] px-3 py-4 text-xs leading-relaxed text-[var(--kb-text-muted)]">
              Adicione links importantes em “Links e notas”.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}

const SUGESTOES_FASE = [
  "Aprovação interna",
  "Aprovação cliente",
  "Animação",
  "Locução",
  "Mixagem",
  "Finalização",
  "Publicação",
  "Arquivamento",
];

function KanbanTarefas({
  tarefas,
  todasTarefas,
  projetos,
  projetoId,
  fases,
  onEditar,
  onNovaTarefa,
  onSolicitarReplicacao,
}: {
  tarefas: Tarefa[];
  todasTarefas: Tarefa[];
  projetos: Projeto[];
  projetoId: string;
  fases: string[];
  onEditar: (t: Tarefa) => void;
  onNovaTarefa: (faseInicial: string) => void;
  onSolicitarReplicacao?: () => void;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [novaFase, setNovaFase] = useState("");
  const [salvandoFase, setSalvandoFase] = useState(false);
  const [erroFase, setErroFase] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [faseEditando, setFaseEditando] = useState<{
    raw: string;
    id: string;
    label: string;
  } | null>(null);
  const [faseRemovendo, setFaseRemovendo] = useState<{
    raw: string;
    id: string;
    label: string;
  } | null>(null);
  const [removendoFase, setRemovendoFase] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resetScroll = window.setTimeout(() => {
      boardScrollRef.current?.scrollTo({ left: 0 });
    }, 150);
    return () => window.clearTimeout(resetScroll);
  }, [projetoId]);

  const colunas = fases.map((fase) => ({
    raw: fase,
    id: faseParaId(fase),
    label: getFaseInfo(fase).label,
  }));
  const idsSet = new Set(fasesParaIds(fases));

  const tokenDuplicadoEmOutraColuna = (valor: string, faseAtual?: string) => {
    const alvo = faseParaId(valor);
    return Boolean(alvo) && colunas.some((coluna) => coluna.id === alvo && coluna.id !== faseAtual);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
    useSensor(KeyboardSensor),
  );

  const confirmarNovaFase = async (nome: string) => {
    const n = nome.trim();
    if (!n || salvandoFase) return;
    setSalvandoFase(true);
    setErroFase(null);
    try {
      if (tokenDuplicadoEmOutraColuna(n)) {
        setErroFase("Já existe uma etapa com esse nome nesta rotina.");
        return;
      }
      const sucesso = await projetosActions.adicionarFase(projetoId, n);
      if (!sucesso) {
        setErroFase("Use um nome diferente das etapas que já existem.");
        return;
      }
      setNovaFase("");
      setAdicionando(false);
      onSolicitarReplicacao?.();
    } finally {
      setSalvandoFase(false);
    }
  };

  const renomearFase = async (faseId: string, label: string) => {
    const novoLabel = label.trim();
    const atual = colunas.find((coluna) => coluna.id === faseId)?.label.trim() ?? "";
    if (!novoLabel || novoLabel === atual) {
      setFaseEditando(null);
      return true;
    }
    if (tokenDuplicadoEmOutraColuna(novoLabel, faseId)) {
      toast.error("Já existe uma etapa com esse nome nesta rotina.");
      return false;
    }
    const token = serializarFaseToken(faseId, novoLabel);
    const novas = fases.map((fase) => (faseParaId(fase) === faseId ? token : fase));
    const ok = await projetosActions.atualizarProjeto(projetoId, { fases: novas });
    if (!ok) return false;
    onSolicitarReplicacao?.();
    return true;
  };

  const removerFaseSelecionada = async () => {
    if (!faseRemovendo || removendoFase) return;
    setRemovendoFase(true);
    try {
      const resultado = await projetosActions.removerFaseDeTodos(faseRemovendo.id);
      if (resultado) {
        toast.success(
          `Coluna removida de ${resultado.projetos} projeto${resultado.projetos === 1 ? "" : "s"}.`,
        );
        setFaseRemovendo(null);
      } else {
        toast.error("Não foi possível remover esta coluna.");
      }
    } finally {
      setRemovendoFase(false);
    }
  };

  const tarefasNaFase = faseRemovendo
    ? todasTarefas.filter((tarefa) => faseParaId(tarefa.status) === faseRemovendo.id)
    : [];
  const projetosComTarefaNaFase = new Set(tarefasNaFase.map((tarefa) => tarefa.projetoId));
  const projetosComFase = faseRemovendo
    ? projetos.filter(
        (item) =>
          (item.fases ?? []).some((fase) => faseParaId(fase) === faseRemovendo.id) ||
          projetosComTarefaNaFase.has(item.id),
      )
    : [];
  const clientesAfetados = new Set(projetosComFase.map((item) => item.cliente)).size;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const novaFaseId = faseParaId(String(over.id));
    if (idsSet.has(novaFaseId)) {
      void projetosActions.atualizarTarefa(String(active.id), { status: novaFaseId });
    }
  };

  const draggingTarefa = draggingId ? tarefas.find((t) => t.id === draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={(e) => setDraggingId(String(e.active.id))}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={boardScrollRef}
        className="kb-kanban-stage kb-scrollbar flex flex-1 snap-x snap-proximity gap-3 overflow-x-auto px-1 pb-3 pt-1"
      >
        {colunas.map((coluna, idx) => {
          const items = tarefas.filter((tarefa) => faseParaId(tarefa.status) === coluna.id);
          const isConcluida = coluna.id === "concluida";
          return (
            <KanbanColuna
              key={coluna.raw}
              faseId={coluna.raw}
              label={coluna.label}
              onStartEditarNome={() => setFaseEditando({ ...coluna })}
              isConcluida={isConcluida}
              podeEsquerda={idx > 0}
              podeDireita={idx < fases.length - 1}
              onMover={async (dir) => {
                const ok = await projetosActions.moverFase(projetoId, coluna.id, dir);
                if (ok) onSolicitarReplicacao?.();
              }}
              onRemover={!isConcluida ? () => setFaseRemovendo({ ...coluna }) : undefined}
              count={items.length}
              onNovaTarefa={() => onNovaTarefa(coluna.id)}
            >
              {items.map((t) => (
                <TarefaCard
                  key={t.id}
                  tarefa={t}
                  onEditar={() => onEditar(t)}
                  isDragging={draggingId === t.id}
                />
              ))}
            </KanbanColuna>
          );
        })}

        {/* botão nova coluna */}
        <div className="flex w-10 flex-shrink-0 items-start justify-center pt-1">
          {!adicionando ? (
            <button
              onClick={() => setAdicionando(true)}
              aria-label="Nova coluna"
              title="Nova coluna"
              className="grid size-8 place-items-center rounded-lg text-[var(--kb-text-faint)] transition-[color,background-color] duration-150 hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)]"
            >
              <Add size={16} color="currentColor" variant="Linear" />
            </button>
          ) : (
            <div className="w-[280px] space-y-2 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-card)] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nova fase
              </p>
              <div className="flex flex-wrap gap-1">
                {SUGESTOES_FASE.filter((s) => !idsSet.has(faseParaId(s)))
                  .slice(0, 6)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => void confirmarNovaFase(s)}
                      disabled={salvandoFase}
                      className="rounded-md border border-border/60 bg-surface-2/60 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
              </div>
              <input
                autoFocus
                value={novaFase}
                onChange={(e) => setNovaFase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmarNovaFase(novaFase);
                  if (e.key === "Escape" && !salvandoFase) setAdicionando(false);
                }}
                disabled={salvandoFase}
                placeholder="Nome personalizado…"
                className="h-8 w-full rounded-lg border border-border/60 bg-background/40 px-2.5 text-xs outline-none focus:border-primary/50"
              />
              {erroFase && <p className="text-xs text-destructive">{erroFase}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={() => void confirmarNovaFase(novaFase)}
                  disabled={salvandoFase || !novaFase.trim()}
                  className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {salvandoFase ? "Adicionando…" : "Adicionar"}
                </button>
                <button
                  onClick={() => {
                    setAdicionando(false);
                    setNovaFase("");
                    setErroFase(null);
                  }}
                  disabled={salvandoFase}
                  className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(faseEditando)} onOpenChange={(open) => !open && setFaseEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Editar nome da etapa</DialogTitle>
            <DialogDescription>
              Escolha um nome mais claro para esta coluna do fluxo deste projeto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fluxo-fase-nome" className="text-xs text-muted-foreground">
              Nome da etapa
            </Label>
            <Input
              id="fluxo-fase-nome"
              autoFocus
              value={faseEditando?.label ?? ""}
              maxLength={60}
              onChange={(event) =>
                setFaseEditando((atual) =>
                  atual ? { ...atual, label: event.target.value } : atual,
                )
              }
              onKeyDown={async (event) => {
                if (event.key === "Enter" && faseEditando) {
                  event.preventDefault();
                  if (await renomearFase(faseEditando.id, faseEditando.label)) {
                    setFaseEditando(null);
                  }
                }
                if (event.key === "Escape") setFaseEditando(null);
              }}
              placeholder="Ex.: Aprovação interna"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              A alteração vale somente para este cliente, a menos que você escolha replicar depois.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaseEditando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!faseEditando?.label.trim()}
              onClick={async () => {
                if (faseEditando && (await renomearFase(faseEditando.id, faseEditando.label))) {
                  setFaseEditando(null);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(faseRemovendo)}
        onOpenChange={(open) => !open && !removendoFase && setFaseRemovendo(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Excluir coluna de todos os fluxos?</DialogTitle>
            <DialogDescription>
              Se esta coluna existir em outros clientes, ela também será apagada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive">
              Coluna: <strong>{faseRemovendo?.label}</strong>
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              A exclusão afetará {projetosComFase.length} projeto
              {projetosComFase.length === 1 ? "" : "s"} em {clientesAfetados} cliente
              {clientesAfetados === 1 ? "" : "s"}.
              {tarefasNaFase.length > 0 &&
                ` As ${tarefasNaFase.length} tarefas desta etapa serão movidas para uma etapa vizinha, sem perda de conteúdo.`}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFaseRemovendo(null)}
              disabled={removendoFase}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={removerFaseSelecionada} disabled={removendoFase}>
              {removendoFase ? "Excluindo…" : "Excluir em todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DragOverlay
        adjustScale={false}
        dropAnimation={kanbanDropAnimation}
        style={{ pointerEvents: "none", willChange: "transform", contain: "layout paint" }}
        zIndex={60}
      >
        {draggingTarefa && (
          <TarefaCard tarefa={draggingTarefa} onEditar={() => {}} isDragging overlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColuna({
  faseId,
  label,
  onStartEditarNome,
  isConcluida,
  podeEsquerda,
  podeDireita,
  onMover,
  onRemover,
  count,
  onNovaTarefa,
  children,
}: {
  faseId: string;
  label: string;
  onStartEditarNome: () => void;
  isConcluida: boolean;
  podeEsquerda: boolean;
  podeDireita: boolean;
  onMover: (d: -1 | 1) => void;
  onRemover?: () => void;
  count: number;
  onNovaTarefa: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: faseId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kb-glass-column group/column relative min-h-[460px] w-[280px] min-w-[280px] flex-shrink-0 snap-start rounded-2xl p-2.5 transition-[background-color,border-color] duration-150",
        isOver && "border-[var(--primary-ui)] bg-[var(--primary-soft)]",
      )}
    >
      <div className="mb-2 flex h-10 items-center gap-2 px-1.5">
        <button
          type="button"
          onClick={onStartEditarNome}
          className={cn(
            "min-w-0 flex-1 truncate rounded text-left text-xs font-bold uppercase tracking-[.085em] text-[var(--kb-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)]",
            isConcluida && "text-[var(--kb-text-faint)]",
          )}
          title="Editar nome da etapa"
        >
          {label}
        </button>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--kb-text-faint)]">
          {count}
        </span>
        <details className="relative opacity-100 sm:opacity-0 sm:group-hover/column:opacity-100">
          <summary
            className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-[var(--kb-text-faint)] hover:bg-[var(--kb-card)] hover:text-[var(--kb-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)]"
            aria-label={`Ações da etapa ${label}`}
          >
            <Ellipsis className="size-[18px]" />
          </summary>
          <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-card)] p-1.5 shadow-[0_24px_48px_-24px_rgba(0,0,0,.7)]">
            <button
              type="button"
              onClick={() => onMover(-1)}
              disabled={!podeEsquerda}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--kb-text-muted)] hover:bg-[var(--kb-card-hover)] disabled:opacity-35"
            >
              <ArrowLeft2 size={16} color="currentColor" /> Mover à esquerda
            </button>
            <button
              type="button"
              onClick={() => onMover(1)}
              disabled={!podeDireita}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--kb-text-muted)] hover:bg-[var(--kb-card-hover)] disabled:opacity-35"
            >
              <ArrowRight2 size={16} color="currentColor" /> Mover à direita
            </button>
            {onRemover && (
              <button
                type="button"
                onClick={onRemover}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--sem-danger)] hover:bg-[var(--kb-card-hover)]"
              >
                <CloseCircle size={16} color="currentColor" /> Remover etapa
              </button>
            )}
          </div>
        </details>
      </div>
      <div className="min-h-[398px] space-y-2.5">
        {count === 0 && (
          <p className="py-10 text-center text-[13px] text-[var(--kb-text-faint)]">
            Nada nesta etapa
          </p>
        )}
        {children}
        <button
          type="button"
          onClick={onNovaTarefa}
          className="flex h-9 w-full items-center gap-1 px-2 text-[13px] font-medium text-[var(--kb-text-faint)] opacity-100 transition-opacity hover:text-[var(--kb-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)] sm:opacity-0 sm:group-hover/column:opacity-100 sm:focus-visible:opacity-100"
        >
          <Add size={16} color="currentColor" variant="Linear" /> tarefa
        </button>
      </div>
    </div>
  );
}

function TarefaCard({
  tarefa,
  onEditar,
  isDragging,
  overlay,
}: {
  tarefa: Tarefa;
  onEditar: () => void;
  isDragging?: boolean;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: overlay ? `${tarefa.id}-overlay` : tarefa.id,
    disabled: overlay,
  });
  const prio = PRIORIDADES[tarefa.prioridade] ?? PRIORIDADES.media;
  const lk = linkSeguro(tarefa.link);
  const prazo = tarefa.prazo ? new Date(tarefa.prazo) : null;
  const atrasada = Boolean(prazo && !tarefa.concluida && prazo.getTime() < Date.now());
  const prazoLabel = prazo
    ? isSameDay(prazo, new Date())
      ? `Hoje · ${format(prazo, "HH:mm")}`
      : format(prazo, "dd MMM", { locale: ptBR })
    : null;
  const prioridadeVisual =
    {
      baixa: "text-[var(--kb-text-faint)]",
      media: "text-[var(--kb-text-muted)]",
      alta: "text-[var(--sem-warn)]",
      urgente: "text-[var(--sem-danger)]",
    }[tarefa.prioridade] ?? "text-[var(--kb-text-muted)]";
  const prioridadeCor =
    {
      baixa: "oklch(0.68 0.025 250)",
      media: "var(--sem-info)",
      alta: "var(--sem-warn)",
      urgente: "var(--sem-danger)",
    }[tarefa.prioridade] ?? "var(--sem-info)";
  return (
    <div
      ref={setNodeRef}
      {...(!overlay ? listeners : {})}
      {...(!overlay ? attributes : {})}
      style={{ "--kb-priority": prioridadeCor } as CSSProperties}
      className={cn(
        "kb-glass-card group relative cursor-grab touch-none rounded-xl p-4 text-[var(--kb-text)] transition-[transform,border-color,background-color,opacity] duration-150 active:cursor-grabbing",
        tarefa.prioridade === "urgente" && "border-[color:oklch(0.68_0.13_25/0.45)]",
        isDragging && !overlay && "kb-is-dragging pointer-events-none opacity-35",
        overlay &&
          "kb-drag-overlay -rotate-[1.5deg] scale-[1.02] cursor-grabbing select-none shadow-[0_20px_40px_-18px_rgba(0,0,0,.8)] will-change-transform",
        tarefa.concluida && "opacity-60",
        !isDragging && "hover:-translate-y-px hover:border-[var(--kb-border-strong)]",
      )}
    >
      <span aria-hidden="true" className="kb-card-neon-dot" />
      <button
        type="button"
        onClick={onEditar}
        disabled={overlay}
        tabIndex={overlay ? -1 : undefined}
        aria-label={`Editar tarefa ${tarefa.titulo}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--kb-bg)]"
      />
      <div className="pointer-events-none relative z-[1] flex items-center justify-between gap-2">
        <span className={cn("text-xs font-bold uppercase tracking-[.08em]", prioridadeVisual)}>
          {prio.label}
        </span>
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            projetosActions.atualizarTarefa(tarefa.id, { concluida: !tarefa.concluida });
          }}
          className="pointer-events-auto grid size-8 place-items-center rounded-lg text-[var(--kb-text-faint)] opacity-100 transition-opacity hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          title={tarefa.concluida ? "Marcar como pendente" : "Marcar como concluída"}
        >
          {tarefa.concluida ? (
            <TickCircle size={19} color="currentColor" variant="Bulk" />
          ) : (
            <Circle className="size-[19px]" />
          )}
        </button>
      </div>

      <div className="pointer-events-none relative z-[1] mt-2.5 block w-full text-left">
        <p
          className={cn(
            "line-clamp-2 text-base font-bold leading-[1.3] tracking-[-.015em]",
            tarefa.concluida && "text-[var(--kb-text-muted)] line-through",
          )}
        >
          {tarefa.titulo}
        </p>
        {tarefa.descricao && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-[1.55] text-[var(--kb-text-muted)]">
            {tarefa.descricao}
          </p>
        )}
      </div>

      <div className="pointer-events-none relative z-[1] mt-4 flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--kb-card-hover)] text-xs font-bold text-[var(--kb-text-muted)]">
          {iniciais(tarefa.responsavel)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--kb-text-muted)]">
          {tarefa.responsavel}
        </span>
        {prazoLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium tabular-nums",
              atrasada ? "text-[var(--sem-danger)]" : "text-[var(--kb-text-muted)]",
            )}
          >
            <Calendar size={15} color="currentColor" variant="Bulk" /> {prazoLabel}
          </span>
        )}
      </div>

      {lk && (
        <a
          href={lk.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto relative z-[1] mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-md text-xs text-[var(--kb-text-faint)] transition-colors hover:text-[var(--kb-text-muted)]"
          title={lk.href}
        >
          <Link2 size={14} color="currentColor" variant="Bulk" className="shrink-0" />
          <span className="truncate">{lk.dominio}</span>
        </a>
      )}
    </div>
  );
}

function ListaMarcos({ marcos, onEditar }: { marcos: Marco[]; onEditar: (m: Marco) => void }) {
  const ordenados = [...marcos].sort((a, b) => +new Date(a.data) - +new Date(b.data));
  if (ordenados.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        Nenhum marco ainda. Crie marcos para acompanhar entregas importantes.
      </div>
    );
  return (
    <div className="space-y-2">
      {ordenados.map((m) => {
        const passou = new Date(m.data) < new Date();
        return (
          <button
            key={m.id}
            onClick={() => onEditar(m)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-1/40 p-3 text-left transition hover:border-primary/40"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                projetosActions.atualizarMarco(m.id, {
                  status: m.status === "concluido" ? "pendente" : "concluido",
                });
              }}
            >
              {m.status === "concluido" ? (
                <TickCircle
                  size={20}
                  color="currentColor"
                  variant="Linear"
                  className="text-success"
                />
              ) : (
                <Flag
                  size={20}
                  color="currentColor"
                  variant="Linear"
                  className={cn(passou ? "text-destructive" : "text-warning")}
                />
              )}
            </button>
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  m.status === "concluido" && "text-muted-foreground line-through",
                )}
              >
                {m.titulo}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(m.data), "EEEE, dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {m.status !== "concluido" && passou && (
              <span className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive">
                Atrasado
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListaEntregaveis({
  entregaveis,
  onEditar,
}: {
  entregaveis: Entregavel[];
  onEditar: (e: Entregavel) => void;
}) {
  if (entregaveis.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        Nenhum entregável ainda. Crie um pra cada peça que precisa ser entregue (vídeo, foto, doc…)
        e cole o link do Drive.
      </div>
    );
  }
  const grupos: { id: StatusEntregavel; label: string }[] = [
    { id: "pendente", label: "Pendentes" },
    { id: "em_revisao", label: "Em revisão" },
    { id: "aprovado", label: "Aprovados" },
    { id: "entregue", label: "Entregues" },
  ];
  return (
    <div className="space-y-4">
      {grupos.map((g) => {
        const items = entregaveis.filter((e) => e.status === g.id);
        if (items.length === 0) return null;
        return (
          <div key={g.id}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {g.label} · {items.length}
            </h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {items.map((e) => (
                <EntregavelCard key={e.id} entregavel={e} onEditar={() => onEditar(e)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EntregavelCard({
  entregavel,
  onEditar,
}: {
  entregavel: Entregavel;
  onEditar: () => void;
}) {
  const tipo = TIPOS_ENTREGAVEL[entregavel.tipo] ?? TIPOS_ENTREGAVEL.outro;
  const TipoIcon = TIPO_ENTREGAVEL_ICONS[entregavel.tipo] ?? TIPO_ENTREGAVEL_ICONS.outro;
  const status = STATUS_ENTREGAVEL[entregavel.status] ?? STATUS_ENTREGAVEL.pendente;
  const link = linkSeguro(entregavel.link);
  return (
    <div className="group rounded-lg border border-border/60 bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-start gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/40 bg-surface-2/40 text-primary">
          <TipoIcon className="size-4" />
        </div>
        <button onClick={onEditar} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{entregavel.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{tipo.label}</span>
            <span className={cn("rounded-md border px-1.5 py-0.5 font-medium", status.classe)}>
              {status.label}
            </span>
          </div>
          {entregavel.notas && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {entregavel.notas}
            </p>
          )}
        </button>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            className="grid size-7 shrink-0 place-items-center rounded-md border border-border/40 bg-surface-2/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            title="Abrir link"
          >
            <Export size={14} color="currentColor" variant="Linear" />
          </a>
        )}
      </div>
    </div>
  );
}

function InfoProjeto({ projeto }: { projeto: Projeto }) {
  const [notas, setNotas] = useState(projeto.notas ?? "");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const dirty = notas !== (projeto.notas ?? "");
  const linksSeguros = (projeto.links ?? [])
    .map((link) => ({ ...link, seguro: linkSeguro(link.url) }))
    .filter((link): link is typeof link & { seguro: NonNullable<ReturnType<typeof linkSeguro>> } =>
      Boolean(link.seguro),
    );

  const salvarNotas = () =>
    projetosActions.atualizarProjeto(projeto.id, { notas: notas.trim() || undefined });
  const addLink = async () => {
    if (!novoLabel.trim() || !novoUrl.trim()) return;
    const url = /^https?:\/\//i.test(novoUrl.trim()) ? novoUrl.trim() : `https://${novoUrl.trim()}`;
    const saved = await projetosActions.adicionarLink(projeto.id, novoLabel.trim(), url);
    if (!saved) return;
    setNovoLabel("");
    setNovoUrl("");
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="kb-workspace-panel flex min-h-[360px] flex-col p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="kb-workspace-icon grid size-11 shrink-0 place-items-center rounded-xl">
              <Link2 size={22} color="currentColor" variant="Bulk" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold tracking-[-.02em]">Links do projeto</h3>
              <p className="mt-0.5 text-[13px] text-[var(--kb-text-muted)]">
                Referências importantes sempre à mão.
              </p>
            </div>
          </div>
          <span className="kb-workspace-count">{linksSeguros.length}</span>
        </header>

        <div className="mt-5 flex-1 space-y-2">
          {linksSeguros.length === 0 && (
            <div className="kb-workspace-empty flex min-h-40 flex-col items-center justify-center px-4 text-center">
              <span className="kb-workspace-empty-icon grid size-11 place-items-center rounded-xl">
                <Link2 size={21} color="currentColor" variant="Bulk" />
              </span>
              <p className="mt-3 text-sm font-bold">Seu ponto de partida</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--kb-text-muted)]">
                Adicione a pasta no Drive, o briefing, moodboard ou qualquer referência recorrente.
              </p>
            </div>
          )}
          {linksSeguros.map((l) => (
            <div key={l.id} className="kb-workspace-item group flex items-center gap-3 p-3">
              <a
                href={l.seguro.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3 text-[13px] hover:text-[var(--primary-ink)]"
              >
                <span className="kb-link-item-icon grid size-9 shrink-0 place-items-center rounded-lg">
                  <Export size={17} color="currentColor" variant="Bulk" />
                </span>
                <span className="truncate font-medium">{l.label}</span>
                <span className="hidden truncate text-[12px] text-[var(--kb-text-muted)] md:inline">
                  {l.seguro.dominio}
                </span>
              </a>
              <button
                onClick={() => projetosActions.removerLink(projeto.id, l.id)}
                className="grid size-9 place-items-center rounded-lg opacity-0 transition hover:bg-white/[.04] group-hover:opacity-100 focus-visible:opacity-100"
                title="Remover"
              >
                <Trash
                  size={16}
                  color="currentColor"
                  variant="Linear"
                  className="text-[var(--kb-text-muted)] hover:text-destructive"
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[.06] pt-4 sm:grid-cols-[minmax(120px,.8fr)_minmax(180px,1.6fr)_44px]">
          <Input
            value={novoLabel}
            onChange={(e) => setNovoLabel(e.target.value)}
            placeholder="Rótulo"
            className="kb-workspace-control h-11 text-sm"
          />
          <Input
            value={novoUrl}
            onChange={(e) => setNovoUrl(e.target.value)}
            placeholder="https://…"
            className="kb-workspace-control h-11 text-sm"
          />
          <Button
            variant="outline"
            onClick={addLink}
            disabled={!novoLabel.trim() || !novoUrl.trim()}
            aria-label="Adicionar link"
            className="h-11 rounded-xl border-white/[.09] bg-white/[.035] px-0 hover:bg-[var(--primary-soft)]"
          >
            <Add size={19} color="currentColor" variant="Linear" />
          </Button>
        </div>
      </section>

      <section className="kb-workspace-panel flex min-h-[360px] flex-col p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="kb-workspace-icon grid size-11 shrink-0 place-items-center rounded-xl">
              <DocumentText1 size={22} color="currentColor" variant="Bulk" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold tracking-[-.02em]">Anotações</h3>
              <p className="mt-0.5 text-[13px] text-[var(--kb-text-muted)]">
                Contexto compartilhado da produção.
              </p>
            </div>
          </div>
          {dirty && (
            <Button
              size="sm"
              variant="outline"
              onClick={salvarNotas}
              className="rounded-xl border-white/[.09] bg-white/[.035]"
            >
              <DocumentDownload size={16} color="currentColor" variant="Linear" /> Salvar
            </Button>
          )}
        </header>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={salvarNotas}
          rows={10}
          placeholder="Briefing detalhado, preferências do cliente, decisões importantes, contatos, observações de produção…"
          className="kb-workspace-control mt-5 min-h-[230px] flex-1 resize-none px-4 py-3 text-sm leading-relaxed"
        />
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--kb-text-muted)]">
          <TickCircle
            size={16}
            color="currentColor"
            variant="Bulk"
            className="text-[var(--primary-ink)]"
          />
          Salva automaticamente ao sair do campo
        </div>
      </section>
    </div>
  );
}
