import {
  FASES_PADRAO,
  faseParaId,
  getFaseInfo,
  normalizarChaveFase,
  serializarFaseToken,
  type Projeto,
  type Tarefa,
} from "@/lib/mock/projetos";

export type ColunaPipeline = {
  key: string;
  token: string;
  ordem: number;
  personalizada: boolean;
};

export const tokenFaseNoFluxo = (projeto: Projeto, status: string) => {
  const id = faseParaId(status);
  return projeto.fases?.find((item) => faseParaId(item) === id) ?? status;
};

export const chavePipeline = (projeto: Projeto, status: string) => {
  const token = tokenFaseNoFluxo(projeto, status);
  const id = faseParaId(token);
  const label = getFaseInfo(token).label;
  return `${id}::${normalizarChaveFase(label)}`;
};

export const statusAtualPipeline = (projeto: Projeto, tarefas: Tarefa[]) => {
  const tarefasDoProjeto = tarefas.filter((tarefa) => tarefa.projetoId === projeto.id);
  if (tarefasDoProjeto.length === 0) return null;

  const fluxo = projeto.fases ?? FASES_PADRAO;
  const ordem = new Map(fluxo.map((fase, indice) => [faseParaId(fase), indice]));
  const pendentes = tarefasDoProjeto.filter((tarefa) => !tarefa.concluida);

  if (pendentes.length === 0) {
    return (
      fluxo.find((fase) => faseParaId(fase) === "concluida") ??
      fluxo.at(-1) ??
      tarefasDoProjeto.at(-1)!.status
    );
  }

  return [...pendentes].sort((a, b) => {
    const ordemA = ordem.get(faseParaId(a.status)) ?? Number.MAX_SAFE_INTEGER;
    const ordemB = ordem.get(faseParaId(b.status)) ?? Number.MAX_SAFE_INTEGER;
    return ordemA - ordemB;
  })[0].status;
};

export const chaveAtualPipeline = (projeto: Projeto, tarefas: Tarefa[]) => {
  const status = statusAtualPipeline(projeto, tarefas);
  return status ? chavePipeline(projeto, status) : null;
};

export function colunasPipeline(projetos: Projeto[], tarefas: Tarefa[] = []): ColunaPipeline[] {
  const projetoPorId = new Map(projetos.map((projeto) => [projeto.id, projeto]));
  const colunas = new Map<string, ColunaPipeline>();

  projetos.forEach((projeto) => {
    (projeto.fases ?? FASES_PADRAO).forEach((token, indice) => {
      const faseId = faseParaId(token);
      const key = chavePipeline(projeto, faseId);
      if (colunas.has(key)) return;
      const ordemPadrao = FASES_PADRAO.indexOf(faseId);
      colunas.set(key, {
        key,
        token,
        ordem: ordemPadrao >= 0 ? ordemPadrao * 100 + indice : 1000 + indice,
        personalizada: token !== serializarFaseToken(faseId),
      });
    });
  });

  tarefas.forEach((tarefa) => {
    const projeto = projetoPorId.get(tarefa.projetoId);
    if (!projeto) return;
    const token = tokenFaseNoFluxo(projeto, tarefa.status);
    const key = chavePipeline(projeto, tarefa.status);
    if (colunas.has(key)) return;
    colunas.set(key, { key, token, ordem: 2000, personalizada: true });
  });

  return [...colunas.values()].sort(
    (a, b) =>
      a.ordem - b.ordem || getFaseInfo(a.token).label.localeCompare(getFaseInfo(b.token).label),
  );
}
