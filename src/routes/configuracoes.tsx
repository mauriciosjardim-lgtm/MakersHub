import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convidarMembro } from "@/lib/api/equipe.functions";
import { MODULOS_LABEL, PERMISSOES_PADRAO, type Permissoes } from "@/lib/permissoes";
import { Target, Rocket, Terminal, Monitor } from "lucide-react";
import {
  TickCircle,
  DocumentUpload,
  Brush,
  Buildings2,
  CloseCircle,
  Profile,
  Cpu,
  Copy,
  Trash,
  Key,
  ArrowRight2,
  ArrowLeft2,
  MagicStar,
  Refresh,
  DocumentDownload,
  ArrowDown2,
  People,
} from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadMetas, saveMetas, type MetasConfig } from "@/lib/mock/metas";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { COR_PRESETS, applyBrandColor } from "@/lib/brandColor";

export const Route = createFileRoute("/configuracoes")({
  // ssr:false — módulo privado, dados 100% client-side (mesmo padrão de /financeiro)
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — MakersHub" }] }),
  component: ConfiguracoesPage,
});

const sections = [
  { id: "perfil", label: "Meu Perfil" },
  { id: "produtora", label: "Minha Produtora" },
  { id: "brand", label: "Brand Kit" },
  { id: "metas", label: "Metas Mensais" },
  { id: "equipe", label: "Equipe" },
  { id: "agente", label: "Agente IA" },
  { id: "integracoes", label: "Integrações" },
  { id: "plano", label: "Plano e Faturamento" },
];

