import { Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { TrialExpirado } from "@/components/trial-expirado";
import { SuporteWidget } from "@/components/suporte/suporte-widget";

interface AuthShellProps {
  trialExpirado: boolean;
  sidebarStyle: React.CSSProperties;
}

export function AuthShell({ trialExpirado, sidebarStyle }: AuthShellProps) {
  // Ponto de montagem único do suporte: é o que garante que ele apareça em toda
  // a área autenticada e em nenhuma pública, sem escrever checagem de rota
  // nenhuma (o AppRuntimeShell já filtra landing, portal, login e checkout
  // antes de chegar aqui). O widget fica FORA do early-return do trial porque
  // quem está bloqueado é justamente quem mais precisa falar com a gente.
  return (
    <>
      {trialExpirado ? (
        <TrialExpirado />
      ) : (
        <SidebarProvider defaultOpen={false} style={sidebarStyle} className="pt-2">
          <AppSidebar />
          <SidebarInset className="flex min-h-screen w-full flex-col">
            <Topbar />
            <main className="flex-1 overflow-x-hidden px-2 pb-3 sm:px-3 lg:px-4">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      )}
      <SuporteWidget />
    </>
  );
}
