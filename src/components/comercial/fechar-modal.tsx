import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kanban, MagicStar } from "iconsax-react";
import { toast } from "sonner";
import { comercial, getEmpresa, type Lead } from "@/lib/hooks/useComercial";

export function FecharModal({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const empresa = getEmpresa(lead.empresaId);
  const [salvando, setSalvando] = useState<"projeto" | "depois" | null>(null);

  const confirmar = async (criarProjeto: boolean) => {
    if (salvando) return;
    setSalvando(criarProjeto ? "projeto" : "depois");
    let resultado = null;
    try {
      resultado = await comercial.fecharLead(lead.id, criarProjeto);
    } finally {
      setSalvando(null);
    }
    if (!resultado) {
      toast.error("Não foi possível fechar o lead. Nenhuma alteração foi feita.");
      return;
    }

    toast.success(
      criarProjeto
        ? "Lead fechado e cliente criado em Projetos."
        : "Lead fechado. Você pode criar o projeto quando quiser.",
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !salvando && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid size-14 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <MagicStar size={28} color="currentColor" variant="Linear" className="text-primary" />
          </div>
          <DialogTitle className="text-center font-display text-xl">
            Você deseja criar o cliente na seção de Projetos?
          </DialogTitle>
          <DialogDescription className="text-center">
            O cliente <strong className="text-foreground">{empresa?.nome}</strong> está pronto para
            virar um card em Projetos.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={!!salvando} onClick={() => confirmar(false)}>
            {salvando === "depois" ? "Fechando…" : "Deixar para depois"}
          </Button>
          <Button disabled={!!salvando} onClick={() => confirmar(true)} className="gap-2">
            <Kanban size={16} color="currentColor" variant="Linear" />
            {salvando === "projeto" ? "Criando…" : "Sim, criar em Projetos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
