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
import { Trash } from "iconsax-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";

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
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmandoRemocao(false);
    setRemovendo(false);
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
      setStatus(faseParaId(tarefa.status));
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
      setStatus(faseInicial ? faseParaId(faseInicial) : faseParaId(fases?.[0] ?? "briefing"));
      setLink("");
    }
  }, [open, tarefa, faseInicial, fases, usuario?.nome]);

  const opcoesFase = (
    fases ?? ["briefing", "pre_producao", "captacao", "edicao", "revisao", "entrega", "concluida"]
  ).map((fase) => ({
    id: faseParaId(fase),
    label: getFaseInfo(fase).label,
  }));

  const salvar = () => {
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
    if (editando && tarefa) projetosActions.atualizarTarefa(tarefa.id, payload);
    else projetosActions.criarTarefa(payload);
    onClose();
  };

  const remover = async () => {
    if (!tarefa || removendo) return;
    setRemovendo(true);
    const removida = await projetosActions.removerTarefa(tarefa.id);
    setRemovendo(false);
    if (!removida) return;
    setConfirmandoRemocao(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="font-display">
            {editando ? "Editar tarefa" : "Nova tarefa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-3 sm:px-6">
          <div className="space-y-1.5">
            <Label className="text-xs">O que precisa ser feito?</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Editar criativo Dia das Mães"
            />
            <p className="text-[10px] text-muted-foreground">
              Use uma ação concreta. A etapa da produção é definida separadamente abaixo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <ResponsavelSelect value={responsavel} onChange={setResponsavel} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Agenda (opcional)</Label>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={diaTodo}
                    onChange={(e) => setDiaTodo(e.target.checked)}
                    className="accent-primary"
                  />{" "}
                  Dia todo
                </label>
              </div>
              <DateTimePicker value={prazo} onChange={setPrazo} hideTime={diaTodo} />
              <p className="text-[10px] text-muted-foreground">
                {diaTodo
                  ? "Ocupa o dia inteiro na agenda."
                  : "Defina início e término da atividade."}
              </p>
            </div>
          </div>
          {!diaTodo && prazo && (
            <div className="-mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="hidden sm:block" />
              <div className="space-y-1.5">
                <Label className="text-xs">Término</Label>
                <DateTimePicker value={prazoFim} onChange={setPrazoFim} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Etapa do fluxo</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusTarefa)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesFase.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Onde esta tarefa está na produção.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link da tarefa</Label>
            <Input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
            <p className="text-[10px] text-muted-foreground">
              Drive, Frame.io, Vimeo, documento ou referência
            </p>
          </div>
          {prazo && (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] text-primary">
              📅 Esta tarefa aparecerá na Agenda automaticamente
            </p>
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 bg-background px-4 py-3 sm:justify-between sm:px-6 sm:py-4">
          {editando ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmandoRemocao(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash size={16} color="currentColor" variant="Linear" /> Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={salvar}>{editando ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogFooter>
        <Dialog open={confirmandoRemocao} onOpenChange={(v) => !v && setConfirmandoRemocao(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Remover tarefa?</DialogTitle>
              <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmandoRemocao(false)}
                disabled={removendo}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={remover} disabled={removendo}>
                {removendo ? "Removendo..." : "Remover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
