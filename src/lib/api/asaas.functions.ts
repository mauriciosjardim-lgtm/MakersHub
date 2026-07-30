import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "./rateLimit";
import { trackMetaPurchase } from "./meta.functions";

// Integração Asaas (https://docs.asaas.com)
// Auth por header `access_token`. Aceita CPF (pessoa física).
//
// FLUXO CHECKOUT (novos usuários):
//   iniciarPix  → cria pending_order + cobrança Pix (QR Code)
//   checarPix   → polling status Asaas
//   checarPedido→ polling status pending_order (preenchido pelo webhook)
//   pagarCartao → cria pending_order + cobra cartão + cria conta imediatamente
//
// FLUXO UPGRADE (usuários com trial expirado):
//   criarPix    → cobrança Pix simples (sem pending_order)
//   checarPix   → compartilhado
//   finalizarPix→ verifica + libera empresa

function base(): string {
  return process.env.ASAAS_SANDBOX === "true"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function apiKey(): string {
  const k = process.env.ASAAS_API_KEY;
  if (!k) throw new Error("ASAAS_API_KEY not set");
  return k;
}

export function supabaseUrl(): string {
  return (
    (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL ?? ""
  );
}

export function supabaseKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function admin() {
  return createClient(supabaseUrl(), supabaseKey());
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const contatoClienteAsaas = (telefone: string) => {
  const digits = onlyDigits(telefone);
  const isMobile = digits.length === 11 || digits[2] === "9";
  return isMobile ? { mobilePhone: digits } : { phone: digits };
};
const telefoneBR = z.string().refine((value) => /^\d{10,11}$/.test(onlyDigits(value)), {
  message: "Informe um telefone brasileiro com DDD.",
});

type AsaasResponse = {
  id?: string;
  status?: string;
  customer?: string;
  externalReference?: string;
  invoiceUrl?: string;
  payload?: string;
  encodedImage?: string;
  expirationDate?: string;
  email?: string;
  errors?: Array<{ description?: string }>;
};

async function asaas(path: string, init: RequestInit) {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      access_token: apiKey(),
      "Content-Type": "application/json",
      "User-Agent": "MakersHub/1.0",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as AsaasResponse;
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description ?? `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

const PRECO = 97;
const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const RESEND_FROM = "MakersHub <equipe@makershub.app.br>";
const ACTIVATION_TTL_MS = 30 * 60_000;

function segredoAtivacao(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashAtivacao(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Senha temporária criptograficamente aleatória (só existe em memória; o
// usuário define a senha real pelo link de recuperação enviado por e-mail).
function senhaAleatoria(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Gera link de definição de senha (Supabase Admin) e envia via Resend.
// NUNCA retorna o link ao chamador nem o registra em logs.
async function gerarLinkDefinicaoSenha(
  sb: ReturnType<typeof admin>,
  email: string,
): Promise<string> {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email,
    // /auth/reset processa o link e mostra o formulário de nova senha
    // (redirecionar pro /login deixava o usuário sem forma de definir a senha).
    options: { redirectTo: `${process.env.SITE_URL ?? "https://makershub.app.br"}/auth/reset` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    throw new Error(error?.message ?? "Não foi possível gerar o link de ativação.");
  }
  return link;
}

async function enviarLinkDefinicaoSenha(sb: ReturnType<typeof admin>, email: string, nome: string) {
  const link = await gerarLinkDefinicaoSenha(sb, email);
  const rKey = process.env.RESEND_API_KEY ?? "";
  if (!rKey) {
    console.error(
      "[pagamento] RESEND_API_KEY não configurada; e-mail de definição de senha não enviado",
    );
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${rKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: email,
      subject: "Sua conta MakersHub está pronta — crie sua senha",
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#111">Pagamento confirmado 🎉</h2>
          <p>Olá${nome ? `, <strong>${nome.replace(/</g, "&lt;")}</strong>` : ""}! Sua conta no MakersHub foi criada.</p>
          <p>Para acessar, defina sua senha pelo botão abaixo:</p>
          <p style="margin:28px 0">
            <a href="${link}" style="background:#90F826;color:#0d0f0a;font-weight:bold;padding:12px 24px;border-radius:10px;text-decoration:none">Criar minha senha</a>
          </p>
          <p style="color:#666;font-size:13px">Se você não fez esta compra, ignore este e-mail.</p>
        </div>`,
    }),
  });
  if (!resp.ok) {
    // loga só o status — nunca o link
    console.error("[pagamento] Resend falhou ao enviar link de senha, status:", resp.status);
  }
}

