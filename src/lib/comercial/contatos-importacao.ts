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
};

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
  if (email) return `email:${normalizarTexto(email)}`;
  const telefone = valorContatoOuVazio(contato.telefone).replace(/\D/g, "");
  if (telefone.length >= 8) return `telefone:${telefone}`;
  return `nome:${normalizarTexto(contato.empresa)}:${normalizarTexto(contato.nome)}`;
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