function ConfiguracoesPage() {
  useEffect(() => {
    const sectionId = window.location.hash.slice(1);
    if (!sectionId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize sua produtora, equipe e integrações.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </aside>

        <div className="space-y-6">
          <PerfilSection />
          <ProdutoraSection />
          <BrandKitSection />
          <MetasSection />
          <EquipeSection />
          <AgenteIASection />
          <PlaceholderSection
            id="integracoes"
            title="Integrações"
            desc="Google Calendar, Drive, WhatsApp, Stripe."
          />
          <PlaceholderSection
            id="plano"
            title="Plano e Faturamento"
            desc="Gerencie sua assinatura MakersHub."
          />
        </div>
      </div>
    </div>
  );
}

// ─── Meu Perfil ──────────────────────────────────────────────────────────────

function PerfilSection() {
  const { usuario } = useAuth();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [cargo, setCargo] = useState(usuario?.cargo ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNome(usuario?.nome ?? "");
    setCargo(usuario?.cargo ?? "");
  }, [usuario]);

  const salvar = async () => {
    if (!usuario) return;
    setSaving(true);
    await supabase
      .from("usuarios")
      .update({ nome: nome.trim(), cargo: cargo.trim() || null })
      .eq("id", usuario.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section
      id="perfil"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-5 flex items-center gap-2">
        <Profile size={16} color="currentColor" variant="Linear" className="text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Meu Perfil</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome completo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cargo / função</Label>
          <Input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex: Diretor de Fotografia"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">E-mail</Label>
          <Input value={usuario?.email ?? ""} disabled className="opacity-60" />
          <p className="text-[11px] text-muted-foreground">O e-mail não pode ser alterado aqui.</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={salvar} disabled={saving} className="h-9 rounded-lg px-4 text-sm">
          {saving ? "Salvando…" : "Salvar perfil"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
            <TickCircle size={14} color="currentColor" variant="Linear" /> Atualizado
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Minha Produtora ─────────────────────────────────────────────────────────

const LOGO_SIZE_KEY = "makershub:logo_size";

function ProdutoraSection() {
  const { empresa, refreshEmpresa } = useAuth();
  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(empresa?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoSize, setLogoSize] = useState<number>(() =>
    Number(localStorage.getItem(LOGO_SIZE_KEY) ?? 2),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNome(empresa?.nome ?? "");
    setLogoPreview(empresa?.logo_url ?? null);
  }, [empresa]);

  const handleLogoSize = (v: number) => {
    setLogoSize(v);
    localStorage.setItem(LOGO_SIZE_KEY, String(v));
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removerLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const salvar = async () => {
    if (!empresa) return;
    setSaving(true);
    let logo_url = empresa.logo_url;

    if (logoFile) {
      // Converte para base64 e salva direto na coluna — sem depender do Storage
      logo_url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(logoFile);
      });
    } else if (logoPreview === null && empresa.logo_url) {
      logo_url = null;
    }

    await supabase.from("empresas").update({ nome: nome.trim(), logo_url }).eq("id", empresa.id);
    setLogoFile(null);
    await refreshEmpresa();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section
      id="produtora"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-5 flex items-center gap-2">
        <Buildings2 size={16} color="currentColor" variant="Linear" className="text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Minha Produtora</h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative grid size-24 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-surface-2/60 transition hover:border-primary/40">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="size-full object-contain"
                style={{ padding: `${(8 - logoSize) * 4}px` }}
              />
            ) : (
              <DocumentUpload
                size={24}
                color="currentColor"
                variant="Linear"
                className="text-muted-foreground"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleLogo}
            />
          </div>
          {logoPreview && (
            <>
              <div className="flex w-full max-w-[96px] flex-col gap-1">
                <span className="text-center text-[10px] text-muted-foreground">Tamanho</span>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={logoSize}
                  onChange={(e) => handleLogoSize(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
              </div>
              <button
                onClick={removerLogo}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <CloseCircle size={12} color="currentColor" variant="Linear" /> Remover
              </button>
            </>
          )}
          <p className="text-center text-[10px] text-muted-foreground">
            PNG ou SVG
            <br />
            Recomendado 200×200px
          </p>
        </div>

        {/* Nome */}
        <div className="flex flex-col justify-center gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da produtora</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Visão Filmes"
              className="max-w-sm"
            />
          </div>
          <div>
            <Button onClick={salvar} disabled={saving} className="h-9 rounded-lg px-4 text-sm">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            {saved && (
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-primary">
                <TickCircle size={14} color="currentColor" variant="Linear" /> Atualizado
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Brand Kit ───────────────────────────────────────────────────────────────

function BrandKitSection() {
  const { empresa, refreshEmpresa } = useAuth();
  const [cor, setCor] = useState(empresa?.accent_color ?? COR_PRESETS[0].value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCor(empresa?.accent_color ?? COR_PRESETS[0].value);
  }, [empresa]);

  const aplicarCor = (c: string) => {
    setCor(c);
    applyBrandColor(c);
  };

  const salvar = async () => {
    if (!empresa) return;
    setSaving(true);
    await supabase.from("empresas").update({ accent_color: cor }).eq("id", empresa.id);
    await refreshEmpresa();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section
      id="brand"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-5 flex items-center gap-2">
        <Brush size={16} color="currentColor" variant="Linear" className="text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Brand Kit</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Cor de destaque usada em botões, badges e gráficos.
      </p>

      <div className="flex flex-wrap gap-3">
        {COR_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => aplicarCor(p.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition",
              cor === p.value
                ? "border-primary ring-2 ring-primary/30"
                : "border-border/60 hover:border-primary/40",
            )}
          >
            <span className="size-8 rounded-full shadow" style={{ backgroundColor: p.value }} />
            <span className="text-[11px] text-muted-foreground">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={salvar} disabled={saving} className="h-9 rounded-lg px-4 text-sm">
          {saving ? "Salvando…" : "Salvar cor"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
            <TickCircle size={14} color="currentColor" variant="Linear" /> Cor salva
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Metas Mensais ───────────────────────────────────────────────────────────

function MetasSection() {
  const [config, setConfig] = useState<MetasConfig>({ meta: 100000, superMeta: 150000 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadMetas());
  }, []);

  const handleSave = () => {
    saveMetas(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section
      id="metas"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-1 font-display text-lg font-semibold tracking-tight">Metas Mensais</div>
      <p className="mb-5 text-sm text-muted-foreground">
        Alimentam o Progresso do Mês no Dashboard.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          icon={Target}
          label="Meta mensal"
          hint="Receita-alvo do mês."
          value={config.meta}
          onChange={(v) => setConfig((c) => ({ ...c, meta: v }))}
        />
        <MoneyField
          icon={Rocket}
          label="Super Meta mensal"
          hint="Ambição que vai além da meta."
          value={config.superMeta}
          onChange={(v) => setConfig((c) => ({ ...c, superMeta: v }))}
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} className="h-9 rounded-lg px-4 text-sm">
          Salvar metas
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <TickCircle size={14} color="currentColor" variant="Linear" /> Atualizado
          </span>
        )}
      </div>
    </section>
  );
}

function MoneyField({
  icon: Icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const fmt = (v: number) =>
    Number.isFinite(v)
      ? v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : "0";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onChange(raw ? Number(raw) : 0);
  };

  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 focus-within:border-primary/40">
        <span className="text-sm text-muted-foreground">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={fmt(value)}
          onChange={handleChange}
          className="h-10 w-full bg-transparent font-display text-base tabular-nums text-foreground outline-none"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </label>
  );
}

// ─── Agente IA (MCP) ─────────────────────────────────────────────────────────

// URL do servidor MCP (Cloudflare Worker). Após o primeiro `wrangler deploy`,
// confirme/atualize aqui com a URL que o deploy imprimir.
const MCP_URL = "https://mcp.makershub.app.br";

interface McpToken {
  id: string;
  nome: string;
  criado_em: string;
  ultimo_uso: string | null;
  revogado: boolean;
}

type McpResult<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}>;

interface McpTokensTable {
  select: (columns: string) => {
    eq: (
      column: "revogado",
      value: boolean,
    ) => {
      order: (column: "criado_em", options: { ascending: boolean }) => McpResult<McpToken[]>;
    };
  };
  update: (values: { revogado: boolean }) => {
    eq: (column: "id", value: string) => McpResult<null>;
  };
  insert: (values: { empresa_id: string; token_hash: string; nome: string }) => McpResult<null>;
}

const mcpTokensTable = () =>
  (supabase.from as unknown as (table: "mcp_tokens") => McpTokensTable)("mcp_tokens");
type AuthEmpresa = NonNullable<ReturnType<typeof useAuth>["empresa"]>;

function gerarTokenPlano(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "mkr_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AgenteIASection() {
  const { empresa } = useAuth();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardAberto, setWizardAberto] = useState(false);
  const [mostrarAcessos, setMostrarAcessos] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    const { data } = await mcpTokensTable()
      .select("id, nome, criado_em, ultimo_uso, revogado")
      .eq("revogado", false)
      .order("criado_em", { ascending: false });
    setTokens((data as McpToken[]) ?? []);
    setLoading(false);
  }, [empresa]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const revogar = async (id: string) => {
    if (!confirm("Revogar este acesso? O agente conectado com ele perde o acesso imediatamente."))
      return;
    await mcpTokensTable().update({ revogado: true }).eq("id", id);
    void carregar();
  };

  return (
    <section
      id="agente"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <Cpu size={16} color="currentColor" variant="Linear" className="text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Agente IA</h2>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Conecte seu ChatGPT ou Claude ao MakersHub. Ele passa a criar leads, lançar no financeiro,
        abrir projetos e agendar — em linguagem natural, sem você abrir o sistema.
      </p>

      {/* Card de chamada pro wizard */}
      <div className="flex flex-col items-start gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <MagicStar size={20} color="currentColor" variant="Linear" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Conectar minha IA</p>
            <p className="text-xs text-muted-foreground">
              ChatGPT ou Claude — passo a passo, uns 2 minutos.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setWizardAberto(true)}
          className="h-10 shrink-0 rounded-lg px-5 text-sm"
        >
          Começar <ArrowRight2 size={16} color="currentColor" variant="Linear" className="ml-1.5" />
        </Button>
      </div>

      {/* Acessos ativos — colapsável */}
      {!loading && tokens.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setMostrarAcessos((v) => !v)}
            className="flex w-full items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
          >
            <Key size={12} color="currentColor" variant="Linear" />
            Acessos ativos
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
              {tokens.length}
            </span>
            <ArrowDown2
              size={14}
              color="currentColor"
              variant="Linear"
              className={cn("ml-auto transition", mostrarAcessos && "rotate-180")}
            />
          </button>
          {mostrarAcessos && (
            <ul className="mt-2 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
              {tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 bg-surface-2/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Criado em {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                      {t.ultimo_uso
                        ? ` · Último uso ${new Date(t.ultimo_uso).toLocaleString("pt-BR")}`
                        : " · Nunca usado"}
                    </p>
                  </div>
                  <button
                    onClick={() => revogar(t.id)}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash size={14} color="currentColor" variant="Linear" /> Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {wizardAberto &&
        createPortal(
          <ConectarWizard
            empresa={empresa}
            onClose={() => {
              setWizardAberto(false);
              carregar();
            }}
          />,
          document.body,
        )}
    </section>
  );
}

// ─── Wizard de conexão (passo a passo com mockups) ───────────────────────────

type AppAlvo = "chatgpt" | "desktop" | "code";

function ConectarWizard({
  empresa,
  onClose,
}: {
  empresa: AuthEmpresa | null;
  onClose: () => void;
}) {
  const [app, setApp] = useState<AppAlvo | null>(null);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    if (!empresa || token) return;
    setGerando(true);
    const plano = gerarTokenPlano();
    const hash = await sha256Hex(plano);
    const { error } = await mcpTokensTable().insert({
      empresa_id: empresa.id,
      token_hash: hash,
      nome: app === "code" ? "Claude Code" : "Claude Desktop",
    });
    setGerando(false);
    if (error) {
      alert("Erro ao gerar acesso: " + error.message);
      return;
    }
    setToken(plano);
  };

  const configJson = `{
  "mcpServers": {
    "makershub": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}",
        "--header", "Authorization: Bearer ${token ?? "SEU_TOKEN"}"]
    }
  }
}`;
  const comandoCode = `claude mcp add --transport http makershub ${MCP_URL} --header "Authorization: Bearer ${token ?? "SEU_TOKEN"}"`;

  // monta os passos conforme o app escolhido
  const steps: { titulo: string; node: React.ReactNode }[] = [];
  if (app === "chatgpt") {
    steps.push(
      { titulo: "Ative o modo desenvolvedor", node: <StepDevModeGPT /> },
      { titulo: "Crie o app do MakersHub", node: <StepCriarAppGPT /> },
      { titulo: "Faça login e autorize", node: <StepLoginGPT /> },
      { titulo: "Tudo pronto!", node: <StepPronto /> },
    );
  } else if (app === "desktop") {
    steps.push(
      {
        titulo: "Gere sua chave de acesso",
        node: <StepGerar gerando={gerando} token={token} onGerar={gerar} />,
      },
      { titulo: "Instale o Node (uma vez só)", node: <StepNode /> },
      { titulo: "Abra a configuração do Claude", node: <StepAbrirConfigDesktop /> },
      {
        titulo: "Cole a configuração",
        node: <StepColar texto={configJson} label="configuração" multiline />,
      },
      { titulo: "Reinicie o Claude", node: <StepReiniciar /> },
      { titulo: "Tudo pronto!", node: <StepPronto /> },
    );
  } else if (app === "code") {
    steps.push(
      {
        titulo: "Gere sua chave de acesso",
        node: <StepGerar gerando={gerando} token={token} onGerar={gerar} />,
      },
      {
        titulo: "Cole o comando no terminal",
        node: <StepColar texto={comandoCode} label="comando" />,
      },
      { titulo: "Tudo pronto!", node: <StepPronto /> },
    );
  }

  const total = steps.length;
  // ChatGPT é OAuth direto (sem token). Desktop/Code travam o "Próximo" até gerar a chave.
  const precisaToken = (app === "desktop" || app === "code") && step === 0 && !token;
  const podeAvancar = !precisaToken;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <MagicStar size={16} color="currentColor" variant="Linear" className="text-primary" />
            <span className="text-sm font-semibold">Conectar minha IA</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <CloseCircle size={16} color="currentColor" variant="Linear" />
          </button>
        </div>

        {/* corpo */}
        <div className="flex-1 overflow-y-auto p-5">
          {!app ? (
            <StepEscolherApp
              onEscolher={(a) => {
                setApp(a);
                setStep(0);
              }}
            />
          ) : (
            <>
              {/* progresso */}
              <div className="mb-5 flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition",
                      i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-border",
                    )}
                  />
                ))}
              </div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Passo {step + 1} de {total}
              </p>
              <h3 className="mb-4 font-display text-lg font-semibold tracking-tight">
                {steps[step].titulo}
              </h3>
              {steps[step].node}
            </>
          )}
        </div>

        {/* footer nav */}
        {app && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
            <button
              onClick={() => (step === 0 ? setApp(null) : setStep((s) => s - 1))}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft2 size={16} color="currentColor" variant="Linear" /> Voltar
            </button>
            {step < total - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!podeAvancar}
                className="h-9 rounded-lg px-5 text-sm"
              >
                Próximo{" "}
                <ArrowRight2 size={16} color="currentColor" variant="Linear" className="ml-1.5" />
              </Button>
            ) : (
              <Button onClick={onClose} className="h-9 rounded-lg px-5 text-sm">
                Concluir{" "}
                <TickCircle size={16} color="currentColor" variant="Linear" className="ml-1.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// — Mockup reutilizável (moldura de "print") —
function Mock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/60">
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-surface-2/50 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-yellow-400/70" />
        <span className="size-2.5 rounded-full bg-green-400/70" />
        {label && <span className="ml-2 text-[10px] text-muted-foreground">{label}</span>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function StepEscolherApp({ onEscolher }: { onEscolher: (a: AppAlvo) => void }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Onde você usa a IA?</p>
      <div className="grid gap-3">
        <button
          onClick={() => onEscolher("chatgpt")}
          className="relative flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/5 p-4 text-left transition hover:bg-primary/10"
        >
          <span className="absolute right-3 top-3 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Mais fácil
          </span>
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <MagicStar size={20} color="currentColor" variant="Linear" />
          </div>
          <div>
            <p className="text-sm font-semibold">ChatGPT</p>
            <p className="text-xs text-muted-foreground">
              Só colar o endereço e fazer login. Sem instalar nada.
            </p>
          </div>
          <ArrowRight2
            size={16}
            color="currentColor"
            variant="Linear"
            className="ml-auto text-muted-foreground"
          />
        </button>
        <button
          onClick={() => onEscolher("desktop")}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/30 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Monitor className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Claude Desktop</p>
            <p className="text-xs text-muted-foreground">O aplicativo do Claude no computador.</p>
          </div>
          <ArrowRight2
            size={16}
            color="currentColor"
            variant="Linear"
            className="ml-auto text-muted-foreground"
          />
        </button>
        <button
          onClick={() => onEscolher("code")}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/30 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Terminal className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Claude Code</p>
            <p className="text-xs text-muted-foreground">
              A versão de terminal (pra quem é mais técnico).
            </p>
          </div>
          <ArrowRight2
            size={16}
            color="currentColor"
            variant="Linear"
            className="ml-auto text-muted-foreground"
          />
        </button>
      </div>
    </div>
  );
}

function StepGerar({
  gerando,
  token,
  onGerar,
}: {
  gerando: boolean;
  token: string | null;
  onGerar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Esta é a senha que liga o Claude ao seu MakersHub. Guarde-a — ela só aparece uma vez.
      </p>
      {!token ? (
        <Button onClick={onGerar} disabled={gerando} className="h-10 w-full rounded-lg text-sm">
          <Key size={16} color="currentColor" variant="Linear" className="mr-1.5" />{" "}
          {gerando ? "Gerando…" : "Gerar minha chave"}
        </Button>
      ) : (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <TickCircle size={14} color="currentColor" variant="Linear" /> Chave gerada
          </div>
          <div className="relative rounded-lg border border-border/60 bg-background/70 p-3 pr-11">
            <code className="block break-all font-mono text-[12px] text-foreground">{token}</code>
            <button
              onClick={copiar}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] transition hover:bg-surface-1"
            >
              {copiado ? (
                <TickCircle
                  size={14}
                  color="currentColor"
                  variant="Linear"
                  className="text-primary"
                />
              ) : (
                <Copy size={14} color="currentColor" variant="Linear" />
              )}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Já vem embutida nos próximos passos — é só copiar lá.
          </p>
        </div>
      )}
    </div>
  );
}

function StepDevModeGPT() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        No <strong>ChatGPT pelo navegador</strong>, clique no seu perfil e abra
        <strong> Configurações → Apps → Configurações avançadas</strong>. Ative o
        <strong> Modo desenvolvedor</strong> para liberar a criação do MakersHub.
      </p>
      <div className="mb-4 rounded-xl border border-warning/25 bg-warning/[.04] p-3 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-warning">Seu plano muda o caminho:</strong> no Pro, faça isso nas
        configurações da sua conta. No Business, somente admin/proprietário pode ativar e criar o
        app em <strong className="text-foreground">Configurações do workspace → Apps</strong>.
      </div>
      <Mock label="ChatGPT · Configurações → Apps → Configurações avançadas">
        <div className="flex gap-3">
          <div className="w-24 shrink-0 space-y-1.5 text-[10px] text-muted-foreground">
            <div className="rounded px-2 py-1">Geral</div>
            <div className="rounded bg-primary/15 px-2 py-1 font-medium text-primary">Apps</div>
            <div className="rounded px-2 py-1">Personalização</div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">Configurações avançadas</span>
              <span className="text-[9px] text-muted-foreground">Beta</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/50 bg-surface-2/40 px-2.5 py-1.5">
              <span className="text-[11px] text-foreground">Modo desenvolvedor</span>
              <span className="flex h-3.5 w-6 items-center rounded-full bg-primary px-0.5">
                <span className="ml-auto size-2.5 rounded-full bg-primary-foreground" />
              </span>
            </div>
          </div>
        </div>
      </Mock>
    </div>
  );
}

