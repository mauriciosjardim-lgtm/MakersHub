import { useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MagicStar } from "iconsax-react";
import { useComercialSupa } from "@/lib/hooks/useComercial";
import { fmtBRL, type Lead } from "@/lib/hooks/useComercial";
import { etapasComLabels } from "@/lib/comercial/etapas";

const DIA_MS = 1000 * 60 * 60 * 24;
const ETAPAS_ATIVAS: Lead["etapa"][] = ["novo", "diagnostico", "reuniao", "proposta", "negociacao"];

type Sugestao = {
  texto: ReactNode;
  acaoLabel: string;
  destino: string;
};

function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / DIA_MS);
}

/**
 * Gera uma sugestão real a partir dos dados do comercial, por ordem de prioridade:
 * 1. Tarefas atrasadas
 * 2. Leads ativos parados há ≥ 3 dias (follow-up)
 * 3. Lead quente em proposta/negociação sem próxima ação
 * 4. Resumo positivo do funil
 */
function gerarSugestao(store: ReturnType<typeof useComercialSupa>): Sugestao | null {
  const { leads, empresas, timeline, tarefas } = store;
  const etapas = etapasComLabels(store.etapasLabels);
  const labelEtapa = (etapa: Lead["etapa"]) =>
    etapas.find((item) => item.id === etapa)?.label ?? etapa;
  const nomeEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nome ?? "este cliente";

  // 1. Tarefas atrasadas
  const hojeISO = new Date().toISOString().slice(0, 10);
  const atrasadas = tarefas
    .filter((t) => !t.feita && t.prazo && t.prazo < hojeISO)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  if (atrasadas.length > 0) {
    const t = atrasadas[0];
    return {
      texto:
        atrasadas.length === 1 ? (
          <>
            A tarefa <span className="text-foreground">{t.titulo}</span> está atrasada — bora
            resolver?
          </>
        ) : (
          <>
            Você tem <span className="text-foreground">{atrasadas.length} tarefas atrasadas</span>.
            A mais antiga: <span className="text-foreground">{t.titulo}</span>.
          </>
        ),
      acaoLabel: "Ver follow-ups",
      destino: "/comercial/followups",
    };
  }

  // 2. Leads ativos parados (última movimentação na timeline, ou data de criação)
  const ativos = leads.filter((l) => ETAPAS_ATIVAS.includes(l.etapa));
  const ultimaAtividade = (leadId: string, criadoEm?: string) => {
    const evs = timeline.filter((e) => e.leadId === leadId);
    if (evs.length === 0) return criadoEm;
    return evs.reduce((max, e) => (e.quando > max ? e.quando : max), evs[0].quando);
  };
  const parados = ativos
    .map((l) => ({ lead: l, dias: diasDesde(ultimaAtividade(l.id, l.criadoEm)) }))
    .filter((x) => x.dias >= 3)
    .sort((a, b) => b.dias - a.dias);
  if (parados.length > 0) {
    const { lead, dias } = parados[0];
    return {
      texto: (
        <>
          <span className="text-foreground">{nomeEmpresa(lead.empresaId)}</span> está há{" "}
          <span className="text-foreground">{dias} dias</span> sem movimentação em{" "}
          <span className="text-foreground">{labelEtapa(lead.etapa)}</span> — talvez seja hora de um
          follow-up.
        </>
      ),
      acaoLabel: "Ver follow-ups",
      destino: "/comercial/followups",
    };
  }

  // 3. Lead quente sem próxima ação
  const quenteSemAcao = ativos.find(
    (l) =>
      l.temperatura === "quente" &&
      (l.etapa === "proposta" || l.etapa === "negociacao") &&
      !l.proximaAcao,
  );
  if (quenteSemAcao) {
    return {
      texto: (
        <>
          <span className="text-foreground">{nomeEmpresa(quenteSemAcao.empresaId)}</span> está
          quente em <span className="text-foreground">{labelEtapa(quenteSemAcao.etapa)}</span> e sem
          próxima ação definida. Defina o próximo passo.
        </>
      ),
      acaoLabel: "Abrir comercial",
      destino: "/comercial/leads",
    };
  }

  // 4. Resumo positivo do funil
  if (ativos.length > 0) {
    const total = ativos.reduce((s, l) => s + l.valor, 0);
    return {
      texto: (
        <>
          Funil em dia:{" "}
          <span className="text-foreground">
            {ativos.length} {ativos.length === 1 ? "oportunidade ativa" : "oportunidades ativas"}
          </span>
          {total > 0 && (
            <>
              {" "}
              somando <span className="text-foreground">{fmtBRL(total)}</span>
            </>
          )}
          . Mantenha o ritmo.
        </>
      ),
      acaoLabel: "Ver jornada",
      destino: "/comercial",
    };
  }

  // 5. Sem leads ainda
  return {
    texto: (
      <>Seu funil está vazio. Cadastre seu primeiro lead e comece a acompanhar oportunidades.</>
    ),
    acaoLabel: "Criar lead",
    destino: "/comercial/leads",
  };
}

export function SugestaoMakersHub() {
  const store = useComercialSupa();
  const navigate = useNavigate();
  const sugestao = useMemo(() => (store.loading ? null : gerarSugestao(store)), [store]);

  if (!sugestao) return null;

  return (
    <button
      onClick={() => navigate({ to: sugestao.destino })}
      className="group mb-6 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent p-4 text-left transition hover:border-primary/40 hover:from-primary/[0.12]"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[0_0_20px_-4px_var(--primary)]">
        <MagicStar size={16} color="currentColor" variant="Linear" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Sugestão do MakersHub</span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
            IA
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{sugestao.texto}</p>
      </div>
      <span className="hidden text-xs text-primary group-hover:underline sm:inline">
        {sugestao.acaoLabel}
      </span>
    </button>
  );
}
