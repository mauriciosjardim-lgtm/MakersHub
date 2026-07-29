import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleCanonicalAsaasWebhook } from "./lib/asaas-webhook-handler.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const PORTAL_MEDIA_PATH = /^\/api\/portal\/media\/([A-Za-z0-9_-]{10,128})$/;

async function proxyPortalMedia(request: Request, fileId: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) upstreamHeaders.set("range", range);

  const upstream = await fetch(
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
    { method: request.method, headers: upstreamHeaders, redirect: "follow" },
  );

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Media unavailable", { status: upstream.status });
  }

  const headers = new Headers({
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Type": upstream.headers.get("content-type") || "video/mp4",
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://challenges.cloudflare.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://smsqhbbbyjacatxvihks.supabase.co wss://smsqhbbbyjacatxvihks.supabase.co https://connect.facebook.net https://www.facebook.com https://challenges.cloudflare.com https://api.stripe.com",
  "frame-src 'self' https://drive.google.com https://docs.google.com https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

// Headers de segurança aplicados a TODAS as respostas do Worker.
function withSecurityHeaders(response: Response, isHttps: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Primeiro em observação: permite inventariar violações reais sem interromper
  // login, fontes, previews do Drive/Vimeo/YouTube ou propostas existentes.
  headers.set("Content-Security-Policy-Report-Only", CONTENT_SECURITY_POLICY_REPORT_ONLY);
  if (isHttps) {
    // só em produção HTTPS — HSTS em http local atrapalharia o dev
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const isHttps = url.protocol === "https:";

    // Força HTTPS em produção: acesso via http:// (link antigo, digitação na
    // barra) recebe 301 pro equivalente https antes de qualquer conteúdo.
    // localhost fica de fora pra não quebrar dev/preview.
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isHttps && !isLocal) {
      url.protocol = "https:";
      return new Response(null, {
        status: 301,
        headers: { Location: url.toString() },
      });
    }

    // Links antigos podiam carregar o segredo do cofre no path. O portal já
    // resolve o acesso pela sessão autenticada, portanto removemos o token antes
    // de renderizar a aplicação ou disparar recursos externos.
    if (/^\/portal\/[a-f0-9]{24,64}$/i.test(url.pathname)) {
      return withSecurityHeaders(
        new Response(null, {
          status: 302,
          headers: { Location: `${url.origin}/portal/acesso${url.search}` },
        }),
        isHttps,
      );
    }

    if (url.pathname === "/api/asaas/webhook" && request.method === "POST") {
      return withSecurityHeaders(
        await handleCanonicalAsaasWebhook(request, (task) => ctx.waitUntil(task)),
        isHttps,
      );
    }

    const portalMediaMatch = url.pathname.match(PORTAL_MEDIA_PATH);
    if (portalMediaMatch) {
      return withSecurityHeaders(await proxyPortalMedia(request, portalMediaMatch[1]), isHttps);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), isHttps);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        isHttps,
      );
    }
  },
};
