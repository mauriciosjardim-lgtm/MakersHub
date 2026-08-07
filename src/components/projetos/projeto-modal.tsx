import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DocumentText1, Trash } from "iconsax-react";
import { useAuth } from "@/lib/auth";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { usuarioTemAcesso, type Permissoes } from "@/lib/permissoes";
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
  const podeAcessarComercial = usuarioTemAcesso(
    usuario?.role,
    usuario?.permissoes as Partial<Permissoes> | null,
    "comercial",
  );
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
      // O vínculo com o CRM é opcional. Quem só tem acesso a Projetos salva o
      // nome textual do cliente sem consultar ou escrever no módulo Comercial.
      const registro = !podeAcessarComercial
        ? projeto?.clienteId
          ? { id: projeto.clienteId }
          : null
        : clienteIdInicial && !editando
          ? { id: clienteIdInicial }
          : projeto?.clienteId &&
              projeto.cliente.trim().toLocaleLowerCase("pt-BR") ===
                cliente.trim().toLocaleLowerCase("pt-BR")
            ? { id: projeto.clienteId }
            : await comercial.encontrarOuCriarCliente(cliente.trim());
      const payload = {
        nome: nome.trim(),
        cliente: cliente.trim(),
        clienteId: registro?.id,
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
      <DialogContent className="kb-form-dialog max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="kb-form-header border-b border-white/[.07] px-5 py-5 pr-14 sm:px-6">
          <div className="flex items-start gap-3.5">
            <span className="kb-form-icon grid size-11 shrink-0 place-items-center rounded-xl">
              <DocumentText1 size={22} color="currentColor" variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-2xl font-bold tracking-[-.025em]">
                {editando ? "Editar projeto" : "Novo projeto"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed">
                {editando
                  ? "Atualize o planejamento e as informações essenciais do projeto."
                  : "Defina o essencial agora. O restante evolui junto com a produção."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="kb-scrollbar grid gap-4 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-2">
          <section className="kb-form-section grid gap-4 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)] lg:col-span-2">
            <div className="space-y-2">
              <Label className="kb-form-label">Nome do projeto</Label>
              <Input
                className="kb-form-control"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Campanha de verão"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="kb-form-label">Cliente</Label>
              {clienteInicial && !editando ? (
                <div className="kb-form-control flex items-center px-3.5 text-sm font-semibold">
                  {clienteInicial}
                </div>
              ) : (
                <Input
                  className="kb-form-control"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ex: Aurora Filmes"
                />
              )}
            </div>
          </section>

          <section className="kb-form-section space-y-3 lg:col-span-2">
            <div>
              <Label className="kb-form-label">Identidade do projeto</Label>
              <p className="mt-1 text-xs leading-relaxed text-[var(--kb-text-muted)]">
                A cor identifica o projeto na navegação, nos glows e nos estados ativos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/[.07] bg-black/10 p-3">
              {CORES_PROJETO.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Selecionar cor ${c}`}
                  onClick={() => setCor(c)}
                  style={{ backgroundColor: c }}
                  className={`size-8 rounded-full transition-[transform,opacity,box-shadow] ${cor === c ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-[oklch(0.18_0.008_260)]" : "opacity-65 hover:scale-105 hover:opacity-100"}`}
                />
              ))}
              <label
                className={`relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-white/30 transition hover:border-white/60 ${!CORES_PROJETO.includes(cor) ? "ring-2 ring-white ring-offset-2 ring-offset-[oklch(0.18_0.008_260)]" : ""}`}
                title="Escolher outra cor"
              >
                <span className="text-base leading-none text-white">+</span>
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-[var(--kb-text-muted)]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                <span className="font-mono">{cor}</span>
              </div>
            </div>
            {coresEmUso.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-warning">
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
          </section>

          <section className="kb-form-section space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label className="kb-form-label">Planejamento de datas</Label>
                <p className="mt-1 text-xs text-[var(--kb-text-muted)]">
                  Escolha somente o nível de prazo que fizer sentido agora.
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-white/[.07] bg-black/10 p-1">
                <button
                  type="button"
                  onClick={() => setModoData("sem_data")}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${modoData === "sem_data" ? "bg-white/[.08] text-[var(--kb-text)] shadow-sm" : "text-[var(--kb-text-muted)] hover:text-[var(--kb-text)]"}`}
                >
                  Sem prazo geral
                </button>
                <button
                  type="button"
                  onClick={() => setModoData("entrega")}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${modoData === "entrega" ? "bg-white/[.08] text-[var(--kb-text)] shadow-sm" : "text-[var(--kb-text-muted)] hover:text-[var(--kb-text)]"}`}
                >
                  Só entrega
                </button>
                <button
                  type="button"
                  onClick={() => setModoData("periodo")}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${modoData === "periodo" ? "bg-white/[.08] text-[var(--kb-text)] shadow-sm" : "text-[var(--kb-text-muted)] hover:text-[var(--kb-text)]"}`}
                >
                  Período
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[var(--kb-text-muted)]">
              {modoData === "sem_data"
                ? "O calendário será definido pelos prazos de cada tarefa."
                : modoData === "entrega"
                  ? "Informe apenas o prazo final. O início será a data de criação."
                  : "Use quando a produção tiver uma janela definida de início e entrega."}
            </p>
            {modoData !== "sem_data" && (
              <div
                className={`grid gap-3 ${modoData === "periodo" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
              >
                {modoData === "periodo" && (
                  <div className="space-y-2">
                    <Label className="kb-form-label">Início</Label>
                    <Input
                      className="kb-form-control"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="kb-form-label">
                    Entrega prevista{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    className="kb-form-control"
                    type="date"
                    value={dataEntrega}
                    min={modoData === "periodo" ? dataInicio : undefined}
                    aria-invalid={periodoInvalido}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                  {periodoInvalido && (
                    <p className="text-xs text-destructive">
                      A entrega deve ser igual ou posterior ao início.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="kb-form-section grid gap-4 sm:grid-cols-2">
            <div className="kb-form-custom space-y-2">
              <Label className="kb-form-label">Equipe do projeto</Label>
              <MembrosSelect value={equipe} onChange={setEquipe} />
            </div>
            {editando && podeVerValor && (
              <div className="space-y-2">
                <Label className="kb-form-label">Valor (R$)</Label>
                <CurrencyInput className="kb-form-control" value={valor} onValueChange={setValor} />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label className="kb-form-label">Descrição</Label>
              <Textarea
                className="kb-form-control min-h-28 resize-y"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Briefing, escopo, observações…"
              />
            </div>
          </section>
        </div>
        <DialogFooter className="kb-form-footer flex-row items-center justify-between gap-2 border-t border-white/[.07] px-5 py-4 sm:justify-between sm:px-6">
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
            <Button
              variant="outline"
              className="h-11 rounded-xl px-4"
              onClick={onClose}
              disabled={salvando || removendo}
            >
              Cancelar
            </Button>
            <Button
              className="h-11 rounded-xl px-5 font-bold"
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
