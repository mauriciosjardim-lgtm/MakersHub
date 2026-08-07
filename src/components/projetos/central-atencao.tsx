import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight2, Danger, Sms, Calendar, TickCircle, Notification } from "iconsax-react";
import { isProjetoAtivo, type Projeto, type Tarefa, type Entregavel } from "@/lib/mock/projetos";
import { projetosActions } from "@/lib/hooks/useProjetos";
import { cn } from "@/lib/utils";

type TipoPendencia = "atrasada" | "aguardando_cliente" | "entrega_amanha" | "aprovacao";

interface Pendencia {
  id: string;
  tipo: TipoPendencia;
  titulo: string;
  projeto: Projeto;
  pessoa?: string;
  tarefaId?: string;
}

const INFO_TIPO: Record<TipoPendencia, { label: string; dot: string; icon: typeof Danger }> = {
  atrasada: { label: "Atrasada", dot: "bg-destructive", icon: Danger },
  aguardando_cliente: { label: "Aguardando cliente", dot: "bg-warning", icon: Sms },
  entrega_amanha: { label: "Entrega amanhã", dot: "bg-info", icon: Calendar },
  aprovacao: { label: "Aprovação", dot: "bg-primary", icon: TickCircle },
};

export function CentralAtencao({
  projetos,
  tarefas,
  entregaveis,
  onAbrir,
  modo = "inline",
}: {
  projetos: Projeto[];
  tarefas: Tarefa[];
  entregaveis: Entregavel[];
  onAbrir: (projetoId: string) => void;
  modo?: "inline" | "painel";
}) {
  const agora = new Date();
  const amanha = addDays(agora, 1);
  const ativos = new Set(projetos.filter(isProjetoAtivo).map((p) => p.id));

  const pendencias: Pendencia[] = [];

  for (const t of tarefas) {
    if (t.concluida || !t.prazo || !ativos.has(t.projetoId)) continue;
    if (new Date(t.prazo) >= agora) continue;
    const projeto = projetos.find((p) => p.id === t.projetoId);
    if (!projeto) continue;
    pendencias.push({
      id: `t-${t.id}`,
      tipo: "atrasada",
      titulo: t.titulo,
      projeto,
      pessoa: t.responsavel,
      tarefaId: t.id,
    });
  }

  for (const e of entregaveis) {
    if (e.status !== "em_revisao" || !ativos.has(e.projetoId)) continue;
    const projeto = projetos.find((p) => p.id === e.projetoId);
    if (!projeto) continue;
    pendencias.push({ id: `e-${e.id}`, tipo: "aguardando_cliente", titulo: e.titulo, projeto });
  }

  for (const p of projetos) {
    if (!p.dataEntrega || !ativos.has(p.id) || !isSameDay(new Date(p.dataEntrega), amanha))
      continue;
    pendencias.push({
      id: `p-${p.id}`,
      tipo: "entrega_amanha",
      titulo: `Entrega — ${p.nome}`,
      projeto: p,
    });
  }

  for (const p of projetos) {
    if (!ativos.has(p.id)) continue;
    const emRevisao = tarefas.some(
      (tarefa) => tarefa.projetoId === p.id && !tarefa.concluida && tarefa.status === "revisao",
    );
    if (!emRevisao) continue;
    pendencias.push({
      id: `a-${p.id}`,
      tipo: "aprovacao",
      titulo: `${p.nome} em revisão`,
      projeto: p,
    });
  }

  const ORDEM: TipoPendencia[] = ["atrasada", "aguardando_cliente", "entrega_amanha", "aprovacao"];
  pendencias.sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo));

  return (
    <aside
      className={cn(
        "rounded-xl border border-border bg-surface-1/25",
        modo === "inline"
          ? "lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"
          : "flex h-full min-h-0 flex-col rounded-none border-0 bg-transparent",
      )}
    >
      <div className="border-b border-white/[.07] px-5 py-5 pr-14">
        <div className="flex items-center gap-3">
          <span className="kb-form-icon grid size-11 shrink-0 place-items-center rounded-xl">
            <Notification size={21} color="currentColor" variant="Bulk" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold tracking-[-.02em]">Central de atenção</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Pendências que exigem decisão ou acompanhamento.
            </p>
          </div>
          {pendencias.length > 0 && (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/15 text-xs font-bold text-destructive ring-1 ring-destructive/20">
              {pendencias.length}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "kb-scrollbar space-y-3 overflow-y-auto p-4",
          modo === "inline" ? "lg:max-h-[calc(100vh-8rem)]" : "min-h-0 flex-1",
        )}
      >
        {pendencias.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground/60">
            Tudo em dia — nenhuma pendência agora.
          </p>
        )}
        {pendencias.slice(0, 12).map((pend) => {
          const info = INFO_TIPO[pend.tipo];
          const Icon = info.icon;
          return (
            <div
              key={pend.id}
              className="rounded-xl border border-white/[.07] bg-white/[.025] p-4 transition hover:border-white/[.11] hover:bg-white/[.035]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[.04] px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Icon size={13} color="currentColor" variant="Bulk" />
                  {info.label}
                </span>
                <span className={cn("size-1.5 rounded-full", info.dot)} />
              </div>
              <p className="font-display text-sm font-bold leading-snug tracking-[-.01em]">
                {pend.titulo}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{pend.projeto.cliente}</span>
                {pend.pessoa && (
                  <>
                    <span className="size-1 rounded-full bg-white/20" />
                    <span>{pend.pessoa}</span>
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2 border-t border-white/[.06] pt-3">
                {pend.tipo === "atrasada" && pend.tarefaId && (
                  <button
                    onClick={() =>
                      projetosActions.atualizarTarefa(pend.tarefaId!, { concluida: true })
                    }
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[.075] bg-white/[.025] px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:bg-primary/[.06] hover:text-primary"
                  >
                    <TickCircle size={14} color="currentColor" variant="Linear" />
                    Concluir
                  </button>
                )}
                <button
                  onClick={() => onAbrir(pend.projeto.id)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[.075] bg-white/[.025] px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:bg-primary/[.06] hover:text-primary"
                >
                  Abrir <ArrowRight2 size={14} color="currentColor" variant="Linear" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
