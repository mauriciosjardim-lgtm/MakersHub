import { describe, expect, test } from "bun:test";
import { etapasComLabels, normalizarLabelsEtapas } from "./etapas";

describe("personalização da Jornada Comercial", () => {
  test("troca somente o nome visual e preserva IDs e cores", () => {
    const etapas = etapasComLabels({ novo: "Prospecção", proposta: "Orçamento enviado" });
    expect(etapas.find((etapa) => etapa.id === "novo")?.label).toBe("Prospecção");
    expect(etapas.find((etapa) => etapa.id === "novo")?.cor).toBe("var(--primary)");
    expect(etapas.find((etapa) => etapa.id === "diagnostico")?.label).toBe("Diagnóstico");
  });

  test("descarta IDs inválidos, valores vazios e limita nomes longos", () => {
    const labels = normalizarLabelsEtapas({
      novo: "  Entrada  ",
      perdido: "",
      inexistente: "Não pode",
      reuniao: "R".repeat(60),
    });
    expect(labels).toEqual({ novo: "Entrada", reuniao: "R".repeat(40) });
  });
});
