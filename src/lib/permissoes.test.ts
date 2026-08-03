import { describe, expect, test } from "bun:test";
import { usuarioTemAcesso, type Permissoes } from "./permissoes";

describe("permissões independentes por módulo", () => {
  const gestoraDeProjetos: Partial<Permissoes> = {
    projetos: true,
    comercial: false,
  };

  test("acesso a Projetos não concede nem exige acesso ao Comercial", () => {
    expect(usuarioTemAcesso("membro", gestoraDeProjetos, "projetos")).toBe(true);
    expect(usuarioTemAcesso("membro", gestoraDeProjetos, "comercial")).toBe(false);
  });

  test("administradores preservam acesso a todos os módulos", () => {
    expect(usuarioTemAcesso("admin", {}, "projetos")).toBe(true);
    expect(usuarioTemAcesso("admin", {}, "comercial")).toBe(true);
  });
});
