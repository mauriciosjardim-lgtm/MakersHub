export type Permissoes = {
  comercial: boolean;
  projetos: boolean;
  agenda: boolean;
  financeiro: boolean;
  orcamentos: boolean;
  propostas: boolean;
  contratos: boolean;
  performance: boolean;
};

export const PERMISSOES_PADRAO: Permissoes = {
  comercial: true,
  projetos: true,
  agenda: true,
  financeiro: false,
  orcamentos: true,
  propostas: true,
  contratos: false,
  performance: false,
};

export const MODULOS_LABEL: Record<keyof Permissoes, string> = {
  comercial: "Comercial / CRM",
  projetos: "Projetos",
  agenda: "Agenda",
  financeiro: "Financeiro",
  orcamentos: "Orçamentos",
  propostas: "Propostas",
  contratos: "Contratos",
  performance: "Performance",
};

// Mapa módulo → prefixo de rota (para bloqueio no __root)
export const MODULO_ROTA: Record<keyof Permissoes, string> = {
  comercial: "/comercial",
  projetos: "/projetos",
  agenda: "/agenda",
  financeiro: "/financeiro",
  orcamentos: "/orcamentos",
  propostas: "/propostas",
  contratos: "/contratos",
  performance: "/performance",
};

export function temAcesso(
  permissoes: Partial<Permissoes> | null | undefined,
  modulo: keyof Permissoes,
): boolean {
  if (!permissoes) return true; // sem restrição = admin
  return permissoes[modulo] === true;
}

export function usuarioTemAcesso(
  role: string | null | undefined,
  permissoes: Partial<Permissoes> | null | undefined,
  modulo: keyof Permissoes,
): boolean {
  return role === "admin" || temAcesso(permissoes, modulo);
}
