import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command } from "lucide-react";
import {
  Notification,
  SearchNormal,
  Add,
  Profile2User,
  EmptyWallet,
  Calendar,
} from "iconsax-react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { setPendingCreate } from "@/lib/pendingCreate";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Cockpit", subtitle: "Visão geral da operação" },
  "/comercial": {
    title: "Comercial",
    subtitle: "Jornada Comercial — do primeiro contato ao fechamento",
  },
  "/propostas": { title: "Propostas", subtitle: "Criadas, enviadas e aprovadas" },
  "/contratos": { title: "Contratos", subtitle: "Documentos e assinaturas" },
  "/projetos": { title: "Projetos", subtitle: "Operação em andamento" },
  "/area-cliente": {
    title: "Área do cliente",
    subtitle: "Makers Members — portais, revisões e aprovações",
  },
  "/eventos": { title: "Eventos", subtitle: "Produções e operações em campo" },
  "/novo-evento": { title: "Novo evento", subtitle: "Estrutura inicial da operação" },
  "/operacao-evento": { title: "Operação do evento", subtitle: "Centro de comando" },
  "/agenda": { title: "Agenda", subtitle: "Reuniões, gravações e entregas" },
  "/assistant": { title: "MakersHub Assistant", subtitle: "Inteligência aplicada à sua operação" },
  "/financeiro": { title: "Financeiro", subtitle: "Faturamento, lucro e fluxo" },
  "/calculadoras": { title: "Calculadoras", subtitle: "Orçamento, margem e mais" },
  "/biblioteca": { title: "Biblioteca", subtitle: "Templates e modelos" },
  "/relatorios": { title: "Relatórios", subtitle: "Métricas e performance" },
  "/configuracoes": { title: "Configurações", subtitle: "Brand kit, equipe e integrações" },
};

const ACOES = [
  { tipo: "lead", label: "Novo lead", icon: Profile2User, to: "/comercial/" },
  { tipo: "lancamento", label: "Lançamento financeiro", icon: EmptyWallet, to: "/financeiro" },
  { tipo: "evento", label: "Novo evento na agenda", icon: Calendar, to: "/agenda" },
] as const;

export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const match = Object.keys(titles)
    .sort((a, b) => b.length - a.length)
    .find((k) => (k === "/" ? pathname === "/" : pathname.startsWith(k)));
  const info = match ? titles[match] : { title: "MakersHub", subtitle: "" };

  const handleNovo = (tipo: string, to: string) => {
    setPendingCreate(tipo);
    window.dispatchEvent(new CustomEvent("nervon:criar", { detail: tipo }));
    navigate({ to } as Parameters<typeof navigate>[0]);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="size-10 rounded-xl border border-border/50 bg-surface-1/40 text-muted-foreground transition hover:border-primary/30 hover:bg-surface-2 hover:text-primary [&>svg]:!size-5 [&>svg]:transition-transform hover:[&>svg]:scale-110" />

      <div className="hidden min-w-0 max-w-[220px] flex-col leading-tight md:flex lg:max-w-[280px] xl:max-w-none">
        <h1 className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
          {info.title}
        </h1>
        {info.subtitle && <p className="truncate text-xs text-muted-foreground">{info.subtitle}</p>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 xl:flex">
          <span className="font-display text-sm font-light tracking-tight text-muted-foreground">
            MakersHub
          </span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            v0.8.4
          </span>
        </div>

        <button className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface-1/60 px-3 text-xs text-muted-foreground transition hover:border-border hover:bg-surface-2 hover:text-foreground lg:flex">
          <SearchNormal size={14} color="currentColor" variant="Linear" />
          <span>Buscar em tudo</span>
          <span className="ml-6 flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium">
            <Command className="size-2.5" />K
          </span>
        </button>

        <Button
          size="icon"
          variant="ghost"
          className="relative size-9 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <Notification size={16} color="currentColor" variant="Linear" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)] hover:bg-primary-glow">
              <Add size={16} color="currentColor" variant="Linear" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {ACOES.map((a) => (
              <DropdownMenuItem
                key={a.tipo}
                onClick={() => handleNovo(a.tipo, a.to)}
                className="gap-2.5"
              >
                <a.icon size={16} color="currentColor" variant="Linear" />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