// Cria auth user + empresa + usuario via SQL function SECURITY DEFINER.
// Chamada tanto pelo webhook (Pix) quanto direto no handler (Card). A senha
// real nunca passa pelo checkout: ambos usam ativação posterior à compra.
export async function processarPagamento({
  paymentId,
  nome,
  email,
  empresa,
  orderAlreadyClaimed = false,
}: {
  paymentId: string;
  nome: string;
  email: string;
  empresa: string;
  orderAlreadyClaimed?: boolean;
}) {
  const sb = admin();

  // Claim atômico evita que webhook e polling criem usuários concorrentes.
  const claim = orderAlreadyClaimed
    ? { data: [{ asaas_payment_id: paymentId }], error: null }
    : await sb.rpc("claim_pending_order", { p_payment_id: paymentId });
  if (claim.error) throw new Error(claim.error.message);
  if (!claim.data?.length) {
    // Outro Worker pode ter obtido a lease. Aguarda sua conclusão por um
    // intervalo curto para o cartão síncrono não devolver uma falsa falha.
    for (let attempt = 0; attempt < 25; attempt++) {
      const { data: current } = await sb
        .from("pending_orders")
        .select("status,error_msg")
        .eq("asaas_payment_id", paymentId)
        .single();
      if (current?.status === "completed") return;
      if (current?.status === "failed")
        throw new Error(current.error_msg ?? "Falha ao ativar a conta.");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Pagamento confirmado; a conta ainda está sendo ativada.");
  }

  // Cria auth user
  const { data: created, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: senhaAleatoria(),
    email_confirm: true,
    user_metadata: { nome },
  });

  const usuarioJaExiste = Boolean(
    authErr?.code === "email_exists" || /already|registered|exists/i.test(authErr?.message ?? ""),
  );
  if ((authErr && !usuarioJaExiste) || (!created.user && !usuarioJaExiste)) {
    const msg = authErr?.message ?? "Erro ao criar usuário.";
    await sb
      .from("pending_orders")
      .update({ status: "failed", error_msg: msg })
      .eq("asaas_payment_id", paymentId);
    throw new Error(msg);
  }

  // Cria empresa + usuario via função SECURITY DEFINER (bypasssa RLS)
  const { error: rpcErr } = await sb.rpc("criar_conta_paga", {
    p_auth_user_id: created.user?.id ?? null,
    p_nome: nome,
    p_email: email,
    p_empresa_nome: empresa,
    p_payment_id: paymentId,
  });

  if (rpcErr) {
    if (created.user) await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    await sb
      .from("pending_orders")
      .update({ status: "failed", error_msg: rpcErr.message })
      .eq("asaas_payment_id", paymentId);
    throw new Error(rpcErr.message);
  }

  // Todo checkout configura a credencial somente depois da compra. O e-mail é
  // o fallback caso o navegador seja fechado antes da ativação direta.
  await enviarLinkDefinicaoSenha(sb, email, nome).catch((err) => {
    console.error(
      "[pagamento] erro ao enviar e-mail de definição de senha:",
      err instanceof Error ? err.message : err,
    );
  });

  // Best-effort: a compra já foi confirmada e provisionada. Falha na
  // plataforma de anúncios não pode reverter nem atrasar a conta do cliente.
  await trackMetaPurchase({ paymentId, email }).catch((err) => {
    console.error(
      "[pagamento] erro ao registrar Purchase na Meta:",
      err instanceof Error ? err.message : err,
    );
  });
}

