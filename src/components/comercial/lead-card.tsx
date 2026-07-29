import { useDraggable } from "@dnd-kit/core";
import { Archive, Flame, Snowflake, Thermometer, Trash2 } from "lucide-react";
import { Danger, Calendar, Buildings2, DollarCircle, Profile } from "iconsax-react";
import { formatDistanceToNow, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Lead, getEmpresa, getContato, fmtBRL } from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";

const TEMPS = {
  frio: {
    icon: Snowflake,
    label: "Frio",
    color: "var(--info)",
    text: "text-info",
    glow: "shadow-[0_0_10px_var(--info)]",
  },
  morno: {
    icon: Thermometer,
    label: "Morno",
    color: "var(--warning)",
    text: "text-warning",
    glow: "shadow-[0_0_10px_var(--warning)]",
  },
  quente: {
    icon: Flame,
    label: "Quente",
    color: "var(--destructive)",
    text: "text-destructive",
    glow: "shadow-[0_0_12px_var(--destructive)]",
  },
} as const;

function quando(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `hoje, ${format(d, "HH:mm", { locale: ptBR })}`;
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
}

export function LeadCard({
  lead,
  onOpen,
  onArchive,
  onDelete,
  dragDisabled = false,
}: {
  lead: Lead;
  onOpen: (id: string) => void;
  onArchive?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  dragDisabled?: boolean;
}) {
  const empresa = getEmpresa(lead.empresaId);
  const contato = getContato(lead.contatoId);
  const temp = TEMPS[lead.temperatura];
  const TempIcon = temp.icon;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { etapa: lead.etapa },
    disabled: dragDisabled,
  });

  const atrasada = lead.proximaAcao && isPast(new Date(lead.proximaAcao.data));
  const semAcao = !lead.proximaAcao;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: undefined }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.preventDefault();
        onOpen(lead.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isDragging) onOpen(lead.id);
      }}
      className={cn(
        "group/card relative w-full select-none text-left rounded-2xl border border-border bg-card p-4 shadow-sm transition-all cursor-pointer",
        "hover:border-primary/40 hover:shadow-[0_10px_30px_-14px_oklch(0_0_0/0.7)] hover:-translate-y-0.5",
        isDragging && "opacity-30 pointer-events-none",
      )}
    >
      {(onArchive || onDelete) && (
        <div className="absolute right-7 top-1.5 z-10 flex gap-1">
          {onArchive && (
            <button
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onArchive(lead);
              }}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 bg-background/95 text-muted-foreground opacity-80 shadow-sm transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:opacity-100 focus-visible:opacity-100"
              title="Arquivar oportunidade"
              aria-label="Arquivar oportunidade"
            >
              <Archive className="size-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(lead);
              }}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 bg-background/95 text-muted-foreground opacity-80 shadow-sm transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100"
              title="Excluir oportunidade"
              aria-label="Excluir oportunidade"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Bolinha de temperatura no canto */}
      <span
        title={`Temperatura: ${temp.label}`}
        className={cn("absolute right-3 top-3 size-2 rounded-full", temp.glow)}
        style={{
          background: `var(--${lead.temperatura === "frio" ? "info" : lead.temperatura === "morno" ? "warning" : "destructive"})`,
        }}
      />

      {/* Empresa */}
      <p className="flex items-center gap-1.5 pr-20 text-[14px] font-semibold leading-tight text-foreground">
        <Buildings2
          size={14}
          color="currentColor"
          variant="Linear"
          className="shrink-0 text-primary"
        />{" "}
        {empresa?.nome}
      </p>

      {/* Contato */}
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Profile
          size={14}
          color="currentColor"
          variant="Linear"
          className="shrink-0 text-primary"
        />{" "}
        {contato?.nome}
      </p>

      {/* Valor */}
      <div className="mt-3 flex items-center justify-between">
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">
          <DollarCircle
            size={16}
            color="currentColor"
            variant="Linear"
            className="mr-1 inline align-[-2px] text-primary"
          />{" "}
          {fmtBRL(lead.valor)}
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            temp.text,
          )}
        >
          <TempIcon className="size-3" /> {temp.label}
        </span>
      </div>

      {/* Próxima ação — bloco destacado */}
      <div
        className={cn(
          "mt-3 rounded-lg border px-2.5 py-2",
          semAcao && "border-destructive/30 bg-destructive/5",
          !semAcao && atrasada && "border-destructive/30 bg-destructive/5",
          !semAcao && !atrasada && "border-border/60 bg-surface-1/60",
        )}
      >
        {semAcao ? (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive">
            <Danger size={12} color="currentColor" variant="Linear" /> Sem próxima ação
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar size={12} color="currentColor" variant="Linear" className="text-primary" />{" "}
              Próxima ação
            </div>
            <p className="mt-0.5 truncate text-[12px] font-medium text-foreground">
              {lead.proximaAcao!.titulo}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[10px] tabular-nums",
                atrasada ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {atrasada ? "Atrasada · " : ""}
              {quando(lead.proximaAcao!.data)}
            </p>
          </>
        )}
      </div>

      {/* Responsável */}
      <p className="mt-2.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {lead.responsavel}
      </p>
    </div>
  );
}
