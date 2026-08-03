import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { SuporteModal } from "@/components/suporte/suporte-modal";

// Some na aba atual e volta no próximo carregamento. O "x" existe porque o
// botão tapa o canto do Kanban e das tabelas, e a intenção de quem clica nele é
// "sai da minha frente agora", não "nunca mais me ofereça ajuda". Um botão de
// suporte dispensado para sempre é um bug que você nunca fica sabendo que teve.
const CHAVE_OCULTO = "mh_suporte_oculto";

/** A sidebar dispara este evento para abrir o suporte mesmo com o botão escondido. */
export const EVENTO_ABRIR_SUPORTE = "makershub:abrir-suporte";

export function SuporteWidget() {
  const [oculto, setOculto] = useState(false);
  const [aberto, setAberto] = useState(false);

  // No useEffect, nunca no render: o SSR não tem sessionStorage e o React 19
  // acusa hydration mismatch.
  useEffect(() => {
    if (sessionStorage.getItem(CHAVE_OCULTO)) setOculto(true);
  }, []);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_SUPORTE, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_SUPORTE, abrir);
  }, []);

  const esconder = () => {
    sessionStorage.setItem(CHAVE_OCULTO, "1");
    setOculto(true);
  };

  return (
    <>
      {!oculto && (
        // z-40 fica abaixo dos dialogs (z-50), como as demais barras fixas do
        // app. O safe-area cobre o home indicator do iPhone.
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 print:hidden">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAberto(true)}
              aria-label="Falar com o suporte"
              title="Falar com o suporte"
              className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 transition hover:scale-105 active:scale-95"
            >
              <MessageCircle className="size-6" />
            </button>
            <button
              type="button"
              onClick={esconder}
              aria-label="Esconder o botão de suporte"
              title="Esconder"
              className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-border bg-surface-3 text-muted-foreground shadow-sm transition hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
      <SuporteModal open={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
