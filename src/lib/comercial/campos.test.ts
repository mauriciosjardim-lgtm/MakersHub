import { describe, expect, test } from "bun:test";
import {
  CAMPO_NAO_INFORMADO,
  normalizarCampoComercial,
  textoOpcionalNaoVazio,
  valoresUnicosNaoVazios,
} from "./campos";

describe("normalização dos campos do Comercial", () => {
  test("substitui texto vazio ou só com espaços pelo valor seguro", () => {
    expect(normalizarCampoComercial("")).toBe(CAMPO_NAO_INFORMADO);
    expect(normalizarCampoComercial("   ")).toBe(CAMPO_NAO_INFORMADO);
    expect(normalizarCampoComercial("  Ana  ")).toBe("Ana");
    expect(normalizarCampoComercial("", "Você")).toBe("Você");
  });

  test("normaliza texto opcional vazio para null", () => {
    expect(textoOpcionalNaoVazio(undefined)).toBeNull();
    expect(textoOpcionalNaoVazio(" \n ")).toBeNull();
    expect(textoOpcionalNaoVazio("  Porto Alegre  ")).toBe("Porto Alegre");
  });

  test("gera opções únicas sem nenhum valor inválido para SelectItem", () => {
    const opcoes = valoresUnicosNaoVazios([
      "",
      "   ",
      "Ana",
      " Ana ",
      null,
      undefined,
      "Indicação",
    ]);

    expect(opcoes).toEqual(["Ana", "Indicação"]);
    expect(opcoes.every((opcao) => opcao.length > 0)).toBeTrue();
  });
});
