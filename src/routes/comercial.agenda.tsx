import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useComercial, getEmpresa, getContato } from "@/lib/hooks/useComercial";
import { LeadDrawer } from "@/components/comercial/lead-drawer";
import { EtapaIcon } from "@/components/comercial/etapa-icon";
import { format, isSameDay, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comercial/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const leads = useComercial((s) => s.leads);
  const [open, setOpen] = useState<string | null>(null);

  const dias = useMemo(() => {
    const inicio = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  }, []);

  const acoes = leads.filter((l) => l.proximaAcao);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Semana de {format(dias[0], "dd 'de' MMM", { locale: ptBR })} a{" "}
        {format(dias[6], "dd 'de' MMM", { locale: ptBR })}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {dias.map((dia) => {
          const doDia = acoes.filter((l) => isSameDay(new Date(l.proximaAcao!.data), dia));
          const ehHoje = isSameDay(dia, new Date());
          return (
            <div
              key={dia.toISOString()}
              className={cn(
                "min-h-[220px] rounded-xl border bg-surface-1/40 p-3",
                ehHoje ? "border-primary/40 ring-1 ring-primary/30" : "border-border",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(dia, "EEE", { locale: ptBR })}
                  </p>
                  <p className={cn("font-display text-lg font-semibold", ehHoje && "text-primary")}>
                    {format(dia, "dd")}
                  </p>
                </div>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {doDia.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {doDia.map((l) => {
                  const e = getEmpresa(l.empresaId);
                  const c = getContato(l.contatoId);
                  return (
                    <button
                      key={l.id}
                      onClick={() => setOpen(l.id)}
                      className="w-full rounded-lg border border-border/60 bg-card p-2 text-left transition hover:border-primary/40"
                    >
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {format(new Date(l.proximaAcao!.data), "HH:mm")}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium">{l.proximaAcao!.titulo}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                        <EtapaIcon etapa={l.etapa} className="size-3" /> {e?.nome} · {c?.nome}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <LeadDrawer leadId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
