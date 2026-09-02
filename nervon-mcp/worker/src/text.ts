export function textoOpcionalNaoVazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return valor.trim() || null;
}
