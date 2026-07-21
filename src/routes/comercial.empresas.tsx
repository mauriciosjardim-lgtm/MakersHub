import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { comercial, useComercial, getContatosDaEmpresa, fmtBRL, type Empresa } from "@/lib/hooks/useComercial";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Buildings2, Location, Profile2User, Trash } from "iconsax-react";
import { toast } from "sonner";

export const Route = createFileRoute("/comercial/empresas")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const empresas = useComercial(s => s.empresas);
  const leads = useComercial(s => s.leads);
  const { projetos } = useProjetos();
  const [empresaParaExcluir, setEmpresaParaExcluir] = useState<Empresa | null>(null);

  if (empresas.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/40 p-10 text-center text-sm text-muted-foreground">
        Nenhuma empresa ainda. Elas aparecem aqui automaticamente quando você cadastra leads.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {empresas.map(e => {
        const contatos = getContatosDaEmpresa(e.id);
        const leadsEmp = leads.filter(l => l.empresaId === e.id);
        const valor = leadsEmp.reduce((s, l) => s + l.valor, 0);
        return (
          <div key={e.id} className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15">
                <Buildings2 size={20} color="currentColor" variant="Linear" className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.nome}</p>
                <p className="text-[11px] text-muted-foreground">{e.segmento}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={() => setEmpresaParaExcluir(e)}
                aria-label={`Excluir ${e.nome}`}
                title="Excluir empresa"
              >
                <Trash size={16} color="currentColor" variant="Linear" />
              </Button>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Location size={12} color="currentColor" variant="Linear" className="text-primary" /> {e.cidade}</p>
              <p className="flex items-center gap-1.5"><Profile2User size={12} color="currentColor" variant="Linear" className="text-primary" /> {contatos.length} contato(s)</p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-[11px] text-muted-foreground">{leadsEmp.length} lead(s)</span>
              <span className="font-display text-sm font-semibold tabular-nums">{fmtBRL(valor)}</span>
            </div>
          </div>
        );
      })}
      <ExcluirEmpresaDialog
        empresa={empresaParaExcluir}
        quantidadeOportunidades={empresaParaExcluir ? leads.filter((lead) => lead.empresaId === empresaParaExcluir.id).length : 0}
        quantidadeProjetos={empresaParaExcluir ? projetos.filter((projeto) =>
          projeto.clienteId === empresaParaExcluir.id ||
          projeto.cliente.toLocaleLowerCase("pt-BR") === empresaParaExcluir.nome.toLocaleLowerCase("pt-BR")
        ).length : 0}
        onClose={() => setEmpresaParaExcluir(null)}
      />
    </div>
  );
}

function ExcluirEmpresaDialog({
  empresa,
  quantidadeOportunidades,
  quantidadeProjetos,
  onClose,
}: {
  empresa: Empresa | null;
  quantidadeOportunidades: number;
  quantidadeProjetos: number;
  onClose: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const possuiVinculos = quantidadeProjetos > 0 || quantidadeOportunidades > 0;

  const fechar = () => {
    if (excluindo) return;
    setConfirmacao("");
    onClose();
  };

  const excluir = async () => {
    if (!empresa || possuiVinculos || confirmacao.trim() !== empresa.nome) return;
    setExcluindo(true);
    const removida = await comercial.removerEmpresa(empresa.id);
    setExcluindo(false);
    if (!removida) return;
    toast.success("Empresa excluída");
    fechar();
  };

  return (
    <Dialog open={Boolean(empresa)} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Excluir empresa</DialogTitle>
        </DialogHeader>
        {possuiVinculos ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-destructive/35 bg-destructive/[.07] p-3 text-xs leading-5 text-muted-foreground">
              Esta empresa não pode ser excluída enquanto possuir histórico comercial ou projetos vinculados.
            </div>
            <p className="text-xs text-muted-foreground">
              Bloqueado: {quantidadeProjetos} projeto(s) e {quantidadeOportunidades} oportunidade(s) vinculada(s).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/35 bg-destructive/[.07] p-3 text-xs leading-5 text-muted-foreground">
              Esta ação remove definitivamente o cadastro da empresa e seus contatos. Ela não poderá ser desfeita.
            </div>
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">
                Digite <strong className="text-foreground">{empresa?.nome}</strong> para confirmar.
              </span>
              <Input
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                placeholder={empresa?.nome}
                autoFocus
              />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={excluindo}>Cancelar</Button>
          {!possuiVinculos && (
            <Button
              variant="destructive"
              onClick={excluir}
              disabled={excluindo || confirmacao.trim() !== empresa?.nome}
            >
              <Trash size={15} color="currentColor" variant="Linear" />
              {excluindo ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
