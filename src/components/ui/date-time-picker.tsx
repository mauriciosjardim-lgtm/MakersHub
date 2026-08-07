import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "iconsax-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function localValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function maskTime(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3 && Number(digits[0]) > 2) return `${digits[0]}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecionar data e hora",
  hideTime = false,
  onlyTime = false,
  maskedTime = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hideTime?: boolean;
  onlyTime?: boolean;
  maskedTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => (value ? new Date(value) : undefined), [value]);
  const valido = selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  const hora = valido ? format(valido, "HH:mm") : "10:00";
  const [timeDraft, setTimeDraft] = useState(hora);

  useEffect(() => setTimeDraft(hora), [hora]);

  const selecionarDia = (dia?: Date) => {
    if (!dia) return;
    const [h, m] = hora.split(":").map(Number);
    dia.setHours(h, m, 0, 0);
    onChange(localValue(dia));
    setOpen(false);
  };

  const alterarHora = (novaHora: string) => {
    const base = valido ? new Date(valido) : new Date();
    const [h, m] = novaHora.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    onChange(localValue(base));
  };

  const atualizarHoraMascarada = (texto: string) => {
    const masked = maskTime(texto);
    const match = masked.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      setTimeDraft(masked);
      return;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      setTimeDraft(hora);
      return;
    }
    const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    setTimeDraft(normalized);
    alterarHora(normalized);
  };

  const confirmarHoraMascarada = () => {
    const match = timeDraft.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      setTimeDraft(hora);
      return;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      setTimeDraft(hora);
      return;
    }
    const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    setTimeDraft(normalized);
    alterarHora(normalized);
  };

  const timeInput = maskedTime ? (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={timeDraft}
      onChange={(e) => atualizarHoraMascarada(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={confirmarHoraMascarada}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
      maxLength={5}
      placeholder="HH:mm"
      aria-label="Horário"
      className="kb-time-input min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm"
    />
  ) : (
    <input
      type="time"
      value={hora}
      onChange={(e) => alterarHora(e.target.value)}
      className="kb-time-input min-w-0 flex-1 bg-transparent text-base outline-none [color-scheme:dark] md:text-sm"
    />
  );

  if (onlyTime)
    return (
      <label className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/35">
        <Clock size={15} color="currentColor" className="shrink-0 text-primary" />
        {timeInput}
      </label>
    );
  return (
    <div
      className={cn(
        "grid gap-2",
        hideTime ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_112px]",
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base shadow-sm transition hover:border-primary/35 focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 md:text-sm",
              !valido && "text-muted-foreground",
            )}
          >
            <CalendarIcon size={15} color="currentColor" className="shrink-0 text-primary" />
            <span className="truncate">
              {valido ? format(valido, "dd MMM yyyy", { locale: ptBR }) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto overflow-hidden rounded-xl border-border/70 bg-popover p-0 shadow-2xl"
        >
          <Calendar
            mode="single"
            selected={valido}
            onSelect={selecionarDia}
            locale={ptBR}
            initialFocus
          />
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            <span className="text-[10px] text-muted-foreground">Escolha o dia</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-[10px] text-primary"
              >
                Limpar
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {!hideTime && (
        <label className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/35">
          <Clock size={14} color="currentColor" className="shrink-0 text-primary" />
          {timeInput}
        </label>
      )}
    </div>
  );
}
