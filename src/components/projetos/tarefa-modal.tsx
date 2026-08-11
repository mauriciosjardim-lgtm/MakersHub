import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORIDADES,
  faseParaId,
  getFaseInfo,
  type Tarefa,
  type Prioridade,
  type StatusTarefa,
} from "@/lib/mock/projetos";
import { projetosActions } from "@/lib/hooks/useProjetos";
import { ResponsavelSelect } from "@/components/projetos/membros-select";
import { useAuth } from "@/lib/auth";
import { DocumentText1, Export, Link2, Maximize, TaskSquare, Trash } from "iconsax-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { linkSeguro } from "@/lib/projetos/progresso";
import { juntarConteudoTarefa, separarConteudoTarefa } from "@/lib/projetos/tarefa-conteudo";
import { cn } from "@/lib/utils";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function TarefaModal({
  open,
  onClose,
  projetoId,
  tarefa,
  fases,
  faseInicial,
}: {
  open: boolean;
  onClose: () => void;
  projetoId: string;
  tarefa?: Tarefa | null;
  fases?: string[];
  faseInicial?: string;
}) {
  const editando = !!tarefa;
  const { usuario } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [diaTodo, setDiaTodo] = useState(false);
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [status, setStatus] = useState<StatusTarefa>("briefing");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [cadernoAberto, setCadernoAberto] = useState(false);
  const linkAcessivel = linkSeguro(link);

  useEffect(() => {
    if (!open) return;
    setCadernoAberto(false);
    if (tarefa) {
      const conteudo = separarConteudoTarefa(tarefa.descricao);
      setTitulo(tarefa.titulo);
      setDescricao(conteudo.descricao);
      setAnotacoes(conteudo.anotacoes);
      setResponsavel(tarefa.responsavel);
      const inicio = tarefa.prazo ? new Date(tarefa.prazo) : null;
      const fimPadrao = inicio ? new Date(inicio.getTime() + 60 * 60 * 1000) : null;
      setPrazo(inicio ? toLocalInput(inicio.toISOString()) : "");
      setPrazoFim(
        tarefa.prazoFim
          ? toLocalInput(tarefa.prazoFim)
          : fimPadrao
            ? toLocalInput(fimPadrao.toISOString())
            : "",
      );
      setDiaTodo(tarefa.diaTodo ?? false);
      setPrioridade(tarefa.prioridade);
      setStatus(tarefa.status);
      setLink(tarefa.link ?? "");
    } else {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      amanha.setHours(10, 0, 0, 0);
      setTitulo("");
      setDescricao("");
      setAnotacoes("");
      setResponsavel(usuario?.nome ?? "");
      setPrazo(toLocalInput(amanha.toISOString()));
      amanha.setHours(18, 0, 0, 0);
      setPrazoFim(toLocalInput(amanha.toISOString()));
      setDiaTodo(false);
      setPrioridade("media");
      setStatus(faseParaId(faseInicial ?? fases?.[0] ?? "briefing"));
      setLink("");
    }
  }, [open, tarefa, faseInicial, fases, usuario?.nome]);

  const salvar = async () => {
    if (!titulo.trim()) return;
    const inicioAgenda = prazo ? new Date(prazo) : undefined;
    let fimAgenda = !diaTodo && prazoFim ? new Date(prazoFim) : undefined;
    if (inicioAgenda && fimAgenda && fimAgenda <= inicioAgenda)
      fimAgenda = new Date(inicioAgenda.getTime() + 60 * 60 * 1000);
    const payload = {
      projetoId,
      titulo: titulo.trim(),
      descricao: juntarConteudoTarefa({ descricao, anotacoes }) || undefined,
      responsavel: responsavel.trim() || "Você",
      prazo: inicioAgenda?.toISOString(),
      prazoFim: fimAgenda?.toISOString(),
      diaTodo,
      prioridade,
      status,
      concluida: tarefa?.concluida ?? false,
      link: link.trim(),
    };
    setSalvando(true);
    try {
      const sucesso =
        editando && tarefa
          ? await projetosActions.atualizarTarefa(tarefa.id, payload)
          : await projetosActions.criarTarefa(payload);
      if (sucesso) onClose();
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!tarefa || !confirm("Remover tarefa?")) return;
    setRemovendo(true);
    try {
      if (await projetosActions.removerTarefa(tarefa.id)) onClose();
    } finally {
      setRemovendo(false);
    }
  };

  const fecharModal = () => {
    setCadernoAberto(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !salvando && !removendo && fecharModal()}>
      <DialogContent className="kb-form-dialog max-w-[660px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 !overflow-hidden p-0">
        <DialogHeader className="kb-form-header relative z-10 border-b border-white/[.07] px-5 py-4 pr-14">
          <div className="flex items-start gap-3">
            <span className="kb-form-icon grid size-10 shrink-0 place-items-center rounded-xl">
              <TaskSquare size={20} color="currentColor" variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl font-bold tracking-[-.025em]">
                {editando ? "Editar tarefa" : "Nova tarefa"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed">
                {editando
                  ? "Atualize responsáveis, prazos e o andamento da produção."
                  : "Transforme o próximo passo em uma tarefa clara e acionável."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="kb-task-form-scroll kb-scrollbar relative z-0 min-h-0 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <section className="kb-form-section grid gap-3 p-4 sm:grid-cols-[1.05fr_.95fr]">
            <div className="space-y-2">
              <Label className="kb-form-label">O que precisa ser feito?</Label>
              <Input
                className="kb-form-control"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Editar criativo Dia das Mães"
                autoFocus
              />
              <p className="text-xs leading-relaxed text-[var(--kb-text-muted)]">
                Prefira uma ação objetiva. A etapa da produção é definida separadamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="kb-form-label">Anotações</Label>
              <button
                type="button"
                onClick={() => setCadernoAberto(true)}
                className="kb-task-notes-trigger group flex min-h-[88px] w-full items-start gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ui)]"
              >
                <span className="kb-task-notes-trigger-icon grid size-9 shrink-0 place-items-center rounded-xl">
                  <DocumentText1 size={18} color="currentColor" variant="Bulk" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--kb-text)]">
                    {anotacoes.trim() ? "Caderno da tarefa" : "Adicionar anotações"}
                  </span>
                  <span
                    className={cn(
                      "kb-task-notes-preview mt-1 block text-xs leading-relaxed",
                      anotacoes.trim()
                        ? "text-[var(--kb-text-muted)]"
                        : "text-[var(--kb-text-faint)]",
                    )}
                  >
                    {anotacoes.trim() || "Contexto, referências e critérios de conclusão…"}
                  </span>
                </span>
                <span className="kb-task-notes-expand grid size-8 shrink-0 place-items-center rounded-lg">
                  <Maximize size={15} color="currentColor" variant="Linear" />
                </span>
              </button>
            </div>
          </section>

          <section className="kb-form-section space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="kb-form-custom space-y-2">
                <Label className="kb-form-label">Responsável</Label>
                <ResponsavelSelect value={responsavel} onChange={setResponsavel} />
              </div>
              <div className="space-y-2">
                <Label className="kb-form-label">Etapa do fluxo</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusTarefa)}>
                  <SelectTrigger className="kb-form-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(fases ?? []).map((f) => (
                      <SelectItem key={f} value={faseParaId(f)}>
                        {getFaseInfo(f).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="kb-form-label">Prioridade</Label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                  <SelectTrigger className="kb-form-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADES).map(([id, p]) => (
                      <SelectItem key={id} value={id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-white/[.06] pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Label className="kb-form-label">Agenda</Label>
                  <span className="text-xs text-[var(--kb-text-muted)]">
                    Sincroniza automaticamente
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--kb-text-muted)]">
                  <input
                    type="checkbox"
                    checked={diaTodo}
                    onChange={(e) => setDiaTodo(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Dia todo
                </label>
              </div>
              <div className="kb-form-date-fields grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="kb-form-custom space-y-2">
                  <Label className="kb-form-label">Início</Label>
                  <DateTimePicker value={prazo} onChange={setPrazo} hideTime={diaTodo} maskedTime />
                </div>
                {!diaTodo && prazo && (
                  <div className="kb-form-custom space-y-2">
                    <Label className="kb-form-label">Término</Label>
                    <DateTimePicker value={prazoFim} onChange={setPrazoFim} maskedTime />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="kb-form-section grid items-end gap-3 p-3 sm:grid-cols-[170px_minmax(0,1fr)_auto]">
            <div className="flex items-start gap-2.5 sm:self-center">
              <Link2
                size={18}
                color="currentColor"
                variant="Bulk"
                className="text-[var(--primary-ink)]"
              />
              <div>
                <Label className="kb-form-label">Link da tarefa</Label>
                <p className="mt-0.5 text-xs leading-snug text-[var(--kb-text-muted)]">
                  Drive, Frame.io ou referência.
                </p>
              </div>
            </div>
            <Input
              className="kb-form-control"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
            {linkAcessivel && (
              <a
                href={linkAcessivel.href}
                target="_blank"
                rel="noreferrer"
                className="kb-form-link inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold"
              >
                <span className="truncate">Abrir {linkAcessivel.dominio}</span>
                <Export size={16} color="currentColor" variant="Linear" className="shrink-0" />
              </a>
            )}
          </section>
        </div>
        <DialogFooter className="kb-form-footer relative z-10 flex-row items-center justify-between gap-2 border-t border-white/[.07] px-5 py-3 sm:justify-between">
          {editando ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={remover}
              disabled={salvando || removendo}
              className="text-destructive hover:text-destructive"
            >
              <Trash size={16} color="currentColor" variant="Linear" />{" "}
              {removendo ? "Removendo…" : "Remover"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={fecharModal}
              disabled={salvando || removendo}
            >
              Cancelar
            </Button>
            <Button
              className="h-10 rounded-xl px-5 font-bold"
              onClick={salvar}
              disabled={salvando || removendo || !titulo.trim()}
            >
              {salvando ? "Salvando…" : editando ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Sheet open={cadernoAberto} onOpenChange={setCadernoAberto}>
        <SheetContent
          side="right"
          className="kb-task-notes-sheet z-[90] flex !w-[min(720px,calc(100vw-.75rem))] !max-w-[720px] flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="kb-task-notes-header border-b border-white/[.07] px-6 py-5 pr-16 text-left sm:px-8 sm:py-7">
            <div className="flex items-start gap-3.5">
              <span className="kb-form-icon grid size-11 shrink-0 place-items-center rounded-2xl">
                <DocumentText1 size={22} color="currentColor" variant="Bulk" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--primary-ink)]">
                  Espaço de escrita
                </p>
                <SheetTitle className="font-display text-2xl font-bold tracking-[-.035em]">
                  Caderno da tarefa
                </SheetTitle>
                <SheetDescription className="mt-1.5 max-w-lg text-sm leading-relaxed">
                  Registre briefing, decisões, referências e tudo o que ajuda a concluir esta
                  tarefa.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="kb-task-notes-canvas relative flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-8 sm:py-7">
            <div className="kb-task-description-field mb-5 rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between gap-4">
                <Label
                  htmlFor="task-description"
                  className="text-xs font-bold text-[var(--kb-text)]"
                >
                  Descrição
                </Label>
                <span className="text-[11px] text-[var(--kb-text-faint)]">Aparece no card</span>
              </div>
              <Input
                id="task-description"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Resumo curto para identificar a tarefa"
                className="kb-form-control"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between gap-4">
                <Label
                  htmlFor="task-notes-editor"
                  className="text-xs font-bold text-[var(--kb-text-muted)]"
                >
                  Anotações
                </Label>
                <span className="text-[11px] tabular-nums text-[var(--kb-text-faint)]">
                  {anotacoes.length.toLocaleString("pt-BR")} caracteres
                </span>
              </div>
              <Textarea
                id="task-notes-editor"
                autoFocus
                value={anotacoes}
                onChange={(event) => setAnotacoes(event.target.value)}
                placeholder={
                  "Comece a escrever…\n\nVocê pode registrar o contexto da tarefa, decisões tomadas, referências importantes e critérios de conclusão."
                }
                className="kb-task-notes-editor kb-scrollbar h-full min-h-[240px] w-full flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-[var(--kb-text)] shadow-none outline-none placeholder:text-[var(--kb-text-faint)] focus-visible:ring-0"
              />
            </div>
          </div>

          <SheetFooter className="kb-task-notes-footer flex-row items-center justify-between gap-3 border-t border-white/[.07] px-5 py-4 sm:px-8">
            <p className="max-w-sm text-xs leading-relaxed text-[var(--kb-text-muted)]">
              Descrição e anotações são salvas juntas no mesmo campo da tarefa.
            </p>
            <Button
              type="button"
              className="h-10 shrink-0 rounded-xl px-5 font-bold"
              onClick={() => setCadernoAberto(false)}
            >
              Voltar à tarefa
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}
