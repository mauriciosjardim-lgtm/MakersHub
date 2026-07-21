import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Add, ArrowLeft2, ArrowRight2, Calendar, Clock, Notification, SearchNormal, TickCircle } from "iconsax-react";
import { Archive, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ClienteModal } from "@/components/projetos/cliente-modal";
import { CentralAtencao } from "@/components/projetos/central-atencao";
import { NovidadesProjetosV7 } from "@/components/projetos/novidades-projetos-v7";
import { FASES, FASES_PADRAO, getFaseInfo, type FaseProjeto, type Projeto, type Tarefa } from "@/lib/mock/projetos";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useComercialSupa } from "@/lib/hooks/useComercial";
import { calcularResumoProgresso, SAUDE_ESTILO } from "@/lib/projetos/progresso";
import { consumeCreate } from "@/lib/pendingCreate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projetos/")({ component: ProjetosPage });

type Visao = "pipeline" | "semana" | "lista";
const CORES_CLIENTE = ["#90F826", "#66B8FF", "#BD8CFF", "#F0B34B", "#FF737A", "#46D6B1", "#FF8FD1", "#8AA2FF"];

function corCliente(nome: string) {
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_CLIENTE[hash % CORES_CLIENTE.length];
}

function iniciais(nome: string) {
  return nome.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

const normalizarNome = (nome: string) => nome.trim().toLocaleLowerCase("pt-BR");
const mesmoMembro = (a: string, b: string) => normalizarNome(a) === normalizarNome(b);

function ProjetosPage() {
  const { projetos, tarefas, marcos, entregaveis } = useProjetos();
  const { empresas: crmClients } = useComercialSupa();
  const navigate = useNavigate();
  const [visao, setVisao] = useState<Visao>("semana");
  const [cliente, setCliente] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [ordemClientes, setOrdemClientes] = useState<string[]>([]);
  const [clienteArrastado, setClienteArrastado] = useState<string | null>(null);
  const ignorarCliqueAposArraste = useRef(false);
  const [busca, setBusca] = useState("");
  const [clientModal, setClientModal] = useState(false);
  const [centralAberta, setCentralAberta] = useState(false);
  const [mostrarFechados, setMostrarFechados] = useState(false);

  useEffect(() => {
    if (consumeCreate("projeto")) { setClientModal(true); return; }
    const abrir = (e: Event) => {
      if ((e as CustomEvent).detail === "projeto") setClientModal(true);
    };
    window.addEventListener("nervon:criar", abrir);
    return () => window.removeEventListener("nervon:criar", abrir);
  }, []);

  const clientes = useMemo(() => {
    const nomes = new Map<string, string>();

    projetos
      .filter((project) => Boolean(project.arquivado) === mostrarFechados)
      .forEach((project) => {
        const nome = project.cliente.trim();
        if (nome) nomes.set(normalizarNome(nome), nome);
      });

    if (!mostrarFechados) {
      crmClients.forEach((item) => {
        const nome = item.nome.trim();
        if (nome) nomes.set(normalizarNome(nome), nome);
      });
    }

    return [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [crmClients, projetos, mostrarFechados]);
  const clientesOrdenados = useMemo(() => {
    const presentes = new Set(clientes);
    const salvos = ordemClientes.filter(c => presentes.has(c));
    return [...salvos, ...clientes.filter(c => !salvos.includes(c))];
  }, [clientes, ordemClientes]);
  const coresClientes = useMemo(() => new Map(
    clientes.map(nome => {
      const clientRecord = crmClients.find(item => normalizarNome(item.nome) === normalizarNome(nome));
      return [normalizarNome(nome), clientRecord?.accentColor ?? corCliente(nome)] as const;
    }),
  ), [clientes, crmClients]);
  const equipe = useMemo(() => [...new Set([
    ...projetos.flatMap(p => p.equipe),
    ...tarefas.map(t => t.responsavel).filter(Boolean),
  ])].sort(), [projetos, tarefas]);
  const filtrados = useMemo(() => projetos.filter(p => {
    if (mostrarFechados ? !p.arquivado : p.arquivado) return false;
    if (cliente !== "todos" && p.cliente !== cliente) return false;
    if (responsavel !== "todos") {
      const participaDoProjeto = p.equipe.some(m => mesmoMembro(m, responsavel));
      const possuiTarefa = tarefas.some(t => t.projetoId === p.id && mesmoMembro(t.responsavel, responsavel));
      if (!participaDoProjeto && !possuiTarefa) return false;
    }
    const q = busca.trim().toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q);
  }), [projetos, tarefas, cliente, responsavel, busca, mostrarFechados]);
  const tarefasVisiveis = useMemo(() => responsavel === "todos"
    ? tarefas
    : tarefas.filter(t => mesmoMembro(t.responsavel, responsavel)), [tarefas, responsavel]);

  const ativos = projetos.filter(p => !p.arquivado && !["concluido", "pausado"].includes(p.fase));
  const fechados = projetos.filter(p => p.arquivado);
  const atrasadas = tarefas.filter(t => !t.concluida && t.prazo && new Date(t.prazo) < new Date()).length;
  const emAprovacao = projetos.filter(p => p.fase === "revisao").length;
  const semanaInicio = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), semanaOffset);
  const semanaFim = addDays(semanaInicio, 4);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem("makershub:projetos:ordem-clientes") ?? "[]");
      if (Array.isArray(salvo)) setOrdemClientes(salvo.filter(c => typeof c === "string"));
    } catch { /* preferência visual inválida: usa a ordem alfabética */ }
  }, []);

  const moverCliente = (origem: string, destino: string) => {
    if (origem === destino) return;
    const atual = [...clientesOrdenados];
    const from = atual.indexOf(origem); const to = atual.indexOf(destino);
    if (from < 0 || to < 0) return;
    atual.splice(from, 1); atual.splice(to, 0, origem);
    setOrdemClientes(atual);
    localStorage.setItem("makershub:projetos:ordem-clientes", JSON.stringify(atual));
  };
  const limparFiltros = () => {
    setCliente("todos");
    setResponsavel("todos");
    setBusca("");
    setMostrarFechados(false);
  };

  return (
    <div className="space-y-3 px-4 py-4 md:px-8 md:py-5">
      <NovidadesProjetosV7 projetos={projetos} />
      <section className="flex min-w-0 flex-wrap items-stretch overflow-hidden rounded-2xl border border-border/70 bg-surface-1/30 shadow-[0_18px_50px_-38px_rgba(0,0,0,.9)]">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid min-w-[620px] grid-cols-4">
            <Metrica label="Produções ativas" valor={ativos.length} />
            <Metrica label="Tarefas atrasadas" valor={atrasadas} danger={atrasadas > 0} />
            <Metrica label="Em aprovação" valor={emAprovacao} />
            <Metrica label="Entregas próximas" valor={marcos.filter(m => m.status === "pendente").length} />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 border-t border-border/60 p-3 sm:flex-none sm:border-l sm:border-t-0">
          <Button variant="outline" size="sm" onClick={() => setCentralAberta(v => !v)} className={cn(centralAberta && "border-primary/35 text-primary")}><Notification size={15} color="currentColor" /> Atenção{atrasadas > 0 && <span className="ml-1 rounded-full bg-destructive/15 px-1.5 text-[9px] font-bold text-destructive">{atrasadas}</span>}</Button>
          <Button size="sm" onClick={() => setClientModal(true)}><Add size={16} color="currentColor" /> Novo cliente</Button>
        </div>
      </section>

      <div className={cn("grid grid-cols-1 gap-5", centralAberta && "2xl:grid-cols-[minmax(0,1fr)_280px]")}>
        <div className="flex min-w-0 flex-col gap-4">
          <section className="order-1">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">
                  {mostrarFechados ? "Clientes com projetos fechados" : "Clientes ativos"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {mostrarFechados
                    ? "Consulte produções já encerradas."
                    : "Clique para abrir o workspace do cliente."}
                </p>
              </div>
              <button className="shrink-0 text-xs font-medium text-primary" onClick={limparFiltros}>
                Limpar filtros
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto px-0.5 py-1.5">
              {clientesOrdenados.map(nome => {
                const clientRecord = crmClients.find(
                  (item) => item.nome.toLowerCase() === nome.toLowerCase(),
                );
                const ps = projetos.filter(
                  (project) =>
                    !project.arquivado &&
                    (project.clienteId === clientRecord?.id || project.cliente === nome),
                );
                const pendentes = tarefas.filter(t => ps.some(p => p.id === t.projetoId) && !t.concluida).length;
                const cor = coresClientes.get(normalizarNome(nome)) ?? corCliente(nome);
                const destino = ps.find(p => !["concluido", "pausado"].includes(p.fase)) ?? ps[0];
                return <button key={nome} draggable onDragStart={() => { ignorarCliqueAposArraste.current = true; setClienteArrastado(nome); }} onDragOver={e => e.preventDefault()} onDrop={() => { if (clienteArrastado) moverCliente(clienteArrastado, nome); setClienteArrastado(null); }} onDragEnd={() => { setClienteArrastado(null); window.setTimeout(() => { ignorarCliqueAposArraste.current = false; }, 0); }} onClick={() => { if (ignorarCliqueAposArraste.current) return; const workspaceId = clientRecord?.id ?? destino?.id; if (workspaceId) navigate({ to: "/projetos/$id", params: { id: workspaceId } }); }} style={{ "--cliente": cor } as React.CSSProperties} className={cn("group relative min-w-[240px] rounded-xl border bg-surface-1/40 p-4 text-left transition-[transform,border-color,background-color,box-shadow,opacity] duration-200 hover:z-10 hover:scale-[1.015] hover:border-[var(--cliente)] hover:bg-surface-1/65 hover:shadow-[0_12px_30px_-18px_var(--cliente)]", cliente === nome ? "border-[var(--cliente)] bg-surface-1/70" : "border-border", clienteArrastado === nome && "opacity-45") }>
                  <span className="absolute right-2.5 top-2.5 cursor-grab text-muted-foreground/45 transition group-hover:text-muted-foreground active:cursor-grabbing" aria-label="Arrastar para reordenar"><GripVertical size={16} /></span><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--cliente)_16%,transparent)] text-xs font-bold text-[var(--cliente)]">{iniciais(nome)}</span><div className="min-w-0 pr-4"><p className="truncate text-sm font-semibold">{nome}</p><p className="text-[11px] text-muted-foreground">{ps.length} projeto{ps.length === 1 ? "" : "s"} ativo{ps.length === 1 ? "" : "s"}</p></div></div>
                  <div className="mt-3.5 flex justify-between border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground"><span>{pendentes} tarefa{pendentes === 1 ? "" : "s"} aberta{pendentes === 1 ? "" : "s"}</span><span className="text-[var(--cliente)]">Abrir →</span></div>
                </button>;
              })}
            </div>
          </section>

          <section className="order-2 overflow-hidden rounded-2xl border border-border bg-surface-1/25 shadow-[0_18px_50px_-36px_rgba(0,0,0,.8)]">
            <div className="border-b border-border/70 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={visao} onValueChange={v => setVisao(v as Visao)}><TabsList className="h-9"><TabsTrigger value="pipeline" className="text-sm">Pipeline</TabsTrigger><TabsTrigger value="semana" className="text-sm">Semana</TabsTrigger><TabsTrigger value="lista" className="text-sm">Lista</TabsTrigger></TabsList></Tabs>
                {visao === "semana" && <div className="flex h-9 items-center gap-1 rounded-lg border border-border/60 bg-surface-1/35 p-1"><button type="button" aria-label="Semana anterior" onClick={() => setSemanaOffset(v => v - 1)} className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"><ArrowLeft2 size={15} color="currentColor" /></button><button type="button" onClick={() => setSemanaOffset(0)} className="min-w-[120px] rounded-md px-1 text-[11px] font-medium tabular-nums hover:bg-surface-2">{format(semanaInicio, "dd MMM", { locale: ptBR })} — {format(semanaFim, "dd MMM", { locale: ptBR })}</button><button type="button" aria-label="Próxima semana" onClick={() => setSemanaOffset(v => v + 1)} className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"><ArrowRight2 size={15} color="currentColor" /></button></div>}
                <div className="relative min-w-[150px] flex-1"><SearchNormal size={15} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar projeto ou cliente…" className="h-9 border-border/60 bg-background/35 pl-9 text-xs" /></div>
                <Select value={responsavel} onValueChange={setResponsavel}><SelectTrigger className="h-9 w-[135px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Toda a equipe</SelectItem>{equipe.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={cliente} onValueChange={setCliente}><SelectTrigger className="h-9 w-[145px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os clientes</SelectItem>{clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                <button type="button" onClick={() => { setMostrarFechados(v => !v); setCliente("todos"); setVisao("lista"); }} className={cn("inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition", mostrarFechados ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground")}><Archive className="size-3.5" />{mostrarFechados ? "Ver ativos" : "Fechados"}{fechados.length > 0 && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px]">{fechados.length}</span>}</button>
              </div>
            </div>
            {visao === "pipeline" && <Pipeline projetos={filtrados} tarefas={tarefasVisiveis} coresClientes={coresClientes} onAbrir={id => navigate({ to: "/projetos/$id", params: { id } })} />}
            {visao === "semana" && <Semana projetos={filtrados} tarefas={tarefasVisiveis} coresClientes={coresClientes} semanaInicio={semanaInicio} onAbrir={id => navigate({ to: "/projetos/$id", params: { id } })} />}
            {visao === "lista" && <Lista projetos={filtrados} tarefas={tarefasVisiveis} onAbrir={id => navigate({ to: "/projetos/$id", params: { id } })} />}
          </section>
        </div>

        {centralAberta && <CentralAtencao
          projetos={projetos}
          tarefas={tarefas}
          entregaveis={entregaveis}
          onAbrir={id => navigate({ to: "/projetos/$id", params: { id } })}
        />}
      </div>
      <ClienteModal
        open={clientModal}
        onClose={() => setClientModal(false)}
        onCreated={(client) => {
          setClientModal(false);
          sessionStorage.setItem("makershub:novo-projeto-cliente", client.id);
          navigate({ to: "/projetos/$id", params: { id: client.id } });
        }}
      />
    </div>
  );
}

function Metrica({ label, valor, danger }: { label: string; valor: number; danger?: boolean }) { return <div className="border-r border-border/60 px-4 py-3 last:border-r-0"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className={cn("mt-1 font-display text-xl font-semibold tabular-nums", danger && "text-destructive")}>{valor}</p></div>; }

function ProjetoCard({ p, tarefas, cor, onAbrir }: { p: Projeto; tarefas: Tarefa[]; cor: string; onAbrir: () => void }) {
  const r = calcularResumoProgresso(p, tarefas); const saude = SAUDE_ESTILO[r.saude];
  return (
    <button
      onClick={onAbrir}
      style={{ "--projeto": cor, "--progress-accent": cor } as React.CSSProperties}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-surface-2/40 p-4 pl-[18px] text-left shadow-[0_12px_34px_-26px_rgba(0,0,0,.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--projeto)] hover:shadow-[0_18px_40px_-25px_var(--projeto)]",
        p.arquivado && "opacity-45 hover:opacity-80",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--projeto)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-snug">{p.nome}</p>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">{p.cliente}</p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold tabular-nums", saude.badge)}>{r.percentual}%</span>
      </div>
      <Progress
        value={r.percentual}
        indicatorClassName="client-progress-gradient"
        className="mt-4 h-1 bg-white/[.06]"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/45 pt-3 text-[9px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          {p.arquivado ? <><Archive className="size-3" />Fechado</> : p.dataEntrega ? <><Calendar size={11} color="currentColor" />{format(new Date(p.dataEntrega), "dd MMM", { locale: ptBR })}</> : <><Clock size={11} color="currentColor" />Sem prazo</>}
        </span>
        <span className={cn("shrink-0 font-medium", r.atrasadas > 0 && "text-destructive")}>{r.atrasadas ? `${r.atrasadas} atrasada${r.atrasadas > 1 ? "s" : ""}` : `${r.concluidas}/${r.total} tarefas`}</span>
      </div>
    </button>
  );
}

const FASE_PROJETO_POR_COLUNA: Partial<Record<string, FaseProjeto>> = {
  briefing: "briefing",
  pre_producao: "pre",
  captacao: "captacao",
  edicao: "edicao",
  revisao: "revisao",
  entrega: "entrega",
  concluida: "concluido",
};

function colunasPipeline(projetos: Projeto[]) {
  const personalizadas: string[] = [];
  const conhecidas = new Set(FASES_PADRAO);
  projetos.forEach(p => (p.fases ?? FASES_PADRAO).forEach(fase => {
    if (!conhecidas.has(fase) && !personalizadas.includes(fase)) personalizadas.push(fase);
  }));
  return [...FASES_PADRAO.slice(0, -1), ...personalizadas, FASES_PADRAO.at(-1)!];
}

function Pipeline({ projetos, tarefas, coresClientes, onAbrir }: { projetos: Projeto[]; tarefas: Tarefa[]; coresClientes: ReadonlyMap<string, string>; onAbrir: (id: string) => void }) {
  const colunas = colunasPipeline(projetos);
  return (
    <div className="flex min-h-[430px] gap-3 overflow-x-auto p-3">
      {colunas.map((fase, index) => {
        const faseProjeto = FASE_PROJETO_POR_COLUNA[fase];
        const ps = faseProjeto
          ? projetos.filter(p => p.fase === faseProjeto)
          : projetos.filter(p => tarefas.some(t => t.projetoId === p.id && t.status === fase));
        return (
          <div key={fase} className="relative w-[280px] shrink-0 p-1.5">
            {index < colunas.length - 1 && <span aria-hidden="true" className="absolute -right-[7px] inset-y-1 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent" />}
            <div className="mb-3 flex h-11 items-center justify-between rounded-xl border border-border/70 bg-surface-1/65 px-3 shadow-sm">
              <h3 className="truncate text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{getFaseInfo(fase).label}</h3>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[9px] font-semibold tabular-nums text-muted-foreground">{ps.length}</span>
            </div>
            <div className="space-y-3 px-0.5">
              {ps.map(p => <ProjetoCard key={p.id} p={p} tarefas={tarefas} cor={coresClientes.get(normalizarNome(p.cliente)) ?? corCliente(p.cliente)} onAbrir={() => onAbrir(p.id)} />)}
              {!ps.length && <p className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border/30 px-4 text-center text-[10px] text-muted-foreground/40">Nenhuma produção nesta etapa</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Semana({ projetos, tarefas, coresClientes, semanaInicio, onAbrir }: { projetos: Projeto[]; tarefas: Tarefa[]; coresClientes: ReadonlyMap<string, string>; semanaInicio: Date; onAbrir: (id: string) => void }) {
  const dias = Array.from({ length: 5 }, (_, i) => addDays(semanaInicio, i));
  const ids = new Set(projetos.map(p => p.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const moverSemana = (direcao: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direcao * 360, behavior: "smooth" });
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2 xl:hidden">
        <p className="text-[10px] text-muted-foreground">
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
        className="max-w-full overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
      >
        <div className="grid min-w-[1050px] grid-cols-5 gap-3 p-3">
          {dias.map((d, dayIndex) => {
            const ts = tarefas.filter(
              t => ids.has(t.projetoId) && t.prazo && isSameDay(new Date(t.prazo), d),
            );
            return (
              <div
                key={d.toISOString()}
                className="relative min-h-[430px] p-1.5"
              >
                {dayIndex < dias.length - 1 && <span aria-hidden="true" className="absolute -right-[7px] inset-y-1 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent" />}
                <div className="mb-3 flex h-11 items-center justify-between rounded-xl border border-border/70 bg-surface-1/65 px-3 shadow-sm">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
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
                  {ts.map(t => {
                    const p = projetos.find(x => x.id === t.projetoId)!;
                    const cor = coresClientes.get(normalizarNome(p.cliente)) ?? corCliente(p.cliente);
                    const atrasada = !t.concluida && new Date(t.prazo!) < new Date();
                    return (
                      <button
                        key={t.id}
                        onClick={() => onAbrir(p.id)}
                        style={{ "--projeto": cor } as React.CSSProperties}
                        className={cn(
                          "relative w-full overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-surface-2/40 p-4 pl-[18px] text-left shadow-[0_12px_34px_-26px_rgba(0,0,0,.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--projeto)] hover:shadow-[0_18px_40px_-25px_var(--projeto)]",
                          t.concluida && "opacity-55",
                        )}
                      >
                        <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--projeto)]" />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-medium tabular-nums text-muted-foreground">
                            {format(new Date(t.prazo!), "HH:mm")}
                          </p>
                          {t.concluida ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase text-success">
                              <TickCircle size={11} color="currentColor" />Feita
                            </span>
                          ) : atrasada ? (
                            <span className="text-[9px] font-semibold uppercase text-destructive">
                              Atrasada
                            </span>
                          ) : null}
                        </div>
                        <p className={cn("mt-3 text-[13px] font-semibold leading-snug", t.concluida && "text-muted-foreground line-through decoration-muted-foreground/70")}>
                          {t.titulo}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-surface-2 px-2 py-1 text-[8px] text-muted-foreground">{p.cliente}</span>
                          <span className="rounded-full px-2 py-1 text-[8px] font-medium" style={{ color: cor, backgroundColor: `${cor}14` }}>{getFaseInfo(t.status).label}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t border-border/45 pt-3 text-[9px] text-muted-foreground">
                          <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-[8px] font-bold text-primary ring-1 ring-primary/20">{iniciais(t.responsavel)}</span>
                          <span className="truncate">{t.responsavel}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!ts.length && <p className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border/30 text-center text-[10px] text-muted-foreground/40">Sem ações planejadas</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Lista({ projetos, tarefas, onAbrir }: { projetos: Projeto[]; tarefas: Tarefa[]; onAbrir: (id: string) => void }) {
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
    <div className="divide-y divide-border/60">
      {projetos.map(p => {
        const r = calcularResumoProgresso(p, tarefas);
        return (
          <button
            key={p.id}
            onClick={() => onAbrir(p.id)}
            className={cn(
              "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 text-left transition hover:bg-surface-2/30",
              p.arquivado && "opacity-45 hover:opacity-80",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.nome}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {p.cliente} · {p.arquivado ? "Fechado" : FASES[p.fase].label}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                {p.arquivado ? <Archive className="size-3" /> : <Clock size={12} color="currentColor" />}
                {p.arquivado ? "Arquivado" : p.dataEntrega ? format(new Date(p.dataEntrega), "dd MMM") : "Sem prazo geral"}
              </span>
              <span>{r.percentual}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
