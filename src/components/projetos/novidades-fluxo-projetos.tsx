import { useEffect, useMemo, useState } from "react";
import { ArrowRight2, Calendar, Edit2, TickCircle } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type Projeto } from "@/lib/mock/projetos";
import { isProjetoAtivo } from "@/lib/mock/projetos";

const STORAGE_KEY = "makershub:projetos:fluxo-wizard:v1";

const PASSOS = [
  {
    titulo: "Um fluxo para cada cliente",
    descricao: "Crie, renomeie e organize as etapas dentro do projeto.",
  },
  {
    titulo: "O Pipeline acompanha",
    descricao: "A etapa exclusiva entra na visão geral sem alterar os outros clientes.",
  },
  {
    titulo: "A semana fala a mesma língua",
    descricao: "Tarefas e listas passam a usar o nome da etapa daquele projeto.",
  },
] as const;

function MiniFluxo() {
  return (
    <div className="grid h-full grid-cols-3 gap-2 p-4">
      {["Briefing", "Captação", "Edição final"].map((etapa, index) => (
        <div key={etapa} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="mb-3 flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${index === 2 ? "bg-primary" : "bg-white/35"}`}
            />
            <span className="truncate text-[8px] font-semibold text-white/80">{etapa}</span>
            {index === 2 && (
              <Edit2 size={9} color="currentColor" className="ml-auto text-primary" />
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
            <div className="h-1.5 w-3/4 rounded-full bg-white/20" />
            <div className="mt-2 h-1 w-1/2 rounded-full bg-white/10" />
          </div>
          {index === 2 && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-1 text-center text-[7px] font-medium text-primary">
              Nome editável
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniPipeline() {
  return (
    <div className="flex h-full items-center justify-center gap-2 p-4">
      <div className="w-[38%] rounded-xl border border-white/10 bg-black/20 p-2.5 opacity-65">
        <p className="text-[8px] font-semibold text-white/60">Briefing</p>
        <div className="mt-2 h-10 rounded-lg bg-white/[0.06]" />
      </div>
      <ArrowRight2 size={15} color="currentColor" className="shrink-0 text-white/25" />
      <div className="relative w-[46%] rounded-xl border border-primary/45 bg-primary/10 p-2.5 shadow-[0_0_28px_-12px_var(--primary)]">
        <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[7px] font-bold text-primary-foreground">
          Só este cliente
        </span>
        <p className="text-[8px] font-semibold text-primary">Edição final</p>
        <div className="mt-2 rounded-lg border border-primary/20 bg-black/20 p-2">
          <div className="h-1.5 w-4/5 rounded-full bg-primary/40" />
          <div className="mt-2 flex items-center justify-between">
            <div className="h-1 w-2/5 rounded-full bg-white/10" />
            <span className="size-3 rounded-full border border-primary/40 bg-primary/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniSemana() {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[8px] font-semibold text-white/75">
          <Calendar size={11} color="currentColor" className="text-primary" /> Esta semana
        </div>
        <span className="text-[7px] text-white/30">Pipeline · Semana · Lista</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["Revisar primeiro corte", "Aprovar trilha sonora"].map((tarefa, index) => (
          <div key={tarefa} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <p className="truncate text-[8px] font-medium text-white/75">{tarefa}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-md bg-primary/12 px-1.5 py-1 text-[7px] font-semibold text-primary">
                Edição final
              </span>
              <span className="text-[7px] text-white/30">{index === 0 ? "Hoje" : "Sex"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEWS = [MiniFluxo, MiniPipeline, MiniSemana] as const;

export function NovidadesFluxoProjetos({ projetos }: { projetos: Projeto[] }) {
  const ativos = useMemo(() => projetos.filter(isProjetoAtivo), [projetos]);
  const [open, setOpen] = useState(false);
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false);
  const [iniciado, setIniciado] = useState(false);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || iniciado) return;
    if (localStorage.getItem(STORAGE_KEY)) {
      setIniciado(true);
      return;
    }
    if (!ativos.length) return;
    setIniciado(true);
    setOpen(true);
  }, [ativos, iniciado]);

  const fechar = () => {
    if (naoMostrarNovamente) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setOpen(false);
  };

  const Preview = PREVIEWS[passo];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) fechar();
      }}
    >
      <DialogContent
        overlayClassName="bg-background/40 backdrop-blur-md"
        className="grid max-w-[720px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border/70 bg-[#101210] p-0 shadow-[0_28px_90px_-24px_rgba(0,0,0,.9)]"
      >
        <div className="border-b border-white/[0.07] bg-gradient-to-br from-primary/[0.09] via-transparent to-transparent px-5 py-5 sm:px-7 sm:py-6 [@media(max-height:700px)]:py-4">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Atualização de fluxo
          </span>
          <DialogHeader>
            <DialogTitle className="max-w-xl font-display text-2xl leading-tight sm:text-[28px] [@media(max-height:700px)]:text-xl">
              O fluxo agora acompanha o jeito que você produz
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xl text-xs leading-relaxed text-white/45 sm:text-sm">
              Veja em poucos segundos como a personalização se conecta ao restante da operação.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 [@media(max-height:700px)]:py-3">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b1f1a] to-[#0c0e0c] shadow-inner">
            <div className="h-[178px] sm:h-[210px] [@media(max-height:700px)]:!h-[140px]">
              <Preview />
            </div>
            <div className="border-t border-white/[0.07] bg-white/[0.025] px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                  {passo + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white/90">{PASSOS[passo].titulo}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
                    {PASSOS[passo].descricao}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {PASSOS.map((item, index) => (
              <button
                key={item.titulo}
                type="button"
                aria-label={`Ver atualização ${index + 1}: ${item.titulo}`}
                onClick={() => setPasso(index)}
                className={`h-1.5 rounded-full transition-all ${
                  passo === index ? "w-8 bg-primary" : "w-2 bg-white/15 hover:bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="gap-3 border-t border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:justify-between sm:px-7 [@media(max-height:700px)]:py-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-white/45 sm:text-xs">
            <Checkbox
              checked={naoMostrarNovamente}
              onCheckedChange={(checked) => setNaoMostrarNovamente(checked === true)}
            />
            Não mostrar esse tutorial novamente
          </label>
          {passo < PASSOS.length - 1 ? (
            <Button className="gap-2" onClick={() => setPasso((atual) => atual + 1)}>
              Próximo <ArrowRight2 size={15} color="currentColor" />
            </Button>
          ) : (
            <Button className="gap-2" onClick={fechar}>
              <TickCircle size={15} color="currentColor" /> Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
