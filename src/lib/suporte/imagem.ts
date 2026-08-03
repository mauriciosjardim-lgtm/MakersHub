import {
  LIMITE_BYTES,
  MIMES_ACEITOS,
  nomeSeguroDeArquivo,
  type MimeAceito,
} from "@/lib/suporte/anexo";

// Só cliente: usa canvas e FileReader.
//
// O teto de 2 MB é a regra de entrada (o que o usuário pode escolher). Acima de
// ALVO_BYTES a imagem é reduzida antes de virar base64, por dois motivos: o
// payload trafega menos, e o Worker não gasta CPU parseando uma string de
// ~2,8 MB três vezes (seroval na entrada, JSON na saída para o Resend). No
// plano Free do Cloudflare o orçamento é de 10 ms por request.

const ALVO_BYTES = 600 * 1024;
const LADO_MAX = 1600;

export interface AnexoPreparado {
  filename: string;
  mime: MimeAceito;
  base64: string;
  bytes: number;
}

/** readAsDataURL devolve "data:image/png;base64,AAAA". O Resend quer só o depois da vírgula. */
function lerBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const virgula = url.indexOf(",");
      if (virgula < 0) {
        reject(new Error("Não foi possível ler o arquivo."));
        return;
      }
      resolve(url.slice(virgula + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a imagem."));
    };
    img.src = url;
  });
}

function paraBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  qualidade: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, qualidade));
}

async function reduzir(file: File): Promise<{ blob: Blob; mime: MimeAceito } | null> {
  try {
    const img = await carregarImagem(file);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Safari antigo ignora "image/webp" no toBlob e devolve PNG sem avisar, que
    // costuma sair MAIOR que o original. Por isso conferimos o tipo do blob.
    let blob = await paraBlob(canvas, "image/webp", 0.85);
    let mime: MimeAceito = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await paraBlob(canvas, "image/jpeg", 0.85);
      mime = "image/jpeg";
    }
    if (!blob || blob.type !== mime) return null;
    return { blob, mime };
  } catch {
    return null;
  }
}

function trocarExtensao(nome: string, mime: MimeAceito): string {
  const ext = mime === "image/webp" ? "webp" : "jpg";
  const semExt = nome.replace(/\.[^.]+$/, "");
  return `${semExt || "print"}.${ext}`;
}

/**
 * Valida e converte a imagem escolhida em base64 pronto para o anexo do e-mail.
 * Lança Error com mensagem apresentável ao usuário quando o arquivo não serve.
 */
export async function prepararAnexo(file: File): Promise<AnexoPreparado> {
  if (!MIMES_ACEITOS.includes(file.type as MimeAceito)) {
    throw new Error("Formato não aceito. Envie PNG, JPG ou WebP.");
  }
  if (file.size > LIMITE_BYTES) {
    throw new Error("A imagem passa de 2 MB. Tente um print menor.");
  }
  if (file.size === 0) {
    throw new Error("O arquivo está vazio.");
  }

  const nomeOriginal = nomeSeguroDeArquivo(file.name);

  if (file.size > ALVO_BYTES) {
    const reduzida = await reduzir(file);
    // Se a redução falhar ou não compensar, segue com o original: ele já passou
    // na validação de tamanho, então nunca fica pior do que era.
    if (reduzida && reduzida.blob.size < file.size) {
      return {
        filename: trocarExtensao(nomeOriginal, reduzida.mime),
        mime: reduzida.mime,
        base64: await lerBase64(reduzida.blob),
        bytes: reduzida.blob.size,
      };
    }
  }

  return {
    filename: nomeOriginal,
    mime: file.type as MimeAceito,
    base64: await lerBase64(file),
    bytes: file.size,
  };
}
