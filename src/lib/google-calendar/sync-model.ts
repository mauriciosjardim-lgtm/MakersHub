import { z } from "zod";
import { CalendarError } from "./protocol";

export const syncValueSchema = z.object({
  title: z.string().max(1024),
  description: z.string().max(16000),
  location: z.string().max(2048),
  allDay: z.boolean(),
  start: z.string(),
  end: z.string(),
});
export type SyncValue = z.infer<typeof syncValueSchema>;
export type LocalEvent = {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicio: string;
  fim: string;
  dia_todo: boolean;
  ref_tipo: string | null;
  calendar_revision: number;
};
export type RemoteEvent = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  recurrence?: string[];
  recurringEventId?: string;
  eventType?: string;
  locked?: boolean;
  visibility?: "default" | "public" | "private" | "confidential";
  extendedProperties?: { private?: Record<string, string> };
};
export type SyncLink = {
  id: string;
  user_id: string;
  empresa_id: string;
  calendar_id: string;
  local_event_id: string;
  google_event_id: string;
  base: SyncValue | null;
  pending: boolean;
  deleted: boolean;
};
export type SyncSettings = {
  user_id: string;
  empresa_id: string;
  calendar_id: string;
  calendar_name: string;
  time_zone: string;
  last_synced_at: string | null;
  sync_from: string;
  configuration_version: number;
};
export type Decision = "none" | "ack" | "push" | "pull" | "conflict";
export function equal(a: SyncValue | null, b: SyncValue | null) {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.title === b.title &&
      a.description === b.description &&
      a.location === b.location &&
      a.allDay === b.allDay &&
      a.start === b.start &&
      a.end === b.end)
  );
}
export function decide(
  base: SyncValue | null,
  local: SyncValue | null,
  remote: SyncValue | null,
  pending = false,
): Decision {
  if (equal(local, remote)) return equal(base, local) && !pending ? "none" : "ack";
  if (pending && !remote && local) return "push";
  const l = !equal(local, base),
    r = !equal(remote, base);
  if (l && r) return "conflict";
  return l ? "push" : r ? "pull" : "none";
}
export function dateInZone(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function midnight(date: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CalendarError("invalid_event");
  const target = Date.parse(`${date}T00:00:00Z`);
  let value = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    const shown = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    if (shown === target) break;
    value += target - shown;
  }
  const result = new Date(value).toISOString();
  if (dateInZone(result, zone) !== date) throw new CalendarError("unsupported_event_time");
  return result;
}
function validate(value: SyncValue) {
  const v = syncValueSchema.parse(value);
  if (
    !Number.isFinite(Date.parse(v.start)) ||
    !Number.isFinite(Date.parse(v.end)) ||
    v.end <= v.start
  )
    throw new CalendarError("invalid_event");
  return v;
}
export function fromLocal(e: LocalEvent, zone: string): SyncValue {
  return validate({
    title: e.titulo,
    description: e.descricao ?? "",
    location: e.local ?? "",
    allDay: !!e.dia_todo,
    start: e.dia_todo ? dateInZone(e.inicio, zone) : new Date(e.inicio).toISOString(),
    end: e.dia_todo ? dateInZone(e.fim, zone) : new Date(e.fim).toISOString(),
  });
}
export function supported(e: RemoteEvent) {
  return !e.recurrence?.length && !e.locked && (!e.eventType || e.eventType === "default");
}
export function fromRemote(e: RemoteEvent, redactPrivate = true): SyncValue | null {
  if (e.status === "cancelled") return null;
  if (!supported(e)) throw new CalendarError("unsupported_event");
  const allDay = !!e.start?.date;
  if (allDay !== !!e.end?.date) throw new CalendarError("invalid_event");
  const start = allDay ? e.start!.date : e.start?.dateTime,
    end = allDay ? e.end!.date : e.end?.dateTime;
  if (!start || !end) throw new CalendarError("invalid_event");
  return validate({
    title: redactPrivate && e.visibility === "private" ? "Ocupado" : (e.summary ?? "(Sem título)"),
    description: redactPrivate && e.visibility === "private" ? "" : (e.description ?? ""),
    location: redactPrivate && e.visibility === "private" ? "" : (e.location ?? ""),
    allDay,
    start: allDay ? start : new Date(start).toISOString(),
    end: allDay ? end : new Date(end).toISOString(),
  });
}
export function toGoogle(v: SyncValue, zone: string) {
  return {
    summary: v.title,
    description: v.description,
    location: v.location,
    start: v.allDay ? { date: v.start } : { dateTime: v.start, timeZone: zone },
    end: v.allDay ? { date: v.end } : { dateTime: v.end, timeZone: zone },
  };
}
export function toLocal(v: SyncValue, zone: string) {
  return {
    titulo: v.title,
    descricao: v.description,
    local: v.location,
    dia_todo: v.allDay,
    inicio: v.allDay ? midnight(v.start, zone) : v.start,
    fim: v.allDay ? midnight(v.end, zone) : v.end,
  };
}
