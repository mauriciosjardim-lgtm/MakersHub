import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { comercial } from "@/lib/hooks/useComercial";
import { isValidEmail } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

export function NovoContatoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [principal, setPrincipal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const limpar = () => {
    setNome("");
    setEmpresa("");
    setCargo("");
    setEmail("");
    setTelefone("");
    setPrincipal(false);
  };

  const salvar = async () => {
    if (!nome.trim() || !empresa.trim()) {
      toast.error("Nome e empresa são obrigatórios.");
      return;
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSalvando(true);
    const resultado = await comercial.criarContatoAvulso({
      nome,
      empresaNome: empresa,
      cargo,
      email,
      telefone,
      principal,
    });
    setSalvando(false);
    if (!resultado) {
      toast.error("Não foi possível salvar o contato.");
      return;
    }
    if (resultado.existente) {
      toast.info("Esse contato já estava cadastrado. Nenhuma cópia foi criada.");
    } else {
      toast.success(`${nome.trim()} foi adicionado à base de contatos.`);
    }
    limpar();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) limpar();
        onOpenChange(aberto);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <UserPlus className="size-5" />
            </span>
            <div>
              <DialogTitle>Novo contato</DialogTitle>
              <DialogDescription>
                Salve uma pessoa sem precisar criar lead ou projeto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <Campo label="Nome *">
            <Input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ana Souza"
              autoFocus
            />
          </Campo>
          <Campo label="Empresa *">
            <Input
              value={empresa}
              onChange={(event) => setEmpresa(event.target.value)}
              placeholder="Nome da empresa"
            />
            <p className="text-[10px] leading-4 text-muted-foreground">
              Se ainda não existir, a empresa será criada automaticamente.
            </p>
          </Campo>
          <Campo label="Cargo">
            <Input
              value={cargo}
              onChange={(event) => setCargo(event.target.value)}
              placeholder="Diretora de marketing"
            />
          </Campo>
          <Campo label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ana@empresa.com"
            />
          </Campo>
          <Campo label="Telefone">
            <PhoneInput value={telefone} onValueChange={setTelefone} />
          </Campo>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5 text-xs">
            <Checkbox
              checked={principal}
              onCheckedChange={(valor) => setPrincipal(valor === true)}
            />
            Contato principal da empresa
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
