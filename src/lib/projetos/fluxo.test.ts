import { describe, expect, test } from "bun:test";
import type { Projeto, Tarefa } from "@/lib/mock/projetos";
import { planejarRemocaoFaseGlobal } from "./fluxo";

const projeto = (id: string, fases: string[]): Projeto =>
  ({ id, fases, fase: "briefing" }) as Projeto;

const tarefa = (id: string, projetoId: string, status: string): Tarefa =>
  ({ id, projetoId, status }) as Tarefa;

describe("exclusão global de uma coluna do fluxo", () => {
  test("remove a coluna em todos os projetos e move tarefas para a etapa anterior", () => {
    const plano = planejarRemocaoFaseGlobal(
      [
        projeto("p1", ["briefing", "edicao", "concluida"]),
        projeto("p2", ["captacao", "edicao", "revisao", "concluida"]),
      ],
      [tarefa("t1", "p1", "edicao"), tarefa("t2", "p2", "edicao")],
      "edicao",
    );

    expect(plano.projetos.map((item) => item.fases)).toEqual([
      ["briefing", "concluida"],
      ["captacao", "revisao", "concluida"],
    ]);
    expect(plano.tarefas.map((item) => item.status)).toEqual(["briefing", "captacao"]);
  });

  test("ao excluir a primeira coluna, usa a próxima como destino", () => {
    const plano = planejarRemocaoFaseGlobal(
      [projeto("p1", ["briefing", "captacao", "concluida"])],
      [tarefa("t1", "p1", "briefing")],
      "briefing",
    );

    expect(plano.projetos[0].fallbackId).toBe("captacao");
    expect(plano.tarefas[0].status).toBe("captacao");
  });

  test("mantém o fluxo válido ao excluir sua única coluna", () => {
    const plano = planejarRemocaoFaseGlobal(
      [projeto("p1", ["edicao"])],
      [tarefa("t1", "p1", "edicao")],
      "edicao",
    );

    expect(plano.projetos[0]).toMatchObject({ fases: ["concluida"], fallbackId: "concluida" });
    expect(plano.tarefas[0].status).toBe("concluida");
  });

  test("corrige tarefa órfã mesmo quando a coluna não consta no fluxo salvo", () => {
    const plano = planejarRemocaoFaseGlobal(
      [projeto("p1", ["captacao", "concluida"])],
      [tarefa("t1", "p1", "edicao")],
      "edicao",
    );

    expect(plano.projetos[0]).toMatchObject({
      fases: ["captacao", "concluida"],
      fallbackId: "captacao",
    });
    expect(plano.tarefas[0].status).toBe("captacao");
  });
});