// Libera empresa de usuário logado (upgrade trial → vitalício).
async function liberarEmpresa(sb: ReturnType<typeof admin>, userId: string) {
  const { data: usuario } = await sb
    .from("usuarios")
    .select("empresa_id")
    .eq("id", userId)
    .single();
  if (usuario?.empresa_id) {
    await sb.from("empresas").update({ trial_expires_at: null }).eq("id", usuario.empresa_id);
  }
}

// ─────────────────── CHECKOUT: PIX ───────────────────

export const iniciarPix = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      nome: z.string().min(1),
      email: z.string().email(),
      cpfCnpj: z.string().min(11),
      empresa: z.string().min(1),
      telefone: telefoneBR,
    }),
  )
  .handler(async ({ data }) => {
    // Endpoint público: sem limite, um bot cria clientes/cobranças em massa no Asaas.
    rateLimit("checkout-pix", 10, 60 * 60_000);
    const sb = admin();
    const hoje = new Date().toISOString().slice(0, 10);
    const activationSecret = segredoAtivacao();
    const activationSecretHash = await hashAtivacao(activationSecret);

    const cliente = await asaas("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.nome,
        cpfCnpj: onlyDigits(data.cpfCnpj),
        email: data.email,
        ...contatoClienteAsaas(data.telefone),
      }),
    });
    if (!cliente.id) throw new Error("Asaas não retornou o cliente da cobrança.");

    const cobranca = await asaas("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: cliente.id,
        billingType: "PIX",
        value: PRECO,
        dueDate: hoje,
        description: "MakersHub — acesso anual",
      }),
    });
    if (!cobranca.id) throw new Error("Asaas não retornou o identificador do pagamento.");

    // CRÍTICO: persiste o pedido ANTES de buscar o QR. Se o QR falhar (ex.: conta
    // Asaas sem chave Pix), a cobrança já existe e o cliente pode pagar pelo
    // invoiceUrl/e-mail — o webhook acha este pedido e provisiona a conta.
    await sb.from("pending_orders").insert({
      asaas_payment_id: cobranca.id,
      nome: data.nome.trim(),
      email: data.email.trim(),
      empresa_nome: data.empresa.trim(),
      cpf: onlyDigits(data.cpfCnpj),
      billing_type: "PIX",
      status: "pending",
      activation_secret_hash: activationSecretHash,
      activation_expires_at: new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(),
    });

    // QR Code é best-effort — não pode derrubar o checkout
    let brCode = "",
      brCodeBase64 = "",
      expiresAt = "",
      qrErro: string | null = null;
    try {
      const qr = await asaas(`/payments/${cobranca.id}/pixQrCode`, { method: "GET" });
      brCode = (qr.payload as string) ?? "";
      brCodeBase64 = qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : "";
      expiresAt = (qr.expirationDate as string) ?? "";
    } catch (e) {
      qrErro = e instanceof Error ? e.message : "QR Code indisponível";
    }

    return {
      id: cobranca.id as string,
      brCode,
      brCodeBase64,
      expiresAt,
      invoiceUrl: (cobranca.invoiceUrl as string) ?? "",
      qrErro,
      activationSecret,
    };
  });

// ─────────────────── CHECKOUT: STATUS ───────────────────

export const checarPix = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const p = await asaas(`/payments/${data.id}`, { method: "GET" });
    return { status: p.status as string };
  });

