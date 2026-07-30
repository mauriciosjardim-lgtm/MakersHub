import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Cpu,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Mic,
  MonitorPlay,
  Play,
  Sparkles,
  Users,
  VolumeX,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Briefcase, ClipboardText, EmptyWallet, Flash, Kanban, TickCircle } from "iconsax-react";
import { useEffect, useRef, useState } from "react";
import { LogoMakersHub } from "@/components/logo-makershub";

const CHECKOUT_URL = "/checkout";

// MP4 servido direto pelo CDN do Bunny, sem o player deles: o controle de som,
// progresso e play/pause é todo nosso. O CDN exige referrer autorizado.
// MP4 e não o playlist.m3u8 de propósito. Com HLS o reinício no 00:00 não se
// sustentava: o hls.js administra a posição de carregamento e o GapController
// dele, ao ver que o buffer não cobre o início, devolvia o vídeo para o trecho
// que já tinha rodado. Com MP4 o currentTime é só nosso.
const VSL_URL =
  "https://vz-8f17a433-360.b-cdn.net/7944589d-9b6e-4aa0-a45c-41e058c66904/play_720p.mp4";

// A barra corre rápido no começo e vai desacelerando. É a curva que os players
// de VSL usam: o visitante sente que já andou bastante e segue assistindo.
// Rende ~55% no primeiro quarto do vídeo, contra 25% de uma barra linear.
function progressoVsl(atual: number, total: number) {
  if (!total || !Number.isFinite(total) || atual <= 0) return 0;
  const fator = 32;
  const razao = Math.min(atual / total, 1);
  return Math.min((Math.log(1 + fator * razao) / Math.log(fator + 1)) * 100, 100);
}

const pains = [
  "O lead chega no WhatsApp e some porque ninguém fez o follow-up.",
  "A proposta demora, fica com cara de planilha e o cliente esfria.",
  "O projeto está no Trello, o briefing no Drive e o prazo na conversa.",
  "Entra dinheiro, sai dinheiro e no fim você não sabe o lucro real.",
];

const outcomes = [
  {
    icon: Briefcase,
    eyebrow: "Comercial",
    title: "Nenhum orçamento morre por falta de acompanhamento.",
    text: "Organize contatos, empresas, oportunidades e follow-ups num pipeline simples de enxergar.",
  },
  {
    icon: ClipboardText,
    eyebrow: "Propostas",
    title: "Do briefing à proposta profissional em poucos minutos.",
    text: "Monte, apresente e acompanhe propostas com uma experiência que valoriza o seu trabalho.",
  },
  {
    icon: Kanban,
    eyebrow: "Produção",
    title: "Todo mundo sabe o que fazer e o que vem depois.",
    text: "Projetos por fases, tarefas, prazos, arquivos e entregas sem depender de memória ou cobrança.",
  },
  {
    icon: EmptyWallet,
    eyebrow: "Financeiro",
    title: "Faturamento deixa de ser confundido com lucro.",
    text: "Acompanhe receitas, despesas, contas e resultado por projeto com visão clara da operação.",
  },
];

const included = [
  "CRM e pipeline comercial",
  "Orçamentos e propostas profissionais",
  "Projetos, etapas, tarefas e prazos",
  "Agenda integrada da operação",
  "Financeiro e visão por projeto",
  "Área exclusiva para o cliente",
  "Contratos e organização de arquivos",
  "Dashboard com visão do negócio",
  "Acesso às atualizações do produto",
];

const faqs = [
  {
    question: "O pagamento é realmente único?",
    answer:
      "Sim. A condição atual é de R$97 em pagamento único, sem mensalidade para manter o acesso ao MakersHub.",
  },
  {
    question: "Preciso instalar alguma coisa?",
    answer:
      "Não. O MakersHub funciona online e pode ser acessado pelo navegador no computador, tablet ou celular.",
  },
  {
    question: "Serve para produtor pequeno ou freelancer?",
    answer:
      "Sim. Ele funciona tanto para quem toca a operação sozinho quanto para produtoras com equipe. Você começa com o essencial e organiza mais áreas conforme cresce.",
  },
  {
    question: "Consigo mostrar o andamento para o meu cliente?",
    answer:
      "Sim. A área do cliente concentra informações, arquivos e andamento do projeto sem expor a operação interna da sua produtora.",
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMakersHub className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span
        className={`font-display font-semibold leading-none tracking-[-0.03em] ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        <span className="text-white">Makers</span>
        <span className="text-[#90f826]">Hub</span>
      </span>
    </span>
  );
}

function CheckoutButton({
  children = "Quero organizar minha produtora",
  className = "",
  inverse = false,
}: {
  children?: React.ReactNode;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <a
      href={CHECKOUT_URL}
      className={`group inline-flex min-h-13 items-center justify-center gap-2 rounded-xl px-6 text-center text-[15px] font-bold transition active:scale-[0.985] ${
        inverse
          ? "bg-[#11130e] text-[#90f826] hover:bg-black"
          : "bg-[#90f826] text-[#10130d] shadow-[0_18px_60px_-20px_rgba(144,248,38,0.9)] hover:bg-[#adff5c]"
      } ${className}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0d0a]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#inicio" aria-label="Ir para o início">
          <Brand compact />
        </a>

        <nav className="hidden items-center gap-7 text-sm text-white/58 md:flex">
          <a className="transition hover:text-white" href="#como-funciona">
            Como funciona
          </a>
          <a className="transition hover:text-white" href="#recursos">
            O que resolve
          </a>
          <a className="transition hover:text-white" href="#ia-nativa">
            IA nativa
          </a>
          <a className="transition hover:text-white" href="#oferta">
            Oferta
          </a>
          <a className="transition hover:text-white" href="#duvidas">
            Dúvidas
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className="px-3 py-2 text-sm font-medium text-white/60 transition hover:text-white"
          >
            Já sou cliente
          </a>
          <CheckoutButton className="min-h-10 px-4 text-sm">Garantir acesso</CheckoutButton>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-lg border border-white/10 text-white md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] bg-[#0b0d0a] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {[
              ["Como funciona", "#como-funciona"],
              ["O que resolve", "#recursos"],
              ["IA nativa", "#ia-nativa"],
              ["Oferta", "#oferta"],
              ["Dúvidas", "#duvidas"],
              ["Já sou cliente", "/login"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          <CheckoutButton className="mt-3 w-full">Garantir acesso</CheckoutButton>
        </div>
      )}
    </header>
  );
}

function VslPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [somLigado, setSomLigado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Primeiro clique do visitante: som e apresentação desde o 00:00.
  // Só clique, de propósito. Rolagem não vale como permissão de áudio: ao tirar
  // o mudo sem um clique o Chrome pausa a mídia e recusa o play(), e o vídeo
  // ficava parado no início. É por isso que o player de referência também espera
  // o clique.
  const ligarSom = () => {
    const video = videoRef.current;
    if (!video) return;
    if (barraRef.current) barraRef.current.style.width = "0%";
    video.muted = false;
    video.currentTime = 0;
    void video.play();
    setSomLigado(true);
  };

  const aoClicar = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!somLigado) {
      ligarSom();
      return;
    }
    if (video.paused) void video.play();
    else video.pause();
  };

  // O spinner nasce ligado e sai no "canplay". Só que o vídeo pode ficar pronto
  // antes do React pendurar o handler (cache do navegador, CDN rápido), e aí o
  // evento nunca chega e o spinner preto cobre o vídeo para sempre: dá exatamente
  // a impressão de que o vídeo não carregou. Então na montagem eu olho o
  // readyState em vez de esperar o evento, e garanto o autoplay mudo.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState >= 3) setCarregando(false);
    if (video.paused) void video.play().catch(() => {});
  }, []);

  // A barra é escrita direto no DOM, quadro a quadro, e só enquanto o vídeo
  // roda de verdade. Isso resolve duas coisas: ela nasce no 00:00 no clique, sem
  // herdar o que correu durante o autoplay mudo, e ao pausar ela para no frame
  // exato. Antes eu atualizava no "timeupdate" (a cada ~250ms) com transição de
  // meio segundo para suavizar, e era essa transição que continuava correndo
  // depois do pause e empurrava a barra alguns pixels à frente.
  useEffect(() => {
    if (!somLigado || pausado) return;

    let quadro = 0;
    const desenhar = () => {
      const video = videoRef.current;
      const barra = barraRef.current;
      if (video && barra) {
        barra.style.width = `${progressoVsl(video.currentTime, video.duration)}%`;
      }
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);

    return () => cancelAnimationFrame(quadro);
  }, [somLigado, pausado]);

  return (
    <div
      onClick={aoClicar}
      className="group relative aspect-video cursor-pointer select-none overflow-hidden rounded-[20px] bg-black"
    >
      <video
        ref={videoRef}
        src={VSL_URL}
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/ads/makershub-dashboard-real-auth.png"
        className="absolute inset-0 h-full w-full object-cover"
        onWaiting={() => setCarregando(true)}
        onCanPlay={() => setCarregando(false)}
        onLoadedData={() => setCarregando(false)}
        // Se o CDN falhar, sai o spinner e fica o poster. Preto infinito, não.
        onError={() => setCarregando(false)}
        onPlaying={() => {
          setCarregando(false);
          setPausado(false);
        }}
        onPause={() => setPausado(true)}
      />

      {carregando && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black">
          <span className="size-12 animate-spin rounded-full border-4 border-white/25 border-b-[#90f826]" />
        </div>
      )}

      {/* Cartão de som: enquanto o visitante não interage, o vídeo roda mudo e
          este aviso ocupa o centro. Qualquer clique na página o dispensa. */}
      {!somLigado && !carregando && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/45 px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-[#90f826]/30 bg-[#0b0f08]/95 px-6 py-7 text-center shadow-[0_0_80px_rgba(0,0,0,0.9)]">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              A apresentação já começou
            </span>
            <span className="grid size-14 place-items-center rounded-full bg-[#90f826] text-[#10140c]">
              <VolumeX className="size-7" />
            </span>
            <span className="text-lg font-bold leading-tight text-white">
              Clique para ouvir
              <span className="mt-1 block text-sm font-medium text-white/60">
                e assistir desde o início
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Overlay de pausa, só depois que o som entrou. */}
      {somLigado && pausado && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55">
          <span className="grid size-20 place-items-center rounded-full bg-[#90f826] text-[#10140c] shadow-[0_0_65px_rgba(144,248,38,0.4)] transition group-hover:scale-105">
            <Play className="ml-1 size-8 fill-current" />
          </span>
        </div>
      )}

      {/* A barra aparece junto com o som, como no player original. */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 h-1.5 bg-white/15 transition-opacity duration-700 ${
          somLigado ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Sem transição de largura: quem move esta barra é o requestAnimationFrame
            acima, quadro a quadro. */}
        <div ref={barraRef} className="h-full w-0 bg-[#90f826]" />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pt-18 lg:px-8 lg:pb-28 lg:pt-24"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.075]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.45) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 72% 60% at 50% 20%, black, transparent)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[720px] -translate-x-1/2 rounded-full bg-[#90f826]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#90f826]/25 bg-[#90f826]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#d7ff8f]">
            <Zap className="size-3.5 fill-current" />
            Criado para quem vive de produção audiovisual
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2.45rem] font-semibold leading-[0.99] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.7rem]">
            Sua produtora cresceu.
            <span className="block text-[#90f826]">A operação precisa acompanhar.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/62 sm:text-lg">
            Centralize clientes, propostas, projetos, agenda e financeiro num sistema que entende o
            fluxo de uma produtora — do primeiro contato à entrega final.
          </p>
        </div>

        <div id="como-funciona" className="mx-auto mt-10 max-w-5xl scroll-mt-24">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-2 shadow-[0_40px_120px_-45px_rgba(0,0,0,1)] sm:p-3">
            <VslPlayer />
          </div>

          <div className="mt-7 flex flex-col items-center">
            <CheckoutButton className="w-full max-w-md sm:w-auto">
              Quero o MakersHub na minha produtora
            </CheckoutButton>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-white/55">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2">
                <TickCircle
                  size={18}
                  color="currentColor"
                  variant="Bulk"
                  className="text-[#90f826]"
                />
                Pagamento único
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2">
                <Flash size={18} color="currentColor" variant="Bulk" className="text-[#90f826]" />
                Acesso imediato
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PainSection() {
  return (
    <section className="border-y border-white/[0.055] bg-[#0e100d] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            O custo invisível do improviso
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">
            O caos não aparece só na planilha.
            <span className="block text-white/36">Ele aparece no lucro.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/52">
            Quando as informações ficam espalhadas, você perde tempo, previsibilidade e vendas —
            mesmo trabalhando cada vez mais.
          </p>
        </div>

        <div className="grid gap-3">
          {pains.map((pain, index) => (
            <div
              key={pain}
              className="flex items-start gap-4 rounded-2xl border border-white/[0.075] bg-white/[0.025] p-4 sm:p-5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#90f826]/20 bg-[#90f826]/[0.07] text-xs font-bold text-[#90f826]">
                0{index + 1}
              </span>
              <p className="pt-1 text-sm leading-relaxed text-white/70 sm:text-base">{pain}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardProof() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            Uma visão antes de começar o dia
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Abra o MakersHub e saiba exatamente onde sua operação está.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/52">
            Vendas, projetos, compromissos e números importantes deixam de depender de cinco abas
            abertas e da memória de alguém.
          </p>
        </div>

        <div className="relative mt-12">
          <div className="pointer-events-none absolute -inset-8 bg-[#90f826]/10 blur-[100px]" />
          <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#11130f] p-2 shadow-[0_35px_100px_-45px_rgba(0,0,0,1)] sm:p-3">
            <img
              src="/ads/makershub-cockpit-real.png"
              alt="Dashboard real do MakersHub com visão da operação"
              className="w-full rounded-[18px]"
              loading="lazy"
            />
          </div>
          <div className="relative mx-auto -mt-4 flex w-[92%] flex-wrap justify-center gap-2 rounded-2xl border border-white/10 bg-[#12140f]/95 px-4 py-4 shadow-2xl backdrop-blur sm:w-fit sm:gap-6 sm:px-6">
            {[
              [LayoutDashboard, "Visão central"],
              [CalendarDays, "Agenda clara"],
              [WalletCards, "Números reais"],
              [Users, "Equipe alinhada"],
            ].map(([Icon, label]) => {
              const ItemIcon = Icon as typeof LayoutDashboard;
              return (
                <span
                  key={label as string}
                  className="inline-flex items-center gap-2 text-xs font-medium text-white/60 sm:text-sm"
                >
                  <ItemIcon className="size-4 text-[#90f826]" />
                  {label as string}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Outcomes() {
  return (
    <section
      id="recursos"
      className="scroll-mt-20 bg-gradient-to-b from-[#090b08] via-[#10130e] to-[#0b0d09] px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
              Uma operação que flui
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-5xl">
              Menos ferramenta.
              <span className="block text-[#90f826]">Mais controle.</span>
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-white/58 lg:justify-self-end">
            O MakersHub conecta as áreas que mais geram retrabalho numa produtora. A informação
            nasce uma vez e acompanha o projeto até o financeiro.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {outcomes.map(({ icon: Icon, eyebrow, title, text }, index) => (
            <article
              key={title}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_70px_-35px_rgba(23,35,12,0.4)] sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="relative grid size-14 place-items-center rounded-2xl border border-[#90f826]/20 bg-[radial-gradient(circle_at_35%_25%,rgba(144,248,38,0.22),rgba(144,248,38,0.055)_62%)] text-[#90f826] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_36px_-20px_rgba(144,248,38,0.65)] transition duration-300 group-hover:scale-105 group-hover:border-[#90f826]/35">
                  <span className="absolute inset-1 rounded-xl border border-white/[0.045]" />
                  <Icon size={26} color="currentColor" variant="TwoTone" className="relative" />
                </span>
                <span className="font-display text-sm font-semibold text-white/25">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#90f826]">
                {eyebrow}
              </p>
              <h3 className="mt-3 max-w-lg font-display text-2xl font-semibold leading-tight tracking-[-0.035em]">
                {title}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
                {text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductMockup({
  src,
  alt,
  direction,
  wide = false,
}: {
  src: string;
  alt: string;
  direction: "left" | "right";
  wide?: boolean;
}) {
  const tilt =
    direction === "left"
      ? "lg:[transform:rotateX(3deg)_rotateY(5deg)_rotateZ(0.25deg)]"
      : "lg:[transform:rotateX(3deg)_rotateY(-5deg)_rotateZ(-0.25deg)]";

  return (
    <div className="group relative [perspective:1800px]">
      <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[#90f826]/14 blur-[85px]" />
      <div
        className={`relative rounded-[24px] border border-white/12 bg-[#151714] p-2 shadow-[0_42px_100px_-42px_rgba(0,0,0,1)] transition duration-700 ease-out lg:group-hover:[transform:rotateX(0deg)_rotateY(0deg)_rotateZ(0deg)] ${tilt}`}
      >
        <div className="flex h-8 items-center gap-1.5 rounded-t-[16px] border-b border-white/[0.06] bg-[#0c0e0c] px-3">
          <span className="size-1.5 rounded-full bg-white/16" />
          <span className="size-1.5 rounded-full bg-white/10" />
          <span className="size-1.5 rounded-full bg-[#90f826]/45" />
          <span className="ml-2 font-mono text-[7px] uppercase tracking-[0.18em] text-white/25">
            MakersHub · produto real
          </span>
        </div>
        <div
          className={`relative overflow-hidden rounded-b-[16px] bg-[#101210] ${
            wide ? "aspect-[1.98/1]" : "aspect-[16/10]"
          }`}
        >
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.012]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.055]" />
        </div>
      </div>
      <div className="mx-auto h-5 w-[82%] rounded-b-[50%] bg-black/70 blur-xl" />
    </div>
  );
}

function AiChatRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/35">{label}</span>
      <span className={`text-right ${accent ? "font-bold text-[#90f826]" : "text-white/78"}`}>
        {value}
      </span>
    </div>
  );
}

function AiPhone({
  assistant,
  color,
  secondary = false,
}: {
  assistant: "ChatGPT" | "Claude";
  color: string;
  secondary?: boolean;
}) {
  return (
    <div
      className={`relative w-full max-w-[292px] rounded-[2.45rem] border border-white/10 bg-[#080a09] p-2 shadow-[0_40px_100px_-35px_rgba(0,0,0,1)] ${
        secondary ? "hidden translate-y-12 lg:block" : ""
      }`}
    >
      <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[1.95rem] bg-[#111311]">
        <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-medium text-white/65">
          <span>{secondary ? "09:14" : "14:32"}</span>
          <span className="flex gap-1">
            <span className="size-1 rounded-full bg-white/55" />
            <span className="size-1 rounded-full bg-white/55" />
            <span className="size-1 rounded-full bg-white/55" />
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <span
            className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {assistant[0]}
          </span>
          <span>
            <span className="block text-xs font-semibold text-white">{assistant}</span>
            <span className="block text-[9px] text-white/38">conectado · MakersHub</span>
          </span>
        </div>

        <div className="space-y-2 px-3 py-4">
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#90f826] px-3 py-2 text-[11px] leading-relaxed text-[#10130d]">
              {secondary
                ? "o que tenho na agenda amanhã e quanto entrou essa semana?"
                : "lança uma despesa: cadeira de escritório, 1500 reais, paguei hoje"}
            </div>
          </div>

          <div className="flex justify-start">
            <div className="max-w-[91%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] leading-relaxed text-white/75">
              {secondary ? (
                <>
                  <p className="font-semibold text-white">Agenda · amanhã</p>
                  <p className="mt-1">09:00 — Captação Banco X</p>
                  <p>14:30 — Reunião Nova Marca</p>
                  <p>17:00 — Revisão Doc Praia</p>
                  <div className="my-2 h-px bg-white/[0.07]" />
                  <p className="font-semibold text-white">Financeiro · semana</p>
                  <p className="mt-1">
                    Entraram <strong className="text-[#90f826]">R$ 42.800</strong> em 3 projetos.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Feito! Registrei o lançamento no financeiro do{" "}
                    <strong className="text-white">MakersHub</strong>:
                  </p>
                  <div className="my-2 space-y-1 rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
                    <AiChatRow label="Tipo" value="Despesa" />
                    <AiChatRow label="Categoria" value="Gastos com escritório" />
                    <AiChatRow label="Descrição" value="Cadeira de escritório" />
                    <AiChatRow label="Valor" value="R$ 1.500,00" accent />
                    <AiChatRow label="Data" value="hoje" />
                    <AiChatRow label="Status" value="Pago" />
                  </div>
                  <p>Quer que eu marque como ativo imobilizado também?</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
            <Mic className="size-3.5 text-[#90f826]" />
            <span className="text-[10px] text-white/32">Mensagem</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiNativeSection() {
  const capabilities = [
    "Lance receitas e despesas falando ou digitando",
    "Crie orçamentos com um único comando",
    "Consulte agenda, tarefas e dados financeiros",
    "Marque follow-ups e reuniões direto pelo chat",
  ];

  return (
    <section
      id="ia-nativa"
      className="relative scroll-mt-20 overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] border border-[#90f826]/20 bg-[radial-gradient(circle_at_82%_12%,rgba(144,248,38,0.17),transparent_30%),linear-gradient(135deg,#111510,#0b0d0b_58%,#11190d)] px-5 py-8 shadow-[0_45px_120px_-65px_rgba(144,248,38,0.5)] sm:px-9 sm:py-12 lg:px-16 lg:py-18">
        <div className="pointer-events-none absolute -bottom-44 left-[18%] h-96 w-96 rounded-full bg-[#90f826]/15 blur-[115px]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:52px_52px]" />

        <div className="relative grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#90f826]/25 bg-[#90f826]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#baff75]">
              <Cpu className="size-3.5" />
              Exclusivo MakersHub
            </div>

            <h2 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.5rem]">
              Conecte seu <span className="text-[#90f826]">ChatGPT e Claude</span> ao MakersHub.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/58 sm:text-lg">
              Sua produtora passa a responder e executar tarefas dentro do chat que você já usa
              todos os dias — por texto ou voz, em linguagem natural.
            </p>

            <ul className="mt-8 space-y-3.5">
              {capabilities.map((capability) => (
                <li
                  key={capability}
                  className="flex items-start gap-3 text-sm leading-relaxed text-white/74 sm:text-[15px]"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-[#90f826]/25 bg-[#90f826]/10 text-[#90f826]">
                    <Check className="size-3" />
                  </span>
                  {capability}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-2">
              {[
                [Mic, "Comando por voz"],
                [MessageSquareText, "Texto natural"],
                [Zap, "Ações em tempo real"],
              ].map(([Icon, label]) => {
                const ChipIcon = Icon as typeof Mic;
                return (
                  <span
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-white/48"
                  >
                    <ChipIcon className="size-3 text-[#90f826]" />
                    {label as string}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="relative flex min-h-[510px] items-center justify-center gap-5 lg:justify-end">
            <div className="pointer-events-none absolute inset-[14%] rounded-full bg-[#90f826]/18 blur-[95px]" />
            <div className="relative z-10">
              <AiPhone assistant="ChatGPT" color="#10a37f" />
            </div>
            <div className="relative z-0">
              <AiPhone assistant="Claude" color="#d97757" secondary />
            </div>

            <div className="absolute left-0 top-8 hidden rounded-2xl border border-white/10 bg-[#11140f]/90 p-4 shadow-2xl backdrop-blur xl:block">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#90f826]">
                Uma conversa. Uma ação.
              </p>
              <p className="mt-1.5 max-w-42 text-xs leading-relaxed text-white/58">
                O comando vira dado real dentro da operação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductShowcase() {
  const products = [
    {
      eyebrow: "Gerenciador de projetos",
      title: "A semana inteira da produtora, visível de verdade.",
      text: "Clientes, tarefas, responsáveis, atrasos e próximas entregas deixam de viver em conversas separadas.",
      chips: ["Quadro semanal", "Responsáveis", "Prazos e aprovações"],
      src: "/ads/makershub-projetos-demo.png",
      alt: "Gerenciador de projetos real do MakersHub",
      wide: true,
    },
    {
      eyebrow: "Controle financeiro",
      title: "Faturamento, custo e margem na mesma leitura.",
      text: "Veja o que entrou, o que saiu e quanto realmente ficou — com gráficos e vencimentos conectados à operação.",
      chips: ["Receita x despesa", "Margem real", "Contas e vencimentos"],
      src: "/ads/makershub-financeiro-real.png",
      alt: "Painel financeiro real do MakersHub",
      wide: false,
    },
    {
      eyebrow: "Orçamentos inteligentes",
      title: "O preço nasce com custo e lucro calculados.",
      text: "Monte equipe, produção, pós e extras enquanto o MakersHub atualiza margem, preço sugerido e lucro em tempo real.",
      chips: ["Custo operacional", "Margem ajustável", "Preço sugerido"],
      src: "/ads/makershub-calculadora-real.png",
      alt: "Calculadora de orçamento real do MakersHub",
      wide: false,
    },
  ];

  return (
    <section
      id="produto-real"
      className="relative scroll-mt-20 overflow-hidden border-y border-white/[0.055] bg-[#0d0f0c] px-4 py-20 sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:58px_58px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            O MakersHub por dentro
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.5rem]">
            Menos promessa.
            <span className="block text-white/38">Mais produto na tela.</span>
          </h2>
        </div>

        <div className="mt-18 space-y-24 lg:mt-24 lg:space-y-32">
          {products.map((product, index) => {
            const direction = index % 2 === 0 ? "right" : "left";
            return (
              <article
                key={product.title}
                className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-18"
              >
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[#90f826]">0{index + 1}</span>
                    <span className="h-px w-8 bg-[#90f826]/45" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#90f826]">
                      {product.eyebrow}
                    </p>
                  </div>
                  <h3 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-4xl">
                    {product.title}
                  </h3>
                  <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/58 sm:text-base">
                    {product.text}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-white/55"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <ProductMockup
                    src={product.src}
                    alt={product.alt}
                    direction={direction}
                    wide={product.wide}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProposalPreview() {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#090b09] shadow-[0_35px_90px_-38px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0d0f0e] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#90f826]" />
          <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/38 sm:text-[9px]">
            MakersHub · proposta
          </span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[8px] font-semibold text-white/58 sm:text-[9px]">
          Baixar proposta
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="flex items-center justify-between rounded-lg border border-white/[0.065] bg-white/[0.025] px-3 py-2">
          <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/35 sm:text-[8px]">
            Proposta comercial · uso restrito
          </span>
          <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/25 sm:text-[8px]">
            PROP-2026-020
          </span>
        </div>

        <div className="mt-3 grid gap-3 rounded-[18px] border border-white/[0.075] bg-[radial-gradient(circle_at_86%_15%,rgba(144,248,38,0.14),transparent_32%),linear-gradient(145deg,#111411,#0b0d0c)] p-4 sm:mt-4 sm:grid-cols-[1fr_0.58fr] sm:gap-5 sm:p-6">
          <div className="flex min-h-50 flex-col sm:min-h-62">
            <div className="flex items-center gap-2">
              <span className="h-px w-7 bg-[#90f826]" />
              <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-[#90f826] sm:text-[8px]">
                proposta audiovisual
              </span>
            </div>

            <h3
              className="mt-7 whitespace-nowrap font-sans text-[clamp(1.35rem,3.1vw,2.75rem)] font-semibold lowercase leading-none tracking-[-0.055em] text-white"
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              filme institucional
            </h3>
            <p
              className="mt-1.5 font-sans text-[clamp(1.2rem,2.55vw,2.25rem)] font-semibold lowercase leading-none tracking-[-0.055em] text-[#90f826]"
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              essência.
            </p>
            <p className="mt-3 max-w-sm text-[10px] leading-relaxed text-white/38 sm:text-xs">
              Uma narrativa clara, humana e memorável para apresentar a essência da marca.
            </p>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-6">
              {[
                ["pré-produção", "estratégia"],
                ["produção", "captação"],
                ["pós-produção", "entrega"],
              ].map(([label, value]) => (
                <div key={label} className="border-t border-white/10 pt-2.5">
                  <p className="font-mono text-[6px] uppercase tracking-[0.14em] text-white/25 sm:text-[7px]">
                    {label}
                  </p>
                  <p className="mt-1 text-[8px] font-medium text-white/62 sm:text-[9px]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/28">
                resumo
              </span>
              <span className="rounded-full border border-[#90f826]/25 bg-[#90f826]/[0.08] px-2 py-1 font-mono text-[7px] text-[#90f826]">
                PROP-2026-020
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {[
                ["formato", "filme de marca"],
                ["prazo estimado", "12 dias úteis"],
                ["investimento", "R$ 12.000 — R$ 19.900"],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-white/[0.07] pb-3 last:border-b-0">
                  <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/25">
                    {label}
                  </p>
                  <p className="mt-1.5 text-[10px] font-semibold text-white/76 sm:text-[11px]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProposalSpotlight() {
  return (
    <section
      id="proposta"
      className="scroll-mt-20 overflow-hidden px-4 pt-20 pb-12 sm:px-6 lg:px-8 lg:pt-28 lg:pb-16"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#90f826]/20 bg-[#90f826]/[0.06] px-3 py-1.5 text-xs font-semibold text-[#90f826]">
            <Sparkles className="size-3.5" />
            Uma das ferramentas favoritas
          </div>
          <h2 className="mt-6 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-5xl">
            Sua proposta também <span className="text-[#90f826]">comunica o valor</span> da sua
            produtora.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/55">
            Pare de enviar preço solto ou PDF improvisado. Estruture escopo, etapas e investimento
            numa proposta que o cliente abre, entende e aprova.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "Apresentação profissional e organizada",
              "Escopo e investimento fáceis de entender",
              "Link pronto para enviar ao cliente",
              "Menos tempo montando documento do zero",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/72">
                <Check className="size-4 shrink-0 text-[#90f826]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#90f826]/10 blur-[100px]" />
          <div className="relative">
            <ProposalPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function ClientExperience() {
  return (
    <section
      id="area-do-cliente"
      className="relative scroll-mt-20 overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="pointer-events-none absolute left-1/2 top-[48%] h-[760px] w-[980px] -translate-x-1/2 rounded-full bg-[#90f826]/[0.075] blur-[160px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-end gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#90f826]/20 bg-[#90f826]/[0.055] px-3 py-1.5 text-xs font-semibold text-[#90f826]">
              <Users className="size-3.5" />
              Área do cliente
            </div>
            <h2 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.5rem]">
              Uma área exclusiva para o seu cliente.
              <span className="block text-[#90f826]">Mais valor percebido em cada entrega.</span>
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-white/58 lg:justify-self-end lg:pb-2">
            Seu cliente acompanha a produção, encontra arquivos e aprova materiais numa área
            exclusiva — sem entrar na operação interna da sua produtora.
          </p>
        </div>

        <div className="group relative mt-14 [perspective:1900px] lg:mt-20">
          <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[#90f826]/14 blur-[105px]" />
          <div className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[#151715] p-2 shadow-[0_55px_130px_-50px_rgba(0,0,0,1)] transition duration-700 lg:[transform:rotateX(2deg)_rotateY(-2.5deg)] lg:group-hover:[transform:rotateX(0deg)_rotateY(0deg)]">
            <div className="flex h-9 items-center justify-between rounded-t-[17px] border-b border-white/[0.06] bg-[#090b09] px-4">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-white/12" />
                <span className="size-1.5 rounded-full bg-white/8" />
                <span className="size-1.5 rounded-full bg-[#90f826]/50" />
              </div>
              <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/25 sm:text-[8px]">
                área do cliente · visão geral
              </span>
              <span className="size-3" />
            </div>
            <div className="overflow-hidden rounded-b-[17px] bg-[#0d0f0d]">
              <img
                src="/ads/makershub-area-cliente-visao.png"
                alt="Área do cliente real do MakersHub com visão geral do projeto"
                className="h-auto w-full"
                loading="lazy"
              />
            </div>
          </div>
          <div className="mx-auto h-7 w-[86%] rounded-b-[50%] bg-black/65 blur-2xl" />
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-[#90f826]">APROVAÇÕES</span>
              <span className="h-px w-8 bg-[#90f826]/45" />
            </div>
            <h3 className="mt-5 font-display text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-4xl">
              Feedback objetivo.
              <span className="block text-white/38">Decisão registrada.</span>
            </h3>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/58 sm:text-base">
              O cliente revisa cada material, solicita ajustes ou aprova. A equipe sabe o que mudou
              e o projeto segue sem mensagens perdidas.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Materiais para revisar", "Solicitação de ajustes", "Aprovação registrada"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-2 text-[10px] font-medium text-white/46"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="group relative [perspective:1800px]">
            <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[#90f826]/12 blur-[90px]" />
            <div className="relative overflow-hidden rounded-[23px] border border-white/12 bg-[#151715] p-2 shadow-[0_48px_115px_-46px_rgba(0,0,0,1)] transition duration-700 lg:[transform:rotateX(2deg)_rotateY(3deg)] lg:group-hover:[transform:rotateX(0deg)_rotateY(0deg)]">
              <div className="flex h-8 items-center gap-1.5 rounded-t-[15px] border-b border-white/[0.06] bg-[#090b09] px-3">
                <span className="size-1.5 rounded-full bg-white/12" />
                <span className="size-1.5 rounded-full bg-white/8" />
                <span className="size-1.5 rounded-full bg-[#90f826]/50" />
                <span className="ml-2 font-mono text-[7px] uppercase tracking-[0.18em] text-white/24">
                  central de aprovações
                </span>
              </div>
              <div className="relative aspect-[1.72/1] overflow-hidden rounded-b-[15px] bg-[#0d0f0d]">
                <img
                  src="/ads/makershub-area-cliente-aprovacoes.png"
                  alt="Central de aprovações real da Área do Cliente MakersHub"
                  className="h-full w-full object-cover object-top"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.045]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsPreview() {
  const highlights = [
    {
      icon: CalendarDays,
      label: "Cronograma operacional",
    },
    {
      icon: Users,
      label: "Equipe e responsáveis",
    },
    {
      icon: MonitorPlay,
      label: "Operação em tempo real",
    },
    {
      icon: WalletCards,
      label: "Custos conectados",
    },
  ];

  return (
    <section
      id="eventos-preview"
      className="relative overflow-hidden border-y border-white/[0.055] bg-[#0d0f0d] px-4 py-20 sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute left-[55%] top-[48%] h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#90f826]/[0.07] blur-[150px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.78fr] lg:gap-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#90f826]/22 bg-[#90f826]/[0.06] px-3 py-1.5 text-xs font-semibold text-[#90f826]">
              <Zap className="size-3.5" />
              Em desenvolvimento
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.21em] text-[#90f826]">
              Controle de eventos para produtoras
            </p>
            <h2 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.5rem]">
              Controle completo para produtoras que gravam eventos.
              <span className="block text-[#90f826]">Da escala à operação ao vivo.</span>
            </h2>
          </div>
          <div className="lg:pb-2">
            <p className="max-w-xl text-base leading-relaxed text-white/58">
              Planeje equipe, ambientes, equipamentos, cronograma e custos num único centro de
              comando — e acompanhe toda a captação em tempo real no dia do evento.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {highlights.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-2 text-[10px] font-medium text-white/48"
                >
                  <Icon className="size-3.5 text-[#90f826]" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-14 pb-0 lg:mt-20 lg:min-h-[850px] lg:pb-16 [perspective:2000px]">
          <div className="pointer-events-none absolute inset-x-[10%] top-[12%] h-[58%] rounded-full bg-[#90f826]/12 blur-[105px]" />

          <div className="relative z-10 overflow-hidden rounded-[24px] border border-white/12 bg-[#151715] p-2 shadow-[0_50px_120px_-45px_rgba(0,0,0,1)] transition duration-700 lg:w-[84%] lg:[transform:rotateX(2deg)_rotateY(-4deg)_rotateZ(-.25deg)] lg:hover:[transform:rotateX(0deg)_rotateY(0deg)_rotateZ(0deg)]">
            <div className="flex h-9 items-center justify-between rounded-t-[16px] border-b border-white/[0.06] bg-[#090b09] px-4">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-white/12" />
                <span className="size-1.5 rounded-full bg-white/8" />
                <span className="size-1.5 rounded-full bg-[#90f826]/50" />
              </div>
              <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/24 sm:text-[8px]">
                visão da operação
              </span>
              <span className="size-3" />
            </div>
            <div className="overflow-hidden rounded-b-[16px] bg-[#0d0f0d]">
              <img
                src="/ads/makershub-eventos-operacao.png"
                alt="Prévia real do MakersHub Eventos com operação ao vivo"
                className="h-auto w-full"
                loading="lazy"
              />
            </div>
          </div>

          <div className="relative z-20 mt-5 ml-auto overflow-hidden rounded-[22px] border border-white/12 bg-[#151715] p-2 shadow-[0_48px_110px_-42px_rgba(0,0,0,1)] transition duration-700 lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:w-[62%] lg:[transform:rotateX(1deg)_rotateY(4deg)_rotateZ(.35deg)] lg:hover:[transform:rotateX(0deg)_rotateY(0deg)_rotateZ(0deg)]">
            <div className="flex h-8 items-center gap-1.5 rounded-t-[14px] border-b border-white/[0.06] bg-[#090b09] px-3">
              <span className="size-1.5 rounded-full bg-white/12" />
              <span className="size-1.5 rounded-full bg-white/8" />
              <span className="size-1.5 rounded-full bg-[#90f826]/50" />
              <span className="ml-2 font-mono text-[7px] uppercase tracking-[0.18em] text-white/24">
                timeline operacional
              </span>
            </div>
            <div className="relative aspect-[1.55/1] overflow-hidden rounded-b-[14px] bg-[#0d0f0d]">
              <img
                src="/ads/makershub-eventos-timeline.png"
                alt="Timeline operacional e recursos do MakersHub Eventos"
                className="h-full w-full object-cover object-bottom"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.045]" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-center lg:mt-2">
          <span className="size-1.5 rounded-full bg-[#90f826] shadow-[0_0_12px_#90f826]" />
          <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-white/35">
            Nova frente do ecossistema MakersHub
          </p>
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    ["Comercial e follow-up", "Planilha + WhatsApp", "Pipeline organizado"],
    ["Propostas", "Documento improvisado", "Proposta profissional"],
    ["Projetos", "Trello + mensagens", "Fluxo audiovisual"],
    ["Agenda", "Calendários espalhados", "Operação centralizada"],
    ["Financeiro", "Planilha separada", "Visão por projeto"],
    ["Experiência do cliente", "Cobrança no WhatsApp", "Área exclusiva"],
  ];

  return (
    <section
      id="comparativo"
      className="scroll-mt-20 px-4 pt-14 pb-20 sm:px-6 lg:px-8 lg:pt-20 lg:pb-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            A conta que ninguém faz
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Quantas ferramentas você paga com o seu tempo?
          </h2>
        </div>

        <div className="mt-10 space-y-3 sm:hidden">
          {rows.map(([label, before, after]) => (
            <article
              key={label}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
            >
              <p className="border-b border-white/[0.07] px-4 py-3 text-xs font-semibold text-white/68">
                {label}
              </p>
              <div className="grid grid-cols-2">
                <div className="p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
                    Hoje
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/38">{before}</p>
                </div>
                <div className="border-l border-[#90f826]/18 bg-[#90f826]/[0.045] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#90f826]">
                    Com MakersHub
                  </p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-white/72">{after}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 hidden overflow-hidden rounded-[24px] border border-white/10 sm:block">
          <div className="grid grid-cols-[0.9fr_1fr_1fr] bg-white/[0.045] text-xs font-bold uppercase tracking-[0.12em] text-white/40 sm:text-sm">
            <div className="p-4 sm:p-5">Rotina</div>
            <div className="border-l border-white/[0.07] p-4 sm:p-5">Hoje</div>
            <div className="border-l border-[#90f826]/20 bg-[#90f826]/[0.075] p-4 text-[#90f826] sm:p-5">
              Com MakersHub
            </div>
          </div>
          {rows.map(([label, before, after]) => (
            <div
              key={label}
              className="grid grid-cols-[0.9fr_1fr_1fr] border-t border-white/[0.07] text-xs sm:text-sm"
            >
              <div className="p-4 font-medium text-white/65 sm:p-5">{label}</div>
              <div className="flex items-center gap-2 border-l border-white/[0.07] p-4 text-white/38 sm:p-5">
                <X className="hidden size-3.5 shrink-0 text-[#90f826] sm:block" />
                {before}
              </div>
              <div className="flex items-center gap-2 border-l border-[#90f826]/20 bg-[#90f826]/[0.035] p-4 font-medium text-white/72 sm:p-5">
                <Check className="hidden size-3.5 shrink-0 text-[#90f826] sm:block" />
                {after}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Offer() {
  return (
    <section
      id="oferta"
      className="relative scroll-mt-20 overflow-hidden border-y border-white/[0.06] bg-[#0e110d] px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="pointer-events-none absolute left-[62%] top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#90f826]/[0.09] blur-[130px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            Condição especial de lançamento
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1] tracking-[-0.05em] sm:text-5xl lg:text-[3.5rem]">
            Organize agora.
            <span className="mt-2 block text-white/42">Cresça sem reconstruir tudo depois.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/58">
            Por menos que o custo de uma ferramenta mensal, você coloca a operação inteira num
            sistema feito para a realidade audiovisual.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#11140f]/95 p-6 text-white shadow-[0_40px_100px_-42px_rgba(0,0,0,1)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-[#90f826]/25 bg-[#90f826]/10 px-3 py-1.5 text-xs font-bold text-[#90f826]">
              Acesso ao MakersHub
            </span>
            <span className="text-sm text-white/35 line-through">De R$149</span>
          </div>

          <div className="mt-7">
            <p className="text-sm font-medium text-white/45">Pagamento único de</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="mb-2 text-xl font-semibold text-white/55">R$</span>
              <span className="font-display text-[5.3rem] font-semibold leading-none tracking-[-0.075em] text-white sm:text-[6.5rem]">
                97
              </span>
              <span className="mb-3 text-base font-medium text-white/45">,00</span>
            </div>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#d0ff84]">
              <CircleCheck className="size-4" />
              Sem mensalidade
            </p>
          </div>

          <div className="my-7 h-px bg-white/10" />

          <ul className="grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-white/68"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-[#90f826]" />
                {item}
              </li>
            ))}
          </ul>

          <CheckoutButton className="mt-8 w-full py-4 text-base">
            Garantir meu acesso por R$97
          </CheckoutButton>

          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" />
              Pagamento seguro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5" />
              Liberação imediata
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section
      id="duvidas"
      className="scroll-mt-20 border-t border-white/[0.055] px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#90f826]">
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Antes de entrar, você pode querer saber.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/45 sm:text-base">
            Se ainda ficar alguma dúvida, fale com a gente antes de comprar.
          </p>
        </div>

        <div className="divide-y divide-white/[0.075] border-y border-white/[0.075]">
          {faqs.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left text-sm font-semibold text-white sm:text-base">
                {question}
                <ChevronDown className="size-4 shrink-0 text-white/35 transition group-open:rotate-180" />
              </summary>
              <p className="max-w-2xl pb-6 pr-8 text-sm leading-relaxed text-white/48">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[30px] border border-[#90f826]/20 bg-[#11140e] px-6 py-14 text-center sm:px-10 lg:py-20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-96 -translate-x-1/2 rounded-full bg-[#90f826]/20 blur-[100px]" />
        <div className="relative">
          <MonitorPlay className="mx-auto size-8 text-[#90f826]" />
          <h2 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">
            Sua produtora não precisa de mais uma planilha.
            <span className="block text-[#90f826]">Precisa de uma operação.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/50">
            Comece hoje com o MakersHub e transforme informação espalhada em controle para decidir,
            vender e produzir melhor.
          </p>
          <CheckoutButton className="mt-8 w-full max-w-sm sm:w-auto">
            Quero organizar minha produtora
          </CheckoutButton>
          <p className="mt-3 text-xs text-white/30">R$97 único · sem mensalidade</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.055] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <Brand compact />
        <div className="flex items-center gap-5 text-xs text-white/35">
          <a className="transition hover:text-white" href="/termos">
            Termos
          </a>
          <a className="transition hover:text-white" href="/privacidade">
            Privacidade
          </a>
          <span>© {new Date().getFullYear()} MakersHub</span>
        </div>
      </div>
    </footer>
  );
}

function MobileBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > Math.max(520, window.innerHeight * 0.72));
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0d0a]/94 p-3 backdrop-blur-xl transition duration-300 md:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <CheckoutButton className="w-full min-h-12">Garantir acesso por R$97</CheckoutButton>
    </div>
  );
}

function DeferredLandingSections() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reveal = () => setReady(true);
    const win = typeof window !== "undefined" ? (window as Window) : null;

    if (!win) return;
    const hasRequestIdle =
      "requestIdleCallback" in win && typeof win.requestIdleCallback === "function";
    if (hasRequestIdle) {
      const idleId = win.requestIdleCallback!(reveal, { timeout: 900 });
      return () => win.cancelIdleCallback?.(idleId);
    }

    const timeoutId = win.setTimeout(reveal, 120);
    return () => win.clearTimeout(timeoutId);
  }, []);

  if (!ready) {
    return <div className="h-24 bg-[#0b0d0a]" aria-hidden="true" />;
  }

  return (
    <>
      <DashboardProof />
      <Outcomes />
      <ProductShowcase />
      <AiNativeSection />
      <ClientExperience />
      <EventsPreview />
      <ProposalSpotlight />
      <Comparison />
      <Offer />
      <Faq />
      <FinalCta />
    </>
  );
}

export function SalesLandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0d0a] font-sans text-white antialiased selection:bg-[#90f826] selection:text-[#11140e]">
      <Header />
      <main>
        <Hero />
        <PainSection />
        <DeferredLandingSections />
      </main>
      <Footer />
      <MobileBar />
    </div>
  );
}
