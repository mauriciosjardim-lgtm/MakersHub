import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const filtros = readFileSync("src/components/comercial/filtros-bar.tsx", "utf8");
const hook = readFileSync("src/lib/hooks/useComercial.ts", "utf8");

describe("proteção do Comercial contra campos vazios", () => {
  test("protege filtros e store contra valores vazios de qualquer origem", () => {
    expect(filtros).toContain("valoresUnicosNaoVazios(leads.map");
    expect(filtros).toContain("valoresUnicosNaoVazios(empresas.map");
    expect(hook).toContain("responsavel: normalizarCampoComercial(r.responsavel)");
    expect(hook).toContain("cidade: normalizarCampoComercial(r.cidade)");
    expect(hook).toContain("patchNormalizado.responsavel = normalizarCampoComercial");
    expect(hook).toContain("patchNormalizado.cidade = normalizarCampoComercial");
  });
});
