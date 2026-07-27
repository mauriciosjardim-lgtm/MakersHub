import { describe, expect, test } from "bun:test";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { strToU8, zipSync } from "fflate";
import {
  analisarLinhasContatos,
  chaveContato,
  converterLinhasEmContatos,
  gerarCsvContatos,
  inferirMapeamento,
  parseArquivoContatos,
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
      "email:a@x.com",
    );
    expect(chaveContato({ nome: "B", empresa: "Y", email: "—", telefone: "(11) 99999-8888" })).toBe(
      "telefone:11999998888",
    );
    expect(chaveContato({ nome: "João", empresa: "Luz", email: "—", telefone: "—" })).toBe(
      "nome:luz:joao",
    );
  });

  test("lê a primeira aba útil de um XLSX sem executar fórmulas", async () => {
    const domParserOriginal = globalThis.DOMParser;
    globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;
    const bytes = zipSync(
      Object.fromEntries(
        Object.entries({
          "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
              <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
            </Types>`,
          "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>`,
          "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets><sheet name="Vazia" sheetId="1" r:id="rId1"/><sheet name="Clientes" sheetId="2" r:id="rId2"/></sheets>
            </workbook>`,
          "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
            </Relationships>`,
          "xl/worksheets/sheet1.xml": worksheetXml([]),
          "xl/worksheets/sheet2.xml": worksheetXml([
            ["Nome", "Empresa", "E-mail"],
            ["Ana", "Luz", "ana@luz.com"],
          ]),
        }).map(([caminho, conteudo]) => [caminho, strToU8(conteudo)]),
      ),
    );
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    try {
      const planilha = await parseArquivoContatos("clientes.xlsx", buffer);
      expect(planilha.aba).toBe("Clientes");
      expect(planilha.cabecalhos).toEqual(["Nome", "Empresa", "E-mail"]);
      expect(planilha.linhas[0]).toEqual(["Ana", "Luz", "ana@luz.com"]);
    } finally {
      globalThis.DOMParser = domParserOriginal;
    }
  });

  test("classifica erros, repetidos no arquivo e contatos já cadastrados", () => {
    const linhas = [
      ["Ana", "Luz", "ana@luz.com", "11999998888"],
      ["Ana repetida", "Luz", "ANA@LUZ.COM", ""],
      ["Bia", "", "email-invalido", "123"],
      ["Caio", "Sol", "caio@sol.com", "11988887777"],
    ];
    const analise = analisarLinhasContatos(
      linhas,
      { nome: 0, empresa: 1, email: 2, telefone: 3 },
      new Set(["email:caio@sol.com"]),
    );
    expect(analise[0].importavel).toBe(true);
    expect(analise[1].avisos).toContain("duplicado_arquivo");
    expect(analise[1].importavel).toBe(false);
    expect(analise[2].erros).toEqual(
      expect.arrayContaining(["sem_empresa", "email_invalido", "telefone_invalido"]),
    );
    expect(analise[3].avisos).toContain("duplicado_existente");
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

function worksheetXml(linhas: string[][]) {
  const linhasXml = linhas
    .map(
      (linha, indiceLinha) =>
        `<row r="${indiceLinha + 1}">${linha
          .map(
            (valor, indiceColuna) =>
              `<c r="${String.fromCharCode(65 + indiceColuna)}${indiceLinha + 1}" t="inlineStr"><is><t>${valor}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhasXml}</sheetData></worksheet>`;
}
