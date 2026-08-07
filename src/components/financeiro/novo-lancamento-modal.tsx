import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendUp, TrendDown, Add, Paperclip, Repeat } from "iconsax-react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getEmpresaId } from "@/lib/empresaId";
import { openComprovante } from "@/lib/comprovantes";
import {
  CATEGORIAS_RECEITA, CATEGORIAS_DESPESA,
  type LancTipo, type Lancamento,
} from "@/lib/mock/financeiro";
import { financeiroActions } from "@/lib/hooks/useFinanceiro";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useCarteiras, getCarteiraAtiva } from "@/lib/hooks/useCarteiras";
import { cn } from "@/lib/utils";

const FREQ_OPCOES = [
  { value: "semanal",     label: "Semanal" },
  { value: "quinzenal",   label: "Quinzenal" },
  { value: "mensal",      label: "Mensal" },
  { value: "bimestral",   label: "Bimestral" },
  { value: "trimestral",  label: "Trimestral" },
  { value: "semestral",   label: "Semestral" },
  { value: "anual",       label: "Anual" },
];

const CATEGORIA_PERSONALIZADA = "__custom__";

function addPeriod(baseIso: string, freq: string, n: number): string {
  const d = new Date(baseIso + "T12:00:00");
  switch (freq) {
    case "semanal":    d.setDate(d.getDate() + 7 * n); break;
    case "quinzenal":  d.setDate(d.getDate() + 14 * n); break;
    case "mensal":     d.setMonth(d.getMonth() + n); break;
    case "bimestral":  d.setMonth(d.getMonth() + 2 * n); break;
    case "trimestral": d.setMonth(d.getMonth() + 3 * n); break;
    case "semestral":  d.setMonth(d.getMonth() + 6 * n); break;
    case "anual":      d.setFullYear(d.getFullYear() + n); break;
  }
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipoInicial?: LancTipo;
  editar?: Lancamento;
}

