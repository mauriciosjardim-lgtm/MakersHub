import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { textoOpcionalNaoVazio } from "../../nervon-mcp/worker/src/text";

const filtros = readFileSync("src/components/comercial/filtros-bar.tsx", "utf8");
const hook = readFileSync("src/lib/hooks/useComercial.ts", "utf8");
const worker = readFileSync("nervon-mcp/worker/src/index.ts", "utf8");
const rpc = readFileSync("nervon-mcp/sql/mcp_v3.sql", "utf8");

describe("normalização de campos vazios recebidos pelo MCP", () => {
  test("trata texto vazio ou só com espaços como campo omitido", () => {
    expect(textoOpcionalNaoVazio(undefined)).toBeNull();
    expect(textoOpcionalNaoVazio("")).toBeNull();
    expect(textoOpcionalNaoVazio("   ")).toBeNull();
  });

  test("remove espaços externos de texto informado", () => {
    expect(textoOpcionalNaoVazio("  Indicação  ")).toBe("Indicação");
  });

  test("protege filtros, store e entradas MCP contra valores vazios", () => {
    expect(filtros).toContain("valoresUnicosNaoVazios(leads.map");
    expect(filtros).toContain("valoresUnicosNaoVazios(empresas.map");
    expect(hook).toContain("responsavel: normalizarCampoComercial(r.responsavel)");
    expect(hook).toContain("cidade: normalizarCampoComercial(r.cidade)");
    expect(worker).toContain("p_origem: textoOpcionalNaoVazio(args.origem)");
    expect(worker).toContain("p_responsavel: textoOpcionalNaoVazio(args.responsavel)");
    expect(rpc).toContain("coalesce(nullif(btrim(p_origem), ''), origem)");
    expect(rpc).toContain("coalesce(nullif(btrim(p_responsavel), ''), responsavel)");
  });
});
