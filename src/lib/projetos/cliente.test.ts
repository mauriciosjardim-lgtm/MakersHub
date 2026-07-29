import { describe, expect, test } from "bun:test";
import { agruparProjetosPorCliente } from "./cliente";

describe("cards de cliente em Projetos", () => {
  test("usa a mesma coleção para formar o card e contar os projetos", () => {
    const projetos = [
      {
        id: "projeto-1",
        cliente: "A Voz do Churrasco",
        clienteId: "cliente-antigo",
        arquivado: false,
      },
    ];

    const grupos = agruparProjetosPorCliente(projetos, false);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.nome).toBe("A Voz do Churrasco");
    expect(grupos[0]?.projetos.map((projeto) => projeto.id)).toEqual(["projeto-1"]);
  });

  test("consolida diferenças de caixa e espaços sem criar card fantasma", () => {
    const grupos = agruparProjetosPorCliente(
      [
        { id: "projeto-1", cliente: " Aurora Café ", arquivado: false },
        { id: "projeto-2", cliente: "aurora café", arquivado: false },
      ],
      false,
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.projetos).toHaveLength(2);
  });

  test("não mistura projetos ativos e fechados", () => {
    const projetos = [
      { id: "ativo", cliente: "Aurora Café", arquivado: false },
      { id: "fechado", cliente: "Aurora Café", arquivado: true },
    ];

    expect(agruparProjetosPorCliente(projetos, false)[0]?.projetos[0]?.id).toBe("ativo");
    expect(agruparProjetosPorCliente(projetos, true)[0]?.projetos[0]?.id).toBe("fechado");
  });
});
