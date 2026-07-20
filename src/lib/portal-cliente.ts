import { portalSupabase } from "@/lib/portal-supabase";

export const DEFAULT_PORTAL_COVER_URL = "/portal/aurora-project-cover-v4.jpg";

export function portalCoverUrl(coverUrl?: string | null): string {
  return coverUrl?.trim() || DEFAULT_PORTAL_COVER_URL;
}

export interface PortalMilestone {
  id: string;
  title: string;
  date: string;
  status: "pendente" | "concluido" | "atrasado";
}

export interface PortalDeliverable {
  id: string;
  review_id?: string;
  thread_id?: string;
  kind?: "review" | "delivery";
  title: string;
  type: string;
  status: "pendente" | "em_producao" | "revisao" | "ajustes" | "aprovado" | "entregue";
  url: string | null;
  embed_url?: string | null;
  drive_file_id?: string | null;
  notes: string | null;
  version_label?: string | null;
  version_number?: number | null;
  content_cycle?: string | null;
  due_at?: string | null;
  client_feedback?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
}

export interface PortalProject {
  id: string;
  name: string;
  description: string | null;
  phase: string;
  progress: number;
  start_date: string;
  due_date: string | null;
  cover_url?: string | null;
  next_milestone?: string | null;
  milestones: PortalMilestone[];
  deliverables: PortalDeliverable[];
}

export interface PortalContract {
  id: string;
  number: number | null;
  title: string;
  status: string;
  pdf_url: string | null;
  signature_url: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface PortalFile {
  id: string;
  name: string;
  url: string;
  type: string | null;
  category: string;
  created_at: string;
}

export interface ClientPortalSnapshot {
  client: {
    name: string;
    responsible_name: string | null;
    welcome_message: string | null;
  };
  company: {
    name: string;
    logo_url: string | null;
    accent_color: string | null;
  };
  projects: PortalProject[];
  contracts: PortalContract[];
  files: PortalFile[];
}

const PORTAL_DELIVERABLE_STATUS_ALIASES: Record<string, PortalDeliverable["status"]> = {
  draft: "pendente",
  pending: "revisao",
  changes_requested: "ajustes",
  approved: "aprovado",
  archived: "entregue",
  pendente: "pendente",
  em_producao: "em_producao",
  revisao: "revisao",
  ajustes: "ajustes",
  aprovado: "aprovado",
  entregue: "entregue",
};

/**
 * O fluxo interno e o portal usam nomes históricos diferentes para o mesmo
 * estado. Normalizar na entrada evita que um material exista em Revisões, mas
 * desapareça dos contadores e da Central de Aprovações do cliente.
 */
function normalizePortalSnapshot(snapshot: ClientPortalSnapshot): ClientPortalSnapshot {
  return {
    ...snapshot,
    projects: snapshot.projects.map((project) => ({
      ...project,
      deliverables: (project.deliverables ?? [])
        .filter(
          (deliverable) =>
            !(String(deliverable.status) === "archived" && deliverable.kind !== "delivery"),
        )
        .map((deliverable) => ({
          ...deliverable,
          kind: deliverable.kind === "delivery" ? "delivery" : "review",
          status: PORTAL_DELIVERABLE_STATUS_ALIASES[String(deliverable.status)] ?? "pendente",
        })),
    })),
  };
}

const PORTAL_PHASE_PROGRESS_FLOOR: Record<string, number> = {
  preparacao: 0,
  planejamento: 10,
  producao: 40,
  editando: 65,
  aguardando_aprovacao: 85,
  ajustes: 85,
  aprovado: 95,
  entregue: 100,
};

/**
 * Evita que uma etapa avançada pareça ter voltado ao início quando o progresso
 * público ainda não foi configurado. Valores informados pela produtora continuam
 * soberanos; o piso só entra quando o campo está zerado.
 */
export function portalDisplayProgress(progress: number | null | undefined, phase?: string): number {
  const normalized = Math.max(0, Math.min(100, Number(progress) || 0));
  if (normalized > 0) return normalized;
  return PORTAL_PHASE_PROGRESS_FLOOR[phase ?? "preparacao"] ?? 0;
}

export function portalSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cliente"
  );
}

