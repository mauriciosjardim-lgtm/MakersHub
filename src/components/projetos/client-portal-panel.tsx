import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Film,
  Link2,
  Loader2,
  MessageSquareText,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { parseClientAdjustmentFeedback } from "@/lib/client-adjustments";
import { cn } from "@/lib/utils";
import type { Projeto } from "@/lib/mock/projetos";
import { DEFAULT_PORTAL_COVER_URL, portalDisplayProgress, portalSlug } from "@/lib/portal-cliente";
import {
  configureMakersMembers,
  getClientPortalAccess,
  getReviewEmbedUrl,
  listClientReviews,
  publishClientDelivery,
  publishClientReview,
  removeClientReview,
  saveProjectClientPortalState,
  updateClientReviewMetadata,
  type ClientPortalAccess,
  type ClientReview,
} from "@/lib/client-reviews";

const PUBLIC_PHASES = [
  { value: "preparacao", label: "Preparação" },
  { value: "planejamento", label: "Planejamento" },
  { value: "producao", label: "Produção" },
  { value: "editando", label: "Editando" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "ajustes", label: "Ajustes" },
  { value: "aprovado", label: "Aprovado" },
  { value: "entregue", label: "Entregue" },
];

const PHASE_MESSAGES: Record<string, string> = {
  preparacao: "Estamos organizando os próximos passos e preparando tudo para iniciar a produção.",
  planejamento: "O planejamento está em andamento e em breve compartilharemos o próximo marco.",
  producao:
    "A produção está acontecendo conforme o planejado. Avisaremos quando houver material para revisar.",
  editando:
    "O material está em edição. Assim que o primeiro corte estiver pronto, ele aparecerá para aprovação.",
  aguardando_aprovacao: "Há materiais disponíveis na área de aprovações aguardando sua revisão.",
  ajustes: "Recebemos os comentários e estamos trabalhando nos ajustes solicitados.",
  aprovado: "O material foi aprovado e estamos preparando os arquivos finais para entrega.",
  entregue: "Os materiais finais já estão disponíveis na área de entregas.",
};

const REVIEW_STATUS = {
  pending: {
    label: "Com o cliente",
    classes: "border-warning/35 bg-warning/10 text-warning",
    icon: Clock3,
  },
  changes_requested: {
    label: "Ajustes solicitados",
    classes: "border-destructive/35 bg-destructive/10 text-destructive",
    icon: MessageSquareText,
  },
  approved: {
    label: "Aprovado",
    classes: "border-success/35 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  draft: {
    label: "Rascunho",
    classes: "border-border bg-surface-2 text-muted-foreground",
    icon: CircleDot,
  },
  archived: {
    label: "Arquivado",
    classes: "border-border bg-surface-2 text-muted-foreground",
    icon: CircleDot,
  },
} as const;