function StepCriarAppGPT() {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(MCP_URL);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Volte para <strong>Configurações → Apps</strong> e clique em <strong>“Criar app”</strong>.
        No Business, use <strong>Configurações do workspace → Apps → Criar</strong>. Preencha assim:
      </p>
      <div className="relative mb-3 rounded-lg border border-border/60 bg-background/80 p-3 pr-11">
        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          URL do servidor
        </p>
        <code className="block break-all font-mono text-[12px] text-foreground">{MCP_URL}</code>
        <button
          onClick={copiar}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] transition hover:bg-surface-1"
        >
          {copiado ? (
            <TickCircle size={14} color="currentColor" variant="Linear" className="text-primary" />
          ) : (
            <Copy size={14} color="currentColor" variant="Linear" />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <Mock label="ChatGPT · Apps → Criar">
        <div className="space-y-2 text-[11px]">
          <div>
            <span className="text-muted-foreground">Nome:</span>{" "}
            <span className="text-foreground">MakersHub</span>
          </div>
          <div>
            <span className="text-muted-foreground">Servidor MCP:</span>{" "}
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
              Remoto
            </span>
          </div>
          <div className="rounded border border-border/50 bg-surface-2/40 px-2 py-1 font-mono text-foreground">
            {MCP_URL}
          </div>
          <div>
            <span className="text-muted-foreground">Autenticação:</span>{" "}
            <span className="text-foreground">OAuth</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="grid size-3.5 place-items-center rounded-sm bg-primary text-[8px] text-primary-foreground">
              ✓
            </span>{" "}
            Confirmar que confio neste app
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
            Criar
          </div>
        </div>
      </Mock>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Ações completas de criação e alteração estão disponíveis oficialmente no Business,
        Enterprise e Edu. No Pro, o ChatGPT pode limitar o app às ferramentas de leitura.
      </p>
    </div>
  );
}

