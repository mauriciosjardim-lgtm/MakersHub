import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  differenceInCalendarDays,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft2, ArrowRight2, Add, Clock, Location, Lock1, Profile2User } from "iconsax-react";
import type { Icon as IconsaxIcon } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { GoogleCalendarConnection } from "@/components/agenda/google-calendar-connection";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { TIPOS, type Evento } from "@/lib/mock/agenda";
import { EventoModal } from "@/components/agenda/evento-modal";
import { cn } from "@/lib/utils";

// ssr:false — módulo privado, dados 100% client-side (mesmo padrão de /financeiro)
export const Route = createFileRoute("/agenda")({ ssr: false, component: AgendaPage });

type Visao = "mes" | "semana" | "dia";

function AgendaPage() {
  const { eventos } = useAgendaSupa();
  const { tarefas } = useProjetos();
  const [visao, setVisao] = useState<Visao>("semana");
  const [cursor, setCursor] = useState(() => {
    const saved =
      typeof window !== "undefined" ? sessionStorage.getItem("makershub:agenda:cursor") : null;
    if (saved) {
      sessionStorage.removeItem("makershub:agenda:cursor");
      const date = new Date(saved);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  });
  const [editando, setEditando] = useState<Evento | null>(null);
  const [criandoEm, setCriandoEm] = useState<Date | null>(null);
  const [modal, setModal] = useState(false);

  const abrirNovo = (data?: Date) => {
    setEditando(null);
    setCriandoEm(data ?? new Date());
    setModal(true);
  };
  const abrirEdicao = (ev: Evento) => {
    setEditando(ev);
    setCriandoEm(null);
    setModal(true);
  };

  const tituloPeriodo = useMemo(() => {
    if (visao === "mes") return format(cursor, "MMMM yyyy", { locale: ptBR });
    if (visao === "dia") return format(cursor, "dd 'de' MMMM, yyyy", { locale: ptBR });
    const ini = startOfWeek(cursor, { weekStartsOn: 1 });
    const fim = endOfWeek(cursor, { weekStartsOn: 1 });
    return `${format(ini, "dd MMM", { locale: ptBR })} — ${format(fim, "dd MMM", { locale: ptBR })}`;
  }, [cursor, visao]);

  const eventosNoPeriodo = useMemo(() => {
    if (visao === "dia") return eventos.filter((e) => isSameDay(new Date(e.inicio), cursor)).length;
    const ini = visao === "mes" ? startOfMonth(cursor) : startOfWeek(cursor, { weekStartsOn: 1 });
    const fim = visao === "mes" ? endOfMonth(cursor) : endOfWeek(cursor, { weekStartsOn: 1 });
    return eventos.filter((e) => {
      const d = new Date(e.inicio);
      return d >= ini && d <= fim;
    }).length;
  }, [eventos, cursor, visao]);

  const navegar = (dir: 1 | -1) => {
    if (visao === "mes") setCursor(dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1));
    else if (visao === "semana") setCursor(addDays(cursor, dir * 7));
    else setCursor(addDays(cursor, dir));
  };

  // Tarefas criadas antes da integração ainda não possuem participantes no
  // evento. Exibe o responsável vindo de Projetos sem exigir nova edição.
  const eventosComResponsaveis = useMemo(
    () =>
      eventos.map((evento) => {
        if (evento.participantes?.length || evento.refTipo !== "tarefa" || !evento.refId)
          return evento;
        const responsavel = tarefas.find((t) => t.id === evento.refId)?.responsavel;
        return responsavel ? { ...evento, participantes: [responsavel] } : evento;
      }),
    [eventos, tarefas],
  );

  return (
    <div className="space-y-4 px-4 py-5 md:px-8 md:py-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold capitalize">{tituloPeriodo}</h1>
          <p className="text-xs text-muted-foreground">
            {eventosNoPeriodo} evento{eventosNoPeriodo === 1 ? "" : "s"} neste período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)}>
            <TabsList className="h-8">
              <TabsTrigger value="mes" className="text-xs">
                Mês
              </TabsTrigger>
              <TabsTrigger value="semana" className="text-xs">
                Semana
              </TabsTrigger>
              <TabsTrigger value="dia" className="text-xs">
                Dia
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface-1/50 p-0.5">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navegar(-1)}>
              <ArrowLeft2 size={16} color="currentColor" variant="Linear" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCursor(new Date())}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navegar(1)}>
              <ArrowRight2 size={16} color="currentColor" variant="Linear" />
            </Button>
          </div>
        </div>
      </header>

      <Legenda onNovo={() => abrirNovo()} />

      {visao === "mes" && (
        <VisaoMes
          cursor={cursor}
          eventos={eventosComResponsaveis}
          onDia={abrirNovo}
          onEvento={abrirEdicao}
        />
      )}
      {visao === "semana" && (
        <VisaoSemana
          cursor={cursor}
          eventos={eventosComResponsaveis}
          onDia={abrirNovo}
          onEvento={abrirEdicao}
        />
      )}
      {visao === "dia" && (
        <VisaoDia
          cursor={cursor}
          eventos={eventosComResponsaveis}
          onNovo={() => abrirNovo(cursor)}
          onEvento={abrirEdicao}
        />
      )}

      <EventoModal
        open={modal}
        onClose={() => setModal(false)}
        evento={editando}
        dataInicial={criandoEm}
      />
    </div>
  );
}

