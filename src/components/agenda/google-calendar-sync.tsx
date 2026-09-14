import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { refreshAgenda } from "@/lib/hooks/useAgenda";
import type { SyncSettings, SyncValue } from "@/lib/google-calendar/sync-model";
import type { SyncReport } from "@/lib/google-calendar/sync.server";

type State = {
  settings: SyncSettings | null;
  enrolled: number;
  candidates: { id: string; title: string; start: string }[];
};
type Calendar = { id: string; summary: string };
const errors: Record<string, string> = {
  sync_in_progress: "Uma sincronização já está em andamento. Aguarde alguns instantes.",
  event_changed:
    "O evento mudou durante a sincronização. Sincronize novamente para revisar as versões.",
  reconnect_required: "Reconecte sua conta Google para retomar a sincronização.",
  access_denied: "A integração foi pausada ou sua sessão expirou.",
  calendar_access_denied: "Não foi possível acessar a agenda selecionada no Google.",
  calendar_timezone_changed:
    "O fuso da agenda Google mudou. Restaure o fuso original antes de sincronizar.",
  calendar_limit: "O piloto atingiu o limite de eventos. A sincronização foi interrompida.",
  invalid_event:
    "Há um evento com datas ou conteúdo incompatível. Revise os eventos antes de tentar novamente.",
  google_retry_later:
    "O Google está temporariamente indisponível. Tente novamente em alguns minutos.",
};
function describe(v: SyncValue | null) {
  if (!v) return "Evento excluído";
  return `${v.title} · ${v.allDay ? `${v.start} até ${v.end} (dia inteiro; término exclusivo)` : `${new Date(v.start).toLocaleString("pt-BR")} até ${new Date(v.end).toLocaleString("pt-BR")}`}${v.location ? ` · ${v.location}` : ""}${v.description ? ` · ${v.description}` : ""}`;
}
export function GoogleCalendarSync({ userId }: { userId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [report, setReport] = useState<SyncReport | null>(null);
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
  }, [request]);
  const run = useCallback(
    async (resolution?: { id: string; fingerprint: string; side: "local" | "google" }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setMessage("");
      try {
        const result = await request<SyncReport>("sync/run", { resolution });
        if (!active.current) return;
        setReport(result);
        await load();
        await refreshAgenda(userId);
        if (active.current)
          setMessage(
            result.partial
              ? "Parte dos eventos foi sincronizada. Clique novamente para continuar."
              : result.conflicts.length
                ? "Existem alterações nos dois lados. Escolha a versão de cada conflito."
                : "Sincronização concluída.",
          );
      } catch (e) {
        if (active.current)
          setMessage(
            errors[e instanceof Error ? e.message : ""] ??
              "Não foi possível sincronizar. Tente novamente.",
          );
      } finally {
        inFlight.current = false;
        if (active.current) setBusy(false);
      }
    },
    [request, load, userId],
  );
  useEffect(() => {
    active.current = true;
    const pending = controllers.current;
    void load().catch(() => {
      if (active.current) setMessage("Não foi possível carregar a sincronização.");
    });
    return () => {
      active.current = false;
      pending.forEach((c) => c.abort());
    };
  }, [load]);
  const configured = !!state?.settings;
  useEffect(() => {
    if (!configured) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [configured, run]);
  async function change(action: "calendars" | "configure" | "enroll") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (action === "calendars") {
        const result = await request<{ calendars: Calendar[] }>("calendars");
        setCalendars(result.calendars);
        setCalendarId(result.calendars[0]?.id ?? "");
        if (!result.calendars.length)
          setMessage(
            "Crie no Google uma agenda secundária chamada MAKERShub - Testes e clique em Buscar agendas novamente.",
          );
      } else {
        await request(
          `sync/${action}`,
          action === "configure" ? { calendarId } : { eventIds: selected },
        );
        setSelected([]);
        await load();
        setMessage(
          action === "configure"
            ? "Agenda selecionada. A sincronização automática está ativa nesta tela."
            : "Eventos incluídos. Clique em Sincronizar agora para enviá-los.",
        );
      }
    } catch (e) {
      if (active.current)
        setMessage(
          errors[e instanceof Error ? e.message : ""] ??
            "Não foi possível concluir. Tente novamente.",
        );
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <details className="w-full rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Sincronização Google ↔ MAKERShub · piloto
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">
          Sincroniza título, descrição, local, datas e exclusões a cada minuto enquanto esta tela
          estiver aberta. Eventos importados ficam visíveis para sua empresa. Convites e
          participantes não são sincronizados; eventos recorrentes e especiais são ignorados neste
          piloto.
        </p>
        {!state ? (
          <p>Carregando…</p>
        ) : !state.settings ? (
          <>
            <p>
              Use uma agenda secundária no Google chamada <strong>MAKERShub - Testes</strong>. Os
              eventos dela serão importados. A agenda principal não será usada.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void change("calendars")}
            >
              Buscar agendas de teste
            </Button>
            {calendars.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <label>
                  Agenda Google{" "}
                  <select
                    className="rounded border bg-background p-2"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  disabled={busy || !calendarId}
                  onClick={() => void change("configure")}
                >
                  Ativar nesta agenda
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p>
              <strong>{state.settings.calendar_name}</strong> · {state.enrolled} eventos vinculados
              {state.settings.last_synced_at
                ? ` · Última sincronização: ${new Date(state.settings.last_synced_at).toLocaleString("pt-BR")}`
                : ""}
            </p>
            <Button size="sm" disabled={busy} onClick={() => void run()}>
              {busy ? "Aguarde…" : "Sincronizar agora"}
            </Button>
            <details>
              <summary className="cursor-pointer">
                Escolher eventos do MAKERShub para enviar
              </summary>
              <p className="my-2 text-muted-foreground">
                Selecione até 20 eventos por vez. Depois de vinculados, alterações e exclusões serão
                propagadas nos dois sentidos.
              </p>
              <div className="max-h-52 space-y-2 overflow-auto">
                {state.candidates.map((e) => (
                  <label key={e.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      disabled={busy || (!selected.includes(e.id) && selected.length >= 20)}
                      onChange={(ev) =>
                        setSelected((ids) =>
                          ev.target.checked ? [...ids, e.id] : ids.filter((id) => id !== e.id),
                        )
                      }
                    />
                    <span>
                      {e.title} · {new Date(e.start).toLocaleString("pt-BR")}
                    </span>
                  </label>
                ))}
                {!state.candidates.length && <p>Nenhum evento manual disponível.</p>}
              </div>
              <Button
                size="sm"
                className="mt-2"
                disabled={busy || !selected.length}
                onClick={() => void change("enroll")}
              >
                Incluir selecionados
              </Button>
            </details>
          </>
        )}
        {report && (
          <p>
            {report.pushed} enviados · {report.pulled} recebidos
            {report.skipped ? ` · ${report.skipped} eventos incompatíveis ignorados` : ""}
          </p>
        )}
        {report?.conflicts.map((c) => (
          <div key={c.id} className="space-y-2 rounded border border-amber-500 p-3">
            <p className="font-medium">Alterações nos dois lados</p>
            <p className="break-words">MAKERShub: {describe(c.local)}</p>
            <p className="break-words">Google: {describe(c.google)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run({ id: c.id, fingerprint: c.fingerprint, side: "local" })}
              >
                Usar MAKERShub
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run({ id: c.id, fingerprint: c.fingerprint, side: "google" })}
              >
                Usar Google
              </Button>
            </div>
          </div>
        ))}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
