import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Archive, ArchiveRestore, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  comercial,
  fmtBRL,
  useComercial,
  useEtapasComercial,
  type EtapaJornada,
  type Lead,
} from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";
import { EtapaIcon } from "./etapa-icon";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";

export function JornadaBoard({ filtroFn }: { filtroFn?: (lead: Lead) => boolean }) {
  const leads = useComercial((store) => store.leads);
  const leadsArquivados = useComercial((store) => store.leadsArquivados);
  const etapas = useEtapasComercial();
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const origem = mostrarArquivados ? leadsArquivados : leads;
  const filtrados = useMemo(
    () => (filtroFn ? origem.filter(filtroFn) : origem),
    [filtroFn, origem],
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(event: DragStartEvent) {
    if (mostrarArquivados) return;
    setActiveLead(leads.find((lead) => lead.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    if (mostrarArquivados) return;
    const leadId = event.active.id as string;
    const destino = event.over?.id as EtapaJornada | undefined;
    if (!destino) return;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.etapa === destino) return;
    const sucesso = await comercial.moverEtapa(leadId, destino);
    if (sucesso) {
      toast.success(`Movido para ${etapas.find((etapa) => etapa.id === destino)?.label}.`);
    }
  }

  const arquivar = async (leadId: string, arquivado: boolean) => {
    const sucesso = await comercial.arquivarLead(leadId, arquivado);
    if (!sucesso) return;
    toast.success(arquivado ? "Oportunidade arquivada." : "Oportunidade restaurada.");
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Clique no título de uma coluna para personalizar sua jornada.
        </p>
        <Button
          type="button"
          variant={mostrarArquivados ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setMostrarArquivados((valor) => !valor)}
        >
          {mostrarArquivados ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {mostrarArquivados ? "Voltar às oportunidades" : `Arquivadas (${leadsArquivados.length})`}
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {etapas.map((etapa) => {
            const dela = filtrados.filter((lead) => lead.etapa === etapa.id);
            const total = dela.reduce((soma, lead) => soma + lead.valor, 0);
            return (
              <Coluna
                key={etapa.id}
                etapa={etapa.id}
                label={etapa.label}
                cor={etapa.cor}
                qtd={dela.length}
                total={total}
                vazioArquivado={mostrarArquivados}
                onRename={async (novoLabel) => {
                  const sucesso = await comercial.renomearEtapa(etapa.id, novoLabel);
                  if (sucesso) toast.success("Nome da etapa atualizado.");
                  return sucesso;
                }}
              >
                {dela.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onOpen={setOpenLead}
                    onArchive={(id, valor) => void arquivar(id, valor)}
                    dragDisabled={mostrarArquivados}
                  />
                ))}
              </Coluna>
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeLead && (
            <div className="rotate-2 opacity-95 shadow-2xl">
              <LeadCard lead={activeLead} onOpen={() => {}} dragDisabled />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
    </>
  );
}

function Coluna({
  etapa,
  label,
  cor,
  qtd,
  total,
  vazioArquivado,
  onRename,
  children,
}: {
  etapa: EtapaJornada;
  label: string;
  cor: string;
  qtd: number;
  total: number;
  vazioArquivado: boolean;
  onRename: (label: string) => Promise<boolean>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-2xl border border-border bg-surface-1/40 transition",
        isOver && "border-primary/60 bg-surface-2/60 ring-2 ring-primary/30",
      )}
    >
      <div className="group/column relative overflow-hidden rounded-t-2xl border-b border-border/60 bg-gradient-to-b from-surface-2/60 to-transparent px-4 py-3.5">
        <span
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: cor, boxShadow: `0 0 12px ${cor}` }}
          aria-hidden
        />
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <EtapaIcon etapa={etapa} className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <TituloEditavel label={label} onSave={onRename} />
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {qtd} {qtd === 1 ? "oportunidade" : "oportunidades"}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-2 font-display text-base font-semibold tabular-nums tracking-tight text-foreground">
          {fmtBRL(total)}
        </p>
      </div>
      <div className="flex min-h-[200px] flex-col gap-2.5 p-2.5">
        {children}
        {qtd === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground">
            {vazioArquivado ? "Nenhuma oportunidade arquivada" : "Solte uma oportunidade aqui"}
          </div>
        )}
      </div>
    </div>
  );
}

function TituloEditavel({
  label,
  onSave,
}: {
  label: string;
  onSave: (label: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(label);
  const [salvando, setSalvando] = useState(false);

  if (!editando) {
    return (
      <button
        type="button"
        className="flex max-w-full items-center gap-1.5 rounded-md text-left text-[13px] font-semibold text-foreground outline-none transition hover:text-primary focus-visible:ring-1 focus-visible:ring-primary/40"
        onClick={() => {
          setValor(label);
          setEditando(true);
        }}
        title="Editar nome da etapa"
      >
        <span className="truncate">{label}</span>
        <Pencil className="size-3 shrink-0 opacity-0 transition group-hover/column:opacity-60" />
      </button>
    );
  }

  const cancelar = () => {
    setValor(label);
    setEditando(false);
  };
  const salvar = async () => {
    const proximo = valor.trim();
    if (!proximo || proximo === label) {
      cancelar();
      return;
    }
    setSalvando(true);
    const salvo = await onSave(proximo);
    setSalvando(false);
    if (salvo) setEditando(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={valor}
        onChange={(event) => setValor(event.target.value.slice(0, 40))}
        onKeyDown={(event) => {
          if (event.key === "Enter") void salvar();
          if (event.key === "Escape") cancelar();
        }}
        className="h-7 min-w-0 flex-1 border-primary/50 bg-background px-2 text-xs"
        maxLength={40}
        autoFocus
        disabled={salvando}
        aria-label="Nome da etapa"
      />
      <button
        type="button"
        onClick={() => void salvar()}
        disabled={salvando}
        className="grid size-7 shrink-0 place-items-center rounded-md text-primary hover:bg-primary/10"
        aria-label="Salvar nome"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={cancelar}
        disabled={salvando}
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-surface-2"
        aria-label="Cancelar edição"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