function StepLoginGPT() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Vai abrir a <strong>tela de login do MakersHub</strong>. Entre com seu e-mail e senha e
        clique em
        <strong> autorizar</strong>. Pronto — sem token, sem terminal.
      </p>
      <Mock label="Conectar ao MakersHub">
        <div className="mx-auto max-w-[200px] space-y-2 py-1">
          <div className="mx-auto grid size-8 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
            N
          </div>
          <div className="h-7 rounded-md border border-border/60 bg-background/70" />
          <div className="h-7 rounded-md border border-border/60 bg-background/70" />
          <div className="h-7 rounded-md bg-primary text-center text-[11px] font-medium leading-7 text-primary-foreground">
            Entrar e autorizar
          </div>
        </div>
      </Mock>
    </div>
  );
}

function StepNode() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        O Claude Desktop precisa do <strong>Node.js</strong> pra falar com o MakersHub. É grátis e
        instala uma vez só. Se você já tem, pode pular.
      </p>
      <a
        href="https://nodejs.org/pt-br/download/prebuilt-installer"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
      >
        <DocumentDownload size={16} color="currentColor" variant="Linear" /> Baixar o Node.js
      </a>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Baixe a versão “LTS”, abra o instalador e clique em avançar até o fim.
      </p>
    </div>
  );
}

