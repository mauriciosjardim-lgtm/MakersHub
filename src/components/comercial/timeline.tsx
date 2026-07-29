import {
  Phone,
  Calendar,
  MessageCircle,
  Mail,
  FileText,
  StickyNote,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TimelineEvent, TimelineTipo } from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";

const PRIMARY = { color: "text-primary", bg: "bg-primary/15", ring: "ring-primary/30" };
const ICONS: Record<TimelineTipo, { icon: typeof Phone; color: string; bg: string; ring: string }> =
  {
    criado: { icon: Sparkles, ...PRIMARY },
    ligacao: { icon: Phone, ...PRIMARY },
    reuniao: { icon: Calendar, ...PRIMARY },
    whatsapp: { icon: MessageCircle, ...PRIMARY },
    email: { icon: Mail, ...PRIMARY },
    proposta_enviada: { icon: FileText, ...PRIMARY },
    observacao: { icon: StickyNote, ...PRIMARY },
    etapa_mudou: { icon: ArrowRight, ...PRIMARY },
    fechado: {
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/15",
      ring: "ring-success/30",
    },
    perdido: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/15",
      ring: "ring-destructive/30",
    },
    arquivado: {
      icon: Archive,
      color: "text-muted-foreground",
      bg: "bg-muted",
      ring: "ring-border",
    },
    restaurado: { icon: ArchiveRestore, ...PRIMARY },
  };

function labelDia(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const groups = events.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const key = labelDia(e.quando);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});
  const order = Object.keys(groups);

  if (order.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
        <Sparkles className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">A timeline desse lead começará aqui.</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Toda interação aparece neste fluxo.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-7">
      {/* Linha vertical contínua */}
      <span
        className="absolute left-[17px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border/60 to-transparent"
        aria-hidden
      />

      {order.map((dia) => (
        <div key={dia} className="space-y-3">
          {/* Separador de dia — estilo chip */}
          <div className="relative flex items-center gap-3 pl-1">
            <span className="grid size-9 place-items-center rounded-full border border-border bg-background text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {dia === "Hoje"
                ? "•"
                : dia === "Ontem"
                  ? "−1"
                  : format(new Date(groups[dia][0].quando), "dd", { locale: ptBR })}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {dia}
            </p>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <ul className="space-y-2.5">
            {groups[dia].map((ev) => {
              const meta = ICONS[ev.tipo];
              const Icon = meta.icon;
              return (
                <li key={ev.id} className="relative pl-11">
                  <span
                    className={cn(
                      "absolute left-0 top-1 grid size-9 place-items-center rounded-full ring-4 ring-background",
                      meta.bg,
                    )}
                  >
                    <Icon className={cn("size-4", meta.color)} />
                  </span>
                  <div
                    className={cn(
                      "rounded-xl border border-border/60 bg-surface-1/60 p-3.5 ring-1",
                      meta.ring,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-foreground">{ev.titulo}</p>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {format(new Date(ev.quando), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {ev.descricao && (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {ev.descricao}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      por {ev.autor}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
