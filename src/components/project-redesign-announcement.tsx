import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, EyeOff } from "lucide-react";
import { Calendar, DocumentText1, Element3, Link2, Profile2User, TickCircle } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ANNOUNCEMENT_ID = "projects-redesign-v0.8.14";

const HIGHLIGHTS = [
  {
    icon: Element3,
    title: "Kanbans que respiram",
  },
  {
    icon: DocumentText1,
    title: "Formulários mais claros",
  },
  {
    icon: Profile2User,
    title: "Cliente no mesmo fluxo",
  },
] as const;

function PreviewTaskCard({
  priority,
  title,
  description,
  assignee,
  due,
  link,
  completed = false,
  priorityColor = "var(--primary)",
}: {
  priority: string;
  title: string;
  description?: string;
  assignee: string;
  due?: string;
  link?: string;
  completed?: boolean;
  priorityColor?: string;
}) {
  return (
    <article
      className={cn("kb-glass-card relative rounded-xl p-2.5", completed && "opacity-60")}
      style={{ "--kb-priority": priorityColor } as CSSProperties}
    >
      <span aria-hidden="true" className="kb-card-neon-dot" />
      <p className="pr-3 text-[7px] font-bold uppercase tracking-[.1em] text-muted-foreground">
        {priority}
      </p>
      <p className={cn("mt-2 text-[9px] font-bold leading-4", completed && "line-through")}>
        {title}
      </p>
      {description && (
        <p className="mt-1 line-clamp-2 text-[7px] leading-3 text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[6px] font-bold text-[var(--primary-ink)]">
          {assignee}
        </span>
        {due && (
          <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[6px] text-muted-foreground">
            <Calendar size={10} color="currentColor" variant="Bulk" />
            {due}
          </span>
        )}
        {completed && (
          <TickCircle
            size={12}
            color="currentColor"
            variant="Bulk"
            className="ml-auto text-[var(--primary-ink)] drop-shadow-[0_0_6px_var(--primary)]"
          />
        )}
      </div>
      {link && (
        <span className="mt-2 flex items-center gap-1 text-[6px] text-muted-foreground">
          <Link2 size={10} color="currentColor" variant="Bulk" />
          {link}
        </span>
      )}
    </article>
  );
}

export function ProjectRedesignAnnouncement({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const storageKey = useMemo(() => `makershub:announcement:${ANNOUNCEMENT_ID}:${userId}`, [userId]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // O anúncio continua funcional mesmo se o navegador bloquear o armazenamento local.
    }

    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const dismissForever = () => {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Ainda fecha o anúncio; apenas a persistência fica indisponível neste navegador.
    }
    setOpen(false);
  };

  const exploreProjects = () => {
    setOpen(false);
    void navigate({ to: "/projetos" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[840px] overflow-y-auto border-white/[.1] bg-[oklch(0.145_0.012_275/.96)] p-0 [font-family:var(--kb-font-sans)] shadow-[0_48px_140px_-44px_rgba(0,0,0,.98),0_0_100px_-58px_var(--primary)] backdrop-blur-3xl">
        <DialogDescription className="sr-only">
          Conheça o novo design da seção de Projetos do MakersHub.
        </DialogDescription>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute -left-28 -top-44 size-[420px] rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] blur-3xl" />
          <div className="absolute -bottom-48 right-0 size-[420px] rounded-full bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/55 to-transparent" />
          <div className="absolute right-7 top-7 grid grid-cols-3 gap-2 opacity-25">
            {Array.from({ length: 9 }).map((_, index) => (
              <span
                key={index}
                className="size-1 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]"
              />
            ))}
          </div>
        </div>

        <div className="relative grid lg:grid-cols-[.92fr_1.08fr]">
          <div className="flex flex-col px-6 pb-5 pt-6 sm:px-7 lg:px-8 lg:pb-5 lg:pt-6">
            <DialogTitle className="max-w-lg [font-family:var(--kb-font-sans)] text-[1.85rem] font-bold leading-[1.04] tracking-[-.045em] sm:text-[2.15rem]">
              Projetos, agora do jeito que a{" "}
              <span className="text-[var(--primary-ink)] drop-shadow-[0_0_18px_var(--primary)]">
                produção merece.
              </span>
            </DialogTitle>
            <p className="mt-2.5 max-w-lg text-[13px] leading-[1.45] text-muted-foreground">
              Nossa V1 está cada vez mais perto. Você já pode aproveitar uma experiência mais
              fluida, bonita e direta ao ponto na seção de Projetos.
            </p>

            <div className="mt-4 space-y-1.5">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="group flex items-center gap-2.5 rounded-2xl border border-white/[.065] bg-white/[.025] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-[color-mix(in_srgb,var(--primary)_24%,transparent)] hover:bg-white/[.04]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_9%,transparent)] text-[var(--primary-ink)] shadow-[0_0_24px_-16px_var(--primary)]">
                      <Icon
                        size={18}
                        color="currentColor"
                        variant="Bulk"
                        className="drop-shadow-[0_0_7px_var(--primary)]"
                      />
                    </span>
                    <strong className="min-w-0 [font-family:var(--kb-font-sans)] text-sm font-bold">
                      {item.title}
                    </strong>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden border-t border-white/[.07] bg-black/[.12] p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-6">
            <div className="absolute -right-28 top-10 size-72 rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] blur-3xl" />
            <div className="absolute bottom-10 left-10 size-36 rounded-full bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] blur-3xl" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--primary-ink)]">
                  Nova experiência
                </p>
                <p className="mt-1 [font-family:var(--kb-font-sans)] text-sm font-bold">
                  Fluxo de produção
                </p>
              </div>
              <span className="rounded-full border border-white/[.08] bg-white/[.035] px-2.5 py-1 text-[9px] font-semibold text-muted-foreground">
                v0.8.15
              </span>
            </div>

            <div className="kb-kanban-stage kb-glass-shell relative mt-4 !min-h-[245px] overflow-hidden rounded-[24px] p-3">
              <div className="grid min-h-[245px] grid-cols-3 gap-2.5">
                <div className="kb-glass-column rounded-2xl p-2.5">
                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                    Briefing
                    <span>1</span>
                  </div>
                  <div className="mt-3">
                    <PreviewTaskCard
                      priority="Média"
                      title="Validar roteiro"
                      description="Revisar o texto antes da captação."
                      assignee="MJ"
                      due="Hoje"
                      link="drive.com"
                    />
                  </div>
                </div>

                <div className="kb-glass-column border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] rounded-2xl p-2.5">
                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[.12em] text-[var(--primary-ink)]">
                    Produção
                    <span>2</span>
                  </div>
                  <div className="mt-3">
                    <PreviewTaskCard
                      priority="Alta"
                      title="Editar campanha"
                      description="Montar o primeiro corte para aprovação."
                      assignee="MJ"
                      due="30 jul"
                      priorityColor="var(--sem-warn)"
                    />
                  </div>
                  <div className="mt-2">
                    <PreviewTaskCard
                      priority="Média"
                      title="Revisar cortes"
                      description="Ajustar os comentários do cliente."
                      assignee="AF"
                      due="02 ago"
                    />
                  </div>
                </div>

                <div className="kb-glass-column rounded-2xl p-2.5">
                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                    Entrega
                    <span>1</span>
                  </div>
                  <div className="mt-3">
                    <PreviewTaskCard
                      priority="Concluída"
                      title="Publicar versão final"
                      description="Arquivos liberados para o cliente."
                      assignee="MJ"
                      link="drive.com"
                      completed
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-3 flex items-center gap-2 text-[9px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" />
              Uma identidade que acompanha a cor da sua marca
            </div>
          </div>
        </div>

        <footer className="sticky bottom-0 z-20 flex flex-col-reverse gap-3 border-t border-white/[.08] bg-[oklch(0.145_0.012_275/.94)] px-6 py-2.5 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={dismissForever}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white/[.035] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)]"
          >
            <EyeOff className="size-4" />
            Não mostrar novamente
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 flex-1 rounded-xl border-white/[.08] bg-white/[.025] px-4 sm:flex-none"
            >
              Agora não
            </Button>
            <Button
              type="button"
              onClick={exploreProjects}
              className="h-10 flex-1 rounded-xl px-4 font-bold shadow-[0_14px_30px_-18px_var(--primary)] sm:flex-none"
            >
              Explorar Projetos
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
