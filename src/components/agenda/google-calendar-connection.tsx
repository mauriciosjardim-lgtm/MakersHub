import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { GoogleCalendarIcon } from "@/components/icons/google-calendar";

type Status = { enabled: boolean; configured: boolean; status: string; email: string | null };
const messages: Record<string, string> = {
  connected:
    "Google Agenda conectada. A sincronização de eventos será habilitada em uma próxima etapa.",
  consent_denied: "Conexão cancelada no Google.",
  wrong_google_account: "Use a mesma conta Google do seu usuário de teste.",
  permissions_missing: "Autorize as permissões solicitadas para concluir a conexão.",
  invalid_state: "A tentativa expirou ou já foi usada. Inicie a conexão novamente.",
  access_denied: "A integração está pausada ou indisponível para esta conta.",
  reconnect_required: "O acesso ao Google expirou. Desconecte e conecte novamente.",
  revocation_pending: "Não foi possível revogar o acesso no Google. Tente desconectar novamente.",
  disconnect_first: "Desconecte a conta atual antes de iniciar outra conexão.",
};

export function GoogleCalendarConnection() {
  const { user } = useAuth();
  const currentUserId = user?.id;
  // Keep results bound to the account that requested them, even during logout/login races.
  const [snapshot, setSnapshot] = useState<{ userId: string; value: Status } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const status = snapshot && user && snapshot.userId === user.id ? snapshot.value : null;

  useEffect(() => {
    setMessage("");
    if (!currentUserId) return;
    const controller = new AbortController();
    const userId = currentUserId;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== userId || controller.signal.aborted) return;
      const response = await fetch("/api/integrations/google-calendar/status", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
      });
      if (!response.ok) return;
      const value = (await response.json()) as Status;
      if (controller.signal.aborted) return;
      setSnapshot({ userId, value });
      const url = new URL(window.location.href);
      const result = url.searchParams.get("google_calendar");
      if (result) {
        if (value.configured)
          setMessage(messages[result] ?? "Não foi possível concluir a conexão. Tente novamente.");
        url.searchParams.delete("google_calendar");
        window.history.replaceState(window.history.state, "", url);
      }
    })().catch(() => undefined);
    return () => controller.abort();
  }, [currentUserId, revision]);

  if (!status?.configured || (!status.enabled && status.status === "disconnected")) return null;

  async function act(action: "start" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== user?.id) return;
      const response = await fetch(`/api/integrations/google-calendar/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const result = (await response.json()) as { url?: string; error?: string };
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== data.session.user.id) return;
      if (!response.ok) {
        setMessage(messages[result.error ?? ""] ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      if (action === "start" && result.url) {
        const destination = new URL(result.url);
        if (destination.origin !== "https://accounts.google.com")
          throw new Error("Invalid destination");
        window.location.assign(destination.href);
      } else setRevision((n) => n + 1);
    } catch {
      setMessage("Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  const hasConnection = !["disconnected", "pending"].includes(status.status);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {hasConnection ? (
        <>
          <GoogleCalendarIcon className="size-4" />
          <span>
            {status.status === "connected" ? "Google Agenda conectada" : "Conexão requer atenção"}
            {status.email ? ` · ${status.email}` : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("disconnect")}
          >
            Desconectar
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !status.enabled}
          onClick={() => void act("start")}
        >
          <GoogleCalendarIcon className="size-4" /> Conectar Google Agenda
        </Button>
      )}
      {message && (
        <p role="status" className="w-full text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
