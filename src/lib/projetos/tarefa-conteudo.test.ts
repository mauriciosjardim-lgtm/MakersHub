import { describe, expect, test } from "bun:test";
import { juntarConteudoTarefa, separarConteudoTarefa } from "./tarefa-conteudo";

describe("conteúdo textual da tarefa", () => {
  test("mantém descrições antigas compatíveis", () => {
    expect(separarConteudoTarefa("Resumo já existente")).toEqual({
      descricao: "Resumo já existente",
      anotacoes: "",
    });
  });

  test("salva somente a descrição como texto simples", () => {
    expect(juntarConteudoTarefa({ descricao: "Resumo do card", anotacoes: "" })).toBe(
      "Resumo do card",
    );
  });

  test("combina descrição e anotações no mesmo texto", () => {
    const conteudo = {
      descricao: "Resumo do card",
      anotacoes: "Primeira decisão.\n\nReferência: arquivo final.",
    };

    expect(separarConteudoTarefa(juntarConteudoTarefa(conteudo))).toEqual(conteudo);
  });

  test("aceita anotações mesmo sem descrição", () => {
    const conteudo = { descricao: "", anotacoes: "Contexto completo da tarefa." };

    expect(separarConteudoTarefa(juntarConteudoTarefa(conteudo))).toEqual(conteudo);
  });
});
