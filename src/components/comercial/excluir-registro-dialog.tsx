import { useState, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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

export function ExcluirRegistroDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  bloqueio,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: ReactNode;
  bloqueio?: string;
  onConfirm: () => Promise<boolean>;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const fechar = () => {
    if (excluindo) return;
    setConfirmacao("");
    onOpenChange(false);
  };

  const excluir = async () => {
    if (bloqueio || confirmacao.trim() !== "EXCLUIR") return;
    setExcluindo(true);
    const excluido = await onConfirm();
    setExcluindo(false);
    if (excluido) {
      setConfirmacao("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{titulo}</DialogTitle>
          <DialogDescription className="sr-only">
            Confirme a exclusão definitiva deste registro comercial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/[.07] p-3 text-xs leading-5 text-muted-foreground">
            {descricao}
          </div>
          {bloqueio ? (
            <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3 text-xs leading-5 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>{bloqueio}</span>
            </div>
          ) : (
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">
                Digite <strong className="text-foreground">EXCLUIR</strong> para confirmar.
              </span>
              <Input
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                placeholder="EXCLUIR"
                autoFocus
              />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void excluir()}
            disabled={Boolean(bloqueio) || excluindo || confirmacao.trim() !== "EXCLUIR"}
          >
            <Trash2 className="size-4" />
            {excluindo ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