async function resolvePortalToken(identifier: string): Promise<string | null> {
  if (import.meta.env.DEV && identifier === "preview") return identifier;
  if (/^[a-f0-9]{24,64}$/i.test(identifier)) return identifier;

  const { data, error } = await (portalSupabase as any).rpc("meu_portal_token");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function getPublicClientPortal(
  identifier: string,
): Promise<ClientPortalSnapshot | null> {
  if (import.meta.env.DEV && identifier === "preview")
    return normalizePortalSnapshot(PORTAL_PREVIEW);
  const token = await resolvePortalToken(identifier);
  if (!token) return null;
  const { data, error } = await (portalSupabase as any).rpc("portal_cliente_publico", {
    p_token: token,
  });
  if (error) throw error;
  return data ? normalizePortalSnapshot(data as ClientPortalSnapshot) : null;
}

const PORTAL_PREVIEW: ClientPortalSnapshot = {
  client: {
    name: "Aurora Café",
    responsible_name: "Marina",
    welcome_message:
      "Preparamos este espaço para você acompanhar a produção do novo filme da Aurora, revisar materiais e acessar tudo o que já foi aprovado.",
  },
  company: {
    name: "Makers Studio",
    logo_url: null,
    accent_color: "#a3ff2b",
  },
  projects: [
    {
      id: "preview-project",
      name: "Filme de marca — Aurora 2026",
      description:
        "Produção do filme principal de 60 segundos e versões para redes sociais, da pré-produção à entrega final.",
      phase: "revisao",
      progress: 72,
      start_date: "2026-06-08",
      due_date: "2026-07-28",
      cover_url: "/portal/aurora-project-cover-v4.jpg",
      next_milestone: "Aprovação dos conteúdos de julho",
      milestones: [
        { id: "m1", title: "Briefing aprovado", date: "2026-06-10", status: "concluido" },
        { id: "m2", title: "Captação principal", date: "2026-06-24", status: "concluido" },
        { id: "m3", title: "Aprovação do primeiro corte", date: "2026-07-20", status: "pendente" },
        { id: "m4", title: "Entrega dos masters", date: "2026-07-28", status: "pendente" },
      ],
      deliverables: [
        {
          id: "d1",
          review_id: "d1",
          thread_id: "thread-film",
          title: "Filme principal — 60 segundos",
          type: "video",
          status: "revisao",
          url: "https://drive.google.com/file/d/demo-filme-principal/view",
          embed_url: null,
          notes: "Nova trilha aplicada e ajuste de ritmo entre 00:18 e 00:26.",
          version_label: "V2",
          version_number: 2,
          content_cycle: "Julho de 2026",
          due_at: "2026-07-21T18:00:00Z",
          created_at: "2026-07-18T10:00:00Z",
        },
        {
          id: "d2",
          review_id: "d2",
          thread_id: "thread-reel-01",
          title: "Reel 01 — Bastidores da torra",
          type: "video",
          status: "revisao",
          url: "https://drive.google.com/file/d/demo-reel-01/view",
          embed_url: null,
          notes: "Confira principalmente o ritmo dos textos e a seleção das cenas.",
          version_label: "V1",
          version_number: 1,
          content_cycle: "Julho de 2026",
          due_at: "2026-07-22T18:00:00Z",
          created_at: "2026-07-18T09:00:00Z",
        },
        {
          id: "d3",
          review_id: "d3",
          thread_id: "thread-reel-02",
          title: "Reel 02 — Ritual da manhã",
          type: "video",
          status: "revisao",
          url: "https://drive.google.com/file/d/demo-reel-02/view",
          embed_url: null,
          notes: "Primeiro corte com trilha e lettering provisórios.",
          version_label: "V1",
          version_number: 1,
          content_cycle: "Julho de 2026",
          due_at: "2026-07-22T18:00:00Z",
          created_at: "2026-07-17T16:00:00Z",
        },
        {
          id: "d4",
          review_id: "d4",
          thread_id: "thread-moodboard",
          kind: "review",
          title: "Moodboard e direção visual",
          type: "documento",
          status: "aprovado",
          url: "https://example.com/",
          notes: null,
          version_label: "Final",
          version_number: 1,
          content_cycle: "Junho de 2026",
          decided_at: "2026-06-22T15:00:00Z",
          created_at: "2026-06-22T10:00:00Z",
        },
        {
          id: "d5",
          review_id: "d5",
          thread_id: "thread-masters-junho",
          kind: "delivery",
          title: "Masters finais — Junho",
          type: "video",
          status: "entregue",
          url: "https://example.com/",
          notes: "Arquivos finais em 4K, versões verticais e legendadas.",
          version_label: "Final",
          version_number: 1,
          content_cycle: "Junho de 2026",
          decided_at: "2026-06-28T15:00:00Z",
          created_at: "2026-06-28T10:00:00Z",
        },
      ],
    },
  ],
  contracts: [
    {
      id: "c1",
      number: 42,
      title: "Contrato de produção audiovisual",
      status: "assinado",
      pdf_url: "https://example.com/",
      signature_url: null,
      signed_at: "2026-06-07T14:30:00Z",
      created_at: "2026-06-05T14:30:00Z",
    },
  ],
  files: [
    {
      id: "f1",
      name: "Cronograma de produção.pdf",
      url: "https://example.com/",
      type: "application/pdf",
      category: "outro",
      created_at: "2026-06-12T10:00:00Z",
    },
    {
      id: "f2",
      name: "Guia de identidade Aurora.pdf",
      url: "https://example.com/",
      type: "application/pdf",
      category: "briefing",
      created_at: "2026-06-09T10:00:00Z",
    },
  ],
};

export async function approvePortalDeliverable(
  token: string,
  deliverableId: string,
): Promise<boolean> {
  return respondPortalReview(token, deliverableId, "approved");
}

export async function respondPortalReview(
  identifier: string,
  reviewId: string,
  decision: "approved" | "changes_requested",
  feedback?: string,
  clientName?: string,
): Promise<boolean> {
  if (import.meta.env.DEV && identifier === "preview") return true;
  const token = await resolvePortalToken(identifier);
  if (!token) return false;
  const { data, error } = await (portalSupabase as any).rpc("responder_revisao_portal", {
    p_token: token,
    p_review_id: reviewId,
    p_decision: decision,
    p_feedback: feedback?.trim() || null,
    p_client_name: clientName?.trim() || null,
  });
  if (error) throw error;
  return Boolean(data);
}
