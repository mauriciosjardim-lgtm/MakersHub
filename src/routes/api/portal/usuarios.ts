import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = () =>
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL ?? "";
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const Route = createFileRoute("/api/portal/usuarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const context = await requireAdmin(request);
        if (context instanceof Response) return context;

        const body = await readBody(request);
        const clientId = String(body.clientId || "");
        const name = String(body.name || "").trim();
        const email = String(body.email || "")
          .trim()
          .toLowerCase();
        const password = String(body.password || "");

        if (!clientId || !name || !email) {
          return json({ error: "Nome, e-mail e cliente são obrigatórios" }, 400);
        }
        if (password.length < 8) {
          return json({ error: "A senha precisa ter pelo menos 8 caracteres" }, 400);
        }

        const { data: client } = await context.sb
          .from("clientes_comercial")
          .select("id,empresa_id")
          .eq("id", clientId)
          .eq("empresa_id", context.empresaId)
          .maybeSingle();
        if (!client) return json({ error: "Cliente não encontrado" }, 404);

        const [
          { data: internalAccount, error: internalLookupError },
          { data: portalAccount, error: portalLookupError },
        ] = await Promise.all([
          context.sb.from("usuarios").select("id").ilike("email", email).limit(1).maybeSingle(),
          context.sb
            .from("portal_client_users")
            .select("id")
            .ilike("email", email)
            .limit(1)
            .maybeSingle(),
        ]);
        if (internalLookupError || portalLookupError) {
          return json({ error: "Não foi possível validar a disponibilidade do e-mail" }, 500);
        }
        if (internalAccount) {
          return json(
            { error: "Este e-mail já é membro da equipe. Use outro e-mail para o cliente." },
            409,
          );
        }
        if (portalAccount) {
          return json({ error: "Este e-mail já possui acesso a um portal de cliente." }, 409);
        }

        const { data, error } = await context.sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: {
            account_type: "client_portal",
          },
          user_metadata: {
            // O GoTrue pode preencher app_metadata somente após o INSERT em
            // auth.users. O trigger usa este sinal apenas para não criar uma
            // empresa trial; o acesso ao portal continua sendo concedido
            // exclusivamente abaixo, pela API autenticada com service role.
            account_type: "client_portal",
            empresa_id: context.empresaId,
            cliente_id: clientId,
            nome: name,
          },
        });
        if (error || !data.user) {
          return json(
            {
              error:
                "Não foi possível provisionar este acesso. O e-mail pode já estar vinculado a outra conta.",
            },
            500,
          );
        }

        const { error: profileError } = await context.sb.from("portal_client_users").upsert(
          {
            id: data.user.id,
            empresa_id: context.empresaId,
            cliente_id: clientId,
            nome: name,
            email,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (profileError) {
          console.error("[portal/usuarios] falha no upsert:", JSON.stringify(profileError));
          const { data: unexpectedInternalUser } = await context.sb
            .from("usuarios")
            .select("empresa_id")
            .eq("id", data.user.id)
            .maybeSingle();

          if (unexpectedInternalUser?.empresa_id) {
            const { error: cleanupError } = await context.sb.rpc(
              "cleanup_failed_portal_provisioning",
              {
                p_auth_user_id: data.user.id,
                p_empresa_id: unexpectedInternalUser.empresa_id,
              },
            );
            if (cleanupError) {
              console.error(
                "[portal/usuarios] falha ao limpar empresa de provisionamento:",
                JSON.stringify(cleanupError),
              );
            }
          }

          await context.sb.auth.admin.deleteUser(data.user.id);
          return json({ error: "A conta não pôde ser vinculada ao portal do cliente" }, 500);
        }
        return json({ ok: true, userId: data.user.id }, 200);
      },
      PATCH: async ({ request }) => {
        const context = await requireAdmin(request);
        if (context instanceof Response) return context;
        const body = await readBody(request);
        const userId = String(body.userId || "");
        const status = body.status === "inactive" ? "inactive" : "active";

        const { data: portalUser } = await context.sb
          .from("portal_client_users")
          .select("id,empresa_id")
          .eq("id", userId)
          .eq("empresa_id", context.empresaId)
          .maybeSingle();
        if (!portalUser) return json({ error: "Usuário não encontrado" }, 404);

        const { error } = await context.sb
          .from("portal_client_users")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true }, 200);
      },
    },
  },
});

async function requireAdmin(request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) return json({ error: "Servidor não configurado" }, 500);

  const sb = createClient(url, key);
  const { data, error } = await sb.auth.getUser(header.slice(7));
  if (error || !data.user) return json({ error: "Sessão inválida" }, 401);
  const { data: internalUser } = await sb
    .from("usuarios")
    .select("empresa_id,role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!internalUser || internalUser.role !== "admin") {
    return json({ error: "Apenas administradores podem gerenciar acessos" }, 403);
  }
  return { sb, empresaId: internalUser.empresa_id as string };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
