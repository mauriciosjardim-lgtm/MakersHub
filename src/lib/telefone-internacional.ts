// Telefone com DDI para o checkout. Módulo puro: sem React, sem rede, para o
// servidor validar exatamente o mesmo formato que o cliente monta.
//
// O número é guardado em E.164 (+5511999998888). É o único formato que não fica
// ambíguo quando o país varia, e é o que WhatsApp e discadores esperam.
//
// Só o Brasil ganha máscara e validação de forma. Para os demais países o
// projeto não tem tabela de formatos (nem lib de telefone instalada), então
// aceitamos dígitos livres dentro de uma faixa de tamanho plausível. Fingir que
// validamos um número do Cazaquistão seria pior que não validar.

export interface Pais {
  /** ISO 3166-1 alpha-2. */
  code: string;
  nome: string;
  /** Código de discagem, sem o "+". */
  ddi: string;
  /** Bandeira em emoji, derivada do code. */
  flag: string;
}

function bandeira(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const BRUTO: Array<[string, string, string]> = [
  ["BR", "Brasil", "55"],
  ["PT", "Portugal", "351"],
  ["US", "Estados Unidos", "1"],
  ["CA", "Canadá", "1"],
  ["AR", "Argentina", "54"],
  ["UY", "Uruguai", "598"],
  ["PY", "Paraguai", "595"],
  ["CL", "Chile", "56"],
  ["CO", "Colômbia", "57"],
  ["PE", "Peru", "51"],
  ["MX", "México", "52"],
  ["BO", "Bolívia", "591"],
  ["EC", "Equador", "593"],
  ["VE", "Venezuela", "58"],
  ["ES", "Espanha", "34"],
  ["FR", "França", "33"],
  ["IT", "Itália", "39"],
  ["DE", "Alemanha", "49"],
  ["GB", "Reino Unido", "44"],
  ["IE", "Irlanda", "353"],
  ["NL", "Países Baixos", "31"],
  ["BE", "Bélgica", "32"],
  ["CH", "Suíça", "41"],
  ["AT", "Áustria", "43"],
  ["SE", "Suécia", "46"],
  ["NO", "Noruega", "47"],
  ["DK", "Dinamarca", "45"],
  ["FI", "Finlândia", "358"],
  ["PL", "Polônia", "48"],
  ["CZ", "Tchéquia", "420"],
  ["GR", "Grécia", "30"],
  ["RO", "Romênia", "40"],
  ["HU", "Hungria", "36"],
  ["AU", "Austrália", "61"],
  ["NZ", "Nova Zelândia", "64"],
  ["JP", "Japão", "81"],
  ["CN", "China", "86"],
  ["KR", "Coreia do Sul", "82"],
  ["IN", "Índia", "91"],
  ["ID", "Indonésia", "62"],
  ["PH", "Filipinas", "63"],
  ["TH", "Tailândia", "66"],
  ["VN", "Vietnã", "84"],
  ["SG", "Singapura", "65"],
  ["MY", "Malásia", "60"],
  ["IL", "Israel", "972"],
  ["TR", "Turquia", "90"],
  ["AE", "Emirados Árabes Unidos", "971"],
  ["SA", "Arábia Saudita", "966"],
  ["ZA", "África do Sul", "27"],
  ["AO", "Angola", "244"],
  ["MZ", "Moçambique", "258"],
  ["CV", "Cabo Verde", "238"],
  ["NG", "Nigéria", "234"],
  ["EG", "Egito", "20"],
  ["MA", "Marrocos", "212"],
  ["RU", "Rússia", "7"],
  ["UA", "Ucrânia", "380"],
];

export const PAISES: Pais[] = BRUTO.map(([code, nome, ddi]) => ({
  code,
  nome,
  ddi,
  flag: bandeira(code),
}));

export const PAIS_PADRAO = "BR";

export function paisPorCodigo(code: string): Pais | undefined {
  return PAISES.find((p) => p.code === code);
}

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Máscara brasileira ao vivo: (11) 99999-8888. Só usada quando o país é BR. */
export function mascaraBR(bruto: string): string {
  const d = soDigitos(bruto).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Número nacional máximo aceito fora do Brasil (E.164 permite 15 com DDI). */
const MAX_NACIONAL = 14;

export function limitarNacional(bruto: string, code: string): string {
  return code === PAIS_PADRAO ? mascaraBR(bruto) : soDigitos(bruto).slice(0, MAX_NACIONAL);
}

/** Valida só a forma do número nacional, dado o país. */
export function telefoneValido(nacional: string, code: string): boolean {
  const d = soDigitos(nacional);
  if (code === PAIS_PADRAO) return d.length === 10 || d.length === 11;
  return d.length >= 6 && d.length <= MAX_NACIONAL;
}

/** Monta o E.164 que vai para o banco: +55 + 11999998888. */
export function paraE164(nacional: string, code: string): string {
  const pais = paisPorCodigo(code);
  if (!pais) throw new Error("País inválido.");
  return `+${pais.ddi}${soDigitos(nacional)}`;
}

/**
 * O Asaas só aceita telefone brasileiro (DDD + número, sem DDI). Para qualquer
 * outro país devolvemos null e o campo simplesmente não vai no payload, já que
 * é opcional na API dele.
 */
export function telefoneParaAsaas(nacional: string, code: string): string | null {
  if (code !== PAIS_PADRAO) return null;
  const d = soDigitos(nacional);
  return d.length === 10 || d.length === 11 ? d : null;
}
