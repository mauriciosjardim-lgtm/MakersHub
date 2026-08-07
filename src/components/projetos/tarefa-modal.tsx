import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Export, Link2, TaskSquare, Trash } from "iconsax-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { linkSeguro } from "@/lib/projetos/progresso";

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
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prazoFim, setPrazoFim] = useState("");
  const [diaTodo, setDiaTodo] = useState(false);
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [status, setStatus] = useState<StatusTarefa>("briefing");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const linkAcessivel = linkSeguro(link);

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
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
      descricao: descricao.trim() || undefined,
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !salvando && !removendo && onClose()}>
      <DialogContent className="kb-form-dialog max-w-[660px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="kb-form-header border-b border-white/[.07] px-5 py-4 pr-14">
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
        <div className="kb-scrollbar space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
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
              <Label className="kb-form-label">Descrição</Label>
              <Textarea
                className="kb-form-control min-h-16 resize-y"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Contexto, referências e critérios de conclusão…"
              />
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
        <DialogFooter className="kb-form-footer flex-row items-center justify-between gap-2 border-t border-white/[.07] px-5 py-3 sm:justify-between">
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
              onClick={onClose}
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
    </Dialog>
  );
}