// Rede de segurança: se o webhook da Asaas atrasar, falhar ou ficar
// "interrompido" (a Asaas pausa entrega após falhas repetidas), o cliente
// pagou mas nunca teria a conta criada — o polling do checkout ficaria
// preso em "pending" pra sempre. Aqui, a cada consulta de um pedido ainda
// pendente, confere o status direto na Asaas; se já estiver pago,
// processa na hora (processarPagamento é idempotente).
export const checarPedido = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentId: z.string(), activationSecret: z.string().length(64) }))
  .handler(async ({ data }) => {
    const sb = admin();
    const activationSecretHash = await hashAtivacao(data.activationSecret);
    const { data: order } = await sb
      .from("pending_orders")
      .select("*")
      .eq("asaas_payment_id", data.paymentId)
      .eq("activation_secret_hash", activationSecretHash)
      .single();

    if (!order) throw new Error("Sessão de checkout inválida.");

    if (order && order.status === "pending") {
      try {
        const cobranca = await asaas(`/payments/${data.paymentId}`, { method: "GET" });
        if (PAGO.has(cobranca.status ?? "")) {
          await processarPagamento({
            paymentId: order.asaas_payment_id,
            nome: order.nome,
            email: order.email,
            empresa: order.empresa_nome,
          });
          return { status: "completed" as const, error: null };
        }
      } catch (err) {
        console.error(
          "[checarPedido] falha ao reconferir na Asaas:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      status: (order?.status ?? "pending") as "pending" | "completed" | "failed",
      error: order?.error_msg ?? null,
    };
  });

// Define a credencial no pós-compra. O segredo é consumido antes da alteração;
// se o Auth falhar, o link de recuperação enviado por e-mail continua válido.
export const concluirAtivacao = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      paymentId: z.string(),
      activationSecret: z.string().length(64),
      password: z.string().min(8).max(128),
    }),
  )
  .handler(async ({ data }) => {
    rateLimit("checkout-activation", 20, 60 * 60_000);
    const sb = admin();
    const activationSecretHash = await hashAtivacao(data.activationSecret);
    const { data: order } = await sb
      .from("pending_orders")
      .select("auth_user_id,email,status,activation_expires_at,activation_consumed_at")
      .eq("asaas_payment_id", data.paymentId)
      .eq("activation_secret_hash", activationSecretHash)
      .single();

    if (!order || order.status !== "completed") throw new Error("Pagamento ainda não confirmado.");
    if (order.activation_consumed_at) throw new Error("Este link de ativação já foi utilizado.");
    if (new Date(order.activation_expires_at).getTime() <= Date.now()) {
      throw new Error("A ativação direta expirou. Use o link enviado por e-mail.");
    }
    if (!order.auth_user_id) throw new Error("Conta ainda não provisionada.");

    const { data: consumed, error } = await sb
      .from("pending_orders")
      .update({ activation_consumed_at: new Date().toISOString() })
      .eq("asaas_payment_id", data.paymentId)
      .eq("activation_secret_hash", activationSecretHash)
      .is("activation_consumed_at", null)
      .select("id")
      .single();
    if (error || !consumed) throw new Error("Este link de ativação já foi utilizado.");
    const { error: passwordError } = await sb.auth.admin.updateUserById(order.auth_user_id, {
      password: data.password,
    });
    if (passwordError)
      throw new Error("Não foi possível definir a senha. Use o link enviado por e-mail.");
    return { completed: true as const };
  });

export const reenviarAtivacao = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentId: z.string(), activationSecret: z.string().length(64) }))
  .handler(async ({ data }) => {
    rateLimit("checkout-activation-resend", 3, 60 * 60_000);
    const sb = admin();
    const activationSecretHash = await hashAtivacao(data.activationSecret);
    const { data: order } = await sb
      .from("pending_orders")
      .select("nome,email,status,activation_expires_at")
      .eq("asaas_payment_id", data.paymentId)
      .eq("activation_secret_hash", activationSecretHash)
      .single();
    if (!order || order.status !== "completed") throw new Error("Pagamento ainda não confirmado.");
    if (new Date(order.activation_expires_at).getTime() <= Date.now()) {
      throw new Error("Sessão expirada. Solicite uma nova senha pela tela de login.");
    }
    await enviarLinkDefinicaoSenha(sb, order.email, order.nome);
    return { sent: true as const };
  });

// ─────────────────── CHECKOUT: CARTÃO ───────────────────

