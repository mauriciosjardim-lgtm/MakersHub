import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { comercial, useComercial } from "@/lib/hooks/useComercial";
import {
  analisarLinhasContatos,
  chaveContato,
  descreverMotivoLinhaContato,
  gerarCsvRelatorioImportacao,
  inferirMapeamento,
  LIMITE_ARQUIVO_CONTATOS,
  LIMITE_LINHAS_CONTATOS,
  parseArquivoContatos,
  type CampoContatoImportacao,
  type LinhaContatoAnalisada,
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
  const [modoDuplicados, setModoDuplicados] = useState<"ignorar" | "atualizar">("ignorar");
  const [resultadoFinal, setResultadoFinal] = useState<{
    importados: number;
    atualizados: number;
    ignorados: number;
    empresasCriadas: number;
  } | null>(null);
  const [relatorioFinal, setRelatorioFinal] = useState<LinhaContatoAnalisada[]>([]);
  const empresas = useComercial((store) => store.empresas);
  const contatosCadastrados = useComercial((store) => store.contatos);

  const chavesExistentes = useMemo(() => {
    const empresasPorId = new Map(empresas.map((empresa) => [empresa.id, empresa.nome]));
    return new Set(
      contatosCadastrados.flatMap((contato) => {
        const empresa = empresasPorId.get(contato.empresaId);
        return empresa ? [chaveContato({ ...contato, empresa })] : [];
      }),
    );
  }, [contatosCadastrados, empresas]);

  const analise = useMemo(
    () => (planilha ? analisarLinhasContatos(planilha.linhas, mapeamento, chavesExistentes) : []),
    [chavesExistentes, mapeamento, planilha],
  );
  const obrigatoriosMapeados = mapeamento.nome !== undefined && mapeamento.empresa !== undefined;
  const invalidas = analise.filter((linha) => linha.erros.length > 0);
  const repetidasArquivo = analise.filter((linha) => linha.avisos.includes("duplicado_arquivo"));
  const repetidasExistentes = analise.filter((linha) =>
    linha.avisos.includes("duplicado_existente"),
  );
  const linhasParaImportar = analise.filter(
    (linha) =>
      linha.importavel &&
      (modoDuplicados === "atualizar" || !linha.avisos.includes("duplicado_existente")),
  );

  const limpar = () => {
    setArquivoNome("");
    setPlanilha(null);
    setMapeamento({});
    setModoDuplicados("ignorar");
    setResultadoFinal(null);
    setRelatorioFinal([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const carregarArquivo = async (arquivo?: File) => {
    if (!arquivo) return;
    const extensao = arquivo.name.split(".").pop()?.toLowerCase();
    if (!extensao || !["csv", "tsv", "txt", "xlsx"].includes(extensao)) {
      toast.error("Use um arquivo CSV, TSV ou XLSX.");
      return;
    }
    if (arquivo.size > LIMITE_ARQUIVO_CONTATOS) {
      toast.error("O arquivo ultrapassa o limite seguro de 5 MB.");
      return;
    }
    try {
      const buffer = await arquivo.arrayBuffer();
      const resultado = await parseArquivoContatos(arquivo.name, buffer);
      if (resultado.cabecalhos.length < 2 || resultado.linhas.length === 0) {
        toast.error("O arquivo precisa ter cabeçalho e pelo menos uma linha de contato.");
        return;
      }
      if (resultado.linhas.length > LIMITE_LINHAS_CONTATOS) {
        toast.error("A planilha ultrapassa o limite seguro de 5.000 linhas.");
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
    if (!planilha || !obrigatoriosMapeados || linhasParaImportar.length === 0) return;
    const analiseConfirmada = analise;
    const quantidadeEnviada = linhasParaImportar.length;
    setImportando(true);
    const resultado = await comercial.importarContatos(
      linhasParaImportar.map((linha) => linha.contato),
      modoDuplicados,
    );
    setImportando(false);
    if (!resultado) {
      toast.error(
        "A importação não foi concluída. Tente novamente; contatos repetidos serão ignorados.",
      );
      return;
    }
    setResultadoFinal({
      ...resultado,
      ignorados: resultado.ignorados + (analiseConfirmada.length - quantidadeEnviada),
    });
    setRelatorioFinal(analiseConfirmada);
    toast.success("Importação concluída com segurança.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto && !importando) limpar();
        onOpenChange(aberto);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <DialogTitle>Importar contatos</DialogTitle>
              <DialogDescription>
                Traga CSV, TSV ou Excel. Validamos tudo antes e gravamos em uma única transação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void carregarArquivo(event.target.files?.[0])}
        />

        {resultadoFinal ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/[.06] p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Importação concluída</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A operação foi confirmada por inteiro no banco. Nenhuma gravação ficou pela
                    metade.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Resumo numero={resultadoFinal.importados} label="Importados" />
              <Resumo numero={resultadoFinal.atualizados} label="Atualizados" />
              <Resumo numero={resultadoFinal.ignorados} label="Ignorados" />
              <Resumo numero={resultadoFinal.empresasCriadas} label="Empresas criadas" />
            </div>
            {relatorioFinal.some((linha) => linha.erros.length > 0 || linha.avisos.length > 0) && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => baixarRelatorio(relatorioFinal)}
              >
                <Download className="size-4" /> Baixar relatório da validação
              </Button>
            )}
          </div>
        ) : !planilha ? (
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
                  CSV, TSV ou XLSX · até 5 MB e 5.000 linhas
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
                  {planilha.linhas.length} linhas encontradas
                  {planilha.aba ? ` · aba ${planilha.aba}` : ""} · confira antes de importar
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Resumo numero={linhasParaImportar.length} label="Serão processados" />
                  <Resumo
                    numero={invalidas.length}
                    label="Com erro"
                    alerta={invalidas.length > 0}
                  />
                  <Resumo
                    numero={repetidasExistentes.length}
                    label="Já cadastrados"
                    alerta={repetidasExistentes.length > 0}
                  />
                  <Resumo
                    numero={repetidasArquivo.length}
                    label="Repetidos no arquivo"
                    alerta={repetidasArquivo.length > 0}
                  />
                </div>

                {repetidasExistentes.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface-2/35 p-3">
                    <p className="text-xs font-medium">Quando o contato já existir</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          [
                            "ignorar",
                            "Ignorar existentes",
                            "Mantém o cadastro atual sem alterações.",
                          ],
                          [
                            "atualizar",
                            "Atualizar existentes",
                            "Atualiza nome, cargo, e-mail e telefone informados.",
                          ],
                        ] as const
                      ).map(([valor, titulo, descricao]) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setModoDuplicados(valor)}
                          className={`rounded-lg border px-3 py-2 text-left transition ${
                            modoDuplicados === valor
                              ? "border-primary/50 bg-primary/[.08]"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <span className="block text-xs font-medium">{titulo}</span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {descricao}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(invalidas.length > 0 || repetidasArquivo.length > 0) && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[.07] px-3 py-2">
                    <div className="flex gap-2 text-xs text-amber-200">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>
                        Linhas inválidas ou repetidas no próprio arquivo não serão gravadas.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => baixarRelatorio(analise)}
                    >
                      Relatório
                    </Button>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between bg-surface-2/60 px-3 py-2 text-[11px] text-muted-foreground">
                    <span>Prévia e validação</span>
                    <span>Mostrando até 8 de {analise.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Linha</th>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Empresa</th>
                          <th className="px-3 py-2">E-mail</th>
                          <th className="px-3 py-2">Telefone</th>
                          <th className="px-3 py-2">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.slice(0, 8).map((linha) => (
                          <tr key={linha.numero} className="border-t border-border/60">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {linha.numero}
                            </td>
                            <td className="px-3 py-2 font-medium">{linha.contato.nome || "—"}</td>
                            <td className="px-3 py-2">{linha.contato.empresa || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {linha.contato.email}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {linha.contato.telefone}
                            </td>
                            <td className="px-3 py-2">
                              <SituacaoLinha linha={linha} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importando}>
            {resultadoFinal ? "Concluir" : "Cancelar"}
          </Button>
          {planilha && !resultadoFinal && (
            <Button
              onClick={importar}
              disabled={!obrigatoriosMapeados || linhasParaImportar.length === 0 || importando}
            >
              {importando
                ? "Importando…"
                : `${modoDuplicados === "atualizar" ? "Importar e atualizar" : "Importar"} ${linhasParaImportar.length} contato${linhasParaImportar.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({
  numero,
  label,
  alerta = false,
}: {
  numero: number;
  label: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/35 px-3 py-2.5">
      <strong className={alerta && numero > 0 ? "text-amber-300" : "text-foreground"}>
        {numero}
      </strong>
      <span className="ml-1.5 text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function SituacaoLinha({ linha }: { linha: LinhaContatoAnalisada }) {
  const motivos = [...linha.erros, ...linha.avisos];
  if (motivos.length === 0) {
    return <span className="text-[10px] font-medium text-primary">Pronta</span>;
  }
  return (
    <span
      className={linha.erros.length > 0 ? "text-[10px] text-red-300" : "text-[10px] text-amber-300"}
    >
      {motivos.map(descreverMotivoLinhaContato).join(" · ")}
    </span>
  );
}

function baixarRelatorio(linhas: LinhaContatoAnalisada[]) {
  baixarCsv(
    gerarCsvRelatorioImportacao(linhas),
    `relatorio-importacao-contatos-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function baixarModelo() {
  const conteudo =
    '\uFEFF"Nome";"Empresa";"Cargo";"E-mail";"Telefone"\r\n"Ana Souza";"Empresa Exemplo";"Marketing";"ana@exemplo.com";"(11) 99999-9999"';
  baixarCsv(conteudo, "modelo-contatos-makershub.csv");
}

function baixarCsv(conteudo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
