import { FASES_PADRAO, faseParaId, type Projeto, type Tarefa } from "@/lib/mock/projetos";

export interface AtualizacaoProjetoAposRemocao {
  projetoId: string;
  fases: string[];
  fallbackId: string;
}

export interface PlanoRemocaoFase {
  alvoId: string;
  projetos: AtualizacaoProjetoAposRemocao[];
  tarefas: Array<{ tarefaId: string; projetoId: string; status: string }>;
}

export function planejarRemocaoFaseGlobal(
  projetos: Projeto[],
  tarefas: Tarefa[],
  fase: string,
): PlanoRemocaoFase {
  const alvoId = faseParaId(fase);
  const projetosAfetados: AtualizacaoProjetoAposRemocao[] = [];
  const fallbackPorProjeto = new Map<string, string>();
  const projetosComTarefaNaFase = new Set(
    tarefas
      .filter((tarefa) => faseParaId(tarefa.status) === alvoId)
      .map((tarefa) => tarefa.projetoId),
  );

  for (const projeto of projetos) {
    const fluxo = projeto.fases ?? [...FASES_PADRAO];
    const indice = fluxo.findIndex((item) => faseParaId(item) === alvoId);
    if (indice < 0 && !projetosComTarefaNaFase.has(projeto.id)) continue;

    const fasesSemAlvo = fluxo.filter((item) => faseParaId(item) !== alvoId);
    const fases = fasesSemAlvo.length > 0 ? fasesSemAlvo : ["concluida"];

    const anterior = indice >= 0 ? fluxo[indice - 1] : undefined;
    const proxima = indice >= 0 ? fluxo[indice + 1] : undefined;
    const fallbackId = faseParaId(anterior ?? proxima ?? fases[0]) || "concluida";
    fallbackPorProjeto.set(projeto.id, fallbackId);
    projetosAfetados.push({
      projetoId: projeto.id,
      fases,
      fallbackId,
    });
  }

  const tarefasAfetadas = tarefas
    .filter((tarefa) => faseParaId(tarefa.status) === alvoId)
    .map((tarefa) => ({
      tarefaId: tarefa.id,
      projetoId: tarefa.projetoId,
      status: fallbackPorProjeto.get(tarefa.projetoId) ?? "concluida",
    }));

  return { alvoId, projetos: projetosAfetados, tarefas: tarefasAfetadas };
}