// Cartão é síncrono: cria pending_order → cobra → cria conta imediatamente.
// Webhook chegará depois e criar_conta_paga é idempotente → no-op.
export const pagarCartao = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      nome: z.string().min(1),
      email: z.string().email(),
      cpfCnpj: z.string().min(11),
      empresa: z.string().min(1),
      telefone: telefoneBR,
      // SEM userId: pagarCartao é EXCLUSIVAMENTE checkout de conta nova.
      // Upgrade de conta existente é outro fluxo (finalizarPix, autenticado).
      card: z.object({
        holderName: z.string().min(1),
        number: z.string().min(12),
        expiryMonth: z.string().min(1),
        expiryYear: z.string().min(2),
        ccv: z.string().min(3),
      }),
      holder: z.object({
        postalCode: z.string().min(8),
        addressNumber: z.string().min(1),
      }),
    }),
  )
  .handler(async ({ data }) => {
    // Endpoint público com dados de cartão: alvo clássico de "card testing".
    rateLimit("checkout-cartao", 5, 60 * 60_000);
    const remoteIp = getRequestIP({ xForwardedFor: true }) ?? "0.0.0.0";
    const sb = admin();
    const activationSecret = segredoAtivacao();
    const activationSecretHash = await hashAtivacao(activationSecret);

    const cliente = await asaas("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.nome,
        cpfCnpj: onlyDigits(data.cpfCnpj),
        email: data.email,
        ...contatoClienteAsaas(data.telefone),
      }),
    });
    if (!cliente.id) throw new Error("Asaas não retornou o cliente da cobrança.");

    const hoje = new Date().toISOString().slice(0, 10);
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: cliente.id,
        billingType: "CREDIT_CARD",
        value: PRECO,
        dueDate: hoje,
        description: "MakersHub — acesso anual",
        remoteIp,
        creditCard: {
          holderName: data.card.holderName,
          number: onlyDigits(data.card.number),
          expiryMonth: data.card.expiryMonth.padStart(2, "0"),
          expiryYear:
            data.card.expiryYear.length === 2 ? `20${data.card.expiryYear}` : data.card.expiryYear,
          ccv: data.card.ccv,
        },
        creditCardHolderInfo: {
          name: data.card.holderName,
          email: data.email,
          cpfCnpj: onlyDigits(data.cpfCnpj),
          postalCode: onlyDigits(data.holder.postalCode),
          addressNumber: data.holder.addressNumber,
          phone: onlyDigits(data.telefone),
        },
      }),
    });
    if (!cobranca.id) throw new Error("Asaas não retornou o identificador do pagamento.");

    if (!PAGO.has(cobranca.status ?? "")) {
      throw new Error("Cartão não aprovado. Tente outro cartão ou use Pix.");
    }

    // Registro do pedido (usado para auditoria; webhook será idempotente)
    await sb.from("pending_orders").upsert({
      asaas_payment_id: cobranca.id,
      nome: data.nome.trim(),
      email: data.email.trim(),
      empresa_nome: data.empresa.trim(),
      cpf: onlyDigits(data.cpfCnpj),
      billing_type: "CREDIT_CARD",
      status: "pending",
      activation_secret_hash: activationSecretHash,
      activation_expires_at: new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(),
    });

    // Cria conta imediatamente (pagamento síncrono confirmado)
    await processarPagamento({
      paymentId: cobranca.id,
      nome: data.nome.trim(),
      email: data.email.trim(),
      empresa: data.empresa.trim(),
    }).catch((error) => {
      // A cobrança já foi aprovada: não induzimos uma segunda tentativa de
      // pagamento. O navegador acompanha o pedido e o webhook pode retentar.
      console.error(
        "[checkout-cartao] pagamento confirmado, provisionamento pendente:",
        error instanceof Error ? error.message : error,
      );
    });

    return { paymentId: cobranca.id as string, activationSecret };
  });

// ─────────────────── UPGRADE: PIX ───────────────────
// Fluxo AUTENTICADO (usuário logado com trial expirado). A identidade vem
// exclusivamente do Bearer token validado pelo requireSupabaseAuth — o
// attachSupabaseAuth (middleware global de client) já envia o header.

