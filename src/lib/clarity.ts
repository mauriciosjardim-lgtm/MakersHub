// Microsoft Clarity, restrito ao funil de pagamento.
//
// O script NÃO fica no `__root` de propósito: gravação de sessão só interessa
// no checkout, e carregá-la no app inteiro custaria banda e privacidade sem
// contrapartida. Também não dá para usar `head: () => ({ scripts })` na rota:
// nesta versão do TanStack Start só os scripts do root chegam ao HTML.

const CLARITY_ID = "ybgakv4xe0";
const TAG_ID = "ms-clarity";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

function clarityGlobal(): ClarityFn | undefined {
  return (window as typeof window & { clarity?: ClarityFn }).clarity;
}

/**
 * Injeta a tag do Clarity e começa a gravar. Seguro para chamar em efeito de
 * montagem: execução no servidor vira no-op e a segunda montagem apenas religa
 * a gravação, sem injetar a tag de novo.
 */
export function carregarClarity(): void {
  if (typeof document === "undefined") return;

  if (document.getElementById(TAG_ID)) {
    clarityGlobal()?.("start");
    return;
  }

  // Enfileira chamadas feitas antes de a tag terminar de carregar.
  const fila: ClarityFn = (...args: unknown[]) => {
    (fila.q = fila.q ?? []).push(args);
  };
  (window as typeof window & { clarity?: ClarityFn }).clarity ??= fila;

  const tag = document.createElement("script");
  tag.id = TAG_ID;
  tag.async = true;
  tag.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(tag);
}

/**
 * Para a gravação ao sair do checkout. Remover a tag não bastaria: uma vez
 * carregado, o Clarity continua gravando a navegação seguinte dentro da SPA.
 */
export function pausarClarity(): void {
  if (typeof window === "undefined") return;
  clarityGlobal()?.("stop");
}
