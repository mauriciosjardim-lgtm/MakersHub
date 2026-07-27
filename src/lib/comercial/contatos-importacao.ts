import type { Contato, Empresa } from "@/lib/mock/comercial";

export type CampoContatoImportacao = "nome" | "empresa" | "cargo" | "email" | "telefone";

export type MapeamentoContatos = Partial<Record<CampoContatoImportacao, number>>;

export type ContatoImportado = {
  nome: string;
  empresa: string;
  cargo: string;
  email: string;
  telefone: string;
  principal: boolean;
};

export type PlanilhaContatos = {
  cabecalhos: string[];
  linhas: string[][];
  delimitador: string;
  aba?: string;
};

export type MotivoLinhaContato =
  | "sem_nome"
  | "sem_empresa"
  | "email_invalido"
  | "telefone_invalido"
  | "campo_muito_longo"
  | "duplicado_arquivo"
  | "duplicado_existente";

export type LinhaContatoAnalisada = {
  numero: number;
  contato: ContatoImportado;
  chave: string;
  erros: MotivoLinhaContato[];
  avisos: MotivoLinhaContato[];
  importavel: boolean;
};

export const LIMITE_ARQUIVO_CONTATOS = 5 * 1024 * 1024;
export const LIMITE_LINHAS_CONTATOS = 5_000;

const CAMPOS: CampoContatoImportacao[] = ["nome", "empresa", "cargo", "email", "telefone"];

const ALIASES: Record<CampoContatoImportacao, string[]> = {
  nome: ["nome", "contato", "contact", "pessoa", "name", "nome completo"],
  empresa: ["empresa", "cliente", "company", "organizacao", "organization", "razao social"],
  cargo: ["cargo", "funcao", "role", "job title", "position"],
  email: ["email", "e mail", "mail", "correio eletronico"],
  telefone: ["telefone", "celular", "phone", "whatsapp", "fone", "mobile"],
};

export const normalizarTexto = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function valorContatoOuVazio(valor?: string | null) {
  const texto = valor?.trim() ?? "";
  if (!texto || texto === "—" || texto === "-") return "";
  if (texto.length <= 10 && /[ÄÃ‚]/.test(texto)) return "";
  return texto;
}

function contarDelimitador(linha: string, delimitador: string) {
  let quantidade = 0;
  let entreAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    if (linha[i] === '"') {
      if (entreAspas && linha[i + 1] === '"') i += 1;
      else entreAspas = !entreAspas;
    } else if (!entreAspas && linha[i] === delimitador) {
      quantidade += 1;
    }
  }
  return quantidade;
}

export function detectarDelimitador(conteudo: string) {
  const primeiraLinha = conteudo.split(/\r?\n/).find((linha) => linha.trim()) ?? "";
  return [";", ",", "\t"].sort(
    (a, b) => contarDelimitador(primeiraLinha, b) - contarDelimitador(primeiraLinha, a),
  )[0];
}

