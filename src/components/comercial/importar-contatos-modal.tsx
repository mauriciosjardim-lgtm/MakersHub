import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { comercial } from "@/lib/hooks/useComercial";
import {
  converterLinhasEmContatos,
  inferirMapeamento,
  parsePlanilhaContatos,
  type CampoContatoImportacao,
  type MapeamentoContatos,
  type PlanilhaContatos,
} from "@/lib/comercial/contatos-importacao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CAMPOS: { id: CampoContatoImportacao; label: string; obrigatorio?: boolean }[] = [
  { id: "nome", label: "Nome", obrigatorio: true },
  { id: "empresa", label: "Empresa", obrigatorio: true },
  { id: "cargo", label: "Cargo" },
  { id: "email", label: "E-mail" },
  { id: "telefone", label: "Telefone" },
];

export function ImportarContatosModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [planilha, setPlanilha] = useState<PlanilhaContatos | null>(null);
  const [mapeamento, setMapeamento] = useState<MapeamentoContatos>({});
  const [importando, setImportando] = useState(false);

  const contatos = useMemo(
    () => (planilha ? converterLinhasEmContatos(planilha.linhas, mapeamento) : []),
    [mapeamento, planilha],
  );
  const obrigatoriosMapeados = mapeamento.nome !== undefined && mapeamento.empresa !== undefined;
  const descartadas = planilha ? planilha.linhas.length - contatos.length : 0;

  const limpar = () => {
    setArquivoNome("");
    setPlanilha(null);
    setMapeamento({});
    if (inputRef.current) inputRef.current.value = "";
  };

  const carregarArquivo = async (arquivo?: File) => {
    if (!arquivo) return;
    const extensao = arquivo.name.split(".").pop()?.toLowerCase();
    if (!extensao || !["csv", "tsv", "txt"].includes(extensao)) {
      toast.error("Use um arquivo CSV ou TSV exportado da sua planilha.");
      return;
    }
    try {
      const buffer = await arquivo.arrayBuffer();
      let conteudo: string;
      try {
        conteudo = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        conteudo = new TextDecoder("windows-1252").decode(buffer);
      }
      const resultado = parsePlanilhaContatos(conteudo);
      if (resultado.cabecalhos.length < 2 || resultado.linhas.length === 0) {
        toast.error("O arquivo precisa ter cabeçalho e pelo menos uma linha de contato.");
        return;
      }
      setArquivoNome(arquivo.name);
      setPlanilha(resultado);
      setMapeamento(inferirMapeamento(resultado.cabecalhos));
    } catch {
      toast.error("Não foi possível ler esse arquivo.");
    }
  };

  const importar = async () => {
    if (!planilha || !obrigatoriosMapeados || contatos.length === 0) return;
    setImportando(true);
    const resultado = await comercial.importarContatos(contatos);
    setImportando(false);
    if (!resultado) {
      toast.error(
        "A importação não foi concluída. Tente novamente; contatos repetidos serão ignorados.",
      );
      return;
    }
    const detalhes = [
      `${resultado.importados} importado${resultado.importados === 1 ? "" : "s"}`,
      resultado.ignorados
        ? `${resultado.ignorados} repetido${resultado.ignorados === 1 ? "" : "s"} ignorado${resultado.ignorados === 1 ? "" : "s"}`
        : "",
      resultado.empresasCriadas
        ? `${resultado.empresasCriadas} empresa${resultado.empresasCriadas === 1 ? "" : "s"} criada${resultado.empresasCriadas === 1 ? "" : "s"}`
        : "",
    ].filter(Boolean);
    toast.success(`Importação concluída: ${detalhes.join(" · ")}.`);
    limpar();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto && !importando) limpar();
        onOpenChange(aberto);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <DialogTitle>Importar contatos</DialogTitle>
              <DialogDescription>
                Traga um CSV do Excel, Google Sheets ou outro CRM. O arquivo só é gravado depois da
                sua confirmação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          onChange={(event) => void carregarArquivo(event.target.files?.[0])}
        />

        {!planilha ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void carregarArquivo(event.dataTransfer.files?.[0]);
              }}
              className="group grid min-h-52 w-full place-items-center rounded-2xl border border-dashed border-primary/35 bg-primary/[.035] p-8 text-center transition hover:border-primary/70 hover:bg-primary/[.06]"
            >
              <span>
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary transition group-hover:scale-105">
                  <UploadCloud className="size-7" />
                </span>
                <strong className="block text-sm">
                  Arraste o arquivo aqui ou clique para selecionar
                </strong>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  CSV ou TSV, com a primeira linha contendo os títulos das colunas
                </span>
              </span>
            </button>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
              <span>Não sabe como organizar as colunas?</span>
              <Button type="button" variant="ghost" size="sm" onClick={baixarModelo}>
                Baixar modelo CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/35 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{arquivoNome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {planilha.linhas.length} linhas encontradas · confira as colunas antes de importar
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                Trocar arquivo
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              {CAMPOS.map((campo) => (
                <div key={campo.id} className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {campo.label}
                    {campo.obrigatorio ? " *" : ""}
                  </p>
                  <Select
                    value={mapeamento[campo.id]?.toString() ?? "__ignorar__"}
                    onValueChange={(valor) => {
                      setMapeamento((atual) => {
                        const proximo = { ...atual };
                        if (valor === "__ignorar__") {
                          delete proximo[campo.id];
                        } else {
                          const indice = Number(valor);
                          for (const outroCampo of CAMPOS) {
                            if (outroCampo.id !== campo.id && proximo[outroCampo.id] === indice) {
                              delete proximo[outroCampo.id];
                            }
                          }
                          proximo[campo.id] = indice;
                        }
                        return proximo;
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignorar__">Não importar</SelectItem>
                      {planilha.cabecalhos.map((cabecalho, indice) => (
                        <SelectItem key={`${cabecalho}-${indice}`} value={indice.toString()}>
                          {cabecalho || `Coluna ${indice + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!obrigatoriosMapeados ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/[.07] px-3 py-2 text-xs text-amber-200">
                Selecione as colunas de Nome e Empresa para continuar.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between bg-surface-2/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Prévia dos dados</span>
                  <span>
                    {contatos.length} válidos
                    {descartadas > 0 ? ` · ${descartadas} sem nome/empresa serão ignorados` : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Empresa</th>
                        <th className="px-3 py-2">Cargo</th>
                        <th className="px-3 py-2">E-mail</th>
                        <th className="px-3 py-2">Telefone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contatos.slice(0, 5).map((contato, indice) => (
                        <tr key={`${contato.nome}-${indice}`} className="border-t border-border/60">
                          <td className="px-3 py-2 font-medium">{contato.nome}</td>
                          <td className="px-3 py-2">{contato.empresa}</td>
                          <td className="px-3 py-2 text-muted-foreground">{contato.cargo}</td>
                          <td className="px-3 py-2 text-muted-foreground">{contato.email}</td>
                          <td className="px-3 py-2 text-muted-foreground">{contato.telefone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importando}>
            Cancelar
          </Button>
          {planilha && (
            <Button
              onClick={importar}
              disabled={!obrigatoriosMapeados || contatos.length === 0 || importando}
            >
              {importando
                ? "Importando…"
                : `Importar ${contatos.length} contato${contatos.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function baixarModelo() {
  const conteudo =
    '\uFEFF"Nome";"Empresa";"Cargo";"E-mail";"Telefone"\r\n"Ana Souza";"Empresa Exemplo";"Marketing";"ana@exemplo.com";"(11) 99999-9999"';
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-contatos-makershub.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
