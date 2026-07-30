import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit } from "./rateLimit";

const META_GRAPH_API_VERSION = "v23.0";
const SITE_ORIGIN = "https://makershub.app.br";

const metaBrowserEventSchema = z.object({
  eventName: z.enum(["PageView", "InitiateCheckout"]),
  eventId: z.string().min(8).max(128),
  eventSourceUrl: z.string().url().max(2048),
  fbp: z.string().max(255).optional(),
  fbc: z.string().max(255).optional(),
});

type MetaUserData = {
  client_ip_address?: string;
  client_user_agent?: string;
  em?: string[];
  ph?: string[];
  fbp?: string;
  fbc?: string;
};

type MetaEvent = {
  event_name: "PageView" | "InitiateCheckout" | "Purchase";
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: MetaUserData;
  custom_data?: {
    currency: "BRL";
    value: number;
    content_name: string;
    content_type: "product";
    content_ids: string[];
  };
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isAllowedSourceUrl(value: string): boolean {
  const url = new URL(value);
  if (url.origin === SITE_ORIGIN || url.origin === "https://www.makershub.app.br") return true;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

async function sendToMeta(event: MetaEvent): Promise<void> {
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  const pixelId = process.env.META_PIXEL_ID;
  if (!accessToken || !pixelId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[meta] META_CONVERSIONS_API_TOKEN ou META_PIXEL_ID ausente");
    }
    return;
  }

  const apiVersion = process.env.META_GRAPH_API_VERSION ?? META_GRAPH_API_VERSION;
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event] }),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Meta Conversions API ${response.status}: ${detail}`);
  }
}

// Chamado pelo navegador para eventos de topo/meio do funil. A falha da
// plataforma de anúncios nunca pode interromper a navegação ou o checkout.
export const trackMetaBrowserEvent = createServerFn({ method: "POST" })
  .inputValidator(metaBrowserEventSchema)
  .handler(async ({ data }) => {
    rateLimit("meta-browser-event", 120, 60 * 60_000);
    if (!isAllowedSourceUrl(data.eventSourceUrl)) return { accepted: false };

    const clientIp = getRequestIP({ xForwardedFor: true });
    const userAgent = getRequestHeader("user-agent");

    const event: MetaEvent = {
      event_name: data.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.eventId,
      event_source_url: data.eventSourceUrl,
      action_source: "website",
      user_data: {
        ...(clientIp ? { client_ip_address: clientIp } : {}),
        ...(userAgent ? { client_user_agent: userAgent } : {}),
        ...(data.fbp ? { fbp: data.fbp } : {}),
        ...(data.fbc ? { fbc: data.fbc } : {}),
      },
      ...(data.eventName === "InitiateCheckout"
        ? {
            custom_data: {
              currency: "BRL",
              value: 97,
              content_name: "MakersHub Anual",
              content_type: "product",
              content_ids: ["makershub-anual"],
            },
          }
        : {}),
    };

    await sendToMeta(event).catch((error) => {
      console.error(
        "[meta] falha ao enviar evento:",
        error instanceof Error ? error.message : error,
      );
    });
    return { accepted: true };
  });

// Purchase só pode nascer no servidor após a confirmação real do pagamento.
// paymentId torna o event_id determinístico e permite deduplicação/idempotência.
export const trackMetaPurchase = createServerOnlyFn(
  async ({ paymentId, email }: { paymentId: string; email: string }): Promise<void> => {
    const userData: MetaUserData = {
      em: [await sha256(normalizeEmail(email))],
    };

    await sendToMeta({
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase_${paymentId}`,
      event_source_url: `${SITE_ORIGIN}/checkout`,
      action_source: "website",
      user_data: userData,
      custom_data: {
        currency: "BRL",
        value: 97,
        content_name: "MakersHub Anual",
        content_type: "product",
        content_ids: ["makershub-anual"],
      },
    }).catch((error) => {
      console.error(
        "[meta] falha ao enviar Purchase:",
        error instanceof Error ? error.message : error,
      );
    });
  },
);
