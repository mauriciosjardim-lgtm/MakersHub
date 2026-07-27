import { describe, expect, test } from "bun:test";
import {
  chaveContato,
  converterLinhasEmContatos,
  gerarCsvContatos,
  inferirMapeamento,
  parsePlanilhaContatos,
} from "./contatos-importacao";

describe("importação de contatos", () => {
  test("lê CSV brasileiro com ponto e vírgula, aspas e acentos", () => {
    const planilha = parsePlanilhaContatos(
      'Nome;Empresa;Cargo;E-mail;Telefone\r\n"Ana Souza";"Estúdio Luz";Diretora;ana@luz.com;11999998888',
    );
    const mapa = inferirMapeamento(planilha.cabecalhos);
    expect(mapa).toEqual({ nome: 0, empresa: 1, cargo: 2, email: 3, telefone: 4 });
    expect(converterLinhasEmContatos(planilha.linhas, mapa)[0]).toMatchObject({
      nome: "Ana Souza",
      empresa: "Estúdio Luz",
      cargo: "Diretora",
      email: "ana@luz.com",
    });
  });

  test("ignora linhas sem nome ou empresa", () => {
    const contatos = converterLinhasEmContatos(
      [
        ["Ana", "Luz"],
        ["", "Outra"],
        ["Carlos", ""],
      ],
      { nome: 0, empresa: 1 },
    );
    expect(contatos).toHaveLength(1);
  });

  test("deduplica primeiro por e-mail, depois telefone e então nome/empresa", () => {
    expect(chaveContato({ nome: "A", empresa: "X", email: "A@X.COM", telefone: "—" })).toBe(
      "email:a x com",
    );
    expect(chaveContato({ nome: "B", empresa: "Y", email: "—", telefone: "(11) 99999-8888" })).toBe(
      "telefone:11999998888",
    );
    expect(chaveContato({ nome: "João", empresa: "Luz", email: "—", telefone: "—" })).toBe(
      "nome:luz:joao",
    );
  });

  test("exporta CSV compatível com Excel e protege fórmulas", () => {
    const csv = gerarCsvContatos(
      [
        {
          id: "c1",
          empresaId: "e1",
          nome: "=IMPORTXML()",
          cargo: "Diretora",
          email: "ana@luz.com",
          telefone: "1199",
          principal: true,
        },
      ],
      [{ id: "e1", nome: "Luz", segmento: "", cidade: "" }],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=IMPORTXML()");
  });
});
