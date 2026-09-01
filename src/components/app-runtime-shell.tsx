import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { applyBrandColor } from "@/lib/brandColor";
import { AuthProvider, useAuth } from "@/lib/auth";
import { MODULO_ROTA, temAcesso, type Permissoes } from "@/lib/permissoes";
import { MakersHubUpdatedScreen } from "@/components/makershub-updated-screen";

const AuthShell = lazy(() =>
  import("@/components/auth-shell").then((m) => ({ default: m.AuthShell })),
);

const PUBLIC_PATHS = ["/login", "/onboarding", "/convite", "/checkout"];
const ALWAYS_PUBLIC = [
  "/home",
  "/lp",
  "/aceitar-convite",
  "/auth/callback",
  "/auth/reset",
  "/termos",
  "/privacidade",
];

const Spinner = (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

export function AppRuntimeShell({ sessionHint }: { sessionHint: boolean }) {
  return (
    <AuthProvider>
      <AppShell sessionHint={sessionHint} />
    </AuthProvider>
  );
}

function AppShell({ sessionHint }: { sessionHint: boolean }) {
  const { session, usuario, loading, empresa } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [preloadRecovery, setPreloadRecovery] = useState<"auto" | "manual" | null>(null);
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAlwaysPublic =
    ALWAYS_PUBLIC.includes(pathname) ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/portal/");

  // Recarrega automaticamente quando um chunk fica desatualizado após deploy.
  // Mantém a trava por alguns segundos após a recarga para evitar loop caso o
  // asset novo ainda não tenha propagado.
  useEffect(() => {
    let reloadTimer: number | undefined;
    const clearReloadLock = window.setTimeout(() => {
      sessionStorage.removeItem("mh_chunk_reload");
    }, 15_000);
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      if (sessionStorage.getItem("mh_chunk_reload")) {
        setPreloadRecovery("manual");
        return;
      }
      sessionStorage.setItem("mh_chunk_reload", String(Date.now()));
      setPreloadRecovery("auto");
      reloadTimer = window.setTimeout(() => window.location.reload(), 1400);
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      window.clearTimeout(clearReloadLock);
      window.removeEventListener("vite:preloadError", onPreloadError);
    };
  }, []);

  useEffect(() => {
    if (empresa?.accent_color) applyBrandColor(empresa.accent_color);
  }, [empresa?.accent_color]);

  useEffect(() => {
    const open = () => navigate({ to: "/login" });
    window.addEventListener("makershub:open-auth", open);
    return () => window.removeEventListener("makershub:open-auth", open);
  }, [navigate]);

  const trialExpirado = (() => {
    if (!empresa?.trial_expires_at) return false;
    const d = new Date(empresa.trial_expires_at);
    return !isNaN(d.getTime()) && d < new Date();
  })();

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "4.5rem",
    "--sidebar": "var(--background)",
    "--sidebar-accent": "color-mix(in srgb, var(--foreground) 7%, var(--background))",
    "--sidebar-border": "color-mix(in srgb, var(--foreground) 7%, transparent)",
  } as CSSProperties;

  if (preloadRecovery) {
    return <MakersHubUpdatedScreen manualReload={preloadRecovery === "manual"} />;
  }

  if (isAlwaysPublic) return <Outlet />;

  if (loading) {
    if (sessionHint) return Spinner;
    if (isPublic) return <Outlet />;
    return Spinner;
  }

  if (session && !usuario) {
    if (pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
    return <Outlet />;
  }

  if (session && usuario) {
    if (isPublic) return <Navigate to="/" replace />;

    // O modo de campo precisa ocupar a tela inteira em celular/tablet, sem a
    // navegação administrativa disputando atenção com a operação ao vivo.
    if (pathname.startsWith("/evento-live/")) return <Outlet />;

    const usuarioAutorizado = usuario as {
      role?: string;
      permissoes?: Partial<Permissoes> | null;
    };
    const role = usuarioAutorizado.role ?? "admin";
    if (role !== "admin") {
      const permissoes = usuarioAutorizado.permissoes ?? null;
      for (const [modulo, rota] of Object.entries(MODULO_ROTA)) {
        if (pathname.startsWith(rota) && !temAcesso(permissoes, modulo as keyof Permissoes)) {
          return <Navigate to="/" replace />;
        }
      }
    }

    return (
      <Suspense fallback={Spinner}>
        <AuthShell trialExpirado={trialExpirado} sidebarStyle={sidebarStyle} />
      </Suspense>
    );
  }

  if (pathname === "/") return <Navigate to="/login" replace />;
  if (isPublic) return <Outlet />;
  return <Navigate to="/login" replace />;
}
