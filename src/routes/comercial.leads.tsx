import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useComercial,
  useEtapasComercial,
  getEmpresa,
  getContato,
  fmtBRL,
} from "@/lib/hooks/useComercial";
import { FiltrosBar, aplicarFiltro, filtroInicial } from "@/components/comercial/filtros-bar";
import { LeadDrawer } from "@/components/comercial/lead-drawer";
import { EtapaIcon } from "@/components/comercial/etapa-icon";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comercial/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const leads = useComercial((s) => s.leads);
  const etapas = useEtapasComercial();
  const [filtro, setFiltro] = useState(filtroInicial);
  const [open, setOpen] = useState<string | null>(null);
  const filtrados = useMemo(() => aplicarFiltro(leads, filtro), [leads, filtro]);

  return (
    <div className="space-y-4">
      <FiltrosBar value={filtro} onChange={setFiltro} />
      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/40">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Empresa</Th>
              <Th>Contato</Th>
              <Th>Etapa</Th>
              <Th>Valor</Th>
              <Th>Resp.</Th>
              <Th>Temp.</Th>
              <Th>Próxima ação</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => {
              const e = getEmpresa(l.empresaId);
              const c = getContato(l.contatoId);
              const et = etapas.find((x) => x.id === l.etapa)!;
              return (
                <tr
                  key={l.id}
                  onClick={() => setOpen(l.id)}
                  className="cursor-pointer border-t border-border/60 transition hover:bg-surface-2/40"
                >
                  <Td>
                    <div className="font-medium">{e?.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{e?.cidade}</div>
                  </Td>
                  <Td>
                    {c?.nome}
                    <div className="text-[11px] text-muted-foreground">{c?.email}</div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px]">
                      <EtapaIcon etapa={et.id} className="size-3" /> {et.label}
                    </span>
                  </Td>
                  <Td className="tabular-nums">{fmtBRL(l.valor)}</Td>
                  <Td>{l.responsavel}</Td>
                  <Td
                    className={cn(
                      "text-[11px] capitalize",
                      l.temperatura === "quente" && "text-destructive",
                      l.temperatura === "morno" && "text-warning",
                      l.temperatura === "frio" && "text-info",
                    )}
                  >
                    {l.temperatura}
                  </Td>
                  <Td>
                    {l.proximaAcao ? (
                      <span>
                        {l.proximaAcao.titulo}{" "}
                        <span className="text-[11px] text-muted-foreground">
                          · {format(new Date(l.proximaAcao.data), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-destructive">Sem próxima ação</span>
                    )}
                  </Td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <LeadDrawer leadId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-2.5 text-left font-semibold">{children}</th>
);
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-top", className)}>{children}</td>
);
