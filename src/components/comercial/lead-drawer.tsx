import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  MapPin,
  Globe,
  Instagram,
  Calendar as CalendarIcon,
  FileText,
  StickyNote,
  XCircle,
  Flame,
  Snowflake,
  Thermometer,
  Building2,
  Users,
  ArrowUpRight,
  ListChecks,
  FolderKanban,
  Info,
  Activity,
  Star,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Sms, Add, MagicStar, MessageCircle } from "iconsax-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  useComercial,
  comercial,
  getEmpresa,
  getContato,
  getContatosDaEmpresa,
  getTimelineDoLead,
  getTarefasDoLead,
  fmtBRL,
  useEtapasComercial,
  leadScore,
  type Lead,
  type Temperatura,
  type EtapaJornada,
} from "@/lib/hooks/useComercial";
import { Timeline } from "./timeline";
import { formatBRL, maskCurrency, maskPhone, isValidEmail } from "@/lib/format";
import { FecharModal } from "./fechar-modal";
import { ExcluirLeadDialog } from "./excluir-lead-dialog";
import { EtapaIcon } from "./etapa-icon";
import { cn } from "@/lib/utils";

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const lead = useComercial(
    (s) =>
      s.leads.find((l) => l.id === leadId) ??
      s.leadsArquivados.find((l) => l.id === leadId) ??
      null,
  );
  const open = !!leadId && !!lead;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[640px] overflow-y-auto p-0 sm:max-w-[640px]"
      >
        {lead && <DrawerBody lead={lead} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

const PROGRESSO: EtapaJornada[] = [
  "novo",
  "diagnostico",
  "reuniao",
  "proposta",
  "negociacao",
  "fechado",
];

function DrawerBody({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const navigate = useNavigate();
  const etapas = useEtapasComercial();
  const empresa = getEmpresa(lead.empresaId);
  const contato = getContato(lead.contatoId);
  const outrosContatos = empresa
    ? getContatosDaEmpresa(empresa.id).filter((c) => c.id !== contato?.id)
    : [];
  useComercial((s) => s.timeline.length + s.tarefas.length);
  const timeline = getTimelineDoLead(lead.id);
  const tarefas = getTarefasDoLead(lead.id);
  const etapaMeta = etapas.find((e) => e.id === lead.etapa)!;
  const { score, estrelas, rotulo } = leadScore(lead);

  const [fechando, setFechando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoContatoAberto, setNovoContatoAberto] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novaObs, setNovaObs] = useState("");
  const [proxAcaoTitulo, setProxAcaoTitulo] = useState(lead.proximaAcao?.titulo ?? "");
  const [proxAcaoData, setProxAcaoData] = useState(
    lead.proximaAcao ? format(new Date(lead.proximaAcao.data), "yyyy-MM-dd'T'HH:mm") : "",
  );

  return (
    <>
      {/* Cabeçalho — empresa, valor, score, progressão */}
      <SheetHeader className="sticky top-0 z-10 space-y-0 border-b border-border bg-background/95 px-6 py-5 backdrop-blur-xl">
        <SheetDescription className="sr-only">
          Detalhes da oportunidade comercial de {empresa?.nome}.
        </SheetDescription>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <EtapaIcon etapa={etapaMeta.id} className="size-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {etapaMeta.label}
              </span>
            </div>
            <SheetTitle className="mt-1 truncate font-display text-xl">{empresa?.nome}</SheetTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {contato?.nome} · {contato?.cargo}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {fmtBRL(lead.valor)}
            </p>
            <p className="text-[11px] text-muted-foreground">Valor estimado</p>
          </div>
        </div>

        {/* Lead Score */}
        <ScoreBox score={score} estrelas={estrelas} rotulo={rotulo} />

        {/* Progressão de etapa */}
        <ProgressoEtapas atual={lead.etapa} />

        {lead.arquivadoEm ? (
          <div className="mt-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Lead arquivado
            {lead.motivoArquivamento ? ` · ${lead.motivoArquivamento}` : ""}. Restaure-o na seção
            Arquivados para voltar a movimentá-lo.
          </div>
        ) : (
          <TempPicker lead={lead} />
        )}
      </SheetHeader>

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2 border-b border-border bg-surface-1/30 px-6 py-3">
        {!lead.arquivadoEm && (
          <>
            <QuickBtn icon={Phone} label="Ligação" soon onClick={() => {}} />
            <QuickBtn icon={FileText} label="Proposta" soon onClick={() => {}} />
            <QuickBtn icon={CalendarIcon} label="Reunião" soon onClick={() => {}} />
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!lead.arquivadoEm && lead.etapa !== "fechado" && lead.etapa !== "perdido" && (
            <>
              <QuickBtn
                icon={XCircle}
                label="Perdido"
                tone="destructive"
                onClick={async () => {
                  const movido = await comercial.moverEtapa(lead.id, "perdido");
                  if (!movido) return;
                  toast("Lead movido para Perdido.");
                }}
              />
              <QuickBtn
                icon={CheckCircle2}
                label="Marcar como fechado"
                tone="success"
                onClick={() => setFechando(true)}
              />
            </>
          )}
          {!lead.arquivadoEm && lead.etapa === "fechado" && lead.projetosIds.length === 0 && (
            <QuickBtn
              icon={FolderKanban}
              label="Criar em Projetos"
              tone="success"
              onClick={() => setFechando(true)}
            />
          )}
          <QuickBtn
            icon={Trash2}
            label="Excluir"
            tone="destructive"
            onClick={() => setExcluindo(true)}
          />
        </div>
      </div>

      {/* Tabs — central de tudo */}
      <Tabs defaultValue="informacoes" className="px-6 py-5">
        <TabsList className="mb-4 h-auto flex w-full flex-wrap gap-1 bg-surface-1/60 p-1">
          <TabTrigger value="informacoes" icon={Info}>
            Informações
          </TabTrigger>
          <TabTrigger value="contatos" icon={Users} badge={1 + outrosContatos.length}>
            Contatos
          </TabTrigger>
          <TabTrigger value="timeline" icon={Activity}>
            Timeline
          </TabTrigger>
          <TabTrigger value="atividades" icon={ListChecks}>
            Atividades
          </TabTrigger>
          <TabTrigger value="projetos" icon={FolderKanban} badge={lead.projetosIds.length}>
            Projetos
          </TabTrigger>
        </TabsList>

        {/* ============ INFORMAÇÕES ============ */}
        <TabsContent value="informacoes" className="space-y-5">
          {!lead.arquivado && lead.etapa !== "fechado" && lead.etapa !== "perdido" && (
            <Bloco titulo="Próxima ação" icon={ArrowUpRight}>
              <div className="space-y-2">
                <Input
                  placeholder="O que precisa ser feito?"
                  value={proxAcaoTitulo}
                  onChange={(e) => setProxAcaoTitulo(e.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <DateTimePicker
                    value={proxAcaoData}
                    onChange={setProxAcaoData}
                    placeholder="Quando acontece?"
                  />
                  <Button
                    className="h-10"
                    onClick={async () => {
                      if (!proxAcaoTitulo || !proxAcaoData) {
                        toast.error("Informe ação e data.");
                        return;
                      }
                      const ok = await comercial.setProximaAcao(lead.id, {
                        titulo: proxAcaoTitulo,
                        data: new Date(proxAcaoData).toISOString(),
                      });
                      if (ok) toast.success("Próxima ação definida.");
                    }}
                  >
                    Salvar
                  </Button>
                </div>
                {!lead.proximaAcao && (
                  <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                    Esse lead está sem próxima ação. Defina uma para não perder o ritmo.
                  </p>
                )}
              </div>
            </Bloco>
          )}

          <Bloco titulo="Detalhes do lead" icon={Info}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CampoEdit
                label="Valor (R$)"
                format="currency"
                defaultValue={String(lead.valor)}
                onSave={async (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return false;
                  const ok = await comercial.updateLead(lead.id, { valor: n });
                  if (ok) toast.success("Valor atualizado.");
                  return ok;
                }}
              />
              <CampoEdit
                label="Responsável"
                defaultValue={lead.responsavel}
                onSave={async (v) => {
                  const ok = await comercial.updateLead(lead.id, { responsavel: v });
                  if (ok) toast.success("Responsável atualizado.");
                  return ok;
                }}
              />
              <CampoEdit
                label="Origem"
                defaultValue={lead.origem}
                onSave={async (v) => {
                  const ok = await comercial.updateLead(lead.id, { origem: v });
                  if (ok) toast.success("Origem atualizada.");
                  return ok;
                }}
                className="sm:col-span-2"
              />
            </div>
          </Bloco>

          <Bloco titulo="Empresa" icon={Building2}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CampoEdit
                label="Nome"
                defaultValue={empresa?.nome ?? ""}
                onSave={async (v) => {
                  if (!empresa) return;
                  const ok = await comercial.updateEmpresa(empresa.id, { nome: v });
                  if (ok) toast.success("Empresa atualizada.");
                  return ok;
                }}
                className="sm:col-span-2"
              />
              <CampoEdit
                label="Cidade"
                defaultValue={empresa?.cidade ?? ""}
                onSave={async (v) => {
                  if (!empresa) return false;
                  const ok = await comercial.updateEmpresa(empresa.id, { cidade: v });
                  if (ok) toast.success("Cidade atualizada.");
                  return ok;
                }}
              />
              <CampoEdit
                label="Segmento"
                defaultValue={empresa?.segmento ?? ""}
                onSave={async (v) => {
                  if (!empresa) return false;
                  const ok = await comercial.updateEmpresa(empresa.id, { segmento: v });
                  if (ok) toast.success("Segmento atualizado.");
                  return ok;
                }}
              />
              <CampoEdit
                label="Site"
                defaultValue={empresa?.site ?? ""}
                onSave={(v) => {
                  if (empresa) void comercial.updateEmpresa(empresa.id, { site: v });
                }}
              />
              <CampoEdit
                label="Instagram"
                defaultValue={empresa?.instagram ?? ""}
                onSave={(v) => {
                  if (empresa) void comercial.updateEmpresa(empresa.id, { instagram: v });
                }}
              />
            </div>
          </Bloco>

          <Bloco titulo={`Contatos · ${empresa?.nome ?? ""}`} icon={Users}>
            <ul className="space-y-2">
              {contato && <ContatoEditavel contato={contato} principal />}
              {outrosContatos.map((c) => (
                <ContatoEditavel key={c.id} contato={c} />
              ))}
              {outrosContatos.length === 0 && !contato && (
                <p className="text-xs text-muted-foreground">Nenhum contato adicional.</p>
              )}
              {empresa && (
                <li>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => setNovoContatoAberto(true)}
                  >
                    <Add size={14} color="currentColor" variant="Linear" className="text-primary" />{" "}
                    Adicionar contato
                  </Button>
                </li>
              )}
            </ul>
          </Bloco>

          <Bloco titulo="Observações" icon={StickyNote}>
            <Textarea
              id="drawer-obs-input"
              placeholder="Anote contexto, preferências, decisores..."
              defaultValue={lead.observacoes ?? ""}
              onBlur={async (e) => {
                if (e.target.value !== (lead.observacoes ?? "")) {
                  const ok = await comercial.setObservacoes(lead.id, e.target.value);
                  if (ok) toast.success("Observação salva.");
                }
              }}
              rows={4}
            />
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Adicionar nota rápida à timeline..."
                value={novaObs}
                onChange={(e) => setNovaObs(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && novaObs) {
                    const ok = await comercial.addEvento(lead.id, {
                      tipo: "observacao",
                      titulo: "Observação",
                      descricao: novaObs,
                    });
                    if (ok) {
                      setNovaObs("");
                      toast.success("Nota adicionada.");
                    }
                  }
                }}
              />
            </div>
          </Bloco>
        </TabsContent>

        {/* ============ CONTATOS ============ */}
        <TabsContent value="contatos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Contatos de {empresa?.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                {1 + outrosContatos.length} pessoa(s) vinculada(s)
              </p>
            </div>
            {empresa && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setNovoContatoAberto(true)}
              >
                <Add size={14} color="currentColor" variant="Linear" className="text-primary" />{" "}
                Adicionar
              </Button>
            )}
          </div>

          <ul className="space-y-3">
            {contato && (
              <li className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                      {contato.nome.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{contato.nome}</p>
                      <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        Contato principal
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <CampoEdit
                    label="Nome"
                    defaultValue={contato.nome}
                    className="sm:col-span-2"
                    onSave={async (v) => {
                      const ok = await comercial.updateContato(contato.id, { nome: v });
                      if (ok) toast.success("Contato atualizado.");
                      return ok;
                    }}
                  />
                  <CampoEdit
                    label="Cargo"
                    defaultValue={contato.cargo}
                    onSave={(v) => comercial.updateContato(contato.id, { cargo: v })}
                  />
                  <CampoEdit
                    label="Telefone"
                    format="phone"
                    defaultValue={contato.telefone}
                    onSave={(v) => comercial.updateContato(contato.id, { telefone: v })}
                  />
                  <CampoEdit
                    label="E-mail"
                    format="email"
                    defaultValue={contato.email}
                    className="sm:col-span-2"
                    onSave={(v) => comercial.updateContato(contato.id, { email: v })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`mailto:${contato.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <Sms size={12} color="currentColor" variant="Linear" className="text-primary" />{" "}
                    Enviar e-mail
                  </a>
                  <a
                    href={`tel:${contato.telefone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <Phone className="size-3 text-primary" /> Ligar
                  </a>
                  <a
                    href={`https://wa.me/${contato.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <MessageCircle
                      size={12}
                      color="currentColor"
                      variant="Linear"
                      className="text-primary"
                    />{" "}
                    WhatsApp
                  </a>
                </div>
              </li>
            )}
            {outrosContatos.map((c) => (
              <li key={c.id} className="rounded-xl border border-border/60 bg-surface-1/40 p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-foreground">
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.cargo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <CampoEdit
                    label="Nome"
                    defaultValue={c.nome}
                    className="sm:col-span-2"
                    onSave={async (v) => {
                      const ok = await comercial.updateContato(c.id, { nome: v });
                      if (ok) toast.success("Contato atualizado.");
                      return ok;
                    }}
                  />
                  <CampoEdit
                    label="Cargo"
                    defaultValue={c.cargo}
                    onSave={(v) => comercial.updateContato(c.id, { cargo: v })}
                  />
                  <CampoEdit
                    label="Telefone"
                    format="phone"
                    defaultValue={c.telefone}
                    onSave={(v) => comercial.updateContato(c.id, { telefone: v })}
                  />
                  <CampoEdit
                    label="E-mail"
                    format="email"
                    defaultValue={c.email}
                    className="sm:col-span-2"
                    onSave={(v) => comercial.updateContato(c.id, { email: v })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <Sms size={12} color="currentColor" variant="Linear" className="text-primary" />{" "}
                    Enviar e-mail
                  </a>
                  <a
                    href={`tel:${c.telefone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <Phone className="size-3 text-primary" /> Ligar
                  </a>
                  <a
                    href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    <MessageCircle
                      size={12}
                      color="currentColor"
                      variant="Linear"
                      className="text-primary"
                    />{" "}
                    WhatsApp
                  </a>
                </div>
              </li>
            ))}
            {outrosContatos.length === 0 && !contato && (
              <p className="rounded-xl border border-dashed border-border bg-surface-1/40 p-6 text-center text-xs text-muted-foreground">
                Nenhum contato vinculado a essa empresa.
              </p>
            )}
          </ul>
        </TabsContent>

        {/* ============ TIMELINE ============ */}
        <TabsContent value="timeline">
          <Timeline events={timeline} />
        </TabsContent>

        {/* ============ ATIVIDADES ============ */}
        <TabsContent value="atividades" className="space-y-3">
          <div className="flex gap-2">
            <Input
              id="drawer-tarefa-input"
              placeholder="Nova atividade..."
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && novaTarefa) {
                  const prazo = new Date();
                  prazo.setDate(prazo.getDate() + 1);
                  const ok = await comercial.addTarefa(lead.id, novaTarefa, prazo.toISOString());
                  if (ok) {
                    setNovaTarefa("");
                    toast.success("Atividade criada.");
                  }
                }
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={async () => {
                if (!novaTarefa) return;
                const prazo = new Date();
                prazo.setDate(prazo.getDate() + 1);
                const ok = await comercial.addTarefa(lead.id, novaTarefa, prazo.toISOString());
                if (ok) {
                  setNovaTarefa("");
                  toast.success("Atividade criada.");
                }
              }}
            >
              <Add size={16} color="currentColor" variant="Linear" className="text-primary" />
            </Button>
          </div>

          <ul className="space-y-1.5">
            {tarefas.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-1/40 p-3"
              >
                <Checkbox
                  checked={t.feita}
                  onCheckedChange={() => comercial.toggleTarefa(t.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", t.feita && "text-muted-foreground line-through")}>
                    {t.titulo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.responsavel} ·{" "}
                    {format(new Date(t.prazo), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </li>
            ))}
            {tarefas.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-surface-1/40 p-6 text-center text-xs text-muted-foreground">
                Nenhuma atividade para esse lead ainda.
              </p>
            )}
          </ul>
        </TabsContent>

        {/* ============ MÓDULOS LIGADOS ============ */}
        <TabsContent value="projetos">
          <Modulo
            titulo="Projetos"
            descricao="Projetos de operação abertos a partir desse lead."
            icone={FolderKanban}
            qtd={lead.projetosIds.length}
            acao="Abrir projetos"
            onAcao={() => navigate({ to: "/projetos" })}
          />
        </TabsContent>
      </Tabs>

      <FecharModal lead={lead} open={fechando} onOpenChange={setFechando} />
      <ExcluirLeadDialog
        lead={excluindo ? lead : null}
        onOpenChange={setExcluindo}
        onDeleted={onClose}
      />
      {empresa && (
        <NovoContatoDialog
          empresaId={empresa.id}
          open={novoContatoAberto}
          onOpenChange={setNovoContatoAberto}
        />
      )}
    </>
  );
}

/* ===================== Sub-componentes ===================== */

function ScoreBox({
  score,
  estrelas,
  rotulo,
}: {
  score: number;
  estrelas: number;
  rotulo: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-gradient-to-br from-surface-2/60 to-surface-1/30 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <MagicStar size={16} color="currentColor" variant="Linear" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Score do lead
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-display text-xl font-semibold tabular-nums text-foreground">
                {score}
              </span>
              <span className="text-[11px] text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-3.5",
                  i < estrelas ? "fill-primary text-primary" : "text-muted-foreground/40",
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{rotulo}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/60">
        Calculado por IA · em breve
      </p>
    </div>
  );
}

function ProgressoEtapas({ atual }: { atual: EtapaJornada }) {
  const etapas = useEtapasComercial();
  const idxAtual = PROGRESSO.indexOf(atual);
  const perdido = atual === "perdido";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-1">
        {PROGRESSO.map((etapa, i) => {
          const meta = etapas.find((e) => e.id === etapa)!;
          const ativo = !perdido && i <= idxAtual;
          const atualEsse = !perdido && i === idxAtual;
          return (
            <div key={etapa} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border transition",
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-1 text-muted-foreground",
                    atualEsse && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                >
                  {ativo && i < idxAtual ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[8px] leading-tight text-center max-w-[60px]",
                    ativo ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {meta.label}
                </span>
              </div>
              {i < PROGRESSO.length - 1 && (
                <div
                  className={cn("h-px flex-1 -mt-3.5", i < idxAtual ? "bg-primary" : "bg-border")}
                />
              )}
            </div>
          );
        })}
      </div>
      {perdido && (
        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-destructive">
          Lead perdido
        </p>
      )}
    </div>
  );
}

function TempPicker({ lead }: { lead: Lead }) {
  const opts: { id: Temperatura; label: string; icon: typeof Flame; cor: string }[] = [
    { id: "frio", label: "Frio", icon: Snowflake, cor: "text-info" },
    { id: "morno", label: "Morno", icon: Thermometer, cor: "text-warning" },
    { id: "quente", label: "Quente", icon: Flame, cor: "text-destructive" },
  ];
  return (
    <div className="mt-3 inline-flex rounded-lg border border-border bg-surface-1 p-0.5">
      {opts.map((o) => {
        const Icon = o.icon;
        const active = lead.temperatura === o.id;
        return (
          <button
            key={o.id}
            onClick={() => comercial.setTemperatura(lead.id, o.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition",
              active
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3", active ? o.cor : "")} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
  tone,
  soon,
}: {
  icon: typeof Add;
  label: string;
  onClick: () => void;
  tone?: "success" | "destructive";
  soon?: boolean;
}) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      title={soon ? "Em breve" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium transition",
        !soon && "hover:bg-surface-2",
        soon && "cursor-not-allowed opacity-50",
        !soon &&
          tone === "success" &&
          "border-success/40 bg-success/10 text-success hover:bg-success/20",
        !soon &&
          tone === "destructive" &&
          "border-destructive/30 text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon className={cn("size-3", soon ? "text-muted-foreground" : !tone && "text-primary")} />
      {label}
      {soon && (
        <span className="ml-0.5 rounded bg-muted px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Em breve
        </span>
      )}
    </button>
  );
}

function TabTrigger({
  value,
  icon: Icon,
  children,
  badge,
}: {
  value: string;
  icon: typeof Add;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex-1 min-w-fit gap-1.5 px-2.5 py-1.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      <Icon className="size-3 text-primary" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </TabsTrigger>
  );
}

function Bloco({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: typeof Add;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="size-3 text-primary" /> {titulo}
      </h3>
      {children}
    </section>
  );
}

function Linha({ icon: Icon, value }: { icon: typeof Add; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-surface-1/40 px-2.5 py-1.5">
      <Icon className="size-3.5 shrink-0 text-primary" />
      <span className="truncate text-xs text-foreground">{value}</span>
    </div>
  );
}

function ContatoLinha({
  contato,
  principal,
}: {
  contato: { nome: string; cargo: string; email: string; telefone: string };
  principal?: boolean;
}) {
  return (
    <li className="rounded-xl border border-border/60 bg-surface-1/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{contato.nome}</p>
          <p className="truncate text-[11px] text-muted-foreground">{contato.cargo}</p>
        </div>
        {principal && (
          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            Principal
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={`mailto:${contato.email}`}
          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Sms size={12} color="currentColor" variant="Linear" className="text-primary" />
          {contato.email}
        </a>
        <a
          href={`tel:${contato.telefone}`}
          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Phone className="size-3 text-primary" />
          {contato.telefone}
        </a>
      </div>
    </li>
  );
}

function CampoEdit({
  label,
  defaultValue,
  onSave,
  type = "text",
  format = "text",
  className,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void | boolean | Promise<void | boolean>;
  type?: string;
  format?: "text" | "currency" | "phone" | "email";
  className?: string;
}) {
  const inicial =
    format === "currency"
      ? Number(defaultValue)
        ? formatBRL(Number(defaultValue), true)
        : ""
      : format === "phone"
        ? maskPhone(defaultValue)
        : defaultValue;
  const [val, setVal] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  const salvar = async (valor: string) => {
    setSalvando(true);
    const ok = await onSave(valor);
    setSalvando(false);
    if (ok === false) setVal(inicial);
  };

  const commit = async () => {
    if (format === "currency") {
      const n = maskCurrency(val).value;
      if (String(n) !== defaultValue) await salvar(String(n));
    } else if (format === "email") {
      const t = val.trim();
      if (t === defaultValue) return;
      if (t && !isValidEmail(t)) {
        toast.error("E-mail inválido.");
        setVal(defaultValue);
        return;
      }
      await salvar(t);
    } else if (val !== defaultValue) {
      await salvar(val);
    }
  };

  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <Input
        type={format === "email" ? "email" : type}
        inputMode={format === "currency" ? "numeric" : format === "phone" ? "tel" : undefined}
        value={val}
        onChange={(e) => {
          const raw = e.target.value;
          if (format === "currency") setVal(maskCurrency(raw).display);
          else if (format === "phone") setVal(maskPhone(raw));
          else setVal(raw);
        }}
        onBlur={commit}
        disabled={salvando}
        className="h-9 text-xs"
      />
    </label>
  );
}

function ContatoEditavel({
  contato,
  principal,
}: {
  contato: { id: string; nome: string; cargo: string; email: string; telefone: string };
  principal?: boolean;
}) {
  return (
    <li className="rounded-xl border border-border/60 bg-surface-1/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {principal ? "Contato principal" : "Contato"}
        </span>
        {principal && (
          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            Principal
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CampoEdit
          label="Nome"
          defaultValue={contato.nome}
          className="sm:col-span-2"
          onSave={async (v) => {
            const ok = await comercial.updateContato(contato.id, { nome: v });
            if (ok) toast.success("Contato atualizado.");
            return ok;
          }}
        />
        <CampoEdit
          label="Cargo"
          defaultValue={contato.cargo}
          onSave={(v) => {
            comercial.updateContato(contato.id, { cargo: v });
          }}
        />
        <CampoEdit
          label="Telefone"
          format="phone"
          defaultValue={contato.telefone}
          onSave={(v) => {
            comercial.updateContato(contato.id, { telefone: v });
          }}
        />
        <CampoEdit
          label="E-mail"
          format="email"
          defaultValue={contato.email}
          className="sm:col-span-2"
          onSave={(v) => {
            comercial.updateContato(contato.id, { email: v });
          }}
        />
      </div>
    </li>
  );
}

function NovoContatoDialog({
  empresaId,
  open,
  onOpenChange,
}: {
  empresaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);

  const reset = () => {
    setNome("");
    setCargo("");
    setEmail("");
    setTelefone("");
  };

  const salvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      toast.error("E-mail inválido.");
      return;
    }
    setSalvando(true);
    const id = await comercial.addContato(empresaId, {
      nome: nome.trim(),
      cargo: cargo.trim() || "—",
      email: email.trim() || "—",
      telefone: telefone.trim() || "—",
      principal: false,
    });
    setSalvando(false);
    if (!id) return;
    toast.success("Contato adicionado.");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !salvando) reset();
        if (!salvando) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar contato</DialogTitle>
          <DialogDescription>
            Cadastre os dados reais da pessoa vinculada a esta empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" />
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
          />
          <PhoneInput value={telefone} onValueChange={setTelefone} />
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={salvando} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando…" : "Adicionar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Modulo({
  titulo,
  descricao,
  icone: Icon,
  qtd,
  acao,
  onAcao,
}: {
  titulo: string;
  descricao: string;
  icone: typeof Add;
  qtd: number;
  acao: string;
  onAcao: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-base font-semibold">{titulo}</p>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {qtd === 0 ? "Nenhum vínculo" : `${qtd} vinculado(s)`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onAcao}>
            <Add size={14} color="currentColor" variant="Linear" className="text-primary" /> {acao}
          </Button>
        </div>
      </div>
    </div>
  );
}
