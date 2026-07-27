import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useComercial, getEmpresa, getContato } from "@/lib/hooks/useComercial";
import { LeadDrawer } from "@/components/comercial/lead-drawer";
import { EtapaIcon } from "@/components/comercial/etapa-icon";
import { Notification, Danger, ArrowRight2 } from "iconsax-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comercial/followups")({
  component: FollowupsPage,
});

function FollowupsPage() {
  const leads = useComercial((s) => s.leads);
  const [open, setOpen] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const atrasados: typeof leads = [];
    const hoje: typeof leads = [];
    const amanha: typeof leads = [];
    const futuros: typeof leads = [];
    const sem: typeof leads = [];
    for (const l of leads) {
      if (l.etapa === "fechado" || l.etapa === "perdido") continue;
      if (!l.proximaAcao) {
        sem.push(l);
        continue;
      }
      const d = new Date(l.proximaAcao.data);
      if (isPast(d) && !isToday(d)) atrasados.push(l);
      else if (isToday(d)) hoje.push(l);
      else if (isTomorrow(d)) amanha.push(l);
      else futuros.push(l);
    }
    return { atrasados, hoje, amanha, futuros, sem };
  }, [leads]);

  const total =
    grupos.atrasados.length +
    grupos.hoje.length +
    grupos.amanha.length +
    grupos.futuros.length +
    grupos.sem.length;

  return (
    <div className="space-y-5">
      {total === 0 && (
        <div className="rounded-xl border border-border bg-surface-1/40 p-10 text-center text-sm text-muted-foreground">
          Nenhum follow-up pendente. Cadastre leads e defina a próxima ação para acompanhar tudo
          aqui.
        </div>
      )}
      <Secao titulo="Atrasados" tone="destructive" leads={grupos.atrasados} onOpen={setOpen} />
      <Secao
        titulo="Sem próxima ação"
        tone="destructive"
        leads={grupos.sem}
        onOpen={setOpen}
        hint="Defina uma próxima ação para não perder o ritmo."
      />
      <Secao titulo="Hoje" tone="primary" leads={grupos.hoje} onOpen={setOpen} />
      <Secao titulo="Amanhã" tone="default" leads={grupos.amanha} onOpen={setOpen} />
      <Secao titulo="Futuros" tone="default" leads={grupos.futuros} onOpen={setOpen} />
      <LeadDrawer leadId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Secao({
  titulo,
  leads,
  tone,
  onOpen,
  hint,
}: {
  titulo: string;
  leads: import("@/lib/hooks/useComercial").Lead[];
  tone: "default" | "primary" | "destructive";
  onOpen: (id: string) => void;
  hint?: string;
}) {
  if (leads.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Notification
          size={14}
          color="currentColor"
          variant="Linear"
          className={cn(
            "text-primary",
            tone === "destructive" && "text-destructive",
            tone === "primary" && "text-primary",
            tone === "default" && "text-primary",
          )}
        />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">{titulo}</h2>
        <span className="text-[11px] text-muted-foreground">· {leads.length}</span>
      </div>
      {hint && <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface-1/40">
        {leads.map((l) => {
          const e = getEmpresa(l.empresaId);
          const c = getContato(l.contatoId);
          return (
            <li key={l.id}>
              <button
                onClick={() => onOpen(l.id)}
                className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-surface-2/40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15">
                  <EtapaIcon etapa={l.etapa} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e?.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c?.nome} · {l.responsavel}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  {l.proximaAcao ? (
                    <>
                      <p className="truncate text-xs">{l.proximaAcao.titulo}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {format(new Date(l.proximaAcao.data), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                      <Danger size={12} color="currentColor" variant="Linear" /> Sem próxima ação
                    </span>
                  )}
                </div>
                <ArrowRight2
                  size={16}
                  color="currentColor"
                  variant="Linear"
                  className="shrink-0 text-primary"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
