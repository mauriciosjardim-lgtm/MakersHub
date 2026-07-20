import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMakersHub } from "@/components/logo-makershub";
import { portalSupabase } from "@/lib/portal-supabase";
import { consumeAuthSessionFromUrl } from "@/lib/auth-url-session";

export const Route = createFileRoute("/portal/redefinir-senha")({
  ssr: false,
  component: PortalPasswordRecovery,
});

type RecoveryState = "checking" | "ready" | "invalid" | "saving" | "done";

function PortalPasswordRecovery() {
  const [state, setState] = useState<RecoveryState>("checking");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const validateSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await consumeAuthSessionFromUrl(portalSupabase);
      if (!active) return;
      if (sessionError || !session) {
        setState("invalid");
        return;
      }

      const { data: portalToken, error: tokenError } = await (portalSupabase as any).rpc(
        "meu_portal_token",
      );
      if (!active) return;
      if (tokenError || !portalToken) {
        await portalSupabase.auth.signOut({ scope: "local" });
        setState("invalid");
        return;
      }
      setToken(String(portalToken));
      setState("ready");
    };

    void validateSession();

    return () => {
      active = false;
    };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setState("saving");
    const { error: updateError } = await portalSupabase.auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível atualizar sua senha. Solicite um novo link.");
      setState("ready");
      return;
    }
    setState("done");
    window.setTimeout(() => window.location.assign(`/portal/${token}`), 900);
  };

  return (
    <main className="relative flex min-h-[100dvh] w-full items-start justify-center overflow-x-hidden bg-[#080a08] px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-white sm:items-center sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute left-1/2 top-[-20rem] size-[46rem] -translate-x-1/2 rounded-full bg-lime-300/[0.08] blur-[120px]" />
      <div className="relative min-w-0 w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
          <LogoMakersHub className="size-9 sm:size-10" />
          <div>
            <p className="font-display text-base font-semibold sm:text-lg">
              Makers <span className="text-lime-300">Members</span>
            </p>
            <p className="text-[10px] uppercase tracking-[.2em] text-white/35">
              Recuperação de acesso
            </p>
          </div>
        </div>

        <section className="min-w-0 w-full rounded-[20px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl sm:rounded-[24px] sm:p-7">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            {state === "done" ? (
              <CheckCircle2 className="size-5" />
            ) : state === "checking" || state === "saving" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LockKeyhole className="size-5" />
            )}
          </span>

          {state === "invalid" ? (
            <div className="text-center">
              <h1 className="mt-5 font-display text-xl font-semibold sm:text-2xl">
                Link inválido ou expirado
              </h1>
              <p className="mt-2 text-xs leading-5 text-white/45">
                Solicite uma nova recuperação na tela de acesso do portal.
              </p>
              <Button
                className="mt-7 h-11 w-full"
                onClick={() => window.location.assign("/portal/login")}
              >
                Voltar ao login
              </Button>
            </div>
          ) : state === "done" ? (
            <div className="text-center">
              <h1 className="mt-5 font-display text-xl font-semibold sm:text-2xl">
                Senha atualizada
              </h1>
              <p className="mt-2 text-xs leading-5 text-white/45">
                Estamos levando você de volta ao seu portal.
              </p>
            </div>
          ) : (
            <>
              <h1 className="mt-5 text-center font-display text-xl font-semibold sm:text-2xl">
                Crie uma nova senha
              </h1>
              <p className="mt-2 text-center text-xs leading-5 text-white/45">
                Use pelo menos 8 caracteres e não compartilhe sua senha.
              </p>

              <form onSubmit={save} className="mt-7 space-y-4">
                <PasswordField
                  label="Nova senha"
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                />
                <PasswordField
                  label="Confirmar nova senha"
                  value={confirmation}
                  onChange={setConfirmation}
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                />
                {error && (
                  <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={state !== "ready"} className="h-11 w-full">
                  {state === "saving" && <Loader2 className="size-4 animate-spin" />}
                  Salvar nova senha
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </span>
      <span className="relative block">
        <LockKeyhole className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <Input
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 border-white/10 bg-white/[0.04] px-10 text-white"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}
