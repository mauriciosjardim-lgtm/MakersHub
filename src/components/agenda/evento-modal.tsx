import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { agendaActions } from "@/lib/hooks/useAgenda";
import { TIPOS, type Evento, type TipoEvento } from "@/lib/mock/agenda";
import { format } from "date-fns";
import { Trash } from "iconsax-react";

interface Props {
  open: boolean;
  onClose: () => void;
  evento?: Evento | null;
  dataInicial?: Date | null;
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EventoModal({ open, onClose, evento, dataInicial }: Props) {
  const editando = !!evento;
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoEvento>("reuniao");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [participantes, setParticipantes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (evento) {
      setTitulo(evento.titulo);
      setTipo(evento.tipo);
      setInicio(toLocalInput(evento.inicio));
      setFim(toLocalInput(evento.fim));
      setLocal(evento.local ?? "");
      setDescricao(evento.descricao ?? "");
      setParticipantes((evento.participantes ?? []).join(", "));
    } else {
      const base = dataInicial ?? new Date();
      const ini = new Date(base);
      ini.setHours(base.getHours() === 0 ? 9 : base.getHours(), 0, 0, 0);
      const f = new Date(ini);
      f.setHours(ini.getHours() + 1);
      setTitulo("");
      setTipo("reuniao");
      setInicio(toLocalInput(ini.toISOString()));
      setFim(toLocalInput(f.toISOString()));
      setLocal("");
      setDescricao("");
      setParticipantes("");
    }
  }, [open, evento, dataInicial]);

  const salvar = () => {
    if (!titulo.trim() || !inicio || !fim || new Date(fim) <= new Date(inicio)) return;
    const payload = {
      titulo: titulo.trim(),
      tipo,
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      local: local.trim(),
      descricao: descricao.trim(),
      participantes: participantes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    if (editando && evento) agendaActions.atualizar(evento.id, payload);
    else agendaActions.criar(payload);
    onClose();
  };

  const remover = () => {
    if (evento && confirm("Remover este evento?")) {
      agendaActions.remover(evento.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editando ? "Editar evento" : "Novo evento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião com cliente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoEvento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([id, t]) => (
                    <SelectItem key={id} value={id}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`size-2 rounded-full ${t.dot}`} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Local</Label>
              <Input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Sala, link, endereço…"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <DateTimePicker value={inicio} onChange={setInicio} placeholder="Data de início" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <DateTimePicker value={fim} onChange={setFim} placeholder="Data de término" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participantes (separe por vírgula)</Label>
            <Input
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="Você, Ana, Pedro"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Pauta, notas, links…"
            />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {editando ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={remover}
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
            <Button onClick={salvar}>{editando ? "Salvar" : "Criar evento"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// avoid unused import warning for format if removed later
void format;
