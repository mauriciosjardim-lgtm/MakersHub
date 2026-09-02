export const CAMPO_NAO_INFORMADO = "Não informado";

export function normalizarCampoComercial(
  valor: string | null | undefined,
  fallback = CAMPO_NAO_INFORMADO,
): string {
  return valor?.trim() || fallback;
}

export function textoOpcionalNaoVazio(valor: string | null | undefined): string | null {
  return valor?.trim() || null;
}

export function valoresUnicosNaoVazios(valores: readonly (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(valores.map((valor) => textoOpcionalNaoVazio(valor)).filter((valor) => valor !== null)),
  );
}
