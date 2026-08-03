import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, lazy, Suspense, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { getSessionHint } from "@/lib/sessionHint";
import { SalesLandingPage } from "@/components/landing/sales-landing-page";
import { MakersHubUpdatedScreen } from "@/components/makershub-updated-screen";
import { trackMetaPageView } from "@/lib/meta-pixel";

const AppRuntimeShell = lazy(() =>
  import("@/components/app-runtime-shell").then((m) => ({ default: m.AppRuntimeShell })),
);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O caminho que você procura não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-glow"
          >
            Voltar ao Cockpit
          </Link>
        </div>
      </div>
    </div>
  );
}

// Erros de carregamento de chunk (hash desatualizado após deploy) → recarrega 1x
function isChunkLoadError(error: Error): boolean {
  const m = `${error?.message ?? ""} ${error?.name ?? ""}`.toLowerCase();
  return (
    m.includes("dynamically imported module") ||
    m.includes("failed to fetch dynamically imported") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported") ||
    m.includes("chunkloaderror") ||
    m.includes("'text/html' is not a valid javascript")
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      if (!sessionStorage.getItem("mh_chunk_reload")) {
        sessionStorage.setItem("mh_chunk_reload", String(Date.now()));
        const reload = window.setTimeout(() => window.location.reload(), 1400);
        return () => window.clearTimeout(reload);
      }
      return;
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, chunkError]);

  if (chunkError) {
    return (
      <MakersHubUpdatedScreen manualReload={Boolean(sessionStorage.getItem("mh_chunk_reload"))} />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou volte para o cockpit.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-glow"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-1 px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Cockpit
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "MakersHub — O Hub Completo para Produtoras de Audiovisual" },
      {
        name: "description",
        content:
          "MakersHub centraliza CRM, propostas, contratos, projetos, agenda e financeiro da sua produtora audiovisual em um único hub.",
      },
      { name: "theme-color", content: "#0a0a0a" },
      {
        property: "og:title",
        content: "MakersHub — O Hub Completo para Produtoras de Audiovisual",
      },
      {
        property: "og:description",
        content:
          "MakersHub centraliza CRM, propostas, contratos, projetos, agenda e financeiro da sua produtora audiovisual em um único hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "MakersHub — O Hub Completo para Produtoras de Audiovisual",
      },
      {
        name: "twitter:description",
        content:
          "MakersHub centraliza CRM, propostas, contratos, projetos, agenda e financeiro da sua produtora audiovisual em um único hub.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c09fe081-0f6c-4b62-8b4c-fc40cb15872a/id-preview-eb58ae41--539069a7-70fd-4ddd-927b-677bb0426890.lovable.app-1781488459803.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c09fe081-0f6c-4b62-8b4c-fc40cb15872a/id-preview-eb58ae41--539069a7-70fd-4ddd-927b-677bb0426890.lovable.app-1781488459803.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Aquece a conexão com o Supabase (auth + dados) — economiza o DNS+TLS
      // da primeira chamada, que é caro em rede móvel.
      {
        rel: "preconnect",
        href: "https://smsqhbbbyjacatxvihks.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "dns-prefetch", href: "https://smsqhbbbyjacatxvihks.supabase.co" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // O player do Drive é pesado. Antecipar DNS e TLS reduz a espera quando o
      // cliente abre a central de aprovações, especialmente em redes móveis.
      { rel: "preconnect", href: "https://drive.google.com" },
      { rel: "dns-prefetch", href: "https://drive.google.com" },
      { rel: "preconnect", href: "https://docs.google.com" },
      { rel: "dns-prefetch", href: "https://docs.google.com" },
    ],
    scripts: [
      {
        // O PageView é disparado pelo MetaPageViewTracker com event_id, permitindo
        // deduplicar o evento enviado em paralelo pela Conversions API.
        children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1576110244237458');`,
      },
      {
        // Carrega Google Fonts de forma não-bloqueante — não trava o primeiro paint
        children: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..700&family=Inter+Tight:ital,wght@0,300..800;1,300..700&display=swap';document.head.appendChild(l);})();`,
      },
    ],
  }),
  // Dica de sessão (cookie mh_s) lida NO SERVIDOR pela API oficial (getCookie
  // via server fn) e serializada com o loader data — SSR e primeira renderização
  // do cliente enxergam o mesmo valor, sem localStorage/document.cookie no render.
  loader: async () => {
    try {
      return { sessionHint: await getSessionHint() };
    } catch (err) {
      console.warn("[root] falha ao ler dica de sessão; tratando como visitante:", err);
      return { sessionHint: false };
    }
  },
  // a dica só importa para a PRIMEIRA renderização; navegações não precisam reler
  staleTime: Infinity,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { sessionHint } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    trackMetaPageView();
  }, [pathname]);

  // Caminho crítico do anúncio: visitante na home não precisa inicializar
  // Supabase/Auth nem esperar chunk lazy da landing. Isso evita a tela escura
  // em Safari/rede móvel antes do primeiro conteúdo útil.
  if (!sessionHint && pathname === "/") {
    return (
      <QueryClientProvider client={queryClient}>
        <SalesLandingPage />
        <Toaster position="top-center" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<MakersHubUpdatedScreen />}>
        <AppRuntimeShell sessionHint={sessionHint} />
      </Suspense>
      {/* top-center de propósito: o default do sonner é bottom-right, que fica
          exatamente em cima do botão flutuante de suporte (e cobriria até o
          toast de sucesso disparado pelo próprio widget). */}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
