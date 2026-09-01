import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Add,
  ArrowLeft2,
  ArrowRight2,
  Buildings2,
  Calendar,
  Clock,
  Danger,
  Element3,
  FolderOpen,
  Notification,
  Profile2User,
  SearchNormal,
  TaskSquare,
  TickCircle,
} from "iconsax-react";
import type { Icon as IconsaxIcon } from "iconsax-react";
import { Archive, ArchiveRestore, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClienteModal } from "@/components/projetos/cliente-modal";
import { CentralAtencao } from "@/components/projetos/central-atencao";
import {
  ProjetosErrorState,
  ProjetosLoadingState,
} from "@/components/projetos/projetos-error-state";
import {
  faseParaId,
  getFaseInfo,
  isProjetoAtivo,
  normalizarChaveFase,
  type Projeto,
  type Tarefa,
} from "@/lib/mock/projetos";
import { projetosActions, useProjetos } from "@/lib/hooks/useProjetos";
import { comercial, useComercialSupa, type Empresa } from "@/lib/hooks/useComercial";
import { calcularResumoProgresso } from "@/lib/projetos/progresso";
import {
  chaveAtualPipeline,
  colunasPipeline,
  statusAtualPipeline,
  tokenFaseNoFluxo,
} from "@/lib/projetos/pipeline";
import {
  agruparProjetosPorCliente,
  findProjectClient,
  normalizeClientName,
} from "@/lib/projetos/cliente";
import { consumeCreate } from "@/lib/pendingCreate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/projetos/")({ component: ProjetosPage });

type Visao = "pipeline" | "semana" | "lista";
const overviewTabClassName =
  "h-11 rounded-none border-b-2 border-transparent bg-transparent px-3 text-sm font-semibold text-muted-foreground shadow-none transition-[color,border-color] data-[state=active]:border-[var(--primary-ui)] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";
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

function corPrioridade(prioridade: Tarefa["prioridade"]) {
  return (
    {
      baixa: "oklch(0.68 0.025 250)",
      media: "var(--sem-info)",
      alta: "var(--sem-warn)",
      urgente: "var(--sem-danger)",
    }[prioridade] ?? "var(--sem-info)"
  );
}

const normalizarNome = normalizeClientName;
const mesmoMembro = (a: string, b: string) => normalizarNome(a) === normalizarNome(b);
const resolverNomeFaseNoFluxo = (fases: string[] | undefined, fase: string) => {
  const id = faseParaId(fase);
  const token = fases?.find((item) => faseParaId(item) === id);
  return getFaseInfo(token ?? fase).label;
};

