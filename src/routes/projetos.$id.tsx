import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Archive, ArchiveRestore, Circle } from "lucide-react";
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
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FASES,
  PRIORIDADES,
  TIPOS_ENTREGAVEL,
  TIPO_ENTREGAVEL_ICONS,
  STATUS_ENTREGAVEL,
  getFaseInfo,
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
import { ProjetoModal } from "@/components/projetos/projeto-modal";
import { TarefaModal } from "@/components/projetos/tarefa-modal";
import { MarcoModal } from "@/components/projetos/marco-modal";
import { EntregavelModal } from "@/components/projetos/entregavel-modal";
import { ClientPortalWorkspace } from "@/components/projetos/client-portal-workspace";
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
} from "@/components/ui/dialog";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useComercialSupa } from "@/lib/hooks/useComercial";
import { comercial } from "@/lib/hooks/useComercial";

export const Route = createFileRoute("/projetos/$id")({ component: ProjetoDetalhe });

const CORES_CLIENTE = [
  "#90F826",
  "#66B8FF",
  "#BD8CFF",
  "#F0B34B",
  "#FF737A",
  "#46D6B1",
  "#FF8FD1",
  "#8AA2FF",
];
function corCliente(nome: string) {
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_CLIENTE[hash % CORES_CLIENTE.length];
}
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
  const { projetos, tarefas, marcos, entregaveis } = useProjetos();
  const { empresas: crmClients } = useComercialSupa();
  const directProject = projetos.find((p) => p.id === id);
  const clientRecord =
    crmClients.find((client) => client.id === id) ??
    crmClients.find((client) => client.id === directProject?.clienteId) ??
    crmClients.find((client) => client.nome.toLowerCase() === directProject?.cliente.toLowerCase());
  const clientName = clientRecord?.nome ?? directProject?.cliente;
  const projetosDoCliente = clientName
    ? projetos
        .filter(
          (project) =>
            project.clienteId === clientRecord?.id ||
            project.cliente.toLowerCase() === clientName.toLowerCase(),
        )
        .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
    : [];
  const projeto = directProject ?? projetosDoCliente[0];
  const [novoProjeto, setNovoProjeto] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(false);

  useEffect(() => {
    const pendingClientId = sessionStorage.getItem("makershub:novo-projeto-cliente");
    if (pendingClientId && (pendingClientId === id || pendingClientId === clientRecord?.id)) {
      sessionStorage.removeItem("makershub:novo-projeto-cliente");
      setNovoProjeto(true);
    }
  }, [id, clientRecord?.id]);

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

  const cor = clientRecord?.accentColor ?? corCliente(clientName);

  return (
    <div
      className="space-y-3"
      style={{ "--cliente": cor, "--progress-accent": cor } as React.CSSProperties}
    >
      <Link
        to="/projetos"
        className="sticky top-2 z-30 inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-border/70 bg-background/85 px-3 text-[11px] font-medium text-muted-foreground shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl transition hover:border-primary/35 hover:bg-surface-1 hover:text-primary"
      >
        <span className="grid size-5 place-items-center rounded-md bg-surface-2">
          <ArrowLeft2 size={12} color="currentColor" variant="Linear" />
        </span>
        Voltar para projetos
      </Link>

      {/* Cliente e troca de projetos em uma única faixa compacta */}
      <section
        className="flex flex-wrap items-stretch overflow-hidden rounded-2xl border border-border/70 bg-surface-1/30"
      >
        <div className="flex min-w-[190px] items-center gap-3 border-b border-border/60 px-3 py-2.5 sm:border-b-0 sm:border-r">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--cliente)_16%,transparent)] text-xs font-bold text-[var(--cliente)]">
            {iniciais(clientName)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold">{clientName}</h2>
            <p className="text-[10px] text-muted-foreground">
              {projetosDoCliente.length} projeto{projetosDoCliente.length === 1 ? "" : "s"} cadastrado
              {projetosDoCliente.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-2">
          {projetosDoCliente.map((p) => {
            const resumo = calcularResumoProgresso(p, tarefas);
            return (
              <button
                key={p.id}
                onClick={() => navigate({ to: "/projetos/$id", params: { id: p.id } })}
                className={cn(
                  "relative min-w-[190px] rounded-xl border px-3 py-2 text-left transition",
                  p.id === projeto?.id
                    ? "border-primary/40 bg-primary/[.07]"
                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-surface-2/40 hover:text-foreground",
                  p.arquivado && "opacity-45 hover:opacity-75",
                )}
              >
                {p.id === projeto?.id && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary" />}
                <p className="truncate text-xs font-semibold">{p.nome}</p>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-[9px]">
                  <span>{p.arquivado ? "Fechado" : FASES[p.fase].label}</span>
                  <span className="font-medium tabular-nums">{resumo.percentual}%</span>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setNovoProjeto(true)}
            className="flex min-w-[130px] items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 px-3 text-[10px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <Add size={12} color="currentColor" variant="Linear" /> Novo projeto
          </button>
        </div>
        <div className="flex items-center gap-1.5 border-t border-border/60 p-2 sm:border-l sm:border-t-0">
          <button
            type="button"
            onClick={() => setEditandoCliente(true)}
            className="grid size-9 place-items-center rounded-lg border border-border/60 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            title="Editar cliente"
          >
            <Edit2 size={14} color="currentColor" variant="Linear" />
          </button>
        </div>
      </section>

      {projeto ? (
        <ProjetoConteudo
          projeto={projeto}
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
      <EditarClienteDialog
        open={editandoCliente}
        onClose={() => setEditandoCliente(false)}
        nomeAtual={clientName}
        clientId={clientRecord?.id}
      />
    </div>
  );
}

function EditarClienteDialog({
  open,
  onClose,
  nomeAtual,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  nomeAtual: string;
  clientId?: string;
}) {
  const [nome, setNome] = useState(nomeAtual);
  useEffect(() => {
    if (open) setNome(nomeAtual);
  }, [open, nomeAtual]);
  const salvar = async () => {
    await Promise.all([
      projetosActions.renomearCliente(nomeAtual, nome),
      clientId ? comercial.updateEmpresa(clientId, { nome: nome.trim() }) : Promise.resolve(),
    ]);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Editar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Renomeia este cliente em todos os projetos vinculados a ele.
          </p>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!nome.trim() || nome.trim() === nomeAtual}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function ProjetoConteudo({
  projeto,
  tarefas,
  marcos,
  entregaveis,
}: {
  projeto: Projeto;
  tarefas: Tarefa[];
  marcos: Marco[];
  entregaveis: Entregavel[];
}) {
  const { usuario } = useAuth();
  const podeVerValor = (usuario as any)?.role === "admin";
  const id = projeto.id;
  const [editandoProjeto, setEditandoProjeto] = useState(false);
  const [tarefaModal, setTarefaModal] = useState<{ open: boolean; tarefa?: Tarefa | null; faseInicial?: string }>({
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

  return (
    <div
      className={cn(
        "min-w-0 space-y-3 transition-opacity",
        projeto.arquivado && "opacity-60 hover:opacity-90",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 px-1 py-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
              {projeto.arquivado ? "Projeto fechado" : "Em produção"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Iniciado {formatDistanceToNow(new Date(projeto.dataInicio), { locale: ptBR, addSuffix: true })}
            </span>
          </div>
          <h1 className="mt-2 truncate font-display text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {projeto.cliente}{projeto.descricao ? ` · ${projeto.descricao}` : " · Workspace de produção"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(projetoConcluido || projeto.arquivado) && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const fechar = !projeto.arquivado;
                if (fechar && !confirm(`Fechar o projeto "${projeto.nome}"? As informações continuarão disponíveis.`)) return;
                await projetosActions.atualizarProjeto(projeto.id, { arquivado: fechar });
              }}
            >
              {projeto.arquivado ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              {projeto.arquivado ? "Reabrir" : "Fechar"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditandoProjeto(true)}>
            <Edit2 size={14} color="currentColor" variant="Linear" /> Editar projeto
          </Button>
        </div>
      </header>

      <section className={cn("grid overflow-hidden rounded-xl border border-border/70 bg-surface-1/30", podeVerValor ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
        <div className="col-span-2 border-b border-border/60 p-3 md:col-span-1 md:border-b-0 md:border-r">
          <ResumoProgresso projeto={projeto} tarefas={minhasTarefas} />
        </div>
        {projeto.dataEntrega && (
          <StatCard icon={Calendar} label="Prazo geral" valor={format(new Date(projeto.dataEntrega), "dd MMM yyyy", { locale: ptBR })} />
        )}
        {podeVerValor && <StatCard icon={DollarCircle} label="Valor" valor={`R$ ${projeto.valor.toLocaleString("pt-BR")}`} />}
        <StatCard icon={Profile2User} label="Equipe" valor={`${projeto.equipe.length} pessoa${projeto.equipe.length === 1 ? "" : "s"}`} />
      </section>

      <Tabs defaultValue="tarefas">
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start rounded-none border-b border-border/60 bg-transparent p-0">
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="tarefas">Fluxo de produção ({minhasTarefas.length})</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="entregaveis">Entregáveis ({meusEntregaveis.length})</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="marcos">Marcos ({meusMarcos.length})</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="cliente">Área do cliente</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="info">Informações</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent" value="equipe">Equipe</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tarefas" className="mt-3">
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_270px]">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-1/25 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-sm font-semibold">Fluxo de produção</h2>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Arraste entre etapas ou clique no card para editar.</p>
                </div>
                <Button size="sm" onClick={() => setTarefaModal({ open: true })}>
                  <Add size={15} color="currentColor" variant="Linear" /> Nova tarefa
                </Button>
              </div>
              <div className="overflow-x-auto">
                <KanbanTarefas
                  tarefas={minhasTarefas}
                  projetoId={projeto.id}
                  fases={projeto.fases ?? []}
                  onEditar={(t) => setTarefaModal({ open: true, tarefa: t })}
                  onNovaTarefa={(faseInicial) => setTarefaModal({ open: true, faseInicial })}
                />
              </div>
            </section>
            <PainelOperacional projeto={projeto} tarefas={minhasTarefas} marcos={meusMarcos} />
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
          <ClientPortalWorkspace project={projeto} />
        </TabsContent>

        <TabsContent value="info" className="mt-3">
          <InfoProjeto projeto={projeto} />
        </TabsContent>

        <TabsContent value="equipe" className="mt-3">
          <div className="rounded-xl border border-border bg-surface-1/40 p-4">
            <h3 className="mb-3 font-display text-sm font-semibold">Equipe do projeto</h3>
            <div className="space-y-2">
              {projeto.equipe.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface-2/30 p-3"
                >
                  <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground">
                    {m
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(() => {
                        const n = minhasTarefas.filter(
                          (t) => t.responsavel === m && t.status !== "concluida",
                        ).length;
                        return `${n} tarefa${n === 1 ? "" : "s"} aberta${n === 1 ? "" : "s"}`;
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
        faseInicial={tarefaModal.faseInicial ?? (
          projeto.fase === "pre"
            ? "pre_producao"
            : projeto.fase === "concluido"
              ? "concluida"
              : projeto.fase
        )}
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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  valor,
  extra,
}: {
  icon: typeof IconsaxIcon;
  label: string;
  valor: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 px-3 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon size={12} color="currentColor" variant="Linear" className="text-primary" /> {label}
      </div>
      <p className="mt-1.5 font-display text-sm font-semibold tabular-nums">{valor}</p>
      {extra}
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
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Progresso geral</span>
        <div className="flex items-center gap-2">
          <span
            className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", saude.badge)}
          >
            {r.label}
          </span>
          <span className="font-display text-sm font-semibold tabular-nums">{r.percentual}%</span>
        </div>
      </div>
      <Progress
        value={r.percentual}
        indicatorClassName="client-progress-gradient"
        className="mt-2 h-1.5 bg-white/[.06]"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
        <span>
          {r.concluidas} de {r.total} tarefas concluídas
        </span>
        {r.atrasadas > 0 && (
          <span className="font-medium text-destructive">
            {r.atrasadas} atrasada{r.atrasadas > 1 ? "s" : ""}
          </span>
        )}
        {proxima && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} color="currentColor" variant="Linear" className="text-primary" />
            Próxima: {proxima.titulo} ·{" "}
            {format(new Date(proxima.prazo!), "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}

function PainelOperacional({ projeto, tarefas, marcos }: { projeto: Projeto; tarefas: Tarefa[]; marcos: Marco[] }) {
  const agenda = [
    ...tarefas
      .filter((t) => !t.concluida && t.prazo)
      .map((t) => ({ id: `t-${t.id}`, titulo: t.titulo, data: t.prazo!, detalhe: t.responsavel })),
    ...marcos
      .filter((m) => m.status === "pendente")
      .map((m) => ({ id: `m-${m.id}`, titulo: m.titulo, data: m.data, detalhe: "Marco do projeto" })),
  ]
    .sort((a, b) => +new Date(a.data) - +new Date(b.data))
    .slice(0, 4);
  const links = (projeto.links ?? [])
    .map((link) => ({ ...link, seguro: linkSeguro(link.url) }))
    .filter((link): link is typeof link & { seguro: NonNullable<ReturnType<typeof linkSeguro>> } => Boolean(link.seguro));

  return (
    <aside className="space-y-3">
      <section className="rounded-2xl border border-border/70 bg-surface-1/25 p-4">
        <h3 className="text-sm font-semibold">Próximos passos</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Prazos e marcos que pedem atenção.</p>
        <div className="mt-4">
          {agenda.map((item, index) => (
            <div key={item.id} className="relative pb-4 pl-5 last:pb-0">
              {index < agenda.length - 1 && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-border/70" />}
              <span className={cn("absolute left-0 top-1 size-[11px] rounded-full border-2 border-background", index === 0 ? "bg-primary shadow-[0_0_12px_hsl(var(--primary)/.45)]" : "bg-muted-foreground/40")} />
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {format(new Date(item.data), "dd MMM · HH:mm", { locale: ptBR })}
              </p>
              <p className="mt-1 text-xs font-medium leading-snug">{item.titulo}</p>
              <p className="mt-1 text-[9px] text-muted-foreground">{item.detalhe}</p>
            </div>
          ))}
          {!agenda.length && <p className="rounded-xl border border-dashed border-border/50 px-3 py-6 text-center text-[10px] text-muted-foreground">Nenhum prazo ou marco pendente.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface-1/25 p-4">
        <h3 className="text-sm font-semibold">Acesso rápido</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Links salvos neste projeto.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {links.slice(0, 4).map((link) => (
            <a
              key={link.id}
              href={link.seguro.href}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-16 rounded-xl border border-border/60 bg-surface-2/30 p-2.5 transition hover:border-primary/35 hover:bg-primary/5"
            >
              <Link2 size={13} color="currentColor" variant="Linear" className="text-primary" />
              <p className="mt-2 truncate text-[10px] font-semibold">{link.label}</p>
              <p className="mt-0.5 truncate text-[8px] text-muted-foreground">{link.seguro.dominio}</p>
            </a>
          ))}
        </div>
        {!links.length && <p className="mt-3 rounded-xl border border-dashed border-border/50 px-3 py-4 text-center text-[9px] leading-relaxed text-muted-foreground">Adicione Drive, Frame.io ou briefing em Informações.</p>}
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
  projetoId,
  fases,
  onEditar,
  onNovaTarefa,
}: {
  tarefas: Tarefa[];
  projetoId: string;
  fases: string[];
  onEditar: (t: Tarefa) => void;
  onNovaTarefa: (faseInicial: string) => void;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [novaFase, setNovaFase] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const confirmarNovaFase = (nome: string) => {
    const n = nome.trim();
    if (!n) return;
    projetosActions.adicionarFase(projetoId, n);
    setNovaFase("");
    setAdicionando(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const novaFaseId = String(over.id);
    if (fases.includes(novaFaseId)) {
      projetosActions.atualizarTarefa(String(active.id), { status: novaFaseId });
    }
  };

  const draggingTarefa = draggingId ? tarefas.find((t) => t.id === draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDraggingId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {fases.map((faseId, idx) => {
          const info = getFaseInfo(faseId);
          const items = tarefas.filter((t) => t.status === faseId);
          const isConcluida = faseId === "concluida";
          return (
            <KanbanColuna
              key={faseId}
              faseId={faseId}
              label={info.label}
              isConcluida={isConcluida}
              podeEsquerda={idx > 0}
              podeDireita={idx < fases.length - 1}
              onMover={(dir) => projetosActions.moverFase(projetoId, faseId, dir)}
              onRemover={
                items.length === 0 && !isConcluida
                  ? () => projetosActions.removerFase(projetoId, faseId)
                  : undefined
              }
              count={items.length}
              onNovaTarefa={() => onNovaTarefa(faseId)}
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
        <div className="min-w-[300px] flex-shrink-0">
          {!adicionando ? (
            <button
              onClick={() => setAdicionando(true)}
              className="flex h-full min-h-[80px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/40 text-xs text-muted-foreground/50 transition hover:border-primary/40 hover:text-primary"
            >
              <Add size={14} color="currentColor" variant="Linear" /> Nova coluna
            </button>
          ) : (
            <div className="rounded-xl border border-primary/40 bg-surface-1/40 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nova fase
              </p>
              <div className="flex flex-wrap gap-1">
                {SUGESTOES_FASE.filter((s) => !fases.includes(s.toLowerCase().replace(/\s+/g, "_")))
                  .slice(0, 6)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => confirmarNovaFase(s)}
                      className="rounded-md border border-border/60 bg-surface-2/60 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
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
                  if (e.key === "Enter") confirmarNovaFase(novaFase);
                  if (e.key === "Escape") setAdicionando(false);
                }}
                placeholder="Nome personalizado…"
                className="h-8 w-full rounded-lg border border-border/60 bg-background/40 px-2.5 text-xs outline-none focus:border-primary/50"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => confirmarNovaFase(novaFase)}
                  disabled={!novaFase.trim()}
                  className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => {
                    setAdicionando(false);
                    setNovaFase("");
                  }}
                  className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
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
        "relative min-h-[430px] min-w-[292px] w-[292px] flex-shrink-0 rounded-2xl p-1.5 transition duration-200",
        isOver && "bg-primary/5",
      )}
    >
      {podeDireita && (
        <span
          aria-hidden="true"
          className="absolute -right-[7px] inset-y-1 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent"
        />
      )}
      <div className={cn("mb-3 flex h-11 items-center gap-1 rounded-xl border bg-surface-1/70 px-2.5 shadow-sm", isConcluida ? "border-muted-foreground/20" : "border-border/70", isOver && "border-primary/60")}>
        <button
          onClick={() => onMover(-1)}
          disabled={!podeEsquerda}
          className="rounded p-0.5 text-muted-foreground/40 transition hover:text-muted-foreground disabled:invisible"
        >
          <ArrowLeft2 size={12} color="currentColor" variant="Linear" />
        </button>
        <h3
          className={cn(
            "flex-1 truncate text-xs font-semibold uppercase tracking-[.12em]",
            isConcluida ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
        >
          {label}
        </h3>
        {count > 0 && (
          <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
        <button
          onClick={() => onMover(1)}
          disabled={!podeDireita}
          className="rounded p-0.5 text-muted-foreground/40 transition hover:text-muted-foreground disabled:invisible"
        >
          <ArrowRight2 size={12} color="currentColor" variant="Linear" />
        </button>
        {onRemover && (
          <button
            onClick={onRemover}
            className="rounded p-0.5 text-muted-foreground/30 transition hover:text-destructive"
            title="Remover coluna"
          >
            <CloseCircle size={12} color="currentColor" variant="Linear" />
          </button>
        )}
      </div>
      <div className="min-h-[360px] space-y-3 px-0.5">
        {count === 0 && (
          <p className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border/30 px-4 text-center text-[10px] text-muted-foreground/40">
            Arraste uma tarefa para esta etapa
          </p>
        )}
        {children}
        <button
          type="button"
          onClick={onNovaTarefa}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-transparent text-[11px] font-medium text-muted-foreground/60 transition hover:border-primary/25 hover:bg-primary/5 hover:text-primary"
        >
          <Add size={13} color="currentColor" variant="Linear" /> Nova tarefa
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
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: tarefa.id });
  const prio = PRIORIDADES[tarefa.prioridade];
  const lk = linkSeguro(tarefa.link);
  const prazo = tarefa.prazo ? new Date(tarefa.prazo) : null;
  const atrasada = Boolean(prazo && !tarefa.concluida && prazo.getTime() < Date.now());
  const prazoLabel = prazo
    ? isSameDay(prazo, new Date())
      ? `Hoje · ${format(prazo, "HH:mm")}`
      : format(prazo, "dd MMM", { locale: ptBR })
    : null;
  const prioridadeVisual = {
    baixa: { acento: "bg-muted-foreground/50", badge: "border-border/70 bg-surface-2 text-muted-foreground" },
    media: { acento: "bg-info", badge: "border-info/25 bg-info/10 text-info" },
    alta: { acento: "bg-amber-400", badge: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
    urgente: { acento: "bg-destructive", badge: "border-destructive/25 bg-destructive/10 text-destructive" },
  }[tarefa.prioridade];
  const style =
    transform && !overlay
      ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
      : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative min-h-[150px] overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-surface-2/40 p-4 pl-[18px] shadow-[0_12px_34px_-25px_rgba(0,0,0,.95)] transition duration-200",
        isDragging && !overlay && "opacity-40",
        overlay && "shadow-xl rotate-1 scale-105",
        tarefa.concluida && "opacity-65",
        !isDragging && "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_-24px_hsl(var(--primary)/.3)]",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", prioridadeVisual.acento)} />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em]", prioridadeVisual.badge)}>
          {prio.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              projetosActions.atualizarTarefa(tarefa.id, { concluida: !tarefa.concluida });
            }}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
            title={tarefa.concluida ? "Marcar como pendente" : "Marcar como concluída"}
          >
            {tarefa.concluida ? <TickCircle size={17} color="currentColor" variant="Bulk" className="text-success" /> : <Circle className="size-[17px]" />}
          </button>
          <button
            {...listeners}
            {...attributes}
            className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-muted-foreground active:cursor-grabbing"
            title="Arrastar para outra fase"
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="4" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="5" cy="12" r="1.2" />
              <circle cx="11" cy="4" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="11" cy="12" r="1.2" />
            </svg>
          </button>
        </div>
      </div>

      <button onClick={onEditar} className="mt-3 block w-full text-left">
          <p
            className={cn(
              "text-[13px] font-semibold leading-snug tracking-[-.01em]",
              tarefa.concluida && "text-muted-foreground line-through",
            )}
          >
            {tarefa.titulo}
          </p>
          {tarefa.descricao && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-[1.55] text-muted-foreground">
              {tarefa.descricao}
            </p>
          )}
      </button>

      <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-[8px] font-bold text-primary ring-1 ring-primary/20">
          {iniciais(tarefa.responsavel)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-muted-foreground">{tarefa.responsavel}</span>
        {prazoLabel && (
          <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium tabular-nums", atrasada ? "text-destructive" : "text-muted-foreground")}>
            <Calendar size={11} color="currentColor" variant="Linear" /> {prazoLabel}
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
          className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md border border-border/40 bg-surface-2/40 px-1.5 py-0.5 text-[9px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          title={lk.href}
        >
          <Link2 size={10} color="currentColor" variant="Linear" className="shrink-0" />
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
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(m.data), "EEEE, dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {m.status !== "concluido" && passou && (
              <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
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
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
  const tipo = TIPOS_ENTREGAVEL[entregavel.tipo];
  const TipoIcon = TIPO_ENTREGAVEL_ICONS[entregavel.tipo];
  const status = STATUS_ENTREGAVEL[entregavel.status];
  return (
    <div className="group rounded-lg border border-border/60 bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-start gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/40 bg-surface-2/40 text-primary">
          <TipoIcon className="size-4" />
        </div>
        <button onClick={onEditar} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{entregavel.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">{tipo.label}</span>
            <span className={cn("rounded-md border px-1.5 py-0.5 font-medium", status.classe)}>
              {status.label}
            </span>
          </div>
          {entregavel.notas && (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
              {entregavel.notas}
            </p>
          )}
        </button>
        {entregavel.link && (
          <a
            href={entregavel.link}
            target="_blank"
            rel="noreferrer"
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
      <section className="rounded-xl border border-border bg-surface-1/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold">
            <Link2 size={14} color="currentColor" variant="Linear" className="text-primary" /> Links
            do projeto
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {projeto.links?.length ?? 0} link(s)
          </span>
        </div>
        <div className="space-y-1.5">
          {(projeto.links ?? []).length === 0 && (
            <p className="rounded-md border border-dashed border-border/40 p-3 text-center text-[11px] text-muted-foreground">
              Nenhum link ainda. Adicione a pasta raiz no Drive, o brief, o moodboard…
            </p>
          )}
          {(projeto.links ?? []).map((l) => (
            <div
              key={l.id}
              className="group flex items-center gap-2 rounded-lg border border-border/40 bg-surface-2/30 p-2"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-xs hover:text-primary"
              >
                <Export
                  size={12}
                  color="currentColor"
                  variant="Linear"
                  className="shrink-0 text-primary"
                />
                <span className="truncate font-medium">{l.label}</span>
                <span className="hidden truncate text-[10px] text-muted-foreground md:inline">
                  {l.url}
                </span>
              </a>
              <button
                onClick={() => projetosActions.removerLink(projeto.id, l.id)}
                className="opacity-0 transition group-hover:opacity-100"
                title="Remover"
              >
                <Trash
                  size={14}
                  color="currentColor"
                  variant="Linear"
                  className="text-muted-foreground hover:text-destructive"
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_2fr_auto] gap-1.5">
          <Input
            value={novoLabel}
            onChange={(e) => setNovoLabel(e.target.value)}
            placeholder="Rótulo"
            className="h-8 text-xs"
          />
          <Input
            value={novoUrl}
            onChange={(e) => setNovoUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addLink}
            disabled={!novoLabel.trim() || !novoUrl.trim()}
          >
            <Add size={14} color="currentColor" variant="Linear" />
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-1/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold">
            <DocumentText1
              size={14}
              color="currentColor"
              variant="Linear"
              className="text-primary"
            />{" "}
            Anotações
          </h3>
          {dirty && (
            <Button size="sm" variant="outline" onClick={salvarNotas}>
              <DocumentDownload size={14} color="currentColor" variant="Linear" /> Salvar
            </Button>
          )}
        </div>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={salvarNotas}
          rows={10}
          placeholder="Briefing detalhado, preferências do cliente, decisões importantes, contatos, observações de produção…"
          className="text-xs"
        />
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Salva automaticamente ao sair do campo.
        </p>
      </section>
    </div>
  );
}
