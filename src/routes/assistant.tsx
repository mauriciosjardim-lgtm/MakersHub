import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Calendar, CheckCircle2, Clock3, FolderKanban, Send, Sparkles, WandSparkles } from "lucide-react";
import { useProjetos } from "@/lib/hooks/useProjetos";
import { useAgendaSupa } from "@/lib/hooks/useAgenda";
import { useFinanceiroSupa } from "@/lib/hooks/useFinanceiro";
import { useComercial } from "@/lib/hooks/useComercial";
import { useAuth } from "@/lib/auth";
import { temAcesso, type Permissoes } from "@/lib/permissoes";
import { isProjetoAtivo } from "@/lib/mock/projetos";
import { responderAssistant } from "@/lib/assistant/engine";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "MakersHub Assistant" }] }),
  component: AssistantPage,
});

const prompts = ["O que exige minha atenção?", "Como está a produção?", "Quais são os próximos passos?"];

function AssistantPage() {
  const { projetos, tarefas, loading } = useProjetos();
  const { eventos } = useAgendaSupa();
  const { lancamentos } = useFinanceiroSupa({ somenteEmpresa: true });
  const leads = useComercial(s => s.leads);
  const { usuario } = useAuth();
  const role = (usuario as any)?.role ?? "admin";
  const permissoes = ((usuario as any)?.permissoes as Partial<Permissoes> | null) ?? null;
  const podeFinanceiro = role === "admin" || temAcesso(permissoes, "financeiro");
  const podeComercial = role === "admin" || temAcesso(permissoes, "comercial");
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("Sua operação está sendo analisada em tempo real.");
  const agora = new Date();
  const ativos = projetos.filter(isProjetoAtivo);
  const abertas = tarefas.filter(t => !t.concluida);
  const atrasadas = abertas.filter(t => t.prazo && new Date(t.prazo) < agora);
  const proximas = abertas.filter(t => t.prazo && new Date(t.prazo) >= agora).sort((a, b) => +new Date(a.prazo!) - +new Date(b.prazo!));

  const mapa = useMemo(() => Array.from({ length: 45 }, (_, i) => {
    const x = i % 9; const y = Math.floor(i / 9);
    const distancia = Math.abs(x - 4) + Math.abs(y - 2);
    return { i, ativo: distancia < 4 || (i % 7 === 0), intensidade: Math.max(0.18, 1 - distancia * .16) };
  }), []);

  const perguntar = (texto = pergunta) => {
    if (!texto.trim()) return;
    setResposta(responderAssistant(texto, { projetos, tarefas, eventos, lancamentos, leads, podeFinanceiro, podeComercial }));
    setPergunta("");
  };

  return <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-8 md:py-9">
    <section style={{ boxShadow: "0 30px 100px -50px color-mix(in srgb, var(--primary) 35%, transparent)" }} className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0d0f0f] p-6 md:p-9">
      <div style={{ background: "radial-gradient(circle at 70% 20%, color-mix(in srgb, var(--primary) 9%, transparent), transparent 35%)" }} className="pointer-events-none absolute inset-0" />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,.9fr)_minmax(520px,1.1fr)] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.16em] text-primary"><Sparkles className="size-3.5" /> Assistant · Beta</span>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-.04em] text-white md:text-6xl">Sua produtora,<br /><span className="text-primary">pensando junto.</span></h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-white/55 md:text-base">O MakersHub Assistant transforma projetos, tarefas e prazos em uma leitura simples do que importa agora.</p>
          <div className="mt-8 flex flex-wrap gap-2">{prompts.map(p => <button key={p} onClick={() => perguntar(p)} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/70 transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary">{p}</button>)}</div>
        </div>

        <div className="relative mx-auto w-full max-w-[660px] rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl md:p-7">
          <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-medium text-white/45">OPERAÇÃO AGORA</p><p className="mt-1 text-lg font-semibold text-white">Pulso da produção</p></div><span className="grid size-10 place-items-center rounded-full bg-primary text-black"><ArrowRight className="size-5 -rotate-45" /></span></div>
          <div className="grid grid-cols-9 gap-2 md:gap-2.5">{mapa.map(({ i, ativo, intensidade }) => <span key={i} style={{ animationDelay: `${80 + i * 22}ms`, opacity: ativo ? intensidade : .16 }} className={`assistant-tile aspect-[1.55] rounded-[6px] border ${ativo ? "border-primary/35 bg-primary" : "border-white/[0.06] bg-white/[0.035]"}`} />)}</div>
          <div className="mt-7 grid grid-cols-3 gap-3">
            <MiniStat icon={FolderKanban} label="Ativos" value={loading ? "—" : String(ativos.length)} />
            <MiniStat icon={Clock3} label="Abertas" value={loading ? "—" : String(abertas.length)} />
            <MiniStat icon={CheckCircle2} label="Atenção" value={loading ? "—" : String(atrasadas.length)} alert={atrasadas.length > 0} />
          </div>
        </div>
      </div>
    </section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="rounded-3xl border border-border/70 bg-surface-1/50 p-5 md:p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><WandSparkles className="size-5" /></span><div><h2 className="font-display text-lg font-semibold">Pergunte ao Assistant</h2><p className="text-xs text-muted-foreground">Uma leitura contextual da operação, sem procurar tela por tela.</p></div></div>
        <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 text-sm leading-6 text-foreground/85">{resposta}</div>
        <div className="mt-4 flex gap-2"><input value={pergunta} onChange={e => setPergunta(e.target.value)} onKeyDown={e => e.key === "Enter" && perguntar()} placeholder="Pergunte sobre sua operação…" className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40" /><button onClick={() => perguntar()} className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:scale-105"><Send className="size-4" /></button></div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-surface-1/50 p-5 md:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Calendar className="size-4 text-primary" /> Próximo movimento</div>{proximas[0] ? <><p className="mt-8 font-display text-xl font-semibold">{proximas[0].titulo}</p><p className="mt-2 text-sm text-muted-foreground">{proximas[0].responsavel} · {new Date(proximas[0].prazo!).toLocaleDateString("pt-BR")}</p><Link to="/projetos" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary">Abrir produção <ArrowRight className="size-4" /></Link></> : <p className="mt-8 text-sm text-muted-foreground">Nenhuma tarefa futura agendada.</p>}</div>
    </section>
  </div>;
}

function MiniStat({ icon: Icon, label, value, alert }: { icon: typeof FolderKanban; label: string; value: string; alert?: boolean }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3.5"><Icon className={`size-4 ${alert ? "text-amber-400" : "text-primary"}`} /><p className="mt-3 text-[10px] uppercase tracking-wider text-white/35">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-white">{value}</p></div>;
}
