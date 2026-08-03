import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_BASE64, nomeSeguroDeArquivo, validarAnexo } from "./anexo.ts";

// Monta um base64 de 32 bytes começando pelos magic bytes informados.
function b64(cabecalho: number[]): string {
  const bytes = new Uint8Array(32);
  cabecalho.forEach((b, i) => {
    bytes[i] = b;
  });
  return Buffer.from(bytes).toString("base64");
}

const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = b64([0xff, 0xd8, 0xff]);
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const base = { filename: "print.png", mime: "image/png" };

describe("validarAnexo", () => {
  it("aceita PNG, JPEG e WebP com assinatura correta", () => {
    assert.deepEqual(validarAnexo({ filename: "p.png", mime: "image/png", base64: PNG }), {
      ok: true,
    });
    assert.deepEqual(validarAnexo({ filename: "p.jpg", mime: "image/jpeg", base64: JPEG }), {
      ok: true,
    });
    assert.deepEqual(validarAnexo({ filename: "p.webp", mime: "image/webp", base64: WEBP }), {
      ok: true,
    });
  });

  it("recusa quando o mime declarado não bate com os magic bytes", () => {
    // Renomear um arquivo não muda o conteúdo: bytes de JPEG declarados como PNG.
    const r = validarAnexo({ ...base, base64: JPEG });
    assert.equal(r.ok, false);
  });

  it("recusa formato fora da allowlist", () => {
    const r = validarAnexo({ filename: "a.gif", mime: "image/gif", base64: PNG });
    assert.equal(r.ok, false);
  });

  it("recusa base64 com caracteres inválidos sem lançar exceção", () => {
    const r = validarAnexo({ ...base, base64: "!!!! não é base64 ####" });
    assert.equal(r.ok, false);
  });

  it("recusa conteúdo curto demais para conter uma assinatura", () => {
    const r = validarAnexo({ ...base, base64: "iVBO" });
    assert.equal(r.ok, false);
  });

  it("recusa acima do limite de 2 MB", () => {
    const r = validarAnexo({ ...base, base64: "A".repeat(LIMITE_BASE64 + 1) });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.erro.includes("2 MB"), true);
  });

  it("recusa arquivo vazio e nome inválido", () => {
    assert.equal(validarAnexo({ ...base, base64: "" }).ok, false);
    assert.equal(validarAnexo({ filename: "  ", mime: "image/png", base64: PNG }).ok, false);
    assert.equal(
      validarAnexo({ filename: "x".repeat(121), mime: "image/png", base64: PNG }).ok,
      false,
    );
  });
});

describe("nomeSeguroDeArquivo", () => {
  it("remove separadores de caminho", () => {
    assert.equal(nomeSeguroDeArquivo("../../etc/passwd"), "..-..-etc-passwd");
    assert.equal(nomeSeguroDeArquivo("C:\\temp\\print.png"), "C:-temp-print.png");
  });

  it("cai para um nome padrão quando vem vazio", () => {
    assert.equal(nomeSeguroDeArquivo("   "), "print");
  });

  it("limita o tamanho", () => {
    assert.equal(nomeSeguroDeArquivo("a".repeat(300)).length, 120);
  });
});