function Legenda({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface-1/40 px-2 py-2">
      <Button size="sm" onClick={onNovo} className="shrink-0">
        <Add size={16} color="currentColor" variant="Linear" /> Novo evento
      </Button>
      <GoogleCalendarConnection />
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border/60" aria-hidden />
      {Object.entries(TIPOS).map(([id, t]) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span className={cn("size-2 rounded-full", t.dot)} /> {t.label}
        </span>
      ))}
    </div>
  );
}

/* ===================== MÊS ===================== */
function VisaoMes({
  cursor,
  eventos,
  onDia,
  onEvento,
}: {
  cursor: Date;
  eventos: Evento[];
  onDia: (d: Date) => void;
  onEvento: (e: Evento) => void;
}) {
  const ini = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const fim = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const dias = eachDayOfInterval({ start: ini, end: fim });
  const semanas = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1/30">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/40">
        {semanas.map((s) => (
          <div
            key={s}
            className="px-2 py-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const doDia = eventos.filter((e) => isSameDay(new Date(e.inicio), d));
          const foraMes = !isSameMonth(d, cursor);
          const hoje = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "group min-h-[110px] cursor-pointer border-b border-r border-border/50 p-1.5 transition hover:bg-surface-2/40",
                foraMes && "bg-surface-1/10 opacity-50",
              )}
              onClick={() => onDia(d)}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-md text-[11px] tabular-nums",
                    hoje ? "bg-primary text-primary-foreground font-bold" : "text-foreground/70",
                  )}
                >
                  {format(d, "dd")}
                </span>
                {doDia.length > 0 && (
                  <span className="text-[9px] text-muted-foreground">{doDia.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {doDia.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEvento(e);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px]",
                      TIPOS[e.tipo].classe,
                    )}
                  >
                    <span className="tabular-nums opacity-70">
                      {format(new Date(e.inicio), "HH:mm")}
                    </span>
                    <span className="truncate">{e.titulo}</span>
                  </button>
                ))}
                {doDia.length > 3 && (
                  <p className="text-[9px] text-muted-foreground">+ {doDia.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== SEMANA ===================== */
// Timeline editorial: a semana é a régua horizontal e cada evento ocupa uma
// lane própria. O horário continua sendo informação, mas não define a posição.
const NOTCH_CLIP: Record<string, string> = {
  reuniao: "bg-info",
  gravacao: "bg-primary",
  edicao: "bg-purple-400",
  entrega: "bg-success",
  tarefa: "bg-warning",
  outro: "bg-muted-foreground",
};
const TEXTO_CLIP: Record<string, string> = {
  reuniao: "text-info",
  gravacao: "text-primary",
  edicao: "text-purple-300",
  entrega: "text-success",
  tarefa: "text-warning",
  outro: "text-muted-foreground",
};

function iniciaisDe(nome: string) {
  return nome
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function VisaoSemana({
  cursor,
  eventos,
  onDia,
  onEvento,
}: {
  cursor: Date;
  eventos: Evento[];
  onDia: (d: Date) => void;
  onEvento: (e: Evento) => void;
}) {
  const ini = startOfWeek(cursor, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  const fimSemana = addDays(addDays(ini, 6), 1); // exclusivo (início do dia seguinte)
  const itens = eventos
    .filter((e) => {
      const d = new Date(e.inicio);
      return d >= ini && d < fimSemana;
    })
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  const fimPorLane: number[] = [];
  const clips = itens.map((evento) => {
    const inicioEvento = new Date(evento.inicio);
    const fimEvento = new Date(evento.fim);
    const inicioDia = clamp(differenceInCalendarDays(inicioEvento, ini), 0, 6);
    const fimDia = clamp(
      Math.max(inicioDia, differenceInCalendarDays(fimEvento, ini)),
      inicioDia,
      6,
    );
    let lane = fimPorLane.findIndex((ocupadoAte) => ocupadoAte < inicioDia);
    if (lane === -1) {
      lane = fimPorLane.length;
      fimPorLane.push(fimDia);
    } else fimPorLane[lane] = fimDia;
    return { evento, inicioEvento, fimEvento, inicioDia, fimDia, lane };
  });
  const totalLanes = Math.max(5, fimPorLane.length);
  const idxHoje = dias.findIndex((dia) => isToday(dia));

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface-1/30 shadow-[0_24px_60px_-40px_rgba(0,0,0,.95)]">
      <div className="overflow-x-auto">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-7 border-b border-border/40 bg-surface-2/15">
            {dias.map((d) => {
              const hoje = isToday(d);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => onDia(d)}
                  title="Agendar neste dia"
                  className={cn(
                    "group flex items-baseline gap-2 border-l border-border/25 px-4 py-3.5 text-left transition first:border-l-0 hover:bg-white/[0.02]",
                    hoje && "bg-primary/[0.035]",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase",
                      hoje ? "text-primary" : "text-muted-foreground/70",
                    )}
                  >
                    {format(d, "EEEEE", { locale: ptBR })}
                  </span>
                  <strong
                    className={cn(
                      "font-display text-xl font-semibold tabular-nums tracking-tight",
                      hoje ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </strong>
                  <span className="ml-auto text-[9px] text-muted-foreground/60 opacity-0 transition group-hover:opacity-100">
                    +
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative grid grid-cols-7" style={{ minHeight: totalLanes * 94 + 40 }}>
            {dias.map((d) => (
              <button
                key={d.toISOString()}
                onClick={() => onDia(d)}
                title={`Agendar ${format(d, "dd MMM", { locale: ptBR })}`}
                className={cn(
                  "border-l border-border/25 first:border-l-0 transition hover:bg-white/[0.012]",
                  (d.getDay() === 0 || d.getDay() === 6) && "bg-black/[0.055]",
                  isToday(d) && "bg-primary/[0.018]",
                )}
              />
            ))}
            {idxHoje >= 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-primary/45"
                style={{ left: `${((idxHoje + 0.5) / 7) * 100}%` }}
              >
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/.75)]" />
              </div>
            )}
            {clips.map(({ evento, inicioEvento, fimEvento, inicioDia, fimDia, lane }) => {
              const responsavel = evento.participantes?.[0];
              const span = fimDia - inicioDia + 1;
              const top = 22 + lane * 94;
              return (
                <div key={evento.id} className="contents">
                  {span > 1 && (
                    <div
                      className="pointer-events-none absolute z-[1] h-px bg-primary/45"
                      style={{
                        top: top + 36,
                        left: `${((inicioDia + 0.5) / 7) * 100}%`,
                        width: `${((span - 1) / 7) * 100}%`,
                      }}
                    >
                      <span className="absolute left-1/2 top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/35 bg-background text-primary shadow-[0_0_12px_hsl(var(--primary)/.18)]">
                        <Lock1 size={9} color="currentColor" variant="Bold" />
                      </span>
                    </div>
                  )}
                  {Array.from({ length: span }, (_, indice) => {
                    const diaSegmento = inicioDia + indice;
                    const rotuloHorario = evento.diaTodo
                      ? "Dia todo"
                      : span === 1
                        ? `${format(inicioEvento, "HH:mm")}–${format(fimEvento, "HH:mm")}`
                        : indice === 0
                          ? `${format(inicioEvento, "HH:mm")} · início`
                          : indice === span - 1
                            ? `${format(fimEvento, "HH:mm")} · término`
                            : "Continuação";
                    return (
                      <button
                        key={`${evento.id}-${diaSegmento}`}
                        onClick={() => onEvento(evento)}
                        style={{
                          left: `calc(${(diaSegmento / 7) * 100}% + 10px)`,
                          width: `calc(${(1 / 7) * 100}% - 20px)`,
                          top,
                        }}
                        className="group absolute z-[2] flex min-h-[72px] overflow-hidden rounded-xl bg-surface-2/95 p-3 text-left ring-1 ring-white/[0.055] shadow-[0_14px_30px_-22px_rgba(0,0,0,.95)] transition duration-200 hover:z-[3] hover:scale-[1.015] hover:bg-surface-2 hover:ring-white/[0.13] hover:shadow-[0_18px_36px_-22px_rgba(0,0,0,1)]"
                      >
                        <span
                          className={cn(
                            "mr-2.5 w-[3px] shrink-0 self-stretch rounded-full",
                            NOTCH_CLIP[evento.tipo] ?? "bg-muted-foreground",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-display text-[13px] font-semibold leading-tight text-foreground">
                              {evento.titulo}
                            </p>
                            {responsavel && (
                              <span
                                title={responsavel}
                                className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[8px] font-bold text-foreground/80 ring-2 ring-surface-2"
                              >
                                {iniciaisDe(responsavel)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                            <span className={cn("font-medium", TEXTO_CLIP[evento.tipo])}>
                              {TIPOS[evento.tipo].label}
                            </span>
                            <span className="truncate tabular-nums text-muted-foreground">
                              {rotuloHorario}
                            </span>
                          </div>
                          {responsavel && (
                            <p className="mt-1 truncate text-[10px] text-muted-foreground">
                              {responsavel}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!clips.length && (
              <p className="absolute inset-x-0 top-20 text-center text-xs text-muted-foreground">
                Semana livre. Clique em qualquer dia para agendar.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== DIA ===================== */
function VisaoDia({
  cursor,
  eventos,
  onNovo,
  onEvento,
}: {
  cursor: Date;
  eventos: Evento[];
  onNovo: () => void;
  onEvento: (e: Evento) => void;
}) {
  const doDia = eventos
    .filter((e) => isSameDay(new Date(e.inicio), cursor))
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  const horas = Array.from({ length: 14 }, (_, i) => i + 7); // 7h até 20h

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border bg-surface-1/30 p-4">
        <div className="space-y-1">
          {horas.map((h) => {
            const eventosHora = doDia.filter((e) => new Date(e.inicio).getHours() === h);
            return (
              <div key={h} className="flex gap-3 border-t border-border/30 py-2 first:border-t-0">
                <div className="w-12 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
                <div className="flex-1 space-y-1.5">
                  {eventosHora.length === 0 && <div className="h-6" />}
                  {eventosHora.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onEvento(e)}
                      className={cn(
                        "w-full rounded-lg border p-2 text-left transition hover:scale-[1.005]",
                        TIPOS[e.tipo].classe,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{e.titulo}</p>
                        <span className="shrink-0 text-[10px] tabular-nums opacity-70">
                          {format(new Date(e.inicio), "HH:mm")}–{format(new Date(e.fim), "HH:mm")}
                        </span>
                      </div>
                      {e.local && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
                          <Location size={12} color="currentColor" variant="Linear" /> {e.local}
                        </p>
                      )}
                      {e.participantes?.[0] && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Responsável: {e.participantes[0]}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-border bg-surface-1/40 p-4">
          <h3 className="mb-2 font-display text-sm font-semibold">Resumo do dia</h3>
          <div className="space-y-2">
            <Stat icon={Clock} label="Eventos" valor={String(doDia.length)} />
            <Stat
              icon={Profile2User}
              label="Reuniões"
              valor={String(doDia.filter((e) => e.tipo === "reuniao").length)}
            />
          </div>
          <Button size="sm" className="mt-3 w-full" onClick={onNovo}>
            <Add size={16} color="currentColor" variant="Linear" /> Novo evento
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-surface-1/40 p-4">
          <h3 className="mb-2 font-display text-sm font-semibold">Próximos</h3>
          <div className="space-y-1.5">
            {eventos
              .filter((e) => new Date(e.inicio) > new Date())
              .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
              .slice(0, 5)
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => onEvento(e)}
                  className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-surface-2/30 p-2 text-left transition hover:border-primary/30"
                >
                  <span className={cn("size-2 rounded-full", TIPOS[e.tipo].dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{e.titulo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(e.inicio), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </button>
              ))}
            {eventos.filter((e) => new Date(e.inicio) > new Date()).length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground">Nada agendado</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  valor,
}: {
  icon: typeof IconsaxIcon;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-surface-2/40 px-2.5 py-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon size={14} color="currentColor" variant="Linear" className="text-primary" /> {label}
      </span>
      <span className="font-display text-sm font-semibold tabular-nums">{valor}</span>
    </div>
  );
}