export function NovoLancamentoModal({ open, onOpenChange, tipoInicial = "receita", editar }: Props) {
  const [tipo, setTipo] = useState<LancTipo>(tipoInicial);
  const [categoria, setCategoria] = useState("");
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [cliente, setCliente] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [carteiraId, setCarteiraId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [observacoes, setObservacoes] = useState("");
  const [pago, setPago] = useState(false);

  // Recorrência (só para novos lançamentos)
  const [recorrente, setRecorrente] = useState(false);
  const [recFreq, setRecFreq] = useState("mensal");
  const [recParcelas, setRecParcelas] = useState(3);

  // Comprovante
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [salvando, setSalvando] = useState(false);

  const { projetos, loading: projetosLoading } = useProjetos();
  const { carteiras } = useCarteiras();
  const categorias = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const clientes = useMemo(() => {
    const nomes = new Map<string, string>();
    projetos.forEach((projeto) => {
      const nome = projeto.cliente.trim();
      if (nome) nomes.set(nome.toLocaleLowerCase("pt-BR"), nome);
    });
    return [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetos]);
  const projetosDoCliente = useMemo(() => {
    const nomeSelecionado = cliente.trim().toLocaleLowerCase("pt-BR");
    if (!nomeSelecionado) return [];
    return projetos
      .filter(
        (projeto) => projeto.cliente.trim().toLocaleLowerCase("pt-BR") === nomeSelecionado,
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [cliente, projetos]);

  const selecionarCliente = (nome: string) => {
    setCliente(nome === "__none__" ? "" : nome);
    setProjetoId("");
  };

  useEffect(() => {
    if (open) {
      if (editar) {
        setTipo(editar.tipo);
        const categoriasDaEdicao =
          editar.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
        const categoriaCadastrada = categoriasDaEdicao.includes(editar.categoria);
        setCategoria(categoriaCadastrada ? editar.categoria : CATEGORIA_PERSONALIZADA);
        setCategoriaPersonalizada(categoriaCadastrada ? "" : editar.categoria);
        setDescricao(editar.descricao);
        setValor(editar.valor);
        setVencimento(editar.vencimento.slice(0, 10));
        setCliente(editar.cliente || "");
        setProjetoId(editar.projetoId || "");
        setCarteiraId(editar.carteiraId || "");
        setFormaPagamento(editar.formaPagamento || "PIX");
        setObservacoes(editar.observacoes || "");
        setPago(!!editar.pagamentoEm);
        setComprovanteUrl(editar.comprovanteUrl);
      } else {
        setTipo(tipoInicial);
        setCategoria(tipoInicial === "receita" ? "Projeto" : "Equipe");
        setCategoriaPersonalizada("");
        setDescricao(""); setValor(0);
        setVencimento(new Date().toISOString().slice(0, 10));
        setCliente(""); setProjetoId(""); setCarteiraId(getCarteiraAtiva() ?? ""); setFormaPagamento("PIX");
        setObservacoes(""); setPago(false);
        setComprovanteUrl(undefined);
      }
      setRecorrente(false);
      setRecFreq("mensal");
      setRecParcelas(3);
      setComprovanteFile(null);
    }
  }, [open, editar, tipoInicial]);

  async function uploadComprovante(file: File): Promise<string | undefined> {
    const empresaId = await getEmpresaId();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${empresaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comprovantes").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar comprovante."); return undefined; }
    return path;
  }

  const salvar = async () => {
    if (!descricao.trim()) { toast.error("Descrição é obrigatória."); return; }
    if (valor <= 0) { toast.error("Informe um valor válido."); return; }
    if (!vencimento) { toast.error("Informe o vencimento."); return; }
    const categoriaFinal =
      categoria === CATEGORIA_PERSONALIZADA ? categoriaPersonalizada.trim() : categoria.trim();
    if (!categoriaFinal) { toast.error("Informe a categoria."); return; }

    setSalvando(true);
    try {
      let urlFinal = comprovanteUrl;
      if (comprovanteFile) {
        urlFinal = await uploadComprovante(comprovanteFile);
      }

      const base = {
        tipo, categoria: categoriaFinal, descricao: descricao.trim(),
        valor,
        vencimento: new Date(vencimento + "T12:00:00").toISOString(),
        pagamentoEm: pago ? new Date(vencimento + "T12:00:00").toISOString() : null,
        cliente: cliente.trim() || undefined,
        projetoId: projetoId || undefined,
        projeto: projetos.find(p => p.id === projetoId)?.nome || undefined,
        carteiraId: carteiraId || undefined,
        formaPagamento, observacoes: observacoes.trim() || undefined,
        comprovanteUrl: urlFinal,
      };

      if (editar) {
        await financeiroActions.update(editar.id, base);
        toast.success("Lançamento atualizado.");
      } else if (recorrente) {
        const datas = Array.from({ length: recParcelas }, (_, i) => addPeriod(vencimento, recFreq, i));
        for (let i = 0; i < datas.length; i++) {
          await financeiroActions.add({
            ...base,
            descricao: `${base.descricao} · ${i + 1}/${recParcelas}`,
            vencimento: new Date(datas[i] + "T12:00:00").toISOString(),
            // comprovante só na primeira parcela
            comprovanteUrl: i === 0 ? urlFinal : undefined,
          });
        }
        toast.success(`${recParcelas} lançamentos criados.`);
      } else {
        await financeiroActions.add(base);
        toast.success(`${tipo === "receita" ? "Receita" : "Despesa"} registrada.`);
      }
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const comprovanteNome = comprovanteFile?.name ?? (comprovanteUrl ? comprovanteUrl.split("/").pop() : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Add size={16} color="currentColor" variant="Linear" className="text-primary" />
            {editar ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            Registre receitas e despesas para acompanhar caixa e margem em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 overflow-y-auto px-4 pb-3 sm:px-6">
          {/* Toggle tipo */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => { setTipo("receita"); setCategoria("Projeto"); setCategoriaPersonalizada(""); }}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition",
                tipo === "receita" ? "bg-surface-3 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendUp size={14} color="currentColor" variant="Linear" className={cn(tipo === "receita" ? "text-success" : "text-primary")} />
              Receita
            </button>
            <button
              type="button"
              onClick={() => { setTipo("despesa"); setCategoria("Equipe"); setCategoriaPersonalizada(""); }}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition",
                tipo === "despesa" ? "bg-surface-3 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendDown size={14} color="currentColor" variant="Linear" className={cn(tipo === "despesa" ? "text-destructive" : "text-primary")} />
              Despesa
            </button>
          </div>

          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Parcela 2/4 — campanha Vibe" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>Valor (R$)</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div className="grid gap-1.5">
              <Label>Vencimento</Label>
              <DateTimePicker
                hideTime
                value={vencimento ? `${vencimento}T12:00` : ""}
                onChange={(value) => setVencimento(value.slice(0, 10))}
                placeholder="Selecionar vencimento"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={categoria}
                onValueChange={(value) => {
                  setCategoria(value);
                  if (value !== CATEGORIA_PERSONALIZADA) setCategoriaPersonalizada("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value={CATEGORIA_PERSONALIZADA}>Personalizada…</SelectItem>
                </SelectContent>
              </Select>
              {categoria === CATEGORIA_PERSONALIZADA && (
                <Input
                  value={categoriaPersonalizada}
                  onChange={(event) => setCategoriaPersonalizada(event.target.value)}
                  placeholder="Nome da categoria"
                  autoFocus
                />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Carteira</Label>
              <Select value={carteiraId || "__none__"} onValueChange={v => setCarteiraId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {carteiras.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid min-w-0 gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PIX", "Transferência", "Boleto", "Cartão", "Dinheiro"].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Cliente (opcional)</Label>
              <Select value={cliente || "__none__"} onValueChange={selecionarCliente}>
                <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum cliente</SelectItem>
                  {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {!projetosLoading && clientes.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Crie um cliente na seção Projetos primeiro.
                </p>
              )}
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Projeto (opcional)</Label>
              <Select
                value={projetoId || "__none__"}
                onValueChange={v => setProjetoId(v === "__none__" ? "" : v)}
                disabled={!cliente || projetosLoading}
              >
                <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate">
                  <SelectValue placeholder={cliente ? "Selecione um projeto" : "Escolha o cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {projetosDoCliente.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {cliente && !projetosLoading && projetosDoCliente.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Este cliente ainda não tem projetos.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Anotações internas" rows={2} />
          </div>

          {/* Comprovante / nota fiscal */}
          <div className="grid gap-1.5">
            <Label>Comprovante / nota fiscal</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => setComprovanteFile(e.target.files?.[0] ?? null)}
            />
            {comprovanteNome ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm">
                <Paperclip size={14} color="currentColor" variant="Linear" className="shrink-0 text-primary" />
                {comprovanteUrl && !comprovanteFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openComprovante(comprovanteUrl).catch(() =>
                        toast.error("Não foi possível abrir o comprovante."),
                      );
                    }}
                    className="flex-1 truncate text-left text-primary underline-offset-2 hover:underline"
                  >
                    {comprovanteNome}
                  </button>
                ) : (
                  <span className="flex-1 truncate text-muted-foreground">{comprovanteNome}</span>
                )}
                <button
                  type="button"
                  onClick={() => { setComprovanteFile(null); setComprovanteUrl(undefined); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-1/50 px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                <Paperclip size={13} color="currentColor" variant="Linear" />
                Anexar arquivo (imagem ou PDF, máx. 5 MB)
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-1 p-3 text-sm">
            <input
              type="checkbox"
              checked={pago}
              onChange={e => setPago(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span>Já foi {tipo === "receita" ? "recebido" : "pago"}</span>
          </label>

          {/* Recorrência — apenas para novos lançamentos */}
          {!editar && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-1 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={e => setRecorrente(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <Repeat size={14} color="currentColor" variant="Linear" className="text-primary" />
                <span>Lançamento recorrente</span>
              </label>
              {recorrente && (
                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Frequência</Label>
                    <Select value={recFreq} onValueChange={setRecFreq}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQ_OPCOES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={String(recParcelas)} onValueChange={v => setRecParcelas(Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-background px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : editar ? "Salvar alterações" : recorrente ? `Criar ${recParcelas} lançamentos` : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