function ProjetosPage() {
  const { projetos, tarefas, marcos, entregaveis, loading, error, retry } = useProjetos();
  const {
    empresas: crmClients,
    loading: crmLoading,
    error: crmError,
    retry: retryCrm,
  } = useComercialSupa();
  const projectClients = crmClients;
  const navigate = useNavigate();
  const [visao, setVisao] = useState<Visao>("semana");
  const [cliente, setCliente] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [ordemClientes, setOrdemClientes] = useState<string[]>([]);
  const [clienteArrastado, setClienteArrastado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [clientModal, setClientModal] = useState(false);
  const [centralAberta, setCentralAberta] = useState(false);
  const [mostrarFechados, setMostrarFechados] = useState(false);
  const [mostrarClientesArquivados, setMostrarClientesArquivados] = useState(false);
  const [clienteParaArquivar, setClienteParaArquivar] = useState<Empresa | null>(null);
  const [projetoSemCadastroParaExcluir, setProjetoSemCadastroParaExcluir] =
    useState<Projeto | null>(null);

  useEffect(() => {
    if (consumeCreate("projeto")) {
      setClientModal(true);
      return;
    }
    const abrir = (e: Event) => {
      if ((e as CustomEvent).detail === "projeto") setClientModal(true);
    };
    window.addEventListener("nervon:criar", abrir);
    return () => window.removeEventListener("nervon:criar", abrir);
  }, []);

  const gruposClientes = useMemo(() => {
    const projetosDaSecao = projetos.filter((project) => {
      const cadastro = findProjectClient(project, projectClients);
      return Boolean(cadastro?.arquivado) === mostrarClientesArquivados;
    });
    return agruparProjetosPorCliente(projetosDaSecao, mostrarFechados);
  }, [projectClients, projetos, mostrarFechados, mostrarClientesArquivados]);
  const clientes = useMemo(() => gruposClientes.map((grupo) => grupo.nome), [gruposClientes]);
  const gruposClientesPorNome = useMemo(
    () => new Map(gruposClientes.map((grupo) => [grupo.chave, grupo])),
    [gruposClientes],
  );
  const clientesOrdenados = useMemo(() => {
    const presentes = new Set(clientes);
    const salvos = ordemClientes.filter((c) => presentes.has(c));
    return [...salvos, ...clientes.filter((c) => !salvos.includes(c))];
  }, [clientes, ordemClientes]);
  const coresClientes = useMemo(
    () =>
      new Map(
        clientes.map((nome) => {
          const clientRecord = projectClients.find(
            (item) => normalizarNome(item.nome) === normalizarNome(nome),
          );
          return [normalizarNome(nome), clientRecord?.accentColor ?? corCliente(nome)] as const;
        }),
      ),
    [clientes, projectClients],
  );
  const clientesArquivadosIds = useMemo(
    () => new Set(crmClients.filter((item) => item.arquivado).map((item) => item.id)),
    [crmClients],
  );
  const clientesArquivadosNomes = useMemo(
    () =>
      new Set(crmClients.filter((item) => item.arquivado).map((item) => normalizarNome(item.nome))),
    [crmClients],
  );
  const projetosOperacionais = useMemo(
    () =>
      projetos.filter((project) =>
        project.clienteId
          ? !clientesArquivadosIds.has(project.clienteId)
          : !clientesArquivadosNomes.has(normalizarNome(project.cliente)),
      ),
    [clientesArquivadosIds, clientesArquivadosNomes, projetos],
  );
  const equipe = useMemo(
    () =>
      [
        ...new Set([
          ...projetos.flatMap((p) => p.equipe),
          ...tarefas.map((t) => t.responsavel).filter(Boolean),
        ]),
      ].sort(),
    [projetos, tarefas],
  );
  const filtrados = useMemo(
    () =>
      projetosOperacionais.filter((p) => {
        if (mostrarFechados ? !p.arquivado : p.arquivado) return false;
        if (cliente !== "todos" && p.cliente !== cliente) return false;
        if (responsavel !== "todos") {
          const participaDoProjeto = p.equipe.some((m) => mesmoMembro(m, responsavel));
          const possuiTarefa = tarefas.some(
            (t) => t.projetoId === p.id && mesmoMembro(t.responsavel, responsavel),
          );
          if (!participaDoProjeto && !possuiTarefa) return false;
        }
        const q = busca.trim().toLowerCase();
        return !q || p.nome.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q);
      }),
    [projetosOperacionais, tarefas, cliente, responsavel, busca, mostrarFechados],
  );
  const tarefasVisiveis = useMemo(
    () =>
      responsavel === "todos"
        ? tarefas
        : tarefas.filter((t) => mesmoMembro(t.responsavel, responsavel)),
    [tarefas, responsavel],
  );

  const ativos = projetosOperacionais.filter(isProjetoAtivo);
  const fechados = projetos.filter((p) => p.arquivado);
  const projetosOperacionaisIds = new Set(projetosOperacionais.map((project) => project.id));
  const atrasadas = tarefas.filter(
    (t) =>
      projetosOperacionaisIds.has(t.projetoId) &&
      !t.concluida &&
      t.prazo &&
      new Date(t.prazo) < new Date(),
  ).length;
  const emAprovacao = projetosOperacionais.filter((projeto) =>
    tarefas.some((tarefa) => {
      if (tarefa.projetoId !== projeto.id || tarefa.concluida) return false;
      const nome = normalizarChaveFase(resolverNomeFaseNoFluxo(projeto.fases, tarefa.status));
      return nome.includes("revis") || nome.includes("aprov");
    }),
  ).length;
  const semanaInicio = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), semanaOffset);
  const semanaFim = addDays(semanaInicio, 6);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem("makershub:projetos:ordem-clientes") ?? "[]");
      if (Array.isArray(salvo)) setOrdemClientes(salvo.filter((c) => typeof c === "string"));
    } catch {
      /* preferência visual inválida: usa a ordem alfabética */
    }
  }, []);

  const moverCliente = (origem: string, destino: string) => {
    if (origem === destino) return;
    const atual = [...clientesOrdenados];
    const from = atual.indexOf(origem);
    const to = atual.indexOf(destino);
    if (from < 0 || to < 0) return;
    atual.splice(from, 1);
    atual.splice(to, 0, origem);
    setOrdemClientes(atual);
    localStorage.setItem("makershub:projetos:ordem-clientes", JSON.stringify(atual));
  };
  const limparFiltros = () => {
    setCliente("todos");
    setResponsavel("todos");
    setBusca("");
    setMostrarFechados(false);
  };
  const temFiltrosAtivos =
    cliente !== "todos" || responsavel !== "todos" || busca.trim().length > 0 || mostrarFechados;

  if (loading || crmLoading) {
    return (
      <div className="px-4 py-4 md:px-8 md:py-5">
        <ProjetosLoadingState />
      </div>
    );
  }

  if (error || crmError) {
    return (
      <div className="px-4 py-4 md:px-8 md:py-5">
        <ProjetosErrorState
          message={error || crmError}
          onRetry={async () => {
            await Promise.all([retry(), retryCrm()]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="project-kanban-ambient space-y-5 px-4 py-5 md:px-8 md:py-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="kb-nav-icon grid size-12 shrink-0 place-items-center rounded-2xl">
            <Element3 size={24} color="currentColor" variant="Bulk" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-[-.035em] text-foreground">
              Projetos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Clientes, produções e próximos compromissos em um só lugar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCentralAberta((v) => !v)}
            className={cn(
              "h-11 rounded-xl border-white/[.08] bg-white/[.025] px-4 font-semibold",
              centralAberta && "border-primary/35 bg-primary/[.07] text-primary",
            )}
          >
            <Notification size={18} color="currentColor" variant="Bulk" /> Atenção
            {atrasadas > 0 && (
              <span className="ml-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive ring-1 ring-destructive/20">
                {atrasadas}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setClientModal(true)}
            className="h-11 rounded-xl px-5 font-bold shadow-[0_10px_28px_-16px_var(--primary)]"
          >
            <Add size={18} color="currentColor" variant="Linear" /> Novo cliente
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metrica icon={FolderOpen} label="Produções ativas" valor={ativos.length} />
        <Metrica icon={Danger} label="Tarefas atrasadas" valor={atrasadas} danger={atrasadas > 0} />
        <Metrica icon={TickCircle} label="Em aprovação" valor={emAprovacao} />
        <Metrica
          icon={Calendar}
          label="Entregas próximas"
          valor={marcos.filter((m) => m.status === "pendente").length}
        />
      </section>

      <div className="grid grid-cols-1 gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="order-1 rounded-2xl border border-white/[.07] bg-white/[.018] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="kb-workspace-icon grid size-10 shrink-0 place-items-center rounded-xl">
                  <Buildings2 size={20} color="currentColor" variant="Bulk" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold tracking-[-.02em]">
                    {mostrarFechados ? "Clientes com projetos fechados" : "Clientes ativos"}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {mostrarFechados
                      ? "Consulte produções já encerradas."
                      : "Abra um cliente para acessar projetos, equipe e entregas."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMostrarClientesArquivados((valor) => !valor)}
                  className="h-10 rounded-xl border-white/[.08] bg-white/[.025] px-3.5 text-sm font-semibold"
                >
                  {mostrarClientesArquivados ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                  {mostrarClientesArquivados
                    ? "Ver ativos"
                    : `Arquivados (${projectClients.filter((item) => item.arquivado).length})`}
                </Button>
                {temFiltrosAtivos && (
                  <button
                    className="h-10 shrink-0 rounded-xl px-3 text-xs font-semibold text-primary transition hover:bg-primary/[.07]"
                    onClick={limparFiltros}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
            <div className="kb-scrollbar flex gap-3 overflow-x-auto px-0.5 pb-2 pt-0.5">
              {clientesOrdenados.map((nome) => {
                const grupo = gruposClientesPorNome.get(normalizarNome(nome));
                const ps = grupo?.projetos ?? [];
                const destino = ps.find(isProjetoAtivo) ?? ps[0];
                if (!destino) return null;
                const clientRecord = findProjectClient(destino, projectClients);
                const pendentes = tarefas.filter(
                  (t) => ps.some((p) => p.id === t.projetoId) && !t.concluida,
                ).length;
                const cor = coresClientes.get(normalizarNome(nome)) ?? corCliente(nome);
                const abrirCliente = () => {
                  navigate({ to: "/projetos/$id", params: { id: destino.id } });
                };
                return (
                  <div
                    key={nome}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (clienteArrastado) moverCliente(clienteArrastado, nome);
                      setClienteArrastado(null);
                    }}
                    style={{ "--cliente": cor } as React.CSSProperties}
                    className={cn(
                      "group relative min-w-[276px] cursor-pointer overflow-hidden rounded-2xl border bg-surface-1/45 p-4 text-left transition-[transform,border-color,background-color,opacity] duration-200 hover:z-10 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--cliente)_48%,transparent)] hover:bg-surface-1/70",
                      cliente === nome
                        ? "border-[var(--cliente)] bg-surface-1/70"
                        : "border-white/[.075]",
                      clienteArrastado === nome && "opacity-45",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-5 h-8 w-0.5 rounded-r-full bg-[var(--cliente)] opacity-75"
                    />
                    <button
                      type="button"
                      onClick={abrirCliente}
                      aria-label={`Abrir workspace de ${nome}`}
                      className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cliente)]"
                    />
                    {clientRecord && (
                      <button
                        type="button"
                        className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg text-muted-foreground/55 transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={
                          clientRecord.arquivado ? `Restaurar ${nome}` : `Arquivar ${nome}`
                        }
                        title={clientRecord.arquivado ? "Restaurar cliente" : "Arquivar cliente"}
                        onClick={async (event) => {
                          event.stopPropagation();
                          if (clientRecord.arquivado) {
                            const restaurado = await comercial.arquivarEmpresa(
                              clientRecord.id,
                              false,
                            );
                            if (restaurado) toast.success(`${nome} foi restaurado`);
                          } else {
                            setClienteParaArquivar(clientRecord);
                          }
                        }}
                      >
                        {clientRecord.arquivado ? (
                          <ArchiveRestore className="size-4" />
                        ) : (
                          <Archive className="size-4" />
                        )}
                      </button>
                    )}
                    {!clientRecord && ps.length === 1 && (
                      <button
                        type="button"
                        className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg text-muted-foreground/55 transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Excluir projeto ${destino.nome}`}
                        title="Excluir projeto sem cadastro"
                        onClick={(event) => {
                          event.stopPropagation();
                          setProjetoSemCadastroParaExcluir(destino);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      draggable
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={() => {
                        setClienteArrastado(nome);
                      }}
                      onDragEnd={() => {
                        setClienteArrastado(null);
                      }}
                      className="absolute right-12 top-3 z-10 grid size-8 cursor-grab place-items-center rounded-lg text-muted-foreground/35 transition hover:bg-surface-2 hover:text-muted-foreground active:cursor-grabbing"
                      aria-label="Arrastar para reordenar"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical size={17} />
                    </button>
                    <div className="pointer-events-none relative z-[1] flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--cliente)_18%,transparent)] bg-[color-mix(in_srgb,var(--cliente)_13%,transparent)] text-sm font-bold text-[var(--cliente)]">
                        {iniciais(nome)}
                      </span>
                      <div className="min-w-0 pr-16">
                        <p className="truncate font-display text-[15px] font-bold tracking-[-.01em]">
                          {nome}
                        </p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">
                          {ps.length} projeto{ps.length === 1 ? "" : "s"}{" "}
                          {mostrarFechados ? "fechado" : "ativo"}
                          {ps.length === 1 ? "" : "s"}
                        </p>
                        {!clientRecord && (
                          <p className="mt-1 text-xs font-semibold text-amber-400">
                            Sem cadastro vinculado
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-none relative z-[1] mt-4 flex items-center justify-between border-t border-white/[.06] pt-3 text-[13px] text-muted-foreground">
                      <span>
                        {pendentes} tarefa{pendentes === 1 ? "" : "s"} aberta
                        {pendentes === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--cliente)]">
                        Abrir <ArrowRight2 size={14} color="currentColor" variant="Linear" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="order-2 overflow-hidden rounded-2xl border border-white/[.075] bg-surface-1/30 shadow-[0_24px_60px_-46px_rgba(0,0,0,.9)]">
            <div className="border-b border-white/[.07] px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-3 pb-3">
                  <span className="kb-workspace-icon grid size-10 shrink-0 place-items-center rounded-xl">
                    <TaskSquare size={20} color="currentColor" variant="Bulk" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-[-.02em]">
                      Planejamento
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Acompanhe o fluxo, a semana ou todos os projetos.
                    </p>
                  </div>
                </div>
                <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)}>
                  <TabsList className="h-11 rounded-none bg-transparent p-0">
                    <TabsTrigger value="pipeline" className={overviewTabClassName}>
                      <Element3 size={16} color="currentColor" variant="Bulk" />
                      Pipeline
                    </TabsTrigger>
                    <TabsTrigger value="semana" className={overviewTabClassName}>
                      <Calendar size={16} color="currentColor" variant="Bulk" />
                      Semana
                    </TabsTrigger>
                    <TabsTrigger value="lista" className={overviewTabClassName}>
                      <TaskSquare size={16} color="currentColor" variant="Bulk" />
                      Lista
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="border-b border-white/[.07] bg-black/[.08] p-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {visao === "semana" && (
                  <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[.075] bg-white/[.025] p-1">
                    <button
                      type="button"
                      aria-label="Semana anterior"
                      onClick={() => setSemanaOffset((v) => v - 1)}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    >
                      <ArrowLeft2 size={15} color="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSemanaOffset(0)}
                      className="min-w-[136px] rounded-lg px-1 text-[13px] font-semibold tabular-nums hover:bg-surface-2"
                    >
                      {format(semanaInicio, "dd MMM", { locale: ptBR })} —{" "}
                      {format(semanaFim, "dd MMM", { locale: ptBR })}
                    </button>
                    <button
                      type="button"
                      aria-label="Próxima semana"
                      onClick={() => setSemanaOffset((v) => v + 1)}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    >
                      <ArrowRight2 size={15} color="currentColor" />
                    </button>
                  </div>
                )}
                <div className="relative min-w-[220px] flex-1">
                  <SearchNormal
                    size={17}
                    color="currentColor"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar projeto ou cliente…"
                    className="h-10 rounded-xl border-white/[.075] bg-white/[.025] pl-10 text-sm"
                  />
                </div>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger className="h-10 w-[170px] rounded-xl border-white/[.075] bg-white/[.025] text-sm">
                    <Profile2User
                      size={16}
                      color="currentColor"
                      variant="Bulk"
                      className="shrink-0 text-muted-foreground"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Toda a equipe</SelectItem>
                    {equipe.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cliente} onValueChange={setCliente}>
                  <SelectTrigger className="h-10 w-[180px] rounded-xl border-white/[.075] bg-white/[.025] text-sm">
                    <Buildings2
                      size={16}
                      color="currentColor"
                      variant="Bulk"
                      className="shrink-0 text-muted-foreground"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os clientes</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFechados((v) => !v);
                    setCliente("todos");
                    setVisao("lista");
                  }}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition",
                    mostrarFechados
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Archive className="size-4" />
                  {mostrarFechados ? "Ver ativos" : "Fechados"}
                  {fechados.length > 0 && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                      {fechados.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {visao === "pipeline" && (
              <Pipeline
                projetos={filtrados}
                tarefas={tarefasVisiveis}
                coresClientes={coresClientes}
                onAbrir={(id) => navigate({ to: "/projetos/$id", params: { id } })}
              />
            )}
            {visao === "semana" && (
              <Semana
                projetos={filtrados}
                tarefas={tarefasVisiveis}
                coresClientes={coresClientes}
                semanaInicio={semanaInicio}
                onAbrir={(id) => navigate({ to: "/projetos/$id", params: { id } })}
              />
            )}
            {visao === "lista" && (
              <Lista
                projetos={filtrados}
                tarefas={tarefasVisiveis}
                coresClientes={coresClientes}
                onAbrir={(id) => navigate({ to: "/projetos/$id", params: { id } })}
              />
            )}
          </section>
        </div>
      </div>
      <Sheet open={centralAberta} onOpenChange={setCentralAberta}>
        <SheetContent
          side="right"
          className="z-[80] !w-[min(400px,calc(100vw-1rem))] !max-w-[400px] border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Central de atenção</SheetTitle>
            <SheetDescription>
              Pendências que exigem decisão ou acompanhamento nos projetos.
            </SheetDescription>
          </SheetHeader>
          <CentralAtencao
            projetos={projetos}
            tarefas={tarefas}
            entregaveis={entregaveis}
            modo="painel"
            onAbrir={(id) => {
              setCentralAberta(false);
              navigate({ to: "/projetos/$id", params: { id } });
            }}
          />
        </SheetContent>
      </Sheet>
      <ClienteModal
        open={clientModal}
        onClose={() => setClientModal(false)}
        onCreated={(client) => {
          setClientModal(false);
          sessionStorage.setItem("makershub:novo-projeto-cliente", client.id);
          navigate({ to: "/projetos/$id", params: { id: client.id } });
        }}
      />
      <ArquivarClienteDialog
        cliente={clienteParaArquivar}
        onClose={() => setClienteParaArquivar(null)}
      />
      <ExcluirProjetoSemCadastroDialog
        projeto={projetoSemCadastroParaExcluir}
        onClose={() => setProjetoSemCadastroParaExcluir(null)}
      />
    </div>
  );
}

function ExcluirProjetoSemCadastroDialog({
  projeto,
  onClose,
}: {
  projeto: Projeto | null;
  onClose: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const fechar = () => {
    if (excluindo) return;
    setConfirmacao("");
    onClose();
  };
  const confirmar = async () => {
    if (!projeto || confirmacao.trim() !== "EXCLUIR") return;
    setExcluindo(true);
    const removido = await projetosActions.removerProjeto(projeto.id);
    setExcluindo(false);
    if (!removido) return;
    toast.success(`${projeto.nome} foi excluído`);
    setConfirmacao("");
    onClose();
  };

  return (
    <Dialog open={Boolean(projeto)} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Excluir projeto sem cadastro</DialogTitle>
          <DialogDescription>
            O projeto <strong className="text-foreground">{projeto?.nome}</strong> ficou
            independente do CRM. A exclusão também remove suas tarefas, marcos e entregáveis.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Digite <strong className="text-foreground">EXCLUIR</strong> para confirmar.
          </span>
          <Input
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="EXCLUIR"
            autoFocus
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmar()}
            disabled={excluindo || confirmacao.trim() !== "EXCLUIR"}
          >
            <Trash2 className="size-4" />
            {excluindo ? "Excluindo…" : "Excluir projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArquivarClienteDialog({
  cliente,
  onClose,
}: {
  cliente: Empresa | null;
  onClose: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [arquivando, setArquivando] = useState(false);
  const fechar = () => {
    if (arquivando) return;
    setConfirmacao("");
    onClose();
  };
  const confirmar = async () => {
    if (!cliente || confirmacao.trim() !== cliente.nome) return;
    setArquivando(true);
    const arquivado = await comercial.arquivarEmpresa(cliente.id, true);
    setArquivando(false);
    if (!arquivado) return;
    toast.success(`${cliente.nome} foi arquivado`);
    fechar();
  };
  return (
    <Dialog open={Boolean(cliente)} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Arquivar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3 text-xs leading-5 text-muted-foreground">
            O cliente sairá das listas ativas. Projetos, tarefas, jornada comercial, contatos,
            contratos, portal e lançamentos financeiros continuarão intactos. Você poderá
            restaurá-lo depois.
          </div>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Digite <strong className="text-foreground">{cliente?.nome}</strong> para confirmar.
            </span>
            <Input
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={cliente?.nome}
              autoFocus
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={arquivando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={arquivando || confirmacao.trim() !== cliente?.nome}>
            <Archive className="size-4" />
            {arquivando ? "Arquivando…" : "Arquivar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metrica({
  icon: Icon,
  label,
  valor,
  danger,
}: {
  icon: IconsaxIcon;
  label: string;
  valor: number;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 shadow-[0_18px_44px_-38px_rgba(0,0,0,.9)] sm:p-5">
      <span
        className={cn(
          "kb-workspace-icon grid size-11 shrink-0 place-items-center rounded-xl",
          danger && "border-destructive/20 bg-destructive/[.07] text-destructive",
        )}
      >
        <Icon size={21} color="currentColor" variant="Bulk" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 font-display text-2xl font-bold tabular-nums tracking-[-.03em]",
            danger && "text-destructive",
          )}
        >
          {valor}
        </p>
      </div>
    </div>
  );
}

function ProjetoCard({
  p,
  tarefas,
  cor,
  onAbrir,
}: {
  p: Projeto;
  tarefas: Tarefa[];
  cor: string;
  onAbrir: () => void;
}) {
  const r = calcularResumoProgresso(p, tarefas);
  return (
    <button
      onClick={onAbrir}
      style={{ "--projeto": cor, "--progress-accent": cor } as React.CSSProperties}
      className={cn(
        "kb-glass-card group relative w-full overflow-hidden rounded-xl p-3.5 text-left transition-[transform,border-color,background-color,opacity] duration-150 hover:-translate-y-px hover:border-[var(--kb-border-strong)]",
        p.arquivado && "opacity-45 hover:opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold leading-snug tracking-[-.015em]">
            {p.nome}
          </p>
          <p className="mt-1.5 flex items-center gap-2 truncate text-[13px] font-medium text-[var(--kb-text-muted)]">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--projeto)]" />
            <span className="truncate">{p.cliente}</span>
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--projeto)]">
          {r.percentual}%
        </span>
      </div>
      <Progress
        value={r.percentual}
        indicatorClassName="bg-[var(--projeto)]"
        className="mt-3.5 h-1 bg-white/[.07]"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[.06] pt-3 text-xs text-[var(--kb-text-muted)]">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          {p.arquivado ? (
            <>
              <Archive className="size-4" />
              Fechado
            </>
          ) : p.dataEntrega ? (
            <>
              <Calendar size={15} color="currentColor" variant="Bulk" />
              {format(new Date(p.dataEntrega), "dd MMM", { locale: ptBR })}
            </>
          ) : (
            <>
              <Clock className="size-[15px]" />
              Sem prazo
            </>
          )}
        </span>
        <span className={cn("shrink-0 font-medium", r.atrasadas > 0 && "text-destructive")}>
          {r.atrasadas
            ? `${r.atrasadas} atrasada${r.atrasadas > 1 ? "s" : ""}`
            : `${r.concluidas}/${r.total} tarefas`}
        </span>
      </div>
    </button>
  );
}

function Pipeline({
  projetos,
  tarefas,
  coresClientes,
  onAbrir,
}: {
  projetos: Projeto[];
  tarefas: Tarefa[];
  coresClientes: ReadonlyMap<string, string>;
  onAbrir: (id: string) => void;
}) {
  const colunas = colunasPipeline(projetos, tarefas);
  return (
    <div className="kb-kanban-stage kb-scrollbar flex min-h-[490px] gap-3 overflow-x-auto p-3">
      {colunas.map((coluna) => {
        const ps = projetos.filter(
          (projeto) => chaveAtualPipeline(projeto, tarefas) === coluna.key,
        );
        return (
          <div
            key={coluna.key}
            className="kb-glass-column relative w-[288px] shrink-0 rounded-2xl p-2.5"
          >
            <div className="mb-1.5 flex h-9 items-center justify-between px-2">
              <div className="flex min-w-0 items-center gap-2 pr-2">
                {coluna.personalizada && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-[var(--primary-ui)]"
                    title="Etapa personalizada"
                  />
                )}
                <h3 className="min-w-0 truncate text-xs font-bold uppercase tracking-[.09em] text-muted-foreground">
                  {getFaseInfo(coluna.token).label}
                </h3>
              </div>
              <span className="shrink-0 px-1 text-xs font-medium tabular-nums text-[var(--kb-text-faint)]">
                {ps.length}
              </span>
            </div>
            <div className="space-y-2">
              {ps.map((p) => (
                <ProjetoCard
                  key={p.id}
                  p={p}
                  tarefas={tarefas}
                  cor={coresClientes.get(normalizarNome(p.cliente)) ?? corCliente(p.cliente)}
                  onAbrir={() => onAbrir(p.id)}
                />
              ))}
              {!ps.length && (
                <p className="grid min-h-24 place-items-center px-5 text-center text-xs leading-relaxed text-[var(--kb-text-faint)]">
                  Nenhuma produção nesta etapa
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Semana({
  projetos,
  tarefas,
  coresClientes,
  semanaInicio,
  onAbrir,
}: {
  projetos: Projeto[];
  tarefas: Tarefa[];
  coresClientes: ReadonlyMap<string, string>;
  semanaInicio: Date;
  onAbrir: (id: string) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i));
  const ids = new Set(projetos.map((p) => p.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const moverSemana = (direcao: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direcao * 360, behavior: "smooth" });
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Navegue horizontalmente para ver todos os dias
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Rolar semana para a esquerda"
            onClick={() => moverSemana(-1)}
            className="grid size-7 place-items-center rounded-md border border-border/60 bg-surface-1/50 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          >
            <ArrowLeft2 size={14} color="currentColor" />
          </button>
          <button
            type="button"
            aria-label="Rolar semana para a direita"
            onClick={() => moverSemana(1)}
            className="grid size-7 place-items-center rounded-md border border-border/60 bg-surface-1/50 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          >
            <ArrowRight2 size={14} color="currentColor" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="kb-scrollbar max-w-full overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
      >
        <div className="grid min-w-[1785px] grid-cols-7 gap-3 p-3">
          {dias.map((d, dayIndex) => {
            const ts = tarefas.filter(
              (t) => ids.has(t.projetoId) && t.prazo && isSameDay(new Date(t.prazo), d),
            );
            return (
              <div key={d.toISOString()} className="relative min-h-[430px] p-1.5">
                {dayIndex < dias.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-[7px] inset-y-1 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent"
                  />
                )}
                <div className="mb-3 flex h-11 items-center justify-between rounded-xl border border-border/70 bg-surface-1/65 px-3 shadow-sm">
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {format(d, "EEE", { locale: ptBR })}
                  </span>
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-md text-sm",
                      isSameDay(d, new Date()) && "bg-primary font-bold text-primary-foreground",
                    )}
                  >
                    {format(d, "dd")}
                  </span>
                </div>
                <div className="space-y-3 px-0.5">
                  {ts.map((t) => {
                    const p = projetos.find((x) => x.id === t.projetoId)!;
                    const cor =
                      coresClientes.get(normalizarNome(p.cliente)) ?? corCliente(p.cliente);
                    const atrasada = !t.concluida && new Date(t.prazo!) < new Date();
                    return (
                      <button
                        key={t.id}
                        onClick={() => onAbrir(p.id)}
                        style={
                          {
                            "--projeto": cor,
                            "--kb-priority": corPrioridade(t.prioridade),
                          } as React.CSSProperties
                        }
                        className={cn(
                          "kb-glass-card group relative w-full overflow-hidden rounded-2xl p-3.5 text-left transition-[transform,border-color,background-color,opacity] duration-150 hover:-translate-y-px hover:border-[var(--projeto)]",
                          t.concluida && "opacity-55",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-[3px] w-7 shrink-0 rounded-full bg-[var(--kb-priority)] opacity-90"
                            />
                            <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {format(new Date(t.prazo!), "HH:mm")}
                            </p>
                          </div>
                          {t.concluida ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.06em] text-success">
                              <TickCircle size={13} color="currentColor" variant="Bulk" />
                              Feita
                            </span>
                          ) : atrasada ? (
                            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.06em] text-destructive">
                              Atrasada
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "mt-2.5 line-clamp-2 font-display text-[15px] font-bold leading-[1.32] tracking-[-.012em]",
                            t.concluida &&
                              "text-muted-foreground line-through decoration-muted-foreground/70",
                          )}
                        >
                          {t.titulo}
                        </p>
                        <div className="mt-2.5 flex min-w-0 items-center gap-2 text-[11px]">
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                            <span className="size-1.5 shrink-0 rounded-full bg-[var(--projeto)]" />
                            <span className="truncate">{p.cliente}</span>
                          </span>
                          <span aria-hidden="true" className="text-white/15">
                            /
                          </span>
                          <span className="min-w-0 truncate font-semibold" style={{ color: cor }}>
                            {resolverNomeFaseNoFluxo(p.fases, t.status)}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[.045] text-[10px] font-bold text-foreground ring-1 ring-white/[.07]">
                            {iniciais(t.responsavel)}
                          </span>
                          <span className="truncate">{t.responsavel}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!ts.length && (
                    <p className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border/30 text-center text-xs text-muted-foreground/50">
                      Sem ações planejadas
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Lista({
  projetos,
  tarefas,
  coresClientes,
  onAbrir,
}: {
  projetos: Projeto[];
  tarefas: Tarefa[];
  coresClientes: ReadonlyMap<string, string>;
  onAbrir: (id: string) => void;
}) {
  if (!projetos.length) {
    return (
      <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
        <div>
          <p className="text-sm font-medium">Nenhum projeto encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste os filtros ou volte para os projetos ativos.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 p-3 sm:p-4">
      {projetos.map((p) => {
        const r = calcularResumoProgresso(p, tarefas);
        const statusAtual = statusAtualPipeline(p, tarefas);
        const faseAtual = statusAtual ? getFaseInfo(tokenFaseNoFluxo(p, statusAtual)).label : null;
        const cor = coresClientes.get(normalizarNome(p.cliente)) ?? corCliente(p.cliente);
        return (
          <button
            key={p.id}
            onClick={() => onAbrir(p.id)}
            style={{ "--projeto": cor } as React.CSSProperties}
            className={cn(
              "group grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl border border-white/[.065] bg-white/[.02] p-3.5 text-left transition-[border-color,background-color,opacity] hover:border-[color-mix(in_srgb,var(--projeto)_38%,transparent)] hover:bg-white/[.035] sm:gap-4 sm:p-4",
              p.arquivado && "opacity-45 hover:opacity-80",
            )}
          >
            <span className="grid size-11 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--projeto)_18%,transparent)] bg-[color-mix(in_srgb,var(--projeto)_12%,transparent)] text-xs font-bold text-[var(--projeto)]">
              {iniciais(p.cliente)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold tracking-[-.01em]">
                {p.nome}
              </p>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">
                  {p.cliente} ·{" "}
                  {p.arquivado ? "Fechado" : `${r.total} tarefa${r.total === 1 ? "" : "s"}`}
                </span>
                {!p.arquivado && faseAtual && (
                  <span className="max-w-full truncate rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-xs font-semibold text-primary">
                    {faseAtual}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground sm:gap-5">
              <div className="hidden min-w-[120px] sm:block">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span>Progresso</span>
                  <strong className="font-bold tabular-nums text-[var(--projeto)]">
                    {r.percentual}%
                  </strong>
                </div>
                <Progress
                  value={r.percentual}
                  indicatorClassName="bg-[var(--projeto)]"
                  className="h-1 bg-white/[.07]"
                />
              </div>
              <span className="hidden min-w-[92px] items-center gap-1.5 lg:inline-flex">
                {p.arquivado ? (
                  <Archive className="size-4" />
                ) : (
                  <Clock size={15} color="currentColor" />
                )}
                {p.arquivado
                  ? "Arquivado"
                  : p.dataEntrega
                    ? format(new Date(p.dataEntrega), "dd MMM")
                    : "Sem prazo"}
              </span>
              <span className="font-bold tabular-nums text-[var(--projeto)] sm:hidden">
                {r.percentual}%
              </span>
              <ArrowRight2
                size={17}
                color="currentColor"
                variant="Linear"
                className="transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--projeto)]"
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
