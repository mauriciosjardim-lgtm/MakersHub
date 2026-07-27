import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
import { useAuth } from "@/lib/auth";
import { temAcesso, type Permissoes } from "@/lib/permissoes";
import { isProjetoConcluidoOuPausado } from "@/lib/mock/projetos";
import { cn } from "@/lib/utils";
import {
  isToday, isThisWeek, isPast, format, startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TickCircle, Calendar, Kanban, Clock, Flag, TaskSquare,
} from "iconsax-react";

const PRIORIDADE_COR: Record<string, string> = {
  urgente: "text-red-400",
  alta:    "text-orange-400",
  media:   "text-muted-foreground",
  baixa:   "text-muted-foreground/60",
};

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// normaliza nome para casar responsável ↔ usuário
const norm = (s: string) => s.trim().toLowerCase();

export function MembroDashboard() {
  const { usuario } = useAuth();
  const { projetos, tarefas } = useProjetos();
  const { eventos } = useAgendaSupa();

  const permissoes = (usuario as any)?.permissoes as Partial<Permissoes> | null ?? null;
  const podeVer = (m: keyof Permissoes) => temAcesso(permissoes, m);

  const meuNome = usuario?.nome ?? "";
  const meuPrimeiro = meuNome.split(" ")[0] ?? "";

  // tarefas atribuídas a mim (casa por nome completo ou primeiro nome)
  const ehMinha = (responsavel: string) => {
    const r = norm(responsavel);
    return r === norm(meuNome) || (!!meuPrimeiro && r === norm(meuPrimeiro));
  };

  const minhasTarefas = useMemo(
    () => tarefas.filter(t => !t.concluida && ehMinha(t.responsavel)),
    [tarefas, meuNome],
  );

  const { atrasadas, hoje, semana, depois } = useMemo(() => {
    const atrasadas: typeof minhasTarefas = [];
    const hoje: typeof minhasTarefas = [];
    const semana: typeof minhasTarefas = [];
    const depois: typeof minhasTarefas = [];
    for (const t of minhasTarefas) {
      if (!t.prazo) { depois.push(t); continue; }
      const d = new Date(t.prazo);
      if (isToday(d)) hoje.push(t);
      else if (isPast(startOfDay(d))) atrasadas.push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 })) semana.push(t);
      else depois.push(t);
    }
    const byPrazo = (a: any, b: any) => +new Date(a.prazo ?? 0) - +new Date(b.prazo ?? 0);
    return {
      atrasadas: atrasadas.sort(byPrazo),
      hoje: hoje.sort(byPrazo),
      semana: semana.sort(byPrazo),
      depois,
    };
  }, [minhasTarefas]);

  const nomeProjeto = (id: string) => projetos.find(p => p.id === id)?.nome ?? "";

  // projetos em que participo
  const meusProjetos = useMemo(() => {
    const mine = projetos.filter(p => p.equipe?.some(m => ehMinha(m)));
    return (mine.length ? mine : projetos).filter((p) => !isProjetoConcluidoOuPausado(p));
  }, [projetos, meuNome]);

  // próximos eventos (agenda compacta)
  const proximosEventos = useMemo(
    () => eventos
      .filter(e => new Date(e.inicio) >= startOfDay(new Date()))
      .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
      .slice(0, 5),
    [eventos],
  );

  const totalPendentes = minhasTarefas.length;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-7 md:px-8 md:py-9">
      {/* Greeting */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 font-display text-[2rem] font-bold tracking-tight text-foreground">
          {greet()}{meuPrimeiro ? `, ${meuPrimeiro}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalPendentes === 0
            ? "Você está em dia. Nenhuma tarefa pendente."
            : `Você tem ${totalPendentes} ${totalPendentes === 1 ? "tarefa pendente" : "tarefas pendentes"}${atrasadas.length ? ` · ${atrasadas.length} atrasada${atrasadas.length === 1 ? "" : "s"}` : ""}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* Coluna principal — Minhas tarefas */}
        <div className="space-y-4">
          {podeVer("projetos") ? (
            totalPendentes === 0 ? (
              <EmptyTarefas />
            ) : (
              <div className="space-y-4">
                <GrupoTarefas titulo="Atrasadas" cor="text-red-400" tarefas={atrasadas} nomeProjeto={nomeProjeto} />
                <GrupoTarefas titulo="Hoje"      cor="text-primary"  tarefas={hoje}      nomeProjeto={nomeProjeto} />
                <GrupoTarefas titulo="Esta semana" cor="text-foreground" tarefas={semana} nomeProjeto={nomeProjeto} />
                <GrupoTarefas titulo="Depois"    cor="text-muted-foreground" tarefas={depois} nomeProjeto={nomeProjeto} />
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-1/70 p-6 text-sm text-muted-foreground">
              Você não tem acesso ao módulo de Projetos.
            </div>
          )}
        </div>

        {/* Coluna lateral — projetos + agenda compacta */}
        <div className="space-y-4">
          {podeVer("projetos") && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-1/70 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Kanban size={15} color="var(--color-primary)" variant="Linear" />
                <p className="font-display text-sm font-semibold tracking-tight">Meus projetos</p>
              </div>
              {meusProjetos.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Nenhum projeto ativo.</p>
              ) : (
                <ul className="space-y-2">
                  {meusProjetos.slice(0, 6).map(p => (
                    <li key={p.id}>
                      <Link to="/projetos/$id" params={{ id: p.id }}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.04]">
                        <span className="size-2 shrink-0 rounded-full bg-primary/70" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-foreground/90 group-hover:text-foreground">{p.nome}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.cliente}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{p.progresso}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/projetos" className="mt-3 block text-center text-[11px] text-muted-foreground hover:text-primary">
                Ver todos →
              </Link>
            </div>
          )}

          {podeVer("agenda") && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-1/70 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Calendar size={15} color="var(--color-primary)" variant="Linear" />
                <p className="font-display text-sm font-semibold tracking-tight">Próximos prazos</p>
              </div>
              {proximosEventos.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Nada agendado.</p>
              ) : (
                <ul className="space-y-2.5">
                  {proximosEventos.map(e => (
                    <li key={e.id} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-foreground/85">{e.titulo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(e.inicio), "EEE, d MMM · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/agenda" className="mt-3 block text-center text-[11px] text-muted-foreground hover:text-primary">
                Ver agenda →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GrupoTarefas({
  titulo, cor, tarefas, nomeProjeto,
}: {
  titulo: string;
  cor: string;
  tarefas: { id: string; titulo: string; projetoId: string; prazo?: string; prioridade: string }[];
  nomeProjeto: (id: string) => string;
}) {
  if (tarefas.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Flag size={13} color="currentColor" variant="Bold" className={cor} />
        <span className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", cor)}>{titulo}</span>
        <span className="text-[11px] text-muted-foreground">{tarefas.length}</span>
      </div>
      <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-white/[0.06] bg-surface-1/70">
        {tarefas.map(t => (
          <li key={t.id}>
            <Link to="/projetos/$id" params={{ id: t.projetoId }}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]">
              <TaskSquare size={16} color="currentColor" variant="Linear" className={PRIORIDADE_COR[t.prioridade] ?? "text-muted-foreground"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground/90">{t.titulo}</p>
                <p className="truncate text-[11px] text-muted-foreground">{nomeProjeto(t.projetoId)}</p>
              </div>
              {t.prazo && (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock size={12} color="currentColor" variant="Linear" />
                  {format(new Date(t.prazo), "d MMM", { locale: ptBR })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyTarefas() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 bg-surface-1/40 px-6 py-16 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <TickCircle size={24} color="currentColor" variant="Linear" />
      </div>
      <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Você não tem tarefas pendentes atribuídas. Quando um admin te atribuir algo, aparece aqui.
      </p>
    </div>
  );
}
