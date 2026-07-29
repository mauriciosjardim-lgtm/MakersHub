export type ProjetoComCliente = {
  clienteId?: string | null;
  cliente: string;
};

export type ClienteIdentificavel = {
  id: string;
  nome: string;
};

export type ProjetoAgrupavel = ProjetoComCliente & {
  id: string;
  arquivado?: boolean | null;
};

export type GrupoProjetosCliente<T extends ProjetoAgrupavel> = {
  chave: string;
  nome: string;
  projetos: T[];
};

export function normalizeClientName(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

/**
 * `clienteId` é a identidade canônica. O nome só serve como compatibilidade
 * para projetos antigos que ainda não foram vinculados ao cadastro do CRM.
 */
export function projectBelongsToClient(
  project: ProjetoComCliente,
  client: ClienteIdentificavel,
): boolean {
  if (project.clienteId) return project.clienteId === client.id;
  return normalizeClientName(project.cliente) === normalizeClientName(client.nome);
}

export function findProjectClient<T extends ClienteIdentificavel>(
  project: ProjetoComCliente,
  clients: T[],
): T | undefined {
  if (project.clienteId) return clients.find((client) => client.id === project.clienteId);
  return clients.find(
    (client) => normalizeClientName(client.nome) === normalizeClientName(project.cliente),
  );
}

/**
 * Monta os cards de cliente a partir dos próprios projetos que serão exibidos.
 * A mesma coleção alimenta o contador e o destino do clique, impedindo cards
 * com "0 projetos" causados por divergência temporária de cliente_id.
 */
export function agruparProjetosPorCliente<T extends ProjetoAgrupavel>(
  projects: T[],
  arquivados: boolean,
): GrupoProjetosCliente<T>[] {
  const grupos = new Map<string, GrupoProjetosCliente<T>>();

  for (const project of projects) {
    if (Boolean(project.arquivado) !== arquivados) continue;
    const nome = project.cliente.trim();
    const chave = normalizeClientName(nome);
    if (!nome || !chave) continue;

    const existente = grupos.get(chave);
    if (existente) existente.projetos.push(project);
    else grupos.set(chave, { chave, nome, projetos: [project] });
  }

  return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
