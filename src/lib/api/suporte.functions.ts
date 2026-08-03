import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/lib/database.types";
import { MODULOS_LABEL, MODULO_ROTA, type Permissoes } from "@/lib/permissoes";
import { LIMITE_BASE64, MIMES_ACEITOS, validarAnexo } from "@/lib/suporte/anexo";
import { labelDoMotivo, motivoSchema } from "@/lib/suporte/motivos";
import { rateLimit } from "./rateLimit";

// Ticket de suporte por e-mail. Sem tabela, sem bucket: o print vai como anexo
// base64 no próprio e-mail, então não há signed URL para expirar nem arquivo
// órfão para limpar depois.

const RESEND_FROM = "MakersHub <equipe@makershub.app.br>";
const DESTINO_SUPORTE = "mauriciosjardim@gmail.com";

function supabaseUrl(): string {
  return (
    (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL ?? ""
  );
}

// Cliente de service role, como nos demais fluxos de servidor. Ele passa por
// cima da RLS, então toda leitura aqui é filtrada pelo userId que veio do JWT
// já validado pelo requireSupabaseAuth — nunca por algo vindo do formulário.
function admin() {
  return createClient<Database>(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

const anexoSchema = z.object({
  filename: z.string().min(1).max(120),
  mime: z.enum(MIMES_ACEITOS),
  base64: z.string().min(1).max(LIMITE_BASE64),
});

interface MetaTicket {
  motivoLabel: string;
  descricao: string;
  temPrint: boolean;
  usuarioNome: string;
  usuarioEmail: string;
  papel: string;
  empresaNome: string;
  plano: string;
  trialExpirado: boolean;
  onde: string;
  url: string;
  navegador: string;
  ip: string;
  tela: string;
  quando: string;
  ids: string;
}

function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normaliza texto que entra no assunto: sem quebra de linha, sem excesso. */
function umaLinha(valor: string, max = 80): string {
  return valor.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Deriva o módulo a partir da rota, para você não precisar perguntar onde foi. */
function moduloDaRota(rota: string): string {
  const achado = (Object.keys(MODULO_ROTA) as (keyof Permissoes)[]).find((modulo) =>
    rota.startsWith(MODULO_ROTA[modulo]),
  );
  if (achado) return MODULOS_LABEL[achado];
  if (rota === "/") return "Dashboard";
  if (rota.startsWith("/configuracoes")) return "Configurações";
  if (rota.startsWith("/area-cliente")) return "Área do cliente";
  if (rota.startsWith("/biblioteca")) return "Biblioteca";
  return "Outro";
}

function linha(rotulo: string, valor: string): string {
  return (
    `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top">${rotulo}</td>` +
    `<td style="padding:6px 0;color:#111827;font-size:13px;word-break:break-word">${esc(valor)}</td></tr>`
  );
}

// E-mail interno, não peça de marca: fundo claro e tabela de contexto, porque o
// que importa aqui é você bater o olho e saber o que fazer.
function templateSuporte(m: MetaTicket): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:18px 22px;border-bottom:1px solid #e5e7eb;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Ticket de suporte</div>
                <div style="margin-top:4px;font-size:17px;font-weight:700;color:#111827;">${esc(m.motivoLabel)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 22px;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Descrição</div>
                <div style="white-space:pre-wrap;font-size:14px;line-height:1.65;color:#111827;">${esc(m.descricao)}</div>
              </td>
            </tr>
            ${
              m.temPrint
                ? `<tr>
              <td style="padding:0 22px 18px 22px;">
                <img src="cid:print-suporte" alt="Print enviado pelo usuário" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;display:block;" />
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:0 22px 22px 22px;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Contexto</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f3f4f6;">
                  ${linha("Usuário", `${m.usuarioNome} <${m.usuarioEmail}>`)}
                  ${linha("Papel", m.papel)}
                  ${linha("Empresa", m.empresaNome)}
                  ${linha("Plano", m.trialExpirado ? `${m.plano} — TRIAL EXPIRADO` : m.plano)}
                  ${linha("Onde estava", m.onde)}
                  ${linha("URL", m.url)}
                  ${linha("Navegador", m.navegador)}
                  ${linha("Tela / fuso", m.tela)}
                  ${linha("IP", m.ip)}
                  ${linha("Quando", m.quando)}
                  ${linha("IDs", m.ids)}
                </table>
              </td>
            </tr>
          </table>
          <div style="max-width:640px;margin-top:12px;font-size:11px;color:#9ca3af;text-align:left;">
            Responda este e-mail para falar direto com o usuário.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const enviarTicketSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    // Sem identidade no payload: quem é o usuário sai da sessão validada.
    z.object({
      motivo: motivoSchema,
      descricao: z.string().trim().min(10).max(4000),
      rota: z.string().max(300),
      url: z.string().url().max(2048),
      viewport: z.string().max(40),
      timezone: z.string().max(60),
      anexo: anexoSchema.nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // A chave do rateLimit é `${bucket}:${ip}`, então pôr o userId no bucket dá
    // um limite por usuário E IP: uma produtora inteira atrás do mesmo NAT do
    // escritório não é punida por causa de um colega.
    rateLimit(`suporte:${context.userId}`, 3, 10 * 60_000);
    rateLimit("suporte-ip", 10, 60 * 60_000);

    if (data.anexo) {
      const veredito = validarAnexo(data.anexo);
      if (!veredito.ok) throw new Error(veredito.erro);
    }

    const sb = admin();
    const { data: usuario } = await sb
      .from("usuarios")
      .select("id, nome, email, cargo, role, empresa_id")
      .eq("id", context.userId)
      .single();
    if (!usuario) throw new Error("Não foi possível identificar sua conta.");

    const { data: empresa } = await sb
      .from("empresas")
      .select("id, nome, plano, trial_expires_at")
      .eq("id", usuario.empresa_id)
      .single();

    const expiraEm = empresa?.trial_expires_at ? new Date(empresa.trial_expires_at) : null;
    const trialExpirado = expiraEm !== null && expiraEm.getTime() < Date.now();

    const agora = new Date();
    const meta: MetaTicket = {
      motivoLabel: labelDoMotivo(data.motivo),
      descricao: data.descricao,
      temPrint: Boolean(data.anexo),
      usuarioNome: usuario.nome ?? "sem nome",
      usuarioEmail: usuario.email ?? "sem e-mail",
      papel: usuario.cargo ? `${usuario.role} — ${usuario.cargo}` : (usuario.role ?? "membro"),
      empresaNome: empresa?.nome ?? "sem empresa",
      plano: empresa?.plano ?? "não informado",
      trialExpirado,
      onde: `${moduloDaRota(data.rota)} — ${data.rota}`,
      url: data.url,
      navegador: getRequestHeader("user-agent") ?? "não informado",
      ip: getRequestIP({ xForwardedFor: true }) ?? "não informado",
      tela: `${data.viewport} · ${data.timezone}`,
      quando: `${agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)`,
      ids: `usuario=${usuario.id} · empresa=${usuario.empresa_id}`,
    };

    const rKey = process.env.RESEND_API_KEY ?? "";
    if (!rKey) {
      console.error("[suporte] RESEND_API_KEY não configurada; ticket não enviado");
      return { ok: true };
    }

    const assunto = `[Suporte] ${meta.motivoLabel} — ${umaLinha(meta.empresaNome)} (${umaLinha(meta.usuarioNome, 40)})`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${rKey}`, "Content-Type": "application/json" },
      // NUNCA logar este body: o base64 do print pode conter dados de cliente e
      // números financeiros da produtora.
      body: JSON.stringify({
        from: RESEND_FROM,
        to: DESTINO_SUPORTE,
        reply_to: meta.usuarioEmail,
        subject: assunto,
        html: templateSuporte(meta),
        tags: [{ name: "motivo", value: data.motivo }],
        ...(data.anexo
          ? {
              attachments: [
                {
                  filename: data.anexo.filename,
                  content: data.anexo.base64,
                  content_type: data.anexo.mime,
                  // Faz o print aparecer inline no corpo e como anexo baixável.
                  content_id: "print-suporte",
                },
              ],
            }
          : {}),
      }),
    });

    if (!resp.ok) {
      console.error("[suporte] Resend falhou ao enviar ticket, status:", resp.status);
      throw new Error("Não conseguimos enviar seu chamado agora. Tente de novo em instantes.");
    }

    return { ok: true };
  });
