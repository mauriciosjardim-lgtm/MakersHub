// Split de recebimento do Asaas (https://docs.asaas.com).
//
// Toda cobrança do acesso anual repassa 40% para a carteira do parceiro
// comercial. O percentual incide sobre o netValue (a cobrança menos as taxas do
// Asaas), não sobre os R$97 cheios: é o que a documentação define e é o motivo
// de usarmos percentualValue em vez de fixedValue. Assim as taxas são divididas
// entre os dois lados na mesma proporção 60/40, e nada precisa ser reajustado à
// mão se o preço ou a taxa mudarem.
//
// Módulo puro de propósito: sem fetch, sem process.env, sem React. É isso que
// permite testar o payload da cobrança em `bun test src` sem encostar na API do
// Asaas — docs/quality/testing.md proíbe teste unitário tocar em rede, mas não
// proíbe testar forma.

// Carteiras hardcoded de propósito: mudar o acordo passa por PR e deploy.
// Variable do painel do Cloudflare está fora de questão, elas são apagadas a
// cada `wrangler deploy` (ver comentário no wrangler.toml), e um valor que some
// não pode decidir para onde vai o dinheiro.

/**
 * Recebedor primário, 60%. NÃO entra no array de split, e isso não é esquecimento:
 * é a carteira da própria conta que emite a cobrança, e o Asaas recusa com
 * "Não é permitido split para sua própria carteira." (400 invalid_action,
 * verificado em produção). Os 60% ficam nela por diferença, que é como o split
 * do Asaas funciona: só se declara o que sai.
 */
export const SPLIT_WALLET_PRIMARY = "37216626-4fc7-4d93-9aa3-8f964d4d268b";

/** Recebedor secundário, 40%. É o único que vai declarado no split. */
export const SPLIT_WALLET_SECONDARY = "1a42abc7-caaf-4ea3-a2a1-19bafc9cdcee";

export const SPLIT_PERCENTUAL_SECONDARY = 40;

/**
 * Identifica o acordo nos relatórios de split do Asaas. Versionado: no dia em
 * que o percentual mudar, bumpar para -v2 faz o corte antes/depois virar um
 * filtro, em vez de arqueologia por data de pagamento.
 */
export const SPLIT_EXTERNAL_REFERENCE = "makershub-anual-split-v1";

export const SPLIT_DESCRIPTION = "MakersHub — acesso anual (parceria 40%)";

export const PRECO_ANUAL = 97;
export const DESCRICAO_COBRANCA = "MakersHub — acesso anual";

export interface AsaasSplit {
  walletId: string;
  percentualValue: number;
  externalReference: string;
  description: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida a configuração ANTES de a requisição sair. Erro de walletId é erro
 * nosso e precisa falhar como erro nosso, determinístico e testável: a mensagem
 * crua do Asaas hoje sobe direto para a tela do comprador.
 */
export function splitDaCobranca(): AsaasSplit[] {
  // Só o que SAI da conta emissora é declarado. Os 60% do primário ficam por
  // diferença: declarar a própria carteira é recusado pela API.
  const rateio = [
    { walletId: SPLIT_WALLET_SECONDARY, percentualValue: SPLIT_PERCENTUAL_SECONDARY },
  ];

  const total = rateio.reduce((soma, r) => soma + r.percentualValue, 0);
  if (total > 100) throw new Error("Configuração de split inválida.");

  for (const r of rateio) {
    if (!UUID.test(r.walletId)) throw new Error("Configuração de split inválida.");
    if (r.percentualValue <= 0) throw new Error("Configuração de split inválida.");
    if (r.walletId === SPLIT_WALLET_PRIMARY) throw new Error("Configuração de split inválida.");
  }

  return rateio.map((r) => ({
    ...r,
    externalReference: SPLIT_EXTERNAL_REFERENCE,
    description: SPLIT_DESCRIPTION,
  }));
}

interface BaseCobranca {
  customerId: string;
  dueDate: string;
  /** Vínculo cobrança↔usuário. Só o fluxo de upgrade preenche. */
  externalReference?: string;
}

export interface DadosCartao {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface TitularCartao {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

/** Corpo da cobrança Pix, sem o split (que é somado na hora do envio). */
export function corpoCobrancaPix(input: BaseCobranca) {
  return {
    customer: input.customerId,
    billingType: "PIX" as const,
    value: PRECO_ANUAL,
    dueDate: input.dueDate,
    description: DESCRICAO_COBRANCA,
    ...(input.externalReference ? { externalReference: input.externalReference } : {}),
  };
}

/** Corpo da cobrança no cartão, sem o split. */
export function corpoCobrancaCartao(
  input: BaseCobranca & {
    remoteIp: string;
    creditCard: DadosCartao;
    creditCardHolderInfo: TitularCartao;
  },
) {
  return {
    customer: input.customerId,
    billingType: "CREDIT_CARD" as const,
    value: PRECO_ANUAL,
    dueDate: input.dueDate,
    description: DESCRICAO_COBRANCA,
    remoteIp: input.remoteIp,
    creditCard: input.creditCard,
    creditCardHolderInfo: input.creditCardHolderInfo,
  };
}
