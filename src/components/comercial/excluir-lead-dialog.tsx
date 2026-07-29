import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { comercial, getEmpresa, type Lead } from "@/lib/hooks/useComercial";

export function ExcluirLeadDialog({
  lead,
  onOpenChange,
  onDeleted,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const empresa = lead ? getEmpresa(lead.empresaId) : null;

  useEffect(() => {
    if (!lead) setConfirmacao("");
  }, [lead]);

  const excluir = async () => {
    if (!lead || confirmacao.trim() !== "EXCLUIR") return;
    setExcluindo(true);
    const ok = await comercial.removerLead(lead.id);
    setExcluindo(false);
    if (!ok) return;
    toast.success("Oportunidade excluída definitivamente.");
    setConfirmacao("");
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(open) => !excluindo && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir oportunidade definitivamente</DialogTitle>
          <DialogDescription>
            O lead de <strong className="text-foreground">{empresa?.nome}</strong> e seu histórico
            comercial serão removidos. Projetos já criados permanecem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Digite <strong className="text-foreground">EXCLUIR</strong> para confirmar.
          </p>
          <Input
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="EXCLUIR"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={excluindo} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={excluindo || confirmacao.trim() !== "EXCLUIR"}
            onClick={() => void excluir()}
          >
            <Trash2 className="size-4" />
            {excluindo ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
