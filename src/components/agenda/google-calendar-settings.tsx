import { useEffect, useState } from "react";
import { GoogleCalendarIcon } from "@/components/icons/google-calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Status = { configured: boolean; status: string; email: string | null };

function IntegrationPlaceholder() {
  return (
    <section
      id="integracoes"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <h2 className="font-display text-lg font-semibold tracking-tight">Integrações</h2>
      <p className="mt-1 text-sm text-muted-foreground">Google Agenda, Drive, WhatsApp, Stripe.</p>
    </section>
  );
}

export function GoogleCalendarSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== user.id) return;
      const response = await fetch("/api/integrations/google-calendar/status", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
      });
      if (response.ok) setStatus((await response.json()) as Status);
    })().catch(() => undefined);
    return () => controller.abort();
  }, [user]);

  if (!status?.configured || status.status === "unavailable") return <IntegrationPlaceholder />;

  const connected = ["connected", "reconnect_required", "revoking"].includes(status.status);

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== user?.id) throw new Error();
      const response = await fetch("/api/integrations/google-calendar/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) throw new Error();
      setStatus({ configured: true, status: "disconnected", email: null });
      setConfirmOpen(false);
      setMessage("Google Agenda desconectada.");
    } catch {
      setMessage("Não foi possível desconectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="integracoes"
      className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <GoogleCalendarIcon className="mt-0.5 size-6 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Google Agenda</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected ? `Conectada a ${status.email ?? "sua Conta do Google"}` : "Desconectada"}
            </p>
          </div>
        </div>
        {connected && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            Desconectar
          </Button>
        )}
      </div>
      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        O MakersHub sincroniza eventos atuais e futuros com sua agenda principal. Você controla o
        acesso e pode revogá-lo aqui. Veja como tratamos seus dados na{" "}
        <a
          href="/privacidade"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Política de Privacidade
        </a>
        .
      </p>
      {!connected && (
        <a
          href="/agenda"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Conectar na Agenda
        </a>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {message}
        </p>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Google Agenda?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso será revogado no Google e as credenciais armazenadas serão excluídas. Os
              eventos já copiados para o MakersHub permanecerão na sua agenda para evitar perda de
              trabalho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void disconnect();
              }}
            >
              {busy ? "Desconectando…" : "Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
