import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleCalendarIcon } from "@/components/icons/google-calendar";

import { GoogleCalendarSync } from "./google-calendar-sync";

type Status = { enabled: boolean; configured: boolean; status: string; email: string | null };
const messages: Record<string, string> = {
  connected: "",
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
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [message, setMessage] = useState("");
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
  }, [currentUserId]);

  if (!status?.configured || (!status.enabled && status.status === "disconnected")) return null;

  async function connect() {
    setDisclosureOpen(false);
    setBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== user?.id) return;
      if (status?.status === "reconnect_required" || status?.status === "revoking") {
        const disconnected = await fetch("/api/integrations/google-calendar/disconnect", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (!disconnected.ok) throw new Error("disconnect_failed");
      }
      const response = await fetch("/api/integrations/google-calendar/start", {
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
      if (result.url) {
        const destination = new URL(result.url);
        if (destination.origin !== "https://accounts.google.com")
          throw new Error("Invalid destination");
        window.location.assign(destination.href);
      }
    } catch {
      setMessage("Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  const connected = status.enabled && status.status === "connected";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {!connected && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !status.enabled}
            onClick={() => setDisclosureOpen(true)}
          >
            <GoogleCalendarIcon className="size-4" /> Conectar agenda
          </Button>
          <Dialog open={disclosureOpen} onOpenChange={setDisclosureOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conectar ao Google Agenda</DialogTitle>
                <DialogDescription>
                  O MakersHub usará sua Conta do Google para sincronizar eventos com sua agenda
                  principal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  A integração lê sua lista de agendas para localizar a principal e pode ler, criar,
                  atualizar e excluir eventos das agendas que você possui. Serão sincronizados
                  apenas eventos atuais e futuros.
                </p>
                <p>
                  Título, descrição, local, data e horário podem ser copiados entre os serviços.
                  Eventos privados vindos do Google aparecem somente como <strong>Ocupado</strong>.
                  Os dados não são usados para publicidade nem para treinar modelos gerais de IA.
                </p>
                <p>
                  Você poderá revogar o acesso em Configurações. Consulte a{" "}
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDisclosureOpen(false)}>
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={() => void connect()}>
                  {busy ? "Conectando…" : "Continuar com Google"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {connected && currentUserId && (
        <GoogleCalendarSync key={currentUserId} userId={currentUserId} />
      )}
      {message && (
        <p role="status" className="w-full text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