export function parsePlanilhaContatos(conteudo: string): PlanilhaContatos {
  const texto = conteudo.replace(/^\uFEFF/, "");
  const delimitador = detectarDelimitador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  const finalizarCampo = () => {
    linha.push(campo.trim());
    campo = "";
  };
  const finalizarLinha = () => {
    finalizarCampo();
    if (linha.some((valor) => valor.trim())) linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i];
    if (caractere === '"') {
      if (entreAspas && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (!entreAspas && caractere === delimitador) {
      finalizarCampo();
    } else if (!entreAspas && (caractere === "\n" || caractere === "\r")) {
      if (caractere === "\r" && texto[i + 1] === "\n") i += 1;
      finalizarLinha();
    } else {
      campo += caractere;
    }
  }
  if (campo || linha.length) finalizarLinha();

  const [cabecalhos = [], ...dados] = linhas;
  return {
    cabecalhos: cabecalhos.map((cabecalho) => cabecalho.trim()),
    linhas: dados,
    delimitador,
  };
}

export async function parseArquivoContatos(
  nomeArquivo: string,
  buffer: ArrayBuffer,
): Promise<PlanilhaContatos> {
  const extensao = nomeArquivo.split(".").pop()?.toLowerCase();
  if (extensao === "xlsx") {
    const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");
    const abas = await readSheetNames(buffer);
    for (const aba of abas) {
      const matriz = await readXlsxFile(buffer, { sheet: aba });
      const linhas = matriz
        .map((linha) =>
          linha.map((valor) =>
            valor instanceof Date ? valor.toLocaleDateString("pt-BR") : String(valor ?? "").trim(),
          ),
        )
        .filter((linha) => linha.some(Boolean));
      if (linhas.length < 2) continue;
      const [cabecalhos, ...dados] = linhas;
      return { cabecalhos, linhas: dados, delimitador: "xlsx", aba };
    }
    return { cabecalhos: [], linhas: [], delimitador: "xlsx" };
  }

  let conteudo: string;
  try {
    conteudo = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    conteudo = new TextDecoder("windows-1252").decode(buffer);
  }
  return parsePlanilhaContatos(conteudo);
}

export function inferirMapeamento(cabecalhos: string[]): MapeamentoContatos {
  const normalizados = cabecalhos.map(normalizarTexto);
  return Object.fromEntries(
    CAMPOS.flatMap((campo) => {
      const indice = normalizados.findIndex((cabecalho) =>
        ALIASES[campo].some((alias) => cabecalho === normalizarTexto(alias)),
      );
      return indice >= 0 ? [[campo, indice]] : [];
    }),
  ) as MapeamentoContatos;
}

const lerCampo = (linha: string[], indice?: number) =>
  indice === undefined ? "" : (linha[indice]?.trim() ?? "");

export function converterLinhasEmContatos(
  linhas: string[][],
  mapeamento: MapeamentoContatos,
): ContatoImportado[] {
  return linhas
    .map((linha) => ({
      nome: lerCampo(linha, mapeamento.nome),
      empresa: lerCampo(linha, mapeamento.empresa),
      cargo: valorContatoOuVazio(lerCampo(linha, mapeamento.cargo)) || "—",
      email: valorContatoOuVazio(lerCampo(linha, mapeamento.email)) || "—",
      telefone: valorContatoOuVazio(lerCampo(linha, mapeamento.telefone)) || "—",
      principal: false,
    }))
    .filter((contato) => contato.nome && contato.empresa);
}

export function chaveContato(
  contato: Pick<ContatoImportado, "nome" | "empresa" | "email" | "telefone">,
) {
  const email = valorContatoOuVazio(contato.email);
  if (email) return `email:${email.toLocaleLowerCase("pt-BR")}`;
  const telefone = valorContatoOuVazio(contato.telefone).replace(/\D/g, "");
  if (telefone.length >= 8) return `telefone:${telefone}`;
  return `nome:${normalizarTexto(contato.empresa)}:${normalizarTexto(contato.nome)}`;
}

const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function analisarLinhasContatos(
  linhas: string[][],
  mapeamento: MapeamentoContatos,
  chavesExistentes: ReadonlySet<string> = new Set(),
): LinhaContatoAnalisada[] {
  const vistas = new Set<string>();
  return linhas.map((linha, indice) => {
    const contato: ContatoImportado = {
      nome: lerCampo(linha, mapeamento.nome),
      empresa: lerCampo(linha, mapeamento.empresa),
      cargo: valorContatoOuVazio(lerCampo(linha, mapeamento.cargo)) || "—",
      email: valorContatoOuVazio(lerCampo(linha, mapeamento.email)) || "—",
      telefone: valorContatoOuVazio(lerCampo(linha, mapeamento.telefone)) || "—",
      principal: false,
    };
    const erros: MotivoLinhaContato[] = [];
    const avisos: MotivoLinhaContato[] = [];
    if (!contato.nome) erros.push("sem_nome");
    if (!contato.empresa) erros.push("sem_empresa");
    if (contato.email !== "—" && !emailValido(contato.email)) erros.push("email_invalido");
    const telefone = contato.telefone === "—" ? "" : contato.telefone.replace(/\D/g, "");
    if (contato.telefone !== "—" && (telefone.length < 8 || telefone.length > 15)) {
      erros.push("telefone_invalido");
    }
    if (
      contato.nome.length > 160 ||
      contato.empresa.length > 200 ||
      contato.cargo.length > 160 ||
      contato.email.length > 254 ||
      contato.telefone.length > 40
    ) {
      erros.push("campo_muito_longo");
    }
    const chave = chaveContato(contato);
    if (vistas.has(chave)) avisos.push("duplicado_arquivo");
    else vistas.add(chave);
    if (chavesExistentes.has(chave)) avisos.push("duplicado_existente");
    return {
      numero: indice + 2,
      contato,
      chave,
      erros,
      avisos,
      importavel: erros.length === 0 && !avisos.includes("duplicado_arquivo"),
    };
  });
}

const ROTULOS_MOTIVOS: Record<MotivoLinhaContato, string> = {
  sem_nome: "Sem nome",
  sem_empresa: "Sem empresa",
  email_invalido: "E-mail inválido",
  telefone_invalido: "Telefone inválido",
  campo_muito_longo: "Campo acima do limite",
  duplicado_arquivo: "Repetido no arquivo",
  duplicado_existente: "Já cadastrado",
};

export const descreverMotivoLinhaContato = (motivo: MotivoLinhaContato) => ROTULOS_MOTIVOS[motivo];

export function gerarCsvRelatorioImportacao(linhas: LinhaContatoAnalisada[]) {
  const cabecalho = ["Linha", "Nome", "Empresa", "E-mail", "Telefone", "Situação"];
  const dados = linhas
    .filter((linha) => linha.erros.length > 0 || linha.avisos.length > 0)
    .map((linha) => [
      String(linha.numero),
      linha.contato.nome,
      linha.contato.empresa,
      linha.contato.email,
      linha.contato.telefone,
      [...linha.erros, ...linha.avisos].map((motivo) => ROTULOS_MOTIVOS[motivo]).join("; "),
    ]);
  return `\uFEFF${[cabecalho, ...dados]
    .map((linha) => linha.map((valor) => escaparCsv(valor)).join(";"))
    .join("\r\n")}`;
}

function protegerCelula(valor: string) {
  const texto = valorContatoOuVazio(valor);
  return /^[\s]*[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

function escaparCsv(valor: string) {
  return `"${protegerCelula(valor).replaceAll('"', '""')}"`;
}

export function gerarCsvContatos(contatos: Contato[], empresas: Empresa[]) {
  const empresasPorId = new Map(empresas.map((empresa) => [empresa.id, empresa.nome]));
  const linhas = contatos.map((contato) =>
    [
      contato.nome,
      empresasPorId.get(contato.empresaId) ?? "",
      contato.cargo,
      contato.email,
      contato.telefone,
      contato.principal ? "Sim" : "Não",
    ]
      .map(escaparCsv)
      .join(";"),
  );
  return `\uFEFF${["Nome", "Empresa", "Cargo", "E-mail", "Telefone", "Principal"]
    .map(escaparCsv)
    .join(";")}\r\n${linhas.join("\r\n")}`;
}