// E-mail do usuário autenticado, derivado só da sessão validada (claims do
// JWT; fallback: Admin API). NUNCA do payload do navegador.
async function emailDaSessao(context: {
  userId: string;
  claims: Record<string, unknown>;
}): Promise<string> {
  const fromClaims = typeof context.claims?.email === "string" ? context.claims.email : undefined;
  if (fromClaims) return fromClaims.toLowerCase();
  const { data: got } = await admin().auth.admin.getUserById(context.userId);
  const fromAdmin = got?.user?.email;
  if (!fromAdmin) throw new Error("Não foi possível confirmar o e-mail da sua conta.");
  return fromAdmin.toLowerCase();
}

export const criarPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    // SEM e-mail do navegador: a cobrança é criada para o e-mail da sessão.
    z.object({ nome: z.string().min(1), cpfCnpj: z.string().min(11) }),
  )
  .handler(async ({ data, context }) => {
    // Autenticado, mas ainda cria cobranças no Asaas — limita abuso por conta.
    rateLimit("upgrade-pix", 10, 60 * 60_000);
    const email = await emailDaSessao(context);
    const cliente = await asaas("/customers", {
      method: "POST",
      body: JSON.stringify({ name: data.nome, cpfCnpj: onlyDigits(data.cpfCnpj), email }),
    });
    const hoje = new Date().toISOString().slice(0, 10);
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: cliente.id,
        billingType: "PIX",
        value: PRECO,
        dueDate: hoje,
        description: "MakersHub — acesso anual",
        // Vínculo forte cobrança↔usuário: finalizarPix confere este campo
        // antes de liberar (mais forte que o match por e-mail).
        externalReference: context.userId,
      }),
    });
    let brCode = "",
      brCodeBase64 = "",
      expiresAt = "",
      qrErro: string | null = null;
    try {
      const qr = await asaas(`/payments/${cobranca.id}/pixQrCode`, { method: "GET" });
      brCode = (qr.payload as string) ?? "";
      brCodeBase64 = qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : "";
      expiresAt = (qr.expirationDate as string) ?? "";
    } catch (e) {
      qrErro = e instanceof Error ? e.message : "QR Code indisponível";
    }
    return {
      id: cobranca.id as string,
      brCode,
      brCodeBase64,
      expiresAt,
      invoiceUrl: (cobranca.invoiceUrl as string) ?? "",
      qrErro,
    };
  });

export const finalizarPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    // SEM userId: a conta liberada é SEMPRE a do usuário autenticado.
    z.object({ chargeId: z.string() }),
  )
  .handler(async ({ data, context }) => {
    // 1. Cobrança precisa existir e estar paga no Asaas
    const cobranca = await asaas(`/payments/${data.chargeId}`, { method: "GET" });
    if (!PAGO.has(cobranca.status ?? "")) throw new Error("Pagamento ainda não confirmado.");

    // 2a. Vínculo forte: cobranças criadas por criarPix carregam o userId no
    //     externalReference — se presente, precisa ser o usuário autenticado.
    const extRef = typeof cobranca.externalReference === "string" ? cobranca.externalReference : "";
    if (extRef && extRef !== context.userId) {
      throw new Error("Este pagamento não pertence à sua conta.");
    }

    // 2b. O cliente da cobrança precisa ser o usuário autenticado (por e-mail).
    //     Cobre cobranças antigas sem externalReference — uma cobrança de
    //     terceiro não pode liberar esta conta, nem o inverso.
    const email = await emailDaSessao(context);
    if (!cobranca.customer) throw new Error("Cobrança sem cliente associado.");
    const cliente = await asaas(`/customers/${cobranca.customer}`, { method: "GET" });
    const emailCobranca = typeof cliente?.email === "string" ? cliente.email.toLowerCase() : "";
    if (!emailCobranca || emailCobranca !== email) {
      throw new Error("Este pagamento não pertence à sua conta.");
    }

    // 3. Libera somente a empresa vinculada ao usuário autenticado
    await liberarEmpresa(admin(), context.userId);
    return { ok: true };
  });