export function ClientPortalProjectPanel({
  project,
  showAccessBanner = true,
  view = "all",
}: {
  project: Projeto;
  showAccessBanner?: boolean;
  view?: "all" | "status" | "approvals" | "deliveries";
}) {
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [access, setAccess] = useState<ClientPortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingPublic, setSavingPublic] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    thread?: ClientReview;
  }>({ open: false });
  const [editingReview, setEditingReview] = useState<ClientReview | null>(null);
  const [removingReview, setRemovingReview] = useState<ClientReview | null>(null);
  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [publicForm, setPublicForm] = useState({
    visible: project.portalVisible ?? false,
    phase: project.portalPhase ?? "preparacao",
    progress: portalDisplayProgress(project.portalProgress, project.portalPhase),
    update: project.portalUpdate ?? "",
    nextMilestone: project.portalNextMilestone ?? "",
    coverUrl: project.portalCoverUrl ?? "",
  });
  const loadRequest = useRef(0);

  useEffect(() => {
    setPublicForm({
      visible: project.portalVisible ?? false,
      phase: project.portalPhase ?? "preparacao",
      progress: portalDisplayProgress(project.portalProgress, project.portalPhase),
      update: project.portalUpdate ?? "",
      nextMilestone: project.portalNextMilestone ?? "",
      coverUrl: project.portalCoverUrl ?? "",
    });
  }, [project]);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [nextReviews, nextAccess] = await Promise.all([
        listClientReviews(project.id),
        getClientPortalAccess(project.clienteId),
      ]);
      if (requestId === loadRequest.current) {
        setReviews(nextReviews);
        setAccess(nextAccess);
      }
    } catch (error) {
      if (requestId === loadRequest.current) {
        setReviews([]);
        setAccess(null);
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar a área do cliente",
        );
        toast.error("Não foi possível carregar a área do cliente");
      }
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [project.clienteId, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewItems = reviews.filter((item) => item.kind !== "delivery");
  const deliveries = reviews.filter(
    (item) => item.kind === "delivery" && item.status !== "archived",
  );
  const pending = reviewItems.filter((item) => item.status === "pending");
  const changes = reviewItems.filter((item) => item.status === "changes_requested");
  const activeReviews = reviewItems.filter((item) => item.status !== "archived");
  const portalUrl =
    access?.token && typeof window !== "undefined"
      ? `${window.location.origin}/portal/${portalSlug(project.cliente)}`
      : null;

  const savePublic = async () => {
    if (!project.clienteId) {
      toast.error("Vincule este projeto ao cadastro do cliente antes de salvar");
      return;
    }
    setSavingPublic(true);
    try {
      await saveProjectClientPortalState({
        projectId: project.id,
        clientId: project.clienteId,
        visible: publicForm.visible,
        phase: publicForm.phase,
        progress: publicForm.progress,
        update: publicForm.update,
        nextMilestone: publicForm.nextMilestone,
        coverUrl: publicForm.coverUrl,
      });
      toast.success(
        publicForm.visible
          ? "Status publicado no portal do cliente"
          : "Alterações salvas, mas o projeto continua oculto",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a atualização");
    } finally {
      setSavingPublic(false);
    }
  };

  const activatePortal = async () => {
    if (!access || !project.clienteId) return;
    try {
      await configureMakersMembers({
        clientId: project.clienteId,
        enabled: true,
        welcomeMessage: access.welcomeMessage || "",
      });
      toast.success("Makers Members ativado para este cliente");
      await load();
    } catch {
      toast.error("Não foi possível ativar o portal");
    }
  };

  return (
    <div className="space-y-4">
      {!project.clienteId && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-semibold">Vincule este projeto ao cadastro do cliente</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              O portal usa o cliente do CRM para garantir que cada pessoa veja somente seus
              projetos.
            </p>
          </div>
        </div>
      )}

      {showAccessBanner && project.clienteId && !access && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-xs font-semibold">Finalize a atualização do Makers Members</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Execute novamente a migração SQL atualizada para gerar o acesso diretamente no
                cliente.
              </p>
            </div>
          </div>
        </div>
      )}

      {showAccessBanner && access && !access.enabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
          <div>
            <p className="text-xs font-semibold">Makers Members pronto para ser ativado</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              O link já está vinculado ao cliente, mas o acesso público está desligado.
            </p>
          </div>
          <Button size="sm" onClick={activatePortal}>
            Ativar portal
          </Button>
        </div>
      )}

      {(view === "all" || view === "status") && (
        <section className="overflow-hidden rounded-xl border border-border bg-surface-1/35">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Eye className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    1
                  </span>
                  <h3 className="text-sm font-semibold">Status do projeto no portal</h3>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Mostre apenas uma visão simples do andamento, sem expor o fluxo interno.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider",
                  publicForm.visible
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border text-muted-foreground",
                )}
              >
                {publicForm.visible ? "Publicado" : "Oculto"}
              </span>
              <Switch
                checked={publicForm.visible}
                onCheckedChange={(visible) => setPublicForm((current) => ({ ...current, visible }))}
              />
            </div>
          </header>

          <div className="grid gap-4 p-4 lg:grid-cols-[.72fr_1.28fr]">
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Etapa pública
                </span>
                <Select
                  value={publicForm.phase}
                  onValueChange={(phase) =>
                    setPublicForm((current) => ({
                      ...current,
                      phase,
                      update: current.update || PHASE_MESSAGES[phase] || "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLIC_PHASES.map((phase) => (
                      <SelectItem key={phase.value} value={phase.value}>
                        {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-2">
                <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Progresso público
                  <strong className="text-sm text-primary">{publicForm.progress}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={publicForm.progress}
                  onChange={(event) =>
                    setPublicForm((current) => ({
                      ...current,
                      progress: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-primary"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Próximo marco
                </span>
                <Input
                  value={publicForm.nextMilestone}
                  onChange={(event) =>
                    setPublicForm((current) => ({
                      ...current,
                      nextMilestone: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Primeiro corte em 24 de julho"
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Resumo para o cliente
                  <span className="normal-case tracking-normal text-muted-foreground/70">
                    opcional
                  </span>
                </span>
                <span className="block text-[10px] leading-4 text-muted-foreground">
                  Uma frase curta que aparece na visão geral. Use a sugestão abaixo ou deixe vazio.
                </span>
                <Textarea
                  rows={4}
                  value={publicForm.update}
                  onChange={(event) =>
                    setPublicForm((current) => ({ ...current, update: event.target.value }))
                  }
                  placeholder={PHASE_MESSAGES[publicForm.phase]}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setPublicForm((current) => ({
                    ...current,
                    update: PHASE_MESSAGES[current.phase] || "",
                  }))
                }
                className="flex w-full items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2.5 text-left text-[10px] leading-4 text-muted-foreground transition hover:border-primary/35"
              >
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong className="block text-foreground">Usar texto sugerido</strong>“
                  {PHASE_MESSAGES[publicForm.phase]}”
                </span>
              </button>
              <details className="rounded-lg border border-border/60 bg-background/20">
                <summary className="cursor-pointer px-3 py-2 text-[10px] text-muted-foreground">
                  Imagem de capa do projeto (opcional)
                </summary>
                <div className="border-t border-border/60 p-3">
                  <Input
                    value={publicForm.coverUrl}
                    onChange={(event) =>
                      setPublicForm((current) => ({ ...current, coverUrl: event.target.value }))
                    }
                    placeholder="Cole a URL da imagem personalizada"
                  />
                  <p className="mt-2 text-[9px] leading-4 text-muted-foreground">
                    Se ficar vazio, o portal usará automaticamente a capa cinematográfica padrão.
                  </p>
                  {!publicForm.coverUrl.trim() && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
                      <img
                        src={DEFAULT_PORTAL_COVER_URL}
                        alt="Capa padrão do portal"
                        className="aspect-[2.4/1] w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Settings2 className="size-3.5 text-primary" />
              Só estas informações serão exibidas ao cliente.
            </div>
            <div className="flex gap-2">
              {portalUrl && access?.enabled && (
                <Button variant="outline" size="sm" asChild>
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> Visualizar como cliente
                  </a>
                </Button>
              )}
              <Button size="sm" onClick={savePublic} disabled={savingPublic || !project.clienteId}>
                {savingPublic ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {publicForm.visible ? "Publicar status no portal" : "Salvar como oculto"}
              </Button>
            </div>
          </footer>
        </section>
      )}

      {(view === "all" || view === "approvals") && (
        <section className="rounded-xl border border-border bg-surface-1/35">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-warning text-[9px] font-bold text-black">
                  2
                </span>
                <h3 className="text-sm font-semibold">Enviar para aprovação</h3>
                {pending.length > 0 && (
                  <span className="rounded-full bg-warning px-2 py-0.5 text-[9px] font-bold text-black">
                    {pending.length} aguardando
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Use quando o cliente precisa aprovar ou pedir alterações em um vídeo.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setReviewDialog({ open: true })}
              disabled={!project.clienteId}
            >
              <Plus className="size-3.5" /> Enviar para revisão
            </Button>
          </header>

          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
            <ReviewMetric label="Com o cliente" value={pending.length} tone="text-warning" />
            <ReviewMetric label="Ajustes" value={changes.length} tone="text-destructive" />
            <ReviewMetric label="Em entregas" value={deliveries.length} tone="text-success" />
          </div>

          <div className="p-4">
            {loading ? (
              <div className="grid min-h-40 place-items-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <PortalDataError onRetry={() => void load()} />
            ) : activeReviews.length === 0 ? (
              <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-border/70 text-center">
                <div>
                  <Film className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-3 text-xs font-medium">Nenhum material em revisão</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Quando houver um corte para aprovação, cole aqui o link do Drive.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeReviews.map((review) => (
                  <ReviewRow
                    key={review.id}
                    review={review}
                    onEdit={() => setEditingReview(review)}
                    onNewVersion={() => setReviewDialog({ open: true, thread: review })}
                    onRemove={() => setRemovingReview(review)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(view === "all" || view === "deliveries") && (
        <section className="rounded-xl border border-border bg-surface-1/35">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-success text-[9px] font-bold text-black">
                  3
                </span>
                <h3 className="text-sm font-semibold">Entregas finais</h3>
                {deliveries.length > 0 && (
                  <span className="rounded-full bg-success/12 px-2 py-0.5 text-[9px] font-bold text-success">
                    {deliveries.length} disponível{deliveries.length === 1 ? "" : "is"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Aprovações entram aqui automaticamente. Use “Nova entrega” para liberar um arquivo
                final sem revisão.
              </p>
            </div>
            <Button size="sm" onClick={() => setDeliveryDialog(true)} disabled={!project.clienteId}>
              <PackageCheck className="size-3.5" /> Nova entrega
            </Button>
          </header>

          <div className="p-4">
            {loading ? (
              <div className="grid min-h-28 place-items-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <PortalDataError onRetry={() => void load()} />
            ) : deliveries.length === 0 ? (
              <button
                type="button"
                onClick={() => setDeliveryDialog(true)}
                className="grid min-h-36 w-full place-items-center rounded-xl border border-dashed border-success/25 bg-success/[0.025] text-center transition hover:bg-success/[0.045]"
              >
                <span>
                  <Download className="mx-auto size-5 text-success" />
                  <span className="mt-3 block text-xs font-medium">Nenhuma entrega publicada</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    Cole o link da pasta ou do arquivo final para disponibilizar ao cliente.
                  </span>
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                {deliveries.map((delivery) => (
                  <article
                    key={delivery.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/[0.035] p-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                        <PackageCheck className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{delivery.title}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {delivery.contentCycle || "Material final"}
                          {delivery.message ? ` · ${delivery.message}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-success/12 px-2 py-1 text-[9px] text-success">
                        Disponível
                      </span>
                      {delivery.driveUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={delivery.driveUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3.5" /> Abrir
                          </a>
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemovingReview(delivery)}
                        className="px-2 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <PublishReviewDialog
        open={reviewDialog.open}
        project={project}
        thread={reviewDialog.thread}
        onClose={() => setReviewDialog({ open: false })}
        onPublished={async () => {
          if (!project.clienteId) throw new Error("Projeto sem cliente vinculado");
          await saveProjectClientPortalState({
            projectId: project.id,
            clientId: project.clienteId,
            phase: "aguardando_aprovacao",
            progress: portalDisplayProgress(publicForm.progress, "aguardando_aprovacao"),
          });
          setPublicForm((current) => ({
            ...current,
            visible: true,
            phase: "aguardando_aprovacao",
            progress: portalDisplayProgress(current.progress, "aguardando_aprovacao"),
          }));
          setReviewDialog({ open: false });
          await load();
        }}
      />
      <EditReviewDialog
        review={editingReview}
        onClose={() => setEditingReview(null)}
        onSaved={async () => {
          setEditingReview(null);
          await load();
        }}
      />
      <RemoveReviewDialog
        review={removingReview}
        onClose={() => setRemovingReview(null)}
        onRemoved={async () => {
          setRemovingReview(null);
          await load();
        }}
      />
      <PublishDeliveryDialog
        open={deliveryDialog}
        project={project}
        onClose={() => setDeliveryDialog(false)}
        onPublished={async () => {
          if (!project.clienteId) throw new Error("Projeto sem cliente vinculado");
          await saveProjectClientPortalState({
            projectId: project.id,
            clientId: project.clienteId,
            phase: "entregue",
            update: PHASE_MESSAGES.entregue,
          });
          setPublicForm((current) => ({
            ...current,
            visible: true,
            phase: "entregue",
            update: PHASE_MESSAGES.entregue,
          }));
          setDeliveryDialog(false);
          await load();
        }}
      />
    </div>
  );
}

function ReviewMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="p-3 text-center">
      <p className={cn("font-display text-xl font-semibold tabular-nums", tone)}>{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function PortalDataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="grid min-h-36 place-items-center rounded-xl border border-destructive/25 bg-destructive/[0.035] px-5 text-center"
    >
      <div>
        <AlertTriangle className="mx-auto size-5 text-destructive" />
        <p className="mt-3 text-xs font-medium">Não foi possível carregar estes dados</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline"
        >
          <RefreshCcw className="size-3" />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function ReviewRow({
  review,
  onEdit,
  onNewVersion,
  onRemove,
}: {
  review: ClientReview;
  onEdit: () => void;
  onNewVersion: () => void;
  onRemove: () => void;
}) {
  const status = REVIEW_STATUS[review.status];
  const StatusIcon = status.icon;
  return (
    <article className="rounded-xl border border-border/60 bg-card/60 p-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface-2/50 text-primary">
          <Film className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{review.title}</p>
            <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {review.versionLabel}
            </span>
            {review.contentCycle && (
              <span className="text-[9px] text-muted-foreground">{review.contentCycle}</span>
            )}
          </div>
          {review.message && (
            <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{review.message}</p>
          )}
          {review.clientFeedback && <ClientFeedbackPanel feedback={review.clientFeedback} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px]",
              status.classes,
            )}
          >
            <StatusIcon className="size-3" /> {status.label}
          </span>
          {review.driveUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={review.driveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" /> Drive
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </Button>
          {(review.status === "changes_requested" || review.status === "approved") && (
            <Button variant="outline" size="sm" onClick={onNewVersion}>
              <RefreshCcw className="size-3.5" /> Nova versão
            </Button>
          )}
          {review.status === "pending" && (
            <button
              onClick={onRemove}
              className="px-2 text-[10px] text-muted-foreground hover:text-destructive"
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ClientFeedbackPanel({ feedback }: { feedback: string }) {
  const points = parseClientAdjustmentFeedback(feedback);

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-warning/20 bg-warning/[0.035]">
      <div className="flex items-center justify-between gap-3 border-b border-warning/15 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
            <MessageSquareText className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-foreground">Ajustes do cliente</p>
            <p className="text-[8px] uppercase tracking-[.12em] text-muted-foreground">
              Retorno recebido para esta versão
            </p>
          </div>
        </div>
        {points && (
          <span className="shrink-0 rounded-full border border-warning/15 bg-warning/[0.06] px-2 py-1 text-[8px] font-medium uppercase tracking-[.1em] text-warning">
            {points.length} {points.length === 1 ? "ponto" : "pontos"}
          </span>
        )}
      </div>

      {points ? (
        <ol className="divide-y divide-border/50">
          {points.map((point, index) => (
            <li
              key={`${point.time || "geral"}-${index}`}
              className="grid gap-2 px-3 py-3 sm:grid-cols-[28px_70px_minmax(0,1fr)] sm:items-start"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-[9px] font-semibold tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "inline-flex h-7 w-fit items-center gap-1 rounded-lg border px-2 text-[9px] font-medium tabular-nums",
                  point.time
                    ? "border-warning/20 bg-warning/[0.06] text-warning"
                    : "border-border/70 bg-surface-2/50 text-muted-foreground",
                )}
              >
                {point.time ? <Clock3 className="size-3" /> : null}
                {point.time || "Geral"}
              </span>
              <p className="min-w-0 text-xs leading-5 text-foreground/85">{point.change}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="whitespace-pre-wrap px-3 py-3 text-xs leading-5 text-foreground/80">
          {feedback}
        </p>
      )}
    </section>
  );
}

function RemoveReviewDialog({
  review,
  onClose,
  onRemoved,
}: {
  review: ClientReview | null;
  onClose: () => void;
  onRemoved: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (!review) return;
    setRemoving(true);
    try {
      await removeClientReview(review.id);
      await onRemoved();
      toast.success(
        review.kind === "delivery" ? "Entrega removida do portal" : "Material removido do portal",
      );
    } catch {
      toast.error("Não foi possível remover este material");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => !open && !removing && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Remover publicação?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">{review?.title}</strong> deixará de aparecer
            imediatamente para o cliente.
          </p>
          <p className="rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-xs">
            Esta ação remove a publicação e não pode ser desfeita. Para corrigir apenas o título, a
            competência ou a mensagem, use <strong className="text-foreground">Editar</strong>.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={removing}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remove} disabled={removing}>
            {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Remover publicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditReviewDialog({
  review,
  onClose,
  onSaved,
}: {
  review: ClientReview | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [cycle, setCycle] = useState("");
  const [version, setVersion] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!review) return;
    setTitle(review.title);
    setCycle(review.contentCycle ?? "");
    setVersion(review.versionLabel);
    setDueAt(review.dueAt ?? "");
    setMessage(review.message ?? "");
  }, [review]);

  const save = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await updateClientReviewMetadata({
        id: review.id,
        title,
        contentCycle: cycle,
        versionLabel: version,
        message,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      await onSaved();
      toast.success("Material atualizado no portal");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o material");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Editar material publicado</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[10px] leading-4 text-muted-foreground">
          Edite as informações exibidas ao cliente sem perder o link, a decisão ou o histórico da
          aprovação.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Título do material
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Reel 03 — Campanha de julho"
              autoFocus
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ciclo ou competência
            </span>
            <Input
              value={cycle}
              onChange={(event) => setCycle(event.target.value)}
              placeholder="Ex.: Julho de 2026"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Versão
            </span>
            <Input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="V1"
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Aprovar até
            </span>
            <DateTimePicker value={dueAt} onChange={setDueAt} placeholder="Escolher prazo" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mensagem para o cliente
            </span>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Contexto ou orientação para a revisão."
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !title.trim() || !cycle.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishReviewDialog({
  open,
  project,
  thread,
  onClose,
  onPublished,
}: {
  open: boolean;
  project: Projeto;
  thread?: ClientReview;
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [cycle, setCycle] = useState("");
  const [version, setVersion] = useState("V1");
  const [driveUrl, setDriveUrl] = useState("");
  const [message, setMessage] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [sharingConfirmed, setSharingConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const embedUrl = useMemo(() => getReviewEmbedUrl(driveUrl), [driveUrl]);

  useEffect(() => {
    if (!open) return;
    setTitle(thread?.title ?? "");
    setCycle(thread?.contentCycle ?? "");
    setVersion(thread ? `V${thread.versionNumber + 1}` : "V1");
    setDriveUrl("");
    setMessage("");
    setDueAt("");
    setSharingConfirmed(false);
  }, [open, thread]);

  const publish = async () => {
    if (!title.trim() || !driveUrl.trim()) {
      toast.error("Informe o título e o link do Drive");
      return;
    }
    if (!cycle.trim()) {
      toast.error("Informe o ciclo ou a competência do material");
      return;
    }
    if (!sharingConfirmed) {
      toast.error("Confirme que o link está liberado para qualquer pessoa com o link");
      return;
    }
    setSaving(true);
    try {
      const published = await publishClientReview({
        projectId: project.id,
        title,
        contentCycle: cycle,
        versionLabel: version,
        driveUrl,
        message,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        threadId: thread?.threadId,
      });
      try {
        await onPublished();
      } catch (publishStateError) {
        await removeClientReview(published.id);
        throw publishStateError;
      }
      toast.success("Material publicado no portal do cliente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível publicar o material no portal.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {thread ? "Enviar nova versão" : "Enviar para revisão"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Link do vídeo no Google Drive
            </span>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={driveUrl}
                onChange={(event) => setDriveUrl(event.target.value)}
                className="pl-9"
                placeholder="https://drive.google.com/file/d/..."
                autoFocus
              />
            </div>
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-3">
              <input
                type="checkbox"
                checked={sharingConfirmed}
                onChange={(event) => setSharingConfirmed(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-[10px] leading-4 text-muted-foreground">
                <strong className="block text-warning">Confirme o acesso antes de publicar</strong>
                No Google Drive, selecione “Qualquer pessoa com o link — Leitor”. Sem isso, o
                cliente verá o player bloqueado.
              </span>
            </label>
          </label>

          {driveUrl && (
            <div className="overflow-hidden rounded-xl border border-border bg-black md:col-span-2">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="Prévia do vídeo"
                  className="aspect-video w-full"
                  allow="autoplay; fullscreen"
                />
              ) : (
                <div className="grid aspect-video place-items-center text-center">
                  <div>
                    <Film className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-2 text-xs">O player não pôde ser incorporado.</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      O cliente ainda poderá abrir o link externamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Material
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Reel 03 — Campanha de julho"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ciclo ou competência <span className="text-destructive">*</span>
            </span>
            <Input
              value={cycle}
              onChange={(event) => setCycle(event.target.value)}
              placeholder="Ex.: Julho de 2026"
              required
              aria-required="true"
            />
            <span className="block text-[9px] leading-4 text-muted-foreground">
              Usado para organizar aprovações e entregas por período.
            </span>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Versão
            </span>
            <Input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="V1"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Aprovar até
            </span>
            <DateTimePicker value={dueAt} onChange={setDueAt} placeholder="Escolher prazo" />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mensagem para o cliente
            </span>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Explique o que mudou e em que pontos o cliente deve prestar atenção."
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={publish} disabled={saving || !sharingConfirmed}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Publicar para o cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishDeliveryDialog({
  open,
  project,
  onClose,
  onPublished,
}: {
  open: boolean;
  project: Projeto;
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [cycle, setCycle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [message, setMessage] = useState("");
  const [sharingConfirmed, setSharingConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCycle("");
    setDriveUrl("");
    setMessage("");
    setSharingConfirmed(false);
  }, [open]);

  const publish = async () => {
    if (!title.trim() || !driveUrl.trim()) {
      toast.error("Informe o nome da entrega e o link do Drive");
      return;
    }
    if (!cycle.trim()) {
      toast.error("Informe o ciclo ou a competência da entrega");
      return;
    }
    if (!sharingConfirmed) {
      toast.error("Confirme que o link está liberado para qualquer pessoa com o link");
      return;
    }
    setSaving(true);
    try {
      const published = await publishClientDelivery({
        projectId: project.id,
        title,
        contentCycle: cycle,
        driveUrl,
        message,
      });
      try {
        await onPublished();
      } catch (publishStateError) {
        await removeClientReview(published.id);
        throw publishStateError;
      }
      toast.success("Entrega disponibilizada no portal do cliente");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível disponibilizar a entrega no portal.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Entregar material final</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-success/20 bg-success/[0.05] p-3 text-[10px] leading-4 text-muted-foreground">
          <strong className="text-foreground">Esta ação não pede aprovação.</strong> O material
          aparecerá diretamente na área de entregas do cliente para abrir ou baixar.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Link da pasta ou arquivo final
            </span>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={driveUrl}
                onChange={(event) => setDriveUrl(event.target.value)}
                className="pl-9"
                placeholder="https://drive.google.com/..."
                autoFocus
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pode ser uma pasta completa, um ZIP, vídeo master, galeria ou documento.
            </p>
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-3">
              <input
                type="checkbox"
                checked={sharingConfirmed}
                onChange={(event) => setSharingConfirmed(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-[10px] leading-4 text-muted-foreground">
                <strong className="block text-warning">
                  O cliente conseguirá abrir este link?
                </strong>
                Confirme que o arquivo ou a pasta está como “Qualquer pessoa com o link — Leitor”.
              </span>
            </label>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Nome da entrega
            </span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Masters finais — Campanha"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ciclo ou competência <span className="text-destructive">*</span>
            </span>
            <Input
              value={cycle}
              onChange={(event) => setCycle(event.target.value)}
              placeholder="Ex.: Julho de 2026"
              required
              aria-required="true"
            />
            <span className="block text-[9px] leading-4 text-muted-foreground">
              Define onde a entrega ficará arquivada no portal.
            </span>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Observação opcional
            </span>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Ex.: Arquivos em 4K, versões verticais e legendadas."
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={publish} disabled={saving || !sharingConfirmed}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageCheck className="size-4" />
            )}
            Disponibilizar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