function StepAbrirConfigDesktop() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        No Claude Desktop, abra <strong>Configurações → Desenvolvedor</strong> e clique em
        <strong> “Editar configuração”</strong>. Um arquivo vai abrir — é nele que vamos colar no
        próximo passo.
      </p>
      <Mock label="Claude · Configurações">
        <div className="flex gap-3">
          <div className="w-24 shrink-0 space-y-1.5 text-[10px] text-muted-foreground">
            <div className="rounded px-2 py-1">Geral</div>
            <div className="rounded px-2 py-1">Perfil</div>
            <div className="rounded bg-primary/15 px-2 py-1 font-medium text-primary">
              Desenvolvedor
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2 w-3/4 rounded bg-border" />
            <div className="h-2 w-1/2 rounded bg-border" />
            <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary">
              Editar configuração
            </div>
          </div>
        </div>
      </Mock>
    </div>
  );
}

function StepColar({
  texto,
  label,
  multiline,
}: {
  texto: string;
  label: string;
  multiline?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Copie {label === "comando" ? "o comando" : "a configuração"} abaixo e cole{" "}
        {label === "comando"
          ? "no terminal, depois aperte Enter"
          : "no arquivo que abriu (substituindo o conteúdo), e salve"}
        .{label !== "comando" && " A sua chave já está embutida."}
      </p>
      <div className="relative rounded-lg border border-border/60 bg-background/80 p-3 pr-11">
        <pre
          className={cn(
            "overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground",
            multiline ? "whitespace-pre" : "whitespace-pre-wrap break-all",
          )}
        >
          {texto}
        </pre>
        <button
          onClick={copiar}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] transition hover:bg-surface-1"
        >
          {copiado ? (
            <TickCircle size={14} color="currentColor" variant="Linear" className="text-primary" />
          ) : (
            <Copy size={14} color="currentColor" variant="Linear" />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function StepReiniciar() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Feche o Claude Desktop por completo (não só a janela) e abra de novo. Ele vai carregar o
        MakersHub.
      </p>
      <Mock label="Claude">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Refresh size={24} color="currentColor" variant="Linear" className="text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Cmd+Q (Mac) ou fechar pela bandeja, e abrir de novo
          </p>
        </div>
      </Mock>
    </div>
  );
}

function StepPronto() {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
        <MagicStar size={28} color="currentColor" variant="Linear" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Sua IA já está ligada ao MakersHub! 🎬
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        No chat, é só pedir em português. Experimente:
      </p>
      <div className="w-full space-y-1.5 text-left">
        {[
          "Liste meus leads no MakersHub",
          "Lance uma despesa de R$ 800 de edição pro dia 30",
          "Qual meu resumo financeiro?",
        ].map((ex) => (
          <div
            key={ex}
            className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2 text-[12px] text-foreground"
          >
            “{ex}”
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Equipe ───────────────────────────────────────────────────────────────────

interface Membro {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  role: string;
  permissoes: Partial<Permissoes>;
}
interface Convite {
  id: string;
  email: string;
  nome: string | null;
  role: string;
  permissoes: Partial<Permissoes>;
  criado_em: string;
}

function EquipeSection() {
  const { empresa, usuario, session } = useAuth();
  const isAdmin = usuario?.role !== "membro";

  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário de convite
  const [email, setEmail] = useState("");
  const [nomeConvite, setNomeConvite] = useState("");
  const [role, setRole] = useState<"membro" | "admin">("membro");
  const [permissoes, setPermissoes] = useState<Permissoes>({ ...PERMISSOES_PADRAO });
  const [enviando, setEnviando] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);
  const [erroConvite, setErroConvite] = useState<string | null>(null);

  // Edição de acessos de um membro existente
  const [editandoAcesso, setEditandoAcesso] = useState<string | null>(null);
  const [acessoDraft, setAcessoDraft] = useState<Permissoes>({ ...PERMISSOES_PADRAO });
  const [salvandoAcesso, setSalvandoAcesso] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase
        .from("usuarios")
        .select("id, nome, email, cargo, role, permissoes")
        .eq("empresa_id", empresa.id),
      supabase
        .from("equipe_convites")
        .select("id, email, nome, role, permissoes, criado_em")
        .eq("empresa_id", empresa.id)
        .eq("status", "pendente"),
    ]);
    setMembros((m ?? []) as Membro[]);
    setConvites((c ?? []) as Convite[]);
    setLoading(false);
  }, [empresa]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const convidar = async () => {
    setErroConvite(null);
    if (!email.trim()) {
      setErroConvite("Informe o e-mail.");
      return;
    }

    // Pega um token FRESCO (renova se expirou) — evita "Não autenticado" por token velho
    let accessToken = session?.access_token ?? "";
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) accessToken = data.session.access_token;
    } catch {
      /* usa o token do contexto como fallback */
    }
    if (!accessToken) {
      setErroConvite("Sua sessão expirou. Recarregue a página e entre novamente.");
      return;
    }

    setEnviando(true);

    try {
      const json = await convidarMembro({
        data: {
          accessToken,
          email: email.trim(),
          nome: nomeConvite.trim() || undefined,
          role: role as "admin" | "membro",
          permissoes: role === "admin" ? {} : (permissoes as Record<string, boolean>),
        },
      });

      // Link de backup caso o email falhe
      if (json.emailError) {
        const link = `https://makershub.app.br/aceitar-convite?token=${json.token}`;
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          /* permissão negada */
        }
        setLinkCopiado(link);
      }

      setEmail("");
      setNomeConvite("");
      setRole("membro");
      setPermissoes({ ...PERMISSOES_PADRAO });
      carregar();
    } catch (err: unknown) {
      setErroConvite(err instanceof Error ? err.message : "Erro ao convidar. Tente novamente.");
      console.error("Erro no convidar:", err);
    } finally {
      setEnviando(false);
    }
  };

  const cancelarConvite = async (id: string) => {
    await supabase.rpc("cancelar_convite", { p_id: id });
    carregar();
  };

  const removerMembro = async (id: string) => {
    if (
      !confirm(
        "Remover este membro? O acesso dele será revogado imediatamente. O histórico de tarefas e atividades é preservado.",
      )
    )
      return;
    const { error } = await supabase.rpc("remover_membro", { p_usuario_id: id });
    if (error) {
      setErroConvite(error.message);
      return;
    }
    carregar();
  };

  const alterarPapel = async (
    id: string,
    novoRole: "admin" | "membro",
    perms?: Partial<Permissoes>,
  ) => {
    setErroConvite(null);
    const { error } = await supabase.rpc("alterar_papel_membro", {
      p_usuario_id: id,
      p_role: novoRole,
      p_permissoes: novoRole === "admin" ? {} : (perms ?? { ...PERMISSOES_PADRAO }),
    });
    if (error) {
      setErroConvite(error.message);
      return;
    }
    carregar();
  };

  const abrirAcesso = (m: Membro) => {
    setErroConvite(null);
    setEditandoAcesso(m.id);
    setAcessoDraft({ ...PERMISSOES_PADRAO, ...(m.permissoes ?? {}) });
  };

  const salvarAcesso = async (id: string) => {
    setSalvandoAcesso(true);
    setErroConvite(null);
    const { error } = await supabase.rpc("alterar_papel_membro", {
      p_usuario_id: id,
      p_role: "membro",
      p_permissoes: acessoDraft,
    });
    setSalvandoAcesso(false);
    if (error) {
      setErroConvite(error.message);
      return;
    }
    setEditandoAcesso(null);
    carregar();
  };

  const togglePerm = (k: keyof Permissoes) => setPermissoes((p) => ({ ...p, [k]: !p[k] }));

  return (
    <section
      id="equipe"
      className="scroll-mt-6 rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <People size={16} color="currentColor" variant="Linear" className="text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Equipe</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Convide membros, defina papéis e controle o acesso por módulo.
      </p>

      {/* Membros ativos */}
      {!loading && membros.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Membros ativos
          </p>
          <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
            {membros.map((m) => (
              <li key={m.id} className="bg-surface-2/30">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
                    {m.nome
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                  </div>
                  {isAdmin && m.id !== usuario?.id ? (
                    <select
                      value={m.role === "admin" ? "admin" : "membro"}
                      onChange={(e) =>
                        alterarPapel(m.id, e.target.value as "admin" | "membro", m.permissoes)
                      }
                      className="shrink-0 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] font-medium text-foreground outline-none transition hover:bg-surface-1 focus:border-primary/40"
                    >
                      <option value="membro">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        m.role === "admin"
                          ? "bg-primary/15 text-primary"
                          : "bg-surface-3 text-muted-foreground",
                      )}
                    >
                      {m.role === "admin" ? "Admin" : "Membro"}
                    </span>
                  )}
                  {m.id === usuario?.id && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">você</span>
                  )}
                  {isAdmin && m.id !== usuario?.id && m.role !== "admin" && (
                    <button
                      onClick={() =>
                        editandoAcesso === m.id ? setEditandoAcesso(null) : abrirAcesso(m)
                      }
                      title="Gerenciar acessos"
                      data-active={editandoAcesso === m.id}
                      className="shrink-0 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-1 hover:text-foreground data-[active=true]:border-primary/40 data-[active=true]:text-primary"
                    >
                      Acessos
                    </button>
                  )}
                  {isAdmin && m.id !== usuario?.id && (
                    <button
                      onClick={() => removerMembro(m.id)}
                      title="Remover da equipe"
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash size={14} color="currentColor" variant="Linear" />
                    </button>
                  )}
                </div>

                {/* Painel de acessos por módulo */}
                {editandoAcesso === m.id && (
                  <div className="space-y-3 border-t border-border/50 bg-surface-1/40 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Módulos com acesso
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(Object.keys(MODULOS_LABEL) as (keyof Permissoes)[]).map((k) => (
                        <label
                          key={k}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2 text-xs transition hover:border-primary/30"
                        >
                          <input
                            type="checkbox"
                            checked={!!acessoDraft[k]}
                            onChange={() => setAcessoDraft((p) => ({ ...p, [k]: !p[k] }))}
                            className="size-3.5 accent-primary"
                          />
                          {MODULOS_LABEL[k]}
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => salvarAcesso(m.id)}
                        disabled={salvandoAcesso}
                        className="h-8 rounded-lg px-4 text-xs"
                      >
                        {salvandoAcesso ? "Salvando…" : "Salvar acessos"}
                      </Button>
                      <button
                        onClick={() => setEditandoAcesso(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Convites pendentes */}
      {convites.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Convites pendentes
          </p>
          <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
            {convites.map((c) => (
              <li key={c.id} className="flex items-center gap-3 bg-surface-2/20 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.nome ? `${c.nome} · ` : ""}
                    {c.role === "admin" ? "Admin" : "Membro"} · Enviado{" "}
                    {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const { data } = await supabase
                      .from("equipe_convites")
                      .select("token")
                      .eq("id", c.id)
                      .single();
                    if (data) {
                      const link = `${window.location.origin}/aceitar-convite?token=${data.token}`;
                      navigator.clipboard.writeText(link);
                      setLinkCopiado(link);
                      setTimeout(() => setLinkCopiado(null), 3000);
                    }
                  }}
                  className="shrink-0 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-1"
                >
                  <Copy size={12} color="currentColor" variant="Linear" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => cancelarConvite(c.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash size={14} color="currentColor" variant="Linear" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link copiado feedback */}
      {linkCopiado && (
        <div className="mb-4 space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-primary">
            <TickCircle size={14} color="currentColor" variant="Linear" />
            Email não enviado — compartilhe o link diretamente com o membro:
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[10px] text-foreground">
              {linkCopiado}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(linkCopiado);
                } catch {
                  /* sem permissão */
                }
              }}
              className="shrink-0 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-1"
            >
              <Copy size={12} color="currentColor" variant="Linear" />
            </button>
          </div>
        </div>
      )}

      {/* Formulário de convite */}
      {isAdmin && (
        <div className="space-y-4 rounded-xl border border-dashed border-border/60 p-4">
          <p className="text-sm font-medium">Convidar novo membro</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome (opcional)</Label>
              <Input
                value={nomeConvite}
                onChange={(e) => setNomeConvite(e.target.value)}
                placeholder="Como chamá-lo?"
              />
            </div>
          </div>

          {/* Role toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs">Papel</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-1 p-1">
              {(["membro", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition",
                    role === r
                      ? "bg-surface-3 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "admin" ? "Admin (acesso total)" : "Membro (acesso limitado)"}
                </button>
              ))}
            </div>
          </div>

          {/* Permissões por módulo — só para membros */}
          {role === "membro" && (
            <div className="space-y-2">
              <Label className="text-xs">Módulos com acesso</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(MODULOS_LABEL) as (keyof Permissoes)[]).map((k) => (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2 text-xs transition hover:border-primary/30"
                  >
                    <input
                      type="checkbox"
                      checked={permissoes[k]}
                      onChange={() => togglePerm(k)}
                      className="size-3.5 accent-primary"
                    />
                    {MODULOS_LABEL[k]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {erroConvite && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {erroConvite}
            </p>
          )}

          <Button onClick={convidar} disabled={enviando} className="h-9 rounded-lg px-5 text-sm">
            {enviando ? "Enviando…" : "Enviar convite"}
          </Button>
        </div>
      )}
    </section>
  );
}

function PlaceholderSection({ id, title, desc }: { id: string; title: string; desc: string }) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-dashed border-border/60 bg-surface-1/30 p-6"
    >
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-3 inline-block rounded-md border border-border/60 bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        Em breve
      </span>
    </section>
  );
}
