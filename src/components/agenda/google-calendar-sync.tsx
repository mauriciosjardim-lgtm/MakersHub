import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { refreshAgenda } from "@/lib/hooks/useAgenda";
import type { SyncSettings, SyncValue } from "@/lib/google-calendar/sync-model";
import type { SyncReport } from "@/lib/google-calendar/sync.server";

type State = { settings: SyncSettings | null };
type Calendar = { id: string };
type Resolution = { id: string; fingerprint: string; side: "local" | "google" };

const errors: Record<string, string> = {
  sync_in_progress: "A atualização já está em andamento.",
  event_changed: "Um evento mudou. Atualize novamente.",
  reconnect_required: "Conecte a agenda novamente.",
  access_denied: "A conexão não está disponível.",
  calendar_access_denied: "Não foi possível acessar a agenda.",
  calendar_timezone_changed: "Confira o fuso horário da agenda.",
  calendar_limit: "A agenda atingiu o limite do piloto.",
  invalid_event: "Revise os dados do evento.",
  google_retry_later: "O Google está indisponível no momento.",
};

function describe(value: SyncValue | null) {
  return value?.title ?? "Evento excluído";
}

export function GoogleCalendarSync({ userId }: { userId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [conflicts, setConflicts] = useState<SyncReport["conflicts"]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const controllers = useRef(new Set<AbortController>());

  const request = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const controller = new AbortController();
      controllers.current.add(controller);
      try {
        const { data } = await supabase.auth.getSession();
        if (!active.current || data.session?.user.id !== userId) throw new Error("access_denied");
        const response = await fetch(`/api/integrations/google-calendar/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const result = await response.json();
        const current = await supabase.auth.getSession();
        if (!active.current || current.data.session?.user.id !== userId)
          throw new Error("access_denied");
        if (!response.ok) throw new Error(result.error ?? "unavailable");
        return result as T;
      } finally {
        controllers.current.delete(controller);
      }
    },
    [userId],
  );

  const load = useCallback(async () => {
    const value = await request<State>("sync");
    if (active.current) setState(value);
    return value;
  }, [request]);

  const run = useCallback(
    async (resolution?: Resolution, manual = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setMessage("");
      try {
        let current = state ?? (await load());
        if (!current.settings) {
          if (!manual) return;
          const { calendars } = await request<{ calendars: Calendar[] }>("calendars");
          if (!calendars.length) throw new Error("calendar_access_denied");
          await request("sync/configure", { calendarId: calendars[0].id });
          current = await load();
        }
        const result = await request<SyncReport>("sync/run", { resolution });
        if (!active.current) return;
        setConflicts(result.conflicts);
        await load();
        await refreshAgenda(userId);
        if (active.current && result.partial) setMessage("Clique em Atualizar novamente.");
      } catch (error) {
        if (active.current)
          setMessage(
            errors[error instanceof Error ? error.message : ""] ?? "Não foi possível atualizar.",
          );
      } finally {
        inFlight.current = false;
        if (active.current) setBusy(false);
      }
    },
    [request, load, state, userId],
  );

  useEffect(() => {
    active.current = true;
    const pending = controllers.current;
    void load().catch(() => {
      if (active.current) setMessage("Não foi possível carregar a agenda.");
    });
    return () => {
      active.current = false;
      pending.forEach((controller) => controller.abort());
    };
  }, [load]);

  useEffect(() => {
    if (!state?.settings) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [state?.settings, run]);

  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(undefined, true)}>
        {busy ? "Atualizando…" : "Atualizar"}
      </Button>
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="flex w-full flex-wrap items-center gap-2 text-xs">
          <span>
            Conflito: {describe(conflict.local)} / {describe(conflict.google)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run({ id: conflict.id, fingerprint: conflict.fingerprint, side: "local" }, true)
            }
          >
            Usar MAKERShub
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run({ id: conflict.id, fingerprint: conflict.fingerprint, side: "google" }, true)
            }
          >
            Usar Google
          </Button>
        </div>
      ))}
      {message && (
        <span role="status" className="w-full text-xs text-muted-foreground">
          {message}
        </span>
      )}
    </>
  );
}
