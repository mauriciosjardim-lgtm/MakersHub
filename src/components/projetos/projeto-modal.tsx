import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CORES_PROJETO,
  resolverCorProjeto,
  type Projeto,
  type FaseProjeto,
} from "@/lib/mock/projetos";
// Select de fase removido: a fase é definida pelos cards do kanban na tela do projeto
import { projetosActions } from "@/lib/hooks/useProjetos";
import { comercial } from "@/lib/hooks/useComercial";
import { MembrosSelect } from "@/components/projetos/membros-select";
import { Trash } from "iconsax-react";
import { useAuth } from "@/lib/auth";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { toast } from "sonner";

const toDate = (iso?: string | null) => iso?.slice(0, 10) ?? "";
const fromDate = (s: string) => {
  const [ano, mes, dia] = s.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia, 12, 0, 0, 0);
  return d.toISOString();
};

export function ProjetoModal({
  open,
  onClose,
  projeto,
  clienteInicial,
  clienteIdInicial,
}: {
  open: boolean;
  onClose: () => void;
  projeto?: Projeto | null;
  clienteInicial?: string;
  clienteIdInicial?: string;
}) {
  const { usuario } = useAuth();
  const { projetos } = useProjetos();
  const podeVerValor = usuario?.role === "admin";
  const editando = !!projeto;
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fase, setFase] = useState<FaseProjeto>("briefing");
  const [equipe, setEquipe] = useState<string[]>([]);
  const [valor, setValor] = useState(0);
  const [dataInicio, setDataInicio] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [modoData, setModoData] = useState<"sem_data" | "entrega" | "periodo">("sem_data");
  const [cor, setCor] = useState(CORES_PROJETO[0]);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const coresEmUso = projetos.filter(
    (p) => p.id !== projeto?.id && resolverCorProjeto(p.cor, p.id) === cor,
  );
  const periodoInvalido =
    modoData === "periodo" && !!dataInicio && !!dataEntrega && dataEntrega < dataInicio;

  useEffect(() => {
    if (!open) return;
    if (projeto) {
      setNome(projeto.nome);
      setCliente(projeto.cliente);
      setDescricao(projeto.descricao ?? "");
      setFase(projeto.fase);
      setEquipe(projeto.equipe);
      setValor(projeto.valor);
      setCor(resolverCorProjeto(projeto.cor, projeto.id));
      setDataInicio(toDate(projeto.dataInicio));
      setDataEntrega(toDate(projeto.dataEntrega));
      setModoData(projeto.dataEntrega ? "periodo" : "sem_data");
    } else {
      const hoje = new Date();
      setNome("");
      setCliente(clienteInicial ?? "");
      setDescricao("");
      setFase("briefing");
      setEquipe([]);
      setValor(0);
      setCor(CORES_PROJETO[0]);
      setDataInicio(toDate(hoje.toISOString()));
      setDataEntrega("");
      setModoData("sem_data");
    }
  }, [open, projeto, clienteInicial]);

  const salvar = async () => {
    if (!nome.trim() || !cliente.trim()) return;
    if (periodoInvalido) {
      toast.error("A entrega prevista não pode ser anterior ao início do projeto.");
      return;
    }
    setSalvando(true);
    try {
      // Vínculo com o cadastro de cliente acontece nos bastidores — o usuário
      // só digita o nome, igual sempre foi.
      const registro =
        clienteIdInicial && !editando
          ? { id: clienteIdInicial }
          : projeto?.clienteId &&
              projeto.cliente.trim().toLocaleLowerCase("pt-BR") ===
                cliente.trim().toLocaleLowerCase("pt-BR")
            ? { id: projeto.clienteId }
            : await comercial.encontrarOuCriarCliente(cliente.trim());
      if (!registro) return;
      const payload = {
        nome: nome.trim(),
        cliente: cliente.trim(),
        clienteId: registro.id,
        descricao: descricao.trim() || undefined,
        fase,
        equipe,
        valor: podeVerValor ? valor : (projeto?.valor ?? 0),
        dataInicio: fromDate(dataInicio),
        dataEntrega: modoData === "sem_data" || !dataEntrega ? null : fromDate(dataEntrega),
        cor,
        fases: projeto?.fases ?? undefined,
      };
      const sucesso =
        editando && projeto
          ? await projetosActions.atualizarProjeto(projeto.id, payload)
          : await projetosActions.criarProjeto(payload);
      if (sucesso) onClose();
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!projeto || !confirm(`Remover projeto "${projeto.nome}" e todas suas tarefas/marcos?`))
      return;
    setRemovendo(true);
    try {
      if (await projetosActions.removerProjeto(projeto.id)) onClose();
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !salvando && !removendo && onClose()}>
      <DialogContent className="max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="font-display">
            {editando ? "Editar projeto" : "Novo projeto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-3 sm:px-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do projeto</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Campanha verão"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            {clienteInicial && !editando ? (
              <div className="flex h-10 items-center rounded-lg border border-border/60 bg-surface-1/40 px-3 text-sm font-medium">
                {clienteInicial}
              </div>
            ) : (
              <Input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ex: Aurora Filmes"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cor do projeto</Label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-surface-1/30 p-3">
              {CORES_PROJETO.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Selecionar cor ${c}`}
                  onClick={() => setCor(c)}
                  style={{ backgroundColor: c }}
                  className={`size-6 rounded-full transition ${cor === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-65 hover:opacity-100"}`}
                />
              ))}
              <label
                className={`relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-white/40 transition hover:border-white ${!CORES_PROJETO.includes(cor) ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""}`}
                title="Escolher outra cor"
              >
                <span className="text-sm leading-none text-white">+</span>
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                <span className="font-mono">{cor}</span>
              </div>
            </div>
            {coresEmUso.length > 0 && (
              <p className="flex items-center gap-1.5 text-[10px] text-warning">
                <span className="size-1.5 rounded-full bg-warning" />
                Esta cor já está sendo usada por{" "}
                {coresEmUso.length === 1 ? (
                  <strong>{coresEmUso[0].nome}</strong>
                ) : (
                  <strong>{coresEmUso.length} outros projetos</strong>
                )}
                .
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Planejamento de datas</Label>
            <div className="inline-flex rounded-lg border border-border/60 bg-surface-1/40 p-1">
              <button
                type="button"
                onClick={() => setModoData("sem_data")}
                className={`rounded-md px-3 py-1.5 text-[11px] transition ${modoData === "sem_data" ? "bg-surface-3 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sem prazo geral
              </button>
              <button
                type="button"
                onClick={() => setModoData("entrega")}
                className={`rounded-md px-3 py-1.5 text-[11px] transition ${modoData === "entrega" ? "bg-surface-3 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Só entrega
              </button>
              <button
                type="button"
                onClick={() => setModoData("periodo")}
                className={`rounded-md px-3 py-1.5 text-[11px] transition ${modoData === "periodo" ? "bg-surface-3 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Período
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {modoData === "sem_data"
                ? "O calendário será definido pelos prazos de cada tarefa."
                : modoData === "entrega"
                  ? "Informe apenas o prazo final. O início será a data de criação."
                  : "Use quando a produção tiver uma janela definida de início e entrega."}
            </p>
          </div>
          {modoData !== "sem_data" && (
            <div
              className={`grid gap-3 ${modoData === "periodo" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
            >
              {modoData === "periodo" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Entrega prevista{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  type="date"
                  value={dataEntrega}
                  min={modoData === "periodo" ? dataInicio : undefined}
                  aria-invalid={periodoInvalido}
                  onChange={(e) => setDataEntrega(e.target.value)}
                />
                {periodoInvalido && (
                  <p className="text-[10px] text-destructive">
                    A entrega deve ser igual ou posterior ao início.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Equipe do projeto</Label>
            <MembrosSelect value={equipe} onChange={setEquipe} />
          </div>
          {editando && podeVerValor && (
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Briefing, escopo, observações…"
            />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 bg-background px-4 py-3 sm:justify-between sm:px-6 sm:py-4">
          {editando ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={remover}
              disabled={salvando || removendo}
              className="text-destructive hover:text-destructive"
            >
              <Trash size={16} color="currentColor" variant="Linear" />{" "}
              {removendo ? "Removendo…" : "Remover"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={salvando || removendo}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando || removendo || periodoInvalido || !nome.trim() || !cliente.trim()}
            >
              {salvando ? "Salvando…" : editando ? "Salvar" : "Criar projeto"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
