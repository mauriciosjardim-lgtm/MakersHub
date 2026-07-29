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
import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  comercial,
  fmtBRL,
  getEmpresa,
  useComercial,
  useEtapasComercial,
  type EtapaJornada,
  type Lead,
} from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";
import { EtapaIcon } from "./etapa-icon";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { FecharModal } from "./fechar-modal";
import { ExcluirLeadDialog } from "./excluir-lead-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function JornadaBoard({ filtroFn }: { filtroFn?: (lead: Lead) => boolean }) {
  const leads = useComercial((store) => store.leads);
  const leadsArquivados = useComercial((store) => store.leadsArquivados);
  const etapas = useEtapasComercial();
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [leadParaArquivar, setLeadParaArquivar] = useState<Lead | null>(null);
  const [leadParaExcluir, setLeadParaExcluir] = useState<Lead | null>(null);
  const [leadParaFechar, setLeadParaFechar] = useState<Lead | null>(null);
  const [motivoArquivo, setMotivoArquivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const filtrados = useMemo(() => (filtroFn ? leads.filter(filtroFn) : leads), [filtroFn, leads]);
  const arquivados = useMemo(
    () => (filtroFn ? leadsArquivados.filter(filtroFn) : leadsArquivados),
    [filtroFn, leadsArquivados],
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(event: DragStartEvent) {
    setActiveLead(leads.find((lead) => lead.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const leadId = event.active.id as string;
    const destino = event.over?.id as EtapaJornada | undefined;
    if (!destino) return;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.etapa === destino) return;
    if (destino === "fechado") {
      setLeadParaFechar(lead);
      return;
    }
    const sucesso = await comercial.moverEtapa(leadId, destino);
    if (sucesso) {
      toast.success(`Movido para ${etapas.find((etapa) => etapa.id === destino)?.label}.`);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {filtrados.length}{" "}
          {filtrados.length === 1 ? "oportunidade ativa" : "oportunidades ativas"}
        </p>
        <Button
          type="button"
          variant={mostrarArquivados ? "secondary" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setMostrarArquivados((valor) => !valor)}
        >
          <Archive className="size-4" />
          Arquivadas ({arquivados.length})
        </Button>
      </div>

      {mostrarArquivados && (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-1/35">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold">Arquivo comercial</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Oportunidades fora da jornada ativa. Restaure ou exclua definitivamente.
            </p>
          </div>
          {arquivados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma oportunidade arquivada.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {arquivados.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenLead(lead.id)}
                  >
                    <p className="truncate text-sm font-semibold">
                      {getEmpresa(lead.empresaId)?.nome ?? "Empresa"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {etapas.find((etapa) => etapa.id === lead.etapaAntesArquivar)?.label ??
                        etapas.find((etapa) => etapa.id === lead.etapa)?.label}
                      {lead.arquivadoEm
                        ? ` · arquivada em ${format(new Date(lead.arquivadoEm), "dd/MM/yyyy", { locale: ptBR })}`
                        : ""}
                    </p>
                    {lead.motivoArquivamento && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lead.motivoArquivamento}
                      </p>
                    )}
                  </button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={async () => {
                        const ok = await comercial.restaurarLead(lead.id);
                        if (ok) toast.success("Oportunidade restaurada para a jornada.");
                      }}
                    >
                      <ArchiveRestore className="size-3.5" /> Restaurar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setLeadParaExcluir(lead)}
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
                    onArchive={setLeadParaArquivar}
                    onDelete={setLeadParaExcluir}
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
      {leadParaFechar && (
        <FecharModal
          lead={leadParaFechar}
          open
          onOpenChange={(open) => !open && setLeadParaFechar(null)}
        />
      )}

      <Dialog open={!!leadParaArquivar} onOpenChange={(open) => !open && setLeadParaArquivar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar oportunidade</DialogTitle>
            <DialogDescription>
              Ela sairá da jornada ativa e poderá ser restaurada depois.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={motivoArquivo}
            onChange={(event) => setMotivoArquivo(event.target.value)}
            placeholder="Motivo do arquivamento (opcional)"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={processando}
              onClick={() => setLeadParaArquivar(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={processando}
              onClick={async () => {
                if (!leadParaArquivar) return;
                setProcessando(true);
                const ok = await comercial.arquivarLead(leadParaArquivar.id, motivoArquivo);
                setProcessando(false);
                if (!ok) return;
                toast.success("Oportunidade arquivada.");
                setMotivoArquivo("");
                setLeadParaArquivar(null);
              }}
            >
              {processando ? "Arquivando…" : "Arquivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcluirLeadDialog
        lead={leadParaExcluir}
        onOpenChange={(open) => !open && setLeadParaExcluir(null)}
      />
    </>
  );
}

function Coluna({
  etapa,
  label,
  cor,
  qtd,
  total,
  onRename,
  children,
}: {
  etapa: EtapaJornada;
  label: string;
  cor: string;
  qtd: number;
  total: number;
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
            Solte uma oportunidade aqui
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
