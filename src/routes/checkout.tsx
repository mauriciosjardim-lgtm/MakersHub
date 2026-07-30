import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft2,
  TickCircle,
  ShieldTick,
  Flash,
  Lock1,
  InfoCircle,
  Eye,
  EyeSlash,
} from "iconsax-react";
import { LogoMakersHub } from "@/components/logo-makershub";
import { AuthBackground } from "@/components/auth-background";
import { PixBox } from "@/components/pix-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  iniciarPix,
  checarPedido,
  concluirAtivacao,
  pagarCartao,
  reenviarAtivacao,
} from "@/lib/api/asaas.functions";
import {
  trackCheckoutStep,
  trackMetaInitiateCheckout,
  trackMetaPurchaseBrowser,
} from "@/lib/meta-pixel";
import { useAuth } from "@/lib/auth";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

export const Route = createFileRoute("/checkout")({ component: Checkout });

const INCLUI = [
  "CRM, orçamentos e contratos",
  "Projetos, agenda e financeiro",
  "Integração com ChatGPT",
  "1 ano de acesso completo",
];

type Charge = {
  id: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
  invoiceUrl?: string;
  qrErro?: string | null;
  activationSecret: string;
};

// ── máscaras ──────────────────────────────────────────────────────────────────

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function maskCard(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function maskExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

// ── bandeira do cartão ────────────────────────────────────────────────────────

type Bandeira = "visa" | "mastercard" | "amex" | "elo" | null;

function detectarBandeira(num: string): Bandeira {
  const d = num.replace(/\D/g, "");
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|636368|627780|6362970)/.test(d)) return "elo";
  if (/^4/.test(d)) return "visa";
  if (/^5[1-5]|^2[2-7]/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  return null;
}

function IconBandeira({ bandeira }: { bandeira: Bandeira }) {
  if (bandeira === "visa")
    return (
      <span
        className="font-black italic text-white text-[13px] tracking-tighter"
        style={{ fontFamily: "serif" }}
      >
        VISA
      </span>
    );
  if (bandeira === "mastercard")
    return (
      <span className="flex items-center">
        <span className="h-5 w-5 rounded-full bg-red-500 opacity-90" />
        <span className="-ml-2.5 h-5 w-5 rounded-full bg-orange-400 opacity-90" />
      </span>
    );
  if (bandeira === "amex")
    return (
      <span className="rounded bg-blue-700 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white">
        AMEX
      </span>
    );
  if (bandeira === "elo")
    return (
      <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[9px] font-black text-black">
        ELO
      </span>
    );
  return (
    <span className="flex items-center opacity-30">
      <span className="h-5 w-5 rounded-full bg-white/50" />
      <span className="-ml-2.5 h-5 w-5 rounded-full bg-white/30" />
    </span>
  );
}

// ── preview do cartão ─────────────────────────────────────────────────────────

