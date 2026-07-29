import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  comercial,
  useComercial,
  getContatosDaEmpresa,
  fmtBRL,
  type Empresa,
} from "@/lib/hooks/useComercial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExcluirRegistroDialog } from "@/components/comercial/excluir-registro-dialog";
import { Buildings2, Location, Profile2User } from "iconsax-react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/comercial/empresas")({
  component: EmpresasPage,
});

function EmpresasPage() {
  const empresas = useComercial((s) => s.empresas);
  const leads = useComercial((s) => s.leads);
  const leadsArquivados = useComercial((s) => s.leadsArquivados);
  const [empresaParaArquivar, setEmpresaParaArquivar] = useState<Empresa | null>(null);
  const [empresaParaExcluir, setEmpresaParaExcluir] = useState<Empresa | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const empresasVisiveis = empresas.filter(
    (empresa) => Boolean(empresa.arquivado) === mostrarArquivadas,
  );

  if (empresas.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/40 p-10 text-center text-sm text-muted-foreground">
        Nenhuma empresa ainda. Elas aparecem aqui automaticamente quando você cadastra leads.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setMostrarArquivadas((valor) => !valor)}>
          {mostrarArquivadas ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {mostrarArquivadas
            ? "Ver empresas ativas"
            : `Arquivadas (${empresas.filter((empresa) => empresa.arquivado).length})`}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {empresasVisiveis.map((e) => {
          const contatos = getContatosDaEmpresa(e.id);
          const leadsEmp = leads.filter((l) => l.empresaId === e.id);
          const valor = leadsEmp.reduce((s, l) => s + l.valor, 0);
          return (
            <div
              key={e.id}
              className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15">
                  <Buildings2
                    size={20}
                    color="currentColor"
                    variant="Linear"
                    className="text-primary"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{e.segmento}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground opacity-70 hover:bg-primary/10 hover:text-primary hover:opacity-100"
                    onClick={() =>
                      e.arquivado ? void restaurarEmpresa(e) : setEmpresaParaArquivar(e)
                    }
                    aria-label={e.arquivado ? `Restaurar ${e.nome}` : `Arquivar ${e.nome}`}
                    title={e.arquivado ? "Restaurar empresa" : "Arquivar empresa"}
                  >
                    {e.arquivado ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                    onClick={() => setEmpresaParaExcluir(e)}
                    aria-label={`Excluir ${e.nome}`}
                    title="Excluir empresa"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Location
                    size={12}
                    color="currentColor"
                    variant="Linear"
                    className="text-primary"
                  />{" "}
                  {e.cidade}
                </p>
                <p className="flex items-center gap-1.5">
                  <Profile2User
                    size={12}
                    color="currentColor"
                    variant="Linear"
                    className="text-primary"
                  />{" "}
                  {contatos.length} contato(s)
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-[11px] text-muted-foreground">{leadsEmp.length} lead(s)</span>
                <span className="font-display text-sm font-semibold tabular-nums">
                  {fmtBRL(valor)}
                </span>
              </div>
            </div>
          );
        })}
        {empresasVisiveis.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {mostrarArquivadas ? "Nenhuma empresa arquivada." : "Nenhuma empresa ativa."}
          </div>
        )}
      </div>
      <ArquivarEmpresaDialog
        empresa={empresaParaArquivar}
        onClose={() => setEmpresaParaArquivar(null)}
      />
      <ExcluirRegistroDialog
        open={Boolean(empresaParaExcluir)}
        onOpenChange={(open) => !open && setEmpresaParaExcluir(null)}
        titulo="Excluir empresa definitivamente"
        descricao={
          <>
            A empresa <strong className="text-foreground">{empresaParaExcluir?.nome}</strong> e seus
            contatos comerciais serão removidos. Projetos já criados permanecem.
          </>
        }
        bloqueio={(() => {
          if (!empresaParaExcluir) return undefined;
          const quantidade = [...leads, ...leadsArquivados].filter(
            (lead) => lead.empresaId === empresaParaExcluir.id,
          ).length;
          return quantidade > 0
            ? `Esta empresa ainda possui ${quantidade} lead(s). Exclua esses leads antes de remover a empresa.`
            : undefined;
        })()}
        onConfirm={async () => {
          if (!empresaParaExcluir) return false;
          const excluida = await comercial.removerEmpresa(empresaParaExcluir.id);
          if (excluida) toast.success(`${empresaParaExcluir.nome} foi excluída`);
          return excluida;
        }}
      />
    </div>
  );
}

async function restaurarEmpresa(empresa: Empresa) {
  const restaurada = await comercial.arquivarEmpresa(empresa.id, false);
  if (restaurada) toast.success(`${empresa.nome} foi restaurada`);
}

function ArquivarEmpresaDialog({
  empresa,
  onClose,
}: {
  empresa: Empresa | null;
  onClose: () => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [arquivando, setArquivando] = useState(false);

  const fechar = () => {
    if (arquivando) return;
    setConfirmacao("");
    onClose();
  };

  const arquivar = async () => {
    if (!empresa || confirmacao.trim() !== empresa.nome) return;
    setArquivando(true);
    const arquivada = await comercial.arquivarEmpresa(empresa.id, true);
    setArquivando(false);
    if (!arquivada) return;
    toast.success(`${empresa.nome} foi arquivada`);
    fechar();
  };

  return (
    <Dialog open={Boolean(empresa)} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Arquivar empresa</DialogTitle>
          <DialogDescription className="sr-only">
            Confirme o arquivamento da empresa selecionada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3 text-xs leading-5 text-muted-foreground">
            A empresa sairá das listas ativas, mas projetos, tarefas, contatos, histórico comercial,
            contratos, portal e lançamentos financeiros serão preservados. Você poderá restaurá-la
            depois.
          </div>
          <label className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground">
              Digite <strong className="text-foreground">{empresa?.nome}</strong> para confirmar.
            </span>
            <Input
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={empresa?.nome}
              autoFocus
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={arquivando}>
            Cancelar
          </Button>
          <Button onClick={arquivar} disabled={arquivando || confirmacao.trim() !== empresa?.nome}>
            <Archive className="size-4" />
            {arquivando ? "Arquivando…" : "Arquivar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
