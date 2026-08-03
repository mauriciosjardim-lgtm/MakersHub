import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { enviarTicketSuporte } from "@/lib/api/suporte.functions";
import { MIMES_ACEITOS } from "@/lib/suporte/anexo";
import { prepararAnexo, type AnexoPreparado } from "@/lib/suporte/imagem";
import { MOTIVOS_SUPORTE, type MotivoSuporte } from "@/lib/suporte/motivos";

const MIN_DESCRICAO = 10;

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SuporteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [motivo, setMotivo] = useState<MotivoSuporte | "">("");
  const [descricao, setDescricao] = useState("");
  const [anexo, setAnexo] = useState<AnexoPreparado | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setDescricao("");
    setAnexo(null);
    setPreparando(false);
    setEnviando(false);
    if (inputArquivo.current) inputArquivo.current.value = "";
  }, [open]);

  const limparAnexo = () => {
    setAnexo(null);
    if (inputArquivo.current) inputArquivo.current.value = "";
  };

  const escolherArquivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreparando(true);
    try {
      setAnexo(await prepararAnexo(file));
    } catch (err) {
      limparAnexo();
      toast.error(err instanceof Error ? err.message : "Não foi possível usar essa imagem.");
    } finally {
      setPreparando(false);
    }
  };

  const enviar = async () => {
    if (!motivo || descricao.trim().length < MIN_DESCRICAO) return;
    setEnviando(true);
    try {
      await enviarTicketSuporte({
        data: {
          motivo,
          descricao: descricao.trim(),
          rota: window.location.pathname,
          url: window.location.href,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          anexo: anexo
            ? { filename: anexo.filename, mime: anexo.mime, base64: anexo.base64 }
            : null,
        },
      });
      toast.success("Chamado enviado. Respondemos no seu e-mail.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar seu chamado.");
    } finally {
      setEnviando(false);
    }
  };

  const ocupado = enviando || preparando;
  const faltaTexto = descricao.trim().length < MIN_DESCRICAO;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !enviando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Falar com o suporte</DialogTitle>
          <DialogDescription>
            Conte o que aconteceu. Já enviamos junto a tela em que você estava, então não precisa
            explicar onde foi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Qual é o assunto?</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoSuporte)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_SUPORTE.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">O que aconteceu?</Label>
            <Textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Descreva o que você estava fazendo e o que esperava que acontecesse."
              rows={5}
              maxLength={4000}
            />
            <p className="text-[11px] text-muted-foreground">
              {faltaTexto
                ? `Escreva pelo menos ${MIN_DESCRICAO} caracteres.`
                : `${descricao.trim().length} caracteres`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Print da tela (opcional)</Label>
            <input
              ref={inputArquivo}
              type="file"
              accept={MIMES_ACEITOS.join(",")}
              className="hidden"
              onChange={(event) => void escolherArquivo(event)}
            />
            {anexo ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{anexo.filename}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {tamanhoLegivel(anexo.bytes)}
                </span>
                <button
                  type="button"
                  onClick={limparAnexo}
                  aria-label="Remover print"
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={preparando}
                onClick={() => inputArquivo.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-surface-1/50 px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-60"
              >
                {preparando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageUp className="size-4" />
                )}
                {preparando ? "Preparando imagem…" : "Anexar print · PNG, JPG ou WebP até 2 MB"}
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={!motivo || faltaTexto || ocupado}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Enviar chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
