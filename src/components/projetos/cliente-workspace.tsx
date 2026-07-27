import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Export, Profile2User } from "iconsax-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  faseParaId,
  getFaseInfo,
  resolverCorProjeto,
  type Entregavel,
  type Marco,
  type Projeto,
  type Tarefa,
} from "@/lib/mock/projetos";
import { calcularResumoProgresso } from "@/lib/projetos/progresso";
import { cn } from "@/lib/utils";

export function ClienteWorkspace({
  cliente,
  projetos,
  tarefas,
  marcos,
  entregaveis,
  open,
  onClose,
  onAbrirProjeto,
}: {
  cliente: string | null;
  projetos: Projeto[];
  tarefas: Tarefa[];
  marcos: Marco[];
  entregaveis: Entregavel[];
  open: boolean;
  onClose: () => void;
  onAbrirProjeto: (id: string) => void;
}) {
  const projetosCliente = useMemo(
    () => projetos.filter((p) => p.cliente === cliente),
    [projetos, cliente],
  );
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const projeto = projetosCliente.find((p) => p.id === selecionadoId) ?? projetosCliente[0];
  if (!cliente) return null;
  const ts = projeto ? tarefas.filter((t) => t.projetoId === projeto.id) : [];
  const ms = projeto ? marcos.filter((m) => m.projetoId === projeto.id) : [];
  const es = projeto ? entregaveis.filter((e) => e.projetoId === projeto.id) : [];
  const resumo = projeto ? calcularResumoProgresso(projeto, tarefas) : null;
  const corProjeto = resolverCorProjeto(projeto?.cor, projeto?.id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        overlayClassName="bg-background/25 backdrop-blur-md"
        className="h-[88vh] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-border/70 bg-[#0b0d0e]/95 p-0 shadow-2xl shadow-black/35"
      >
        <DialogHeader className="border-b border-border/60 bg-surface-1/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-[11px] font-bold text-primary">
              {cliente
                .split(/\s+/)
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <DialogTitle className="font-display text-base">{cliente}</DialogTitle>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {projetosCliente.length} projeto{projetosCliente.length === 1 ? "" : "s"} em
                produção
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 grid-cols-[236px_minmax(0,1fr)] overflow-hidden">
          <aside className="overflow-y-auto border-r border-border/60 bg-surface-1/30 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projetos
              </p>
              <span className="rounded-full border border-border/70 px-2 py-0.5 text-[8px] text-muted-foreground">
                {projetosCliente.length}
              </span>
            </div>
            {projetosCliente.map((p) => {
              const abertas = tarefas.filter((t) => t.projetoId === p.id && !t.concluida).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelecionadoId(p.id)}
                  className={cn(
                    "group mb-2.5 w-full rounded-xl border p-3.5 text-left transition-all",
                    projeto?.id === p.id
                      ? "border-primary/45 bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]"
                      : "border-border/60 bg-card/60 hover:border-primary/25 hover:bg-card",
                    p.arquivado && "opacity-45 hover:opacity-75",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug">{p.nome}</p>
                    <span
                      className={cn(
                        "mt-0.5 size-1.5 shrink-0 rounded-full",
                        projeto?.id === p.id
                          ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                          : "bg-muted-foreground/30",
                      )}
                    />
                  </div>
                  <p className="mt-2 text-[9px] text-muted-foreground">
                    {p.arquivado
                      ? "Fechado"
                      : `${abertas} tarefa${abertas === 1 ? "" : "s"} aberta${abertas === 1 ? "" : "s"}`}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/50">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${p.progresso}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[8px] tabular-nums text-muted-foreground">
                    {p.progresso}%
                  </p>
                </button>
              );
            })}
          </aside>
          {projeto ? (
            <main
              style={{ "--projeto": corProjeto } as React.CSSProperties}
              className="min-w-0 overflow-y-auto px-6 py-5 lg:px-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-[9px] font-medium",
                      projeto.arquivado
                        ? "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                        : "border-primary/30 bg-primary/10 text-primary",
                    )}
                  >
                    {projeto.arquivado ? "Fechado" : "Em produção"}
                  </span>
                  <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                    {projeto.nome}
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                    {projeto.descricao || "Sem descrição registrada."}
                  </p>
                </div>
                <button
                  onClick={() => onAbrirProjeto(projeto.id)}
                  className="rounded-xl bg-primary px-4 py-2.5 text-[11px] font-semibold text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.12)] transition hover:brightness-110"
                >
                  Abrir projeto completo
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {projeto.dataEntrega && (
                  <Stat
                    label="Entrega geral"
                    valor={format(new Date(projeto.dataEntrega), "dd MMM yyyy", { locale: ptBR })}
                  />
                )}
                <Stat label="Progresso" valor={`${resumo?.percentual ?? 0}%`} />
                <Stat
                  label="Equipe"
                  valor={`${projeto.equipe.length} ${projeto.equipe.length === 1 ? "pessoa" : "pessoas"}`}
                />
                <Stat label="Valor" valor={`R$ ${projeto.valor.toLocaleString("pt-BR")}`} />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/50">
                <div
                  className="h-full rounded-full bg-[var(--projeto)] transition-all"
                  style={{ width: `${resumo?.percentual ?? 0}%` }}
                />
              </div>
              <Tabs defaultValue="fluxo" className="mt-5">
                <TabsList className="h-10 w-full justify-start rounded-xl border border-border/60 bg-surface-1/50 p-1">
                  <TabsTrigger className="text-xs" value="fluxo">
                    Fluxo
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="entregaveis">
                    Entregáveis
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="marcos">
                    Marcos
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="info">
                    Informações e links
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="equipe">
                    Equipe
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="fluxo" className="mt-3">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {(projeto.fases ?? []).map((f) => {
                      const items = ts.filter((t) => faseParaId(t.status) === faseParaId(f));
                      return (
                        <div
                          key={f}
                          className="w-[220px] shrink-0 rounded-xl border border-border/60 bg-surface-1/30 p-2.5"
                        >
                          <div className="mb-2.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span>{getFaseInfo(f).label}</span>
                            <span className="rounded-full bg-surface-2 px-1.5 py-0.5">
                              {items.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {items.map((t) => (
                              <div
                                key={t.id}
                                className="relative overflow-hidden rounded-lg border border-border/60 bg-card p-2.5 pl-3"
                              >
                                <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--projeto)]" />
                                <p className="text-[10px] font-medium leading-snug">{t.titulo}</p>
                                <p className="mt-2 text-[8px] text-muted-foreground">
                                  {t.responsavel}
                                  {t.prazo ? ` · ${format(new Date(t.prazo), "dd MMM")}` : ""}
                                </p>
                              </div>
                            ))}
                            {!items.length && (
                              <p className="rounded-lg border border-dashed border-border/40 p-5 text-center text-[8px] text-muted-foreground/50">
                                Nenhuma tarefa nesta etapa
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="entregaveis" className="mt-3 space-y-2">
                  {es.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3"
                    >
                      <div>
                        <p className="text-xs font-medium">{e.titulo}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {e.tipo} · {e.status.replaceAll("_", " ")}
                        </p>
                      </div>
                      {e.link && (
                        <a href={e.link} target="_blank" rel="noreferrer" className="text-primary">
                          <Export size={15} color="currentColor" />
                        </a>
                      )}
                    </div>
                  ))}
                  {!es.length && <Vazio texto="Nenhum entregável registrado." />}
                </TabsContent>
                <TabsContent value="marcos" className="mt-3 space-y-2">
                  {ms.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3"
                    >
                      <Calendar size={15} color="currentColor" className="text-primary" />
                      <div>
                        <p className="text-xs font-medium">{m.titulo}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {format(new Date(m.data), "dd MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!ms.length && <Vazio texto="Nenhum marco registrado." />}
                </TabsContent>
                <TabsContent value="info" className="mt-3 grid gap-3 md:grid-cols-2">
                  <section className="rounded-xl border border-border bg-surface-1/35 p-4">
                    <h3 className="text-xs font-semibold">Informações e decisões</h3>
                    <p className="mt-3 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                      {projeto.notas || "Nenhuma anotação registrada."}
                    </p>
                  </section>
                  <section className="rounded-xl border border-border bg-surface-1/35 p-4">
                    <h3 className="text-xs font-semibold">Links do projeto</h3>
                    <div className="mt-3 space-y-2">
                      {(projeto.links ?? []).map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-[10px] hover:border-primary/30"
                        >
                          <span>{l.label}</span>
                          <Export size={12} color="currentColor" className="text-primary" />
                        </a>
                      ))}
                      {!(projeto.links ?? []).length && (
                        <p className="text-[10px] text-muted-foreground">Nenhum link salvo.</p>
                      )}
                    </div>
                  </section>
                </TabsContent>
                <TabsContent value="equipe" className="mt-3 grid gap-2 md:grid-cols-2">
                  {projeto.equipe.map((m) => (
                    <div
                      key={m}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                        {m
                          .split(/\s+/)
                          .map((x) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{m}</p>
                        <p className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
                          <Profile2User size={9} color="currentColor" />
                          {ts.filter((t) => t.responsavel === m && !t.concluida).length} tarefas
                          abertas
                        </p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </main>
          ) : (
            <Vazio texto="Nenhum projeto neste cliente." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-1/35 p-3.5">
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-xs font-semibold">{valor}</p>
    </div>
  );
}
function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border/50 p-8 text-center text-[10px] text-muted-foreground">
      {texto}
    </p>
  );
}
