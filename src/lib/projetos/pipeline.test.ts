import { describe, expect, test } from "bun:test";
import { serializarFaseToken, type Projeto, type Tarefa } from "@/lib/mock/projetos";
import {
  chaveAtualPipeline,
  chavePipeline,
  colunasPipeline,
  statusAtualPipeline,
} from "./pipeline";

const projeto = (id: string, fases: string[]): Projeto => ({
  id,
  nome: id,
  cliente: `Cliente ${id}`,
  fase: "briefing",
  progresso: 0,
  fases,
  equipe: [],
  dataInicio: "2026-07-01",
  valor: 0,
  cor: "primary",
  criadoEm: "2026-07-01",
});

const tarefa = (id: string, projetoId: string, status: string, concluida = false): Tarefa =>
  ({ id, projetoId, status, concluida }) as Tarefa;

describe("posição atual de um projeto na Pipeline", () => {
  test("cada projeto ocupa somente a primeira etapa que ainda tem tarefa pendente", () => {
    const projetoAtual = projeto("p1", ["briefing", "captacao", "edicao", "concluida"]);
    const tarefas = [
      tarefa("t1", "p1", "briefing", true),
      tarefa("t2", "p1", "captacao"),
      tarefa("t3", "p1", "edicao"),
    ];

    expect(statusAtualPipeline(projetoAtual, tarefas)).toBe("captacao");
    expect(chaveAtualPipeline(projetoAtual, tarefas)).toBe(chavePipeline(projetoAtual, "captacao"));
  });

  test("projeto concluído fica na coluna final e projeto sem tarefas não é inventado", () => {
    const projetoAtual = projeto("p1", ["briefing", "concluida"]);
    expect(statusAtualPipeline(projetoAtual, [tarefa("t1", "p1", "briefing", true)])).toBe(
      "concluida",
    );
    expect(statusAtualPipeline(projetoAtual, [])).toBeNull();
  });
});

describe("identidade das colunas da Pipeline", () => {
  test("renomear uma etapa em apenas um projeto cria uma coluna independente", () => {
    const padrao = projeto("padrao", ["briefing", "edicao", "concluida"]);
    const local = projeto("local", [
      serializarFaseToken("briefing", "Edição"),
      "edicao",
      "concluida",
    ]);

    expect(chavePipeline(padrao, "briefing")).not.toBe(chavePipeline(local, "briefing"));
    expect(
      colunasPipeline([padrao, local]).filter((coluna) => coluna.token.includes("Edição")),
    ).toHaveLength(1);
  });

  test("replicar o mesmo fluxo faz os projetos compartilharem a coluna renomeada", () => {
    const token = serializarFaseToken("briefing", "Entrada do cliente");
    const primeiro = projeto("primeiro", [token, "edicao", "concluida"]);
    const segundo = projeto("segundo", [token, "edicao", "concluida"]);

    expect(chavePipeline(primeiro, "briefing")).toBe(chavePipeline(segundo, "briefing"));
    expect(
      colunasPipeline([primeiro, segundo]).filter((coluna) => coluna.token === token),
    ).toHaveLength(1);
  });
});
