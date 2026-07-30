import { createClient } from "@supabase/supabase-js";
import { processarPagamento, supabaseKey, supabaseUrl } from "./api/asaas.functions";
import { handleAsaasWebhook, type AsaasOrderClaim, type AsaasPendingOrder } from "./asaas-webhook";

export async function handleCanonicalAsaasWebhook(
  request: Request,
  schedule?: (task: Promise<void>) => void,
): Promise<Response> {
  const sb = createClient(supabaseUrl(), supabaseKey());
  const claimClient = sb as unknown as {
    rpc: (
      name: "claim_pending_order",
      args: { p_payment_id: string },
    ) => Promise<{ data: AsaasPendingOrder[] | null; error: { message: string } | null }>;
  };

  return handleAsaasWebhook(request, {
    expectedToken: process.env.ASAAS_WEBHOOK_TOKEN,
    claimOrder: async (paymentId): Promise<AsaasOrderClaim> => {
      const { data: claimed, error: claimError } = await claimClient.rpc("claim_pending_order", {
        p_payment_id: paymentId,
      });
      if (claimError) throw new Error("Unable to claim pending order.");
      if (claimed?.[0]) return { state: "claimed", order: claimed[0] };

      const { data: current, error: currentError } = await sb
        .from("pending_orders")
        .select("status")
        .eq("asaas_payment_id", paymentId)
        .single();
      if (currentError || !current) return { state: "missing" };
      if (current.status === "completed") return { state: "completed" };
      return { state: "in_progress" };
    },
    processOrder: async (order) => {
      await processarPagamento({
        paymentId: order.asaas_payment_id,
        nome: order.nome,
        email: order.email,
        empresa: order.empresa_nome,
        orderAlreadyClaimed: true,
      });
    },
    schedule,
  });
}
