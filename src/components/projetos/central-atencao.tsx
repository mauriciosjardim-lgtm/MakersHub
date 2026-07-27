import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Danger, Sms, Calendar, TickCircle } from "iconsax-react";
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
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">Central de atenção</h2>
          {pendencias.length > 0 && (
            <span className="grid size-5 place-items-center rounded-md bg-destructive/15 text-[10px] font-bold text-destructive">
              {pendencias.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Só o que exige decisão ou acompanhamento.
        </p>
      </div>
      <div
        className={cn(
          "space-y-2 overflow-y-auto p-3",
          modo === "inline" ? "lg:max-h-[calc(100vh-8rem)]" : "min-h-0 flex-1",
        )}
      >
        {pendencias.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/40 p-6 text-center text-[10px] text-muted-foreground/60">
            Tudo em dia — nenhuma pendência agora.
          </p>
        )}
        {pendencias.slice(0, 12).map((pend) => {
          const info = INFO_TIPO[pend.tipo];
          return (
            <div key={pend.id} className="rounded-lg border border-border/60 bg-surface-2/40 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", info.dot)} />
                {info.label}
              </div>
              <p className="text-xs font-medium leading-snug">{pend.titulo}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{pend.projeto.cliente}</p>
              {pend.pessoa && (
                <p className="mt-1 text-[10px] text-muted-foreground">{pend.pessoa}</p>
              )}
              <div className="mt-2 flex gap-1.5">
                {pend.tipo === "atrasada" && pend.tarefaId && (
                  <button
                    onClick={() =>
                      projetosActions.atualizarTarefa(pend.tarefaId!, { concluida: true })
                    }
                    className="flex-1 rounded-md border border-border/60 bg-surface-1/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    Concluir
                  </button>
                )}
                <button
                  onClick={() => onAbrir(pend.projeto.id)}
                  className="flex-1 rounded-md border border-border/60 bg-surface-1/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  Abrir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
