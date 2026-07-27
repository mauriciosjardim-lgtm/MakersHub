import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileUp, Phone, Search, Star, UserPlus, UsersRound } from "lucide-react";
import { Edit2, Sms } from "iconsax-react";
import { toast } from "sonner";
import { ImportarContatosModal } from "@/components/comercial/importar-contatos-modal";
import { NovoContatoModal } from "@/components/comercial/novo-contato-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { comercial, useComercial } from "@/lib/hooks/useComercial";
import {
  gerarCsvContatos,
  normalizarTexto,
  valorContatoOuVazio,
} from "@/lib/comercial/contatos-importacao";

export const Route = createFileRoute("/comercial/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const contatos = useComercial((store) => store.contatos);
  const empresas = useComercial((store) => store.empresas);
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [empresa.id, empresa])),
    [empresas],
  );
  const contatosVisiveis = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return contatos;
    return contatos.filter((contato) =>
      normalizarTexto(
        [
          contato.nome,
          empresasPorId.get(contato.empresaId)?.nome,
          contato.cargo,
          contato.email,
          contato.telefone,
        ].join(" "),
      ).includes(termo),
    );
  }, [busca, contatos, empresasPorId]);

  const exportar = () => {
    if (contatos.length === 0) {
      toast.info("Ainda não há contatos para exportar.");
      return;
    }
    baixarCsv(
      gerarCsvContatos(contatos, empresas),
      `contatos-makershub-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`${contatos.length} contatos exportados.`);
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-surface-1/80 to-primary/[.025] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <UsersRound className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Base de contatos</h2>
            <p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">
              Cadastre pessoas para oportunidades futuras, sem precisar abrir um lead. Importe sua
              planilha ou mantenha tudo atualizado por aqui.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportacaoAberta(true)}>
            <FileUp className="size-4" /> Importar arquivo
          </Button>
          <Button size="sm" onClick={() => setNovoAberto(true)}>
            <UserPlus className="size-4" /> Novo contato
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border bg-surface-1/60 px-3 py-1.5">
            <strong className="text-foreground">{contatos.length}</strong> contatos
          </span>
          <span className="rounded-full border border-border bg-surface-1/60 px-3 py-1.5">
            <strong className="text-foreground">
              {new Set(contatos.map((contato) => contato.empresaId)).size}
            </strong>{" "}
            empresas
          </span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar nome, empresa ou telefone…"
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Contato</Th>
                <Th>Empresa</Th>
                <Th>Cargo</Th>
                <Th>E-mail</Th>
                <Th>Telefone</Th>
              </tr>
            </thead>
            <tbody>
              {contatosVisiveis.map((contato) => {
                const empresa = empresasPorId.get(contato.empresaId);
                return (
                  <tr
                    key={contato.id}
                    className="border-t border-border/60 transition hover:bg-surface-2/40"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <ContactField
                          value={contato.nome}
                          className="font-medium"
                          onSave={(nome) => comercial.updateContato(contato.id, { nome })}
                        />
                        {contato.principal && (
                          <Star
                            className="size-3 fill-primary text-primary"
                            aria-label="Contato principal"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-muted-foreground">
                      {empresa?.nome ?? "Empresa não encontrada"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ContactField
                        value={contato.cargo}
                        onSave={(cargo) => comercial.updateContato(contato.id, { cargo })}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <Sms
                          size={12}
                          color="currentColor"
                          variant="Linear"
                          className="shrink-0 text-primary"
                        />
                        <ContactField
                          value={contato.email}
                          type="email"
                          onSave={(email) => comercial.updateContato(contato.id, { email })}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <Phone className="size-3 shrink-0 text-primary" />
                        <ContactField
                          value={contato.telefone}
                          type="tel"
                          onSave={(telefone) => comercial.updateContato(contato.id, { telefone })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {contatos.length === 0 && (
          <div className="grid min-h-64 place-items-center border-t border-border/60 p-8 text-center">
            <div>
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <UsersRound className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">
                Sua base de contatos começa aqui
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Adicione uma pessoa manualmente ou importe a planilha que você já usa.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportacaoAberta(true)}>
                  Importar planilha
                </Button>
                <Button size="sm" onClick={() => setNovoAberto(true)}>
                  Novo contato
                </Button>
              </div>
            </div>
          </div>
        )}
        {contatos.length > 0 && contatosVisiveis.length === 0 && (
          <div className="border-t border-border/60 p-10 text-center text-xs text-muted-foreground">
            Nenhum contato corresponde a “{busca}”.
          </div>
        )}
      </div>

      <NovoContatoModal open={novoAberto} onOpenChange={setNovoAberto} />
      <ImportarContatosModal open={importacaoAberta} onOpenChange={setImportacaoAberta} />
    </div>
  );
}

function baixarCsv(conteudo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-2.5 text-left font-semibold">{children}</th>
);

function ContactField({
  value,
  onSave,
  type = "text",
  className,
}: {
  value: string;
  onSave: (value: string) => Promise<boolean>;
  type?: string;
  className?: string;
}) {
  const valorLimpo = valorContatoOuVazio(value);
  return (
    <div className="group relative inline-flex items-center">
      <Input
        key={value}
        type={type}
        defaultValue={valorLimpo}
        placeholder="—"
        onBlur={async (event) => {
          const proximo = event.currentTarget.value.trim();
          if (proximo === valorLimpo) return;
          const salvo = await onSave(proximo || "—");
          if (!salvo) event.currentTarget.value = valorLimpo;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`h-8 min-w-[140px] border-border/60 bg-surface-2/30 px-2 pr-7 text-xs shadow-none hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/30 ${className ?? ""}`}
      />
      <Edit2
        size={12}
        color="currentColor"
        variant="Linear"
        className="pointer-events-none absolute right-2 text-primary opacity-60 transition group-focus-within:opacity-100"
      />
    </div>
  );
}
