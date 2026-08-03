// Validação do print anexado ao ticket. Módulo puro (sem React, sem DOM) para
// rodar no servidor e ser testado isolado.

export const MIMES_ACEITOS = ["image/png", "image/jpeg", "image/webp"] as const;
export type MimeAceito = (typeof MIMES_ACEITOS)[number];

/** Teto que o usuário vê: 2 MB de arquivo. */
export const LIMITE_BYTES = 2 * 1024 * 1024;

// base64 infla ~4/3: ceil(2MB/3)*4 = 2_796_204. A folga cobre padding e
// eventual variação de encoder.
export const LIMITE_BASE64 = 2_800_000;

// Barra lixo antes de chamar atob: sem isso um payload inválido derrubaria o
// handler com exceção e viraria 500 em vez de erro de validação limpo.
const BASE64_VALIDO = /^[A-Za-z0-9+/]+={0,2}$/;

export interface AnexoBruto {
  filename: string;
  mime: string;
  base64: string;
}

export type ResultadoAnexo = { ok: true } | { ok: false; erro: string };

function bytesIniciais(base64: string): Uint8Array | null {
  // 24 caracteres base64 = 18 bytes, suficiente para toda assinatura conhecida
  // e barato de decodificar. Múltiplo de 4, então atob não reclama.
  const inicio = base64.slice(0, 24);
  if (inicio.length < 24) return null;
  try {
    const bin = atob(inicio);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function casa(bytes: Uint8Array, offset: number, esperado: number[]): boolean {
  return esperado.every((b, i) => bytes[offset + i] === b);
}

/**
 * Confere se os magic bytes batem com o mime declarado. Mata quem renomeia um
 * executável para .png e declara image/png no formulário.
 */
export function assinaturaBate(base64: string, mime: MimeAceito): boolean {
  const bytes = bytesIniciais(base64);
  if (!bytes) return false;

  if (mime === "image/png") return casa(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/jpeg") return casa(bytes, 0, [0xff, 0xd8, 0xff]);
  // WebP é um container RIFF: "RIFF" nos bytes 0-3 e "WEBP" nos 8-11.
  return casa(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && casa(bytes, 8, [0x57, 0x45, 0x42, 0x50]);
}

export function validarAnexo(anexo: AnexoBruto): ResultadoAnexo {
  if (!MIMES_ACEITOS.includes(anexo.mime as MimeAceito)) {
    return { ok: false, erro: "Formato não aceito. Envie PNG, JPG ou WebP." };
  }
  if (!anexo.filename.trim() || anexo.filename.length > 120) {
    return { ok: false, erro: "Nome de arquivo inválido." };
  }
  if (!anexo.base64) {
    return { ok: false, erro: "Arquivo vazio." };
  }
  if (anexo.base64.length > LIMITE_BASE64) {
    return { ok: false, erro: "A imagem passa de 2 MB." };
  }
  if (!BASE64_VALIDO.test(anexo.base64)) {
    return { ok: false, erro: "Arquivo corrompido." };
  }
  if (!assinaturaBate(anexo.base64, anexo.mime as MimeAceito)) {
    return { ok: false, erro: "O arquivo não parece ser uma imagem válida." };
  }
  return { ok: true };
}

/** Remove separadores de caminho e limita o tamanho do nome que vai pro e-mail. */
export function nomeSeguroDeArquivo(nome: string): string {
  const limpo = nome.replace(/[/\\]/g, "-").replace(/\s+/g, " ").trim();
  return (limpo || "print").slice(0, 120);
}
