import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const STORAGE_PREFIX = "makershub:founding-members:v1:seen";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/G29fWlq7QK52n5bGGmJe9k?s=cl&p=i&mlu=4";

export function FoundingMembersAnnouncement() {
  const { user, usuario } = useAuth();
  const [open, setOpen] = useState(false);
  const memberId = usuario?.id ?? user?.id;
  const storageKey = useMemo(() => (memberId ? `${STORAGE_PREFIX}:${memberId}` : null), [memberId]);

  useEffect(() => {
    if (!storageKey) return;

    try {
      setOpen(!localStorage.getItem(storageKey));
    } catch {
      // Armazenamento restrito não deve impedir o comunicado de aparecer.
      setOpen(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // O fechamento continua funcionando mesmo sem persistência local.
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
      <DialogContent
        overlayClassName="bg-[#050706]/85 backdrop-blur-md"
        className="max-w-[780px] gap-0 overflow-hidden border-white/10 bg-[#0d100e] p-0 font-sans text-white shadow-[0_32px_110px_-28px_rgba(0,0,0,.95)]"
      >
        <div className="grid lg:grid-cols-[1.12fr_.88fr]">
          <div className="relative overflow-hidden px-6 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-28 -top-32 size-72 rounded-full bg-primary/10 blur-3xl"
            />

            <div className="relative">
              <DialogTitle className="max-w-md text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[2.65rem]">
                Obrigado por construir o começo com a gente.
              </DialogTitle>
              <DialogDescription className="mt-5 max-w-lg text-sm leading-6 text-white/58">
                Você faz parte do grupo de membros fundadores que acreditou no MakersHub ainda na
                versão beta. Essa confiança ajudou a transformar uma ideia em um produto real.
              </DialogDescription>

              <p className="mt-4 max-w-lg text-sm leading-6 text-white/78">
                Em breve, vamos lançar o novo MakersHub: a{" "}
                <strong className="font-semibold text-white">V1 oficial</strong>, um sistema
                inteiramente novo, com correções, melhorias e novidades construídas a partir de tudo
                o que aprendemos até aqui.
              </p>

              <div className="mt-7 border-t border-white/[0.08] pt-5">
                <p className="text-xs font-medium text-white/85">No grupo de WhatsApp, você vai:</p>
                <ul className="mt-3 grid gap-2.5 text-xs leading-5 text-white/50">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    receber as novidades antes do lançamento;
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    participar da live oficial de lançamento;
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    testar a V1 antes de todo mundo.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <aside className="flex flex-col justify-between border-t border-white/[0.08] bg-white/[0.025] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.22em] text-white/32">
                Próximo capítulo
              </p>

              <div className="mt-9" aria-label="Transição da versão beta para a V1 oficial">
                <div className="h-px w-full bg-gradient-to-r from-white/20 to-primary/70" />
                <div className="mt-3 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">Beta</p>
                    <p className="mt-1 text-xs text-white/55">Onde começamos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      V1 oficial
                    </p>
                    <p className="mt-1 text-xs text-white/80">O novo MakersHub</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-3">
              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={dismiss}
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-[0_16px_40px_-20px_var(--primary)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d100e]"
              >
                <MessageCircle className="size-4" />
                Entrar no grupo de WhatsApp
                <ArrowUpRight className="size-3.5" />
              </a>

              <button
                type="button"
                onClick={dismiss}
                className="min-h-10 w-full rounded-lg px-3 text-xs font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Continuar no MakersHub
              </button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