function CardPreview({
  number,
  name,
  expiry,
  bandeira,
}: {
  number: string;
  name: string;
  expiry: string;
  bandeira: Bandeira;
}) {
  const digits = number.replace(/\s/g, "");
  const groups = digits.padEnd(16, " ").match(/.{1,4}/g) ?? ["    ", "    ", "    ", "    "];
  const displayName = name.trim() || "SEU NOME";
  const displayExp = expiry || "MM/AA";

  return (
    <div
      className="relative h-[160px] w-full overflow-hidden rounded-2xl p-5 select-none"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #111827 40%, #0a1628 100%)" }}
    >
      {/* reflexo holográfico */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(115deg, transparent 40%, rgba(144,248,38,0.06) 50%, transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#90F826]/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-blue-500/[0.06] blur-2xl" />
      {/* borda sutil */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.08]" />

      {/* topo: logo + bandeira */}
      <div className="flex items-start justify-between">
        {/* logo MakersHub no cartão */}
        <div className="flex items-center gap-1.5">
          <LogoMakersHub className="h-5 w-5 opacity-80" />
          <span className="text-[11px] font-semibold tracking-tight text-white/60">
            Makers<span className="text-[#90F826]">Hub</span>
          </span>
        </div>
        <IconBandeira bandeira={bandeira} />
      </div>

      {/* chip */}
      <div className="mt-3 h-5 w-7 rounded border border-yellow-400/30 bg-gradient-to-br from-yellow-300/50 to-yellow-600/40" />

      {/* número */}
      <div className="mt-2 flex gap-3 font-mono text-sm tracking-[0.15em] text-white/85">
        {groups.map((g, i) => (
          <span key={i} className={digits.length > i * 4 ? "text-white" : "text-white/30"}>
            {g.trim() || "••••"}
          </span>
        ))}
      </div>

      {/* nome e validade */}
      <div className="mt-2.5 flex items-end justify-between">
        <div>
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Titular</p>
          <p className="mt-0.5 truncate max-w-[160px] text-[11px] font-medium uppercase tracking-wider text-white/75">
            {displayName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Validade</p>
          <p className="mt-0.5 text-[11px] font-medium text-white/75">{displayExp}</p>
        </div>
      </div>
    </div>
  );
}

// ── componente principal ──────────────────────────────────────────────────────

function Checkout() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  // dados da compra
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const [aba, setAba] = useState<"pix" | "cartao">("pix");
  const [erro, setErro] = useState<string | null>(null);

  // pix
  const [charge, setCharge] = useState<Charge | null>(null);
  const [criando, setCriando] = useState(false);
  const [aguardandoAtivacao, setAguardandoAtivacao] = useState(false);
  const [contaCriada, setContaCriada] = useState(false);
  const [pedidoAtual, setPedidoAtual] = useState<{
    paymentId: string;
    activationSecret: string;
  } | null>(null);
  const [ativacao, setAtivacao] = useState<{ paymentId: string; activationSecret: string } | null>(
    null,
  );
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  // cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [pagando, setPagando] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    trackMetaInitiateCheckout();
  }, []);

  function validarConta(): string | null {
    if (!nome.trim()) return "Informe seu nome completo.";
    if (!empresa.trim()) return "Informe o nome da sua produtora.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Informe um e-mail válido.";
    if (cpf.replace(/\D/g, "").length !== 11) return "Informe um CPF válido (11 dígitos).";
    if (telefone.replace(/\D/g, "").length < 10) return "Informe um telefone com DDD.";
    if (!aceitouTermos) return "Aceite os Termos de Uso e a Política de Privacidade.";
    return null;
  }

  async function abrirAtivacao(paymentId: string, activationSecret: string) {
    trackCheckoutStep("activation_opened");
    setPagando(false);
    setAguardandoAtivacao(false);
    setAtivacao({ paymentId, activationSecret });
  }

  async function finalizarAtivacao(e: React.FormEvent) {
    e.preventDefault();
    if (!ativacao) return;
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    setErro(null);
    setAtivando(true);
    try {
      await concluirAtivacao({ data: { ...ativacao, password: senha } });
      trackCheckoutStep("activation_completed");
      const { error } = await signIn(email.trim(), senha);
      if (error) navigate({ to: "/login" });
      else window.location.assign("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Use o link de ativação enviado por e-mail.");
      setContaCriada(true);
      setAtivacao(null);
    } finally {
      setAtivando(false);
    }
  }

  async function reenviarEmailAtivacao() {
    if (!pedidoAtual) return;
    setReenviando(true);
    setErro(null);
    try {
      await reenviarAtivacao({ data: pedidoAtual });
      setErro("Novo link enviado. Confira também a caixa de spam.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível reenviar agora.");
    } finally {
      setReenviando(false);
    }
  }

  async function gerarPix(e: React.FormEvent) {
    e.preventDefault();
    const v = validarConta();
    if (v) {
      setErro(v);
      return;
    }
    trackCheckoutStep("form_validated");
    setErro(null);
    setCriando(true);
    try {
      trackCheckoutStep("payment_started", "pix");
      const c = await iniciarPix({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          cpfCnpj: cpf,
          empresa: empresa.trim(),
          telefone,
        },
      });
      setCharge(c);
      setPedidoAtual({ paymentId: c.id, activationSecret: c.activationSecret });
    } catch (err) {
      trackCheckoutStep("payment_failed", "pix");
      setErro(err instanceof Error ? err.message : "Erro ao gerar o Pix.");
    } finally {
      setCriando(false);
    }
  }

  async function aguardarProvisionamento(
    paymentId: string,
    activationSecret: string,
    method: "pix" | "cartao",
  ) {
    setAguardandoAtivacao(true);
    setErro(null);

    const inicio = Date.now();
    const TIMEOUT = 60_000; // 60s aguardando webhook

    const checarAtivacao = async () => {
      let result: Awaited<ReturnType<typeof checarPedido>>;
      try {
        result = await checarPedido({ data: { paymentId, activationSecret } });
      } catch (err) {
        if (Date.now() - inicio <= TIMEOUT) {
          setTimeout(checarAtivacao, 2000);
          return;
        }
        setErro(err instanceof Error ? err.message : "Não foi possível confirmar a ativação.");
        setAguardandoAtivacao(false);
        setContaCriada(true);
        return;
      }
      const { status, error: errMsg } = result;

      if (status === "completed") {
        trackMetaPurchaseBrowser(paymentId);
        trackCheckoutStep("payment_confirmed", method);
        setAguardandoAtivacao(false);
        await abrirAtivacao(paymentId, activationSecret);
        return;
      }

      if (status === "failed") {
        setErro(errMsg ?? "Erro ao ativar conta. Contate o suporte.");
        setAguardandoAtivacao(false);
        return;
      }

      if (Date.now() - inicio > TIMEOUT) {
        // Timeout: conta ainda pode estar sendo ativada pelo webhook —
        // o e-mail com o link de senha chega assim que concluir.
        setAguardandoAtivacao(false);
        setContaCriada(true);
        return;
      }

      setTimeout(checarAtivacao, 2000);
    };

    checarAtivacao();
  }

  // Chamado pelo PixBox quando detecta pagamento confirmado no Asaas.
  async function aoPagarPix() {
    if (!charge) return;
    await aguardarProvisionamento(charge.id, charge.activationSecret, "pix");
  }

  async function pagarComCartao(e: React.FormEvent) {
    e.preventDefault();
    const v = validarConta();
    if (v) {
      setErro(v);
      return;
    }
    trackCheckoutStep("form_validated");
    const [mm, aa] = validade.split("/").map((s) => s.trim());
    if (!mm || !aa || mm.length !== 2 || aa.length !== 2) {
      setErro("Validade inválida. Use MM/AA (ex: 06/30).");
      return;
    }
    if (cardNumber.replace(/\D/g, "").length < 13) {
      setErro("Número do cartão inválido.");
      return;
    }
    if (!cardName.trim()) {
      setErro("Informe o nome impresso no cartão.");
      return;
    }
    if (cvv.length < 3) {
      setErro("CVV inválido.");
      return;
    }
    if (cep.replace(/\D/g, "").length !== 8) {
      setErro("CEP inválido.");
      return;
    }
    if (!numero.trim()) {
      setErro("Informe o número do endereço.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErro("Confirme que você é humano.");
      return;
    }
    setErro(null);
    setPagando(true);
    try {
      trackCheckoutStep("payment_started", "cartao");
      const result = await pagarCartao({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          cpfCnpj: cpf,
          empresa: empresa.trim(),
          telefone,
          card: {
            holderName: cardName.trim(),
            number: cardNumber,
            expiryMonth: mm,
            expiryYear: aa,
            ccv: cvv,
          },
          holder: { postalCode: cep, addressNumber: numero.trim() },
        },
      });
      setPedidoAtual(result);
      await aguardarProvisionamento(result.paymentId, result.activationSecret, "cartao");
    } catch (err) {
      trackCheckoutStep("payment_failed", "cartao");
      setErro(err instanceof Error ? err.message : "Não foi possível processar o cartão.");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      setPagando(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <AuthBackground />

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        {/* cabeçalho */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMakersHub className="h-9 w-9" />
            <span className="font-display text-lg font-semibold">
              <span className="text-white">Makers</span>
              <span className="text-[#90F826]">Hub</span>
            </span>
          </div>
          <button
            onClick={() => (charge ? setCharge(null) : navigate({ to: "/home" }))}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft2 size={15} color="currentColor" variant="Linear" /> Voltar
          </button>
        </div>

        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          {/* resumo do pedido */}
          <div className="md:pt-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#90F826]">
              Seu pedido
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              MakersHub <span className="text-[#90F826]">Anual</span>
            </h1>
            <div className="mt-6 flex items-end gap-3">
              <span className="text-lg text-white/40 line-through">R$ 149</span>
              <span className="font-display text-5xl font-bold">R$ 97</span>
              <span className="mb-1.5 text-sm text-white/55">/ano</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#90F826]/25 bg-[#90F826]/[0.07] px-3 py-1 text-xs font-medium text-[#c8ff8a]">
              <Flash size={13} color="currentColor" variant="Bold" /> Condição de lançamento
            </div>
            <ul className="mt-8 space-y-3">
              {INCLUI.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                  <TickCircle size={18} color="#90F826" variant="Bold" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-1.5 text-xs text-white/35">
              <ShieldTick size={14} color="currentColor" variant="Linear" />
              Pagamento seguro · 7 dias de garantia
            </div>
          </div>

          {/* painel de pagamento */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] shadow-[0_8px_48px_-12px_rgba(0,0,0,0.7)]">
            {/* faixa verde no topo */}
            <div className="h-[3px] w-full bg-gradient-to-r from-[#90F826]/40 via-[#90F826] to-[#90F826]/40" />

            <div className="p-5 md:p-6">
              {ativacao ? (
                <form onSubmit={finalizarAtivacao} className="space-y-4 py-3">
                  <div className="text-center">
                    <TickCircle size={40} color="#90F826" variant="Bold" className="mx-auto" />
                    <h2 className="mt-3 font-display text-xl font-semibold">
                      Pagamento confirmado!
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                      Agora crie sua senha para entrar no MakersHub.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/55">Crie uma senha</Label>
                    <div className="relative">
                      <Input
                        type={mostrarSenha ? "text" : "password"}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        autoFocus
                        className="pr-10 focus:border-[#90F826]/40"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                      >
                        {mostrarSenha ? (
                          <EyeSlash size={16} color="currentColor" />
                        ) : (
                          <Eye size={16} color="currentColor" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-white/30">Use pelo menos 8 caracteres.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/55">Confirme a senha</Label>
                    <Input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className="focus:border-[#90F826]/40"
                    />
                  </div>
                  {erro && (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400">
                      {erro}
                    </p>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={ativando}>
                    {ativando ? "Ativando…" : "Criar senha e entrar"}
                  </Button>
                  <p className="text-center text-[10px] text-white/30">
                    Também enviamos um link de ativação para seu e-mail.
                  </p>
                </form>
              ) : contaCriada ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <TickCircle size={40} color="#90F826" variant="Bold" />
                  <div>
                    <p className="font-medium text-white">Pagamento confirmado.</p>
                    <p className="mt-1 text-sm text-white/50">
                      Enviamos um link seguro para você criar sua senha. Confira seu e-mail.
                    </p>
                    {erro && <p className="mt-3 text-xs text-amber-300">{erro}</p>}
                  </div>
                  <button
                    onClick={() => navigate({ to: "/login" })}
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-[#90F826] px-6 py-3 text-sm font-bold text-[#0d0f0a] transition hover:bg-[#a3ff45] active:scale-[0.98]"
                  >
                    Ir para o login
                  </button>
                  {pedidoAtual && (
                    <button
                      type="button"
                      onClick={() => void reenviarEmailAtivacao()}
                      disabled={reenviando}
                      className="text-xs text-white/55 underline transition hover:text-white disabled:opacity-50"
                    >
                      {reenviando ? "Reenviando…" : "Reenviar e-mail de ativação"}
                    </button>
                  )}
                </div>
              ) : aguardandoAtivacao ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#90F826] border-t-transparent" />
                  <div>
                    <p className="font-medium text-white">Pagamento confirmado!</p>
                    <p className="mt-1 text-sm text-white/50">Ativando sua conta, aguarde…</p>
                  </div>
                  {erro && (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                      {erro}
                    </p>
                  )}
                </div>
              ) : charge ? (
                <>
                  <PixBox charge={charge} onPaid={aoPagarPix} />
                  {erro && (
                    <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400">
                      {erro}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Seus dados</h2>
                    <p className="mt-0.5 text-xs text-white/40">
                      Dados para cobrança; o acesso é configurado depois do pagamento
                    </p>
                  </div>

                  {/* ── dados pessoais ── */}
                  <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                      Dados da compra
                    </p>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/55">Nome completo</Label>
                      <Input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="João Silva"
                        autoComplete="name"
                        className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-white/55">Produtora</Label>
                        <Input
                          value={empresa}
                          onChange={(e) => setEmpresa(e.target.value)}
                          placeholder="Aurora Filmes"
                          autoComplete="organization"
                          className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-white/55">CPF</Label>
                        <Input
                          value={cpf}
                          onChange={(e) => setCpf(maskCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          maxLength={14}
                          className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/55">E-mail</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        inputMode="email"
                        className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/55">Telefone com DDD</Label>
                      <Input
                        value={telefone}
                        onChange={(e) => setTelefone(maskPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        inputMode="tel"
                        maxLength={15}
                        autoComplete="tel"
                        className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                      />
                      <p className="text-[10px] text-white/30">
                        Usado somente para cobrança e suporte desta compra.
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-white/45">
                      <input
                        type="checkbox"
                        checked={aceitouTermos}
                        onChange={(e) => setAceitouTermos(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#90F826]"
                      />
                      <span>
                        Li e aceito os{" "}
                        <a href="/termos" target="_blank" className="text-white/70 underline">
                          Termos de Uso
                        </a>{" "}
                        e a{" "}
                        <a href="/privacidade" target="_blank" className="text-white/70 underline">
                          Política de Privacidade
                        </a>
                        .
                      </span>
                    </label>
                  </div>
                  {/* fim painel sua conta */}

                  {/* ── separador forma de pagamento ── */}
                  <div className="relative flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-white/[0.07]" />
                    <span className="text-[11px] uppercase tracking-widest text-white/25">
                      pagamento
                    </span>
                    <div className="h-px flex-1 bg-white/[0.07]" />
                  </div>

                  {/* seletor */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
                    {(["pix", "cartao"] as const).map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => {
                          setAba(op);
                          setErro(null);
                        }}
                        className={cn(
                          "rounded-lg py-2 text-sm font-medium transition",
                          aba === op
                            ? "bg-[#90F826] text-[#0a0a0a]"
                            : "text-white/60 hover:text-white",
                        )}
                      >
                        {op === "pix" ? "Pix" : "Cartão de crédito"}
                      </button>
                    ))}
                  </div>

                  {/* ── aba pix ── */}
                  {aba === "pix" ? (
                    <form onSubmit={gerarPix} className="space-y-4">
                      {erro && (
                        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400">
                          {erro}
                        </p>
                      )}
                      <Button type="submit" size="lg" className="w-full" disabled={criando}>
                        {criando ? "Gerando Pix…" : "Pagar com Pix · R$ 97"}
                      </Button>
                      <p className="text-center text-[11px] text-white/35">
                        Pagamento instantâneo via Pix
                      </p>
                    </form>
                  ) : (
                    /* ── aba cartão ── */
                    <form onSubmit={pagarComCartao} className="space-y-4">
                      {/* preview do cartão */}
                      <CardPreview
                        number={cardNumber}
                        name={cardName}
                        expiry={validade}
                        bandeira={detectarBandeira(cardNumber)}
                      />

                      {/* dados do cartão em painel destacado */}
                      <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                          Dados do cartão
                        </p>

                        {/* número */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/55">Número</Label>
                          <div className="relative">
                            <Lock1
                              size={13}
                              color="currentColor"
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                              variant="Linear"
                            />
                            <Input
                              value={cardNumber}
                              onChange={(e) => setCardNumber(maskCard(e.target.value))}
                              placeholder="0000 0000 0000 0000"
                              inputMode="numeric"
                              maxLength={19}
                              autoComplete="cc-number"
                              className="pl-8 pr-16 font-mono tracking-wider focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <IconBandeira bandeira={detectarBandeira(cardNumber)} />
                            </div>
                          </div>
                        </div>

                        {/* nome */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/55">Nome no cartão</Label>
                          <Input
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value.toUpperCase())}
                            placeholder="COMO ESCRITO NO CARTÃO"
                            autoComplete="cc-name"
                            className="font-mono tracking-wider focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                          />
                        </div>

                        {/* validade + cvv */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/55">Validade</Label>
                            <Input
                              value={validade}
                              onChange={(e) => setValidade(maskExpiry(e.target.value))}
                              placeholder="MM/AA"
                              inputMode="numeric"
                              maxLength={5}
                              autoComplete="cc-exp"
                              className="font-mono tracking-wider focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5 text-xs text-white/55">
                              CVV
                              <span className="group relative cursor-help">
                                <InfoCircle
                                  size={11}
                                  color="currentColor"
                                  variant="Linear"
                                  className="text-white/25"
                                />
                                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1a1a1a] border border-white/10 px-2.5 py-1.5 text-[10px] text-white/60 opacity-0 shadow-xl transition group-hover:opacity-100 z-10">
                                  3 dígitos no verso do cartão
                                </span>
                              </span>
                            </Label>
                            <Input
                              value={cvv}
                              onChange={(e) =>
                                setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                              }
                              placeholder="•••"
                              inputMode="numeric"
                              maxLength={4}
                              autoComplete="cc-csc"
                              className="font-mono tracking-widest focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                            />
                          </div>
                        </div>
                      </div>

                      {/* endereço de cobrança */}
                      <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                          Endereço de cobrança
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/55">CEP</Label>
                            <Input
                              value={cep}
                              onChange={(e) => setCep(maskCep(e.target.value))}
                              placeholder="00000-000"
                              inputMode="numeric"
                              maxLength={9}
                              autoComplete="postal-code"
                              className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/55">Nº</Label>
                            <Input
                              value={numero}
                              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
                              placeholder="123"
                              inputMode="numeric"
                              className="focus:border-[#90F826]/40 focus:ring-1 focus:ring-[#90F826]/15"
                            />
                          </div>
                        </div>
                      </div>

                      {TURNSTILE_SITE_KEY && (
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={setTurnstileToken}
                          onExpire={() => setTurnstileToken(null)}
                          options={{ theme: "dark", language: "pt-BR", size: "flexible" }}
                          className="mt-1"
                        />
                      )}

                      {erro && (
                        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400">
                          {erro}
                        </p>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full gap-2"
                        disabled={pagando || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                      >
                        <Lock1 size={15} color="currentColor" variant="Bold" />
                        {pagando ? "Processando…" : "Pagar com segurança · R$ 97"}
                      </Button>

                      {/* selos */}
                      <div className="flex items-center justify-center gap-5 pt-1 text-[10px] text-white/30">
                        <span className="flex items-center gap-1.5">
                          <ShieldTick size={11} color="#90F826" variant="Bold" />
                          SSL 256-bit
                        </span>
                        <span className="h-3 w-px bg-white/10" />
                        <span className="flex items-center gap-1.5">
                          <Lock1 size={11} color="currentColor" variant="Bold" />
                          Criptografado
                        </span>
                        <span className="h-3 w-px bg-white/10" />
                        <span className="flex items-center gap-1.5">
                          <ShieldTick size={11} color="currentColor" variant="Linear" />7 dias de
                          garantia
                        </span>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
