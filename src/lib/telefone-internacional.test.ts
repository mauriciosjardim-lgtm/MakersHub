import { describe, expect, test } from "bun:test";
import {
  PAISES,
  PAIS_PADRAO,
  limitarNacional,
  mascaraBR,
  paraE164,
  paisPorCodigo,
  telefoneParaAsaas,
  telefoneValido,
} from "./telefone-internacional";

describe("catálogo de países", () => {
  test("o Brasil é o padrão e vem primeiro", () => {
    expect(PAIS_PADRAO).toBe("BR");
    expect(PAISES[0].code).toBe("BR");
    expect(PAISES[0].ddi).toBe("55");
  });

  test("todo país tem bandeira derivada do código ISO", () => {
    expect(paisPorCodigo("BR")?.flag).toBe("🇧🇷");
    expect(paisPorCodigo("PT")?.flag).toBe("🇵🇹");
    expect(paisPorCodigo("US")?.flag).toBe("🇺🇸");
  });

  test("não há códigos ISO duplicados", () => {
    const codes = PAISES.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("máscara brasileira", () => {
  test("formata fixo e celular", () => {
    expect(mascaraBR("1133334444")).toBe("(11) 3333-4444");
    expect(mascaraBR("11999998888")).toBe("(11) 99999-8888");
  });

  test("formata parcialmente enquanto digita", () => {
    expect(mascaraBR("1")).toBe("1");
    expect(mascaraBR("11")).toBe("11");
    expect(mascaraBR("119")).toBe("(11) 9");
    expect(mascaraBR("119999")).toBe("(11) 9999");
  });

  test("descarta o excedente além de 11 dígitos", () => {
    expect(mascaraBR("11999998888777")).toBe("(11) 99999-8888");
  });
});

describe("entrada por país", () => {
  test("fora do Brasil não aplica máscara brasileira", () => {
    expect(limitarNacional("2015550123", "US")).toBe("2015550123");
    expect(limitarNacional("912 345 678", "PT")).toBe("912345678");
  });

  test("no Brasil aplica a máscara", () => {
    expect(limitarNacional("11999998888", "BR")).toBe("(11) 99999-8888");
  });
});

describe("validação", () => {
  test("Brasil exige 10 ou 11 dígitos", () => {
    expect(telefoneValido("(11) 3333-4444", "BR")).toBe(true);
    expect(telefoneValido("(11) 99999-8888", "BR")).toBe(true);
    expect(telefoneValido("119999", "BR")).toBe(false);
    expect(telefoneValido("119999988887", "BR")).toBe(false);
  });

  test("fora do Brasil aceita faixa ampla, porque não temos tabela de formatos", () => {
    expect(telefoneValido("912345678", "PT")).toBe(true);
    expect(telefoneValido("2015550123", "US")).toBe(true);
    expect(telefoneValido("12345", "PT")).toBe(false);
  });
});

describe("E.164 para o banco", () => {
  test("prefixa o DDI e remove a máscara", () => {
    expect(paraE164("(11) 99999-8888", "BR")).toBe("+5511999998888");
    expect(paraE164("912345678", "PT")).toBe("+351912345678");
    expect(paraE164("2015550123", "US")).toBe("+12015550123");
  });

  test("recusa país desconhecido", () => {
    expect(() => paraE164("999999999", "XX")).toThrow();
  });
});

describe("o que vai para o Asaas", () => {
  test("número brasileiro vai só com DDD, sem DDI e sem máscara", () => {
    expect(telefoneParaAsaas("(11) 99999-8888", "BR")).toBe("11999998888");
    expect(telefoneParaAsaas("(11) 3333-4444", "BR")).toBe("1133334444");
  });

  test("qualquer outro país não vai: o campo é opcional na API", () => {
    // O Asaas valida telefone como brasileiro. Mandar um número de fora faria
    // a cobrança inteira falhar por causa de um campo opcional.
    expect(telefoneParaAsaas("912345678", "PT")).toBeNull();
    expect(telefoneParaAsaas("2015550123", "US")).toBeNull();
    expect(telefoneParaAsaas("11999998888", "AR")).toBeNull();
  });

  test("número brasileiro malformado também não vai", () => {
    expect(telefoneParaAsaas("119", "BR")).toBeNull();
  });
});
