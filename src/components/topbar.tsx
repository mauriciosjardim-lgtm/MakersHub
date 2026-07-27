import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar() {
  return (
    <header className="pointer-events-none sticky top-2 z-40 flex h-11 items-center justify-between px-2">
      <div className="pointer-events-auto rounded-xl border border-border/70 bg-background/80 p-1 shadow-[0_12px_35px_-20px_rgba(0,0,0,.95)] backdrop-blur-xl">
        <SidebarTrigger className="size-8 rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-primary [&>svg]:!size-4" />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 shadow-[0_12px_35px_-20px_rgba(0,0,0,.95)] backdrop-blur-xl">
        <span className="font-display text-sm font-light tracking-tight text-muted-foreground">
          MakersHub
        </span>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          v0.8.2
        </span>
      </div>
    </header>
  );
}
