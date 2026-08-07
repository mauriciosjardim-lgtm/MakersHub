import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Add, Buildings2 } from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { comercial } from "@/lib/hooks/useComercial";
import { CORES_PROJETO } from "@/lib/mock/projetos";

export function ClienteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: { id: string; nome: string }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CORES_PROJETO[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setColor(CORES_PROJETO[0]);
    }
  }, [open]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const client = await comercial.criarCliente({ nome: name.trim(), accentColor: color });
      if (!client) throw new Error();
      toast.success("Cliente criado. Agora você pode adicionar os projetos dele.");
      onCreated(client);
    } catch {
      toast.error("Não foi possível criar o cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="kb-form-dialog max-w-[560px] gap-0 overflow-hidden p-0">
        <DialogHeader className="kb-form-header border-b border-white/[.07] px-5 py-5 pr-14 sm:px-6">
          <div className="flex items-start gap-3.5">
            <span className="kb-form-icon grid size-11 shrink-0 place-items-center rounded-xl">
              <Buildings2 size={22} color="currentColor" variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-2xl font-bold tracking-[-.025em]">
                Novo cliente
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed">
                Crie o workspace que reunirá projetos, equipe e entregas deste cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <section className="kb-form-section space-y-2 p-4">
            <Label className="kb-form-label">Nome do cliente</Label>
            <Input
              className="kb-form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Aurora Café"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && void save()}
            />
            <p className="text-xs leading-relaxed text-[var(--kb-text-muted)]">
              Use o nome pelo qual sua equipe reconhece o cliente no dia a dia.
            </p>
          </section>
          <section className="kb-form-section space-y-3 p-4">
            <div>
              <Label className="kb-form-label">Identidade do cliente</Label>
              <p className="mt-1 text-xs leading-relaxed text-[var(--kb-text-muted)]">
                Essa cor identifica o cliente nos projetos, filtros e indicadores.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/[.07] bg-black/10 p-3">
              {CORES_PROJETO.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Selecionar ${item}`}
                  onClick={() => setColor(item)}
                  style={{ backgroundColor: item }}
                  className={`size-8 rounded-full transition-[transform,opacity,box-shadow] ${
                    color === item
                      ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-[oklch(0.18_0.008_260)]"
                      : "opacity-65 hover:scale-105 hover:opacity-100"
                  }`}
                />
              ))}
              <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-[var(--kb-text-muted)]">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-mono">{color}</span>
              </div>
            </div>
          </section>
        </div>
        <DialogFooter className="kb-form-footer flex-row justify-end gap-2 border-t border-white/[.07] px-5 py-4 sm:px-6">
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="h-11 rounded-xl px-5 font-bold"
            onClick={save}
            disabled={!name.trim() || saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {!saving && <Add size={18} color="currentColor" variant="Linear" />}
            Criar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
