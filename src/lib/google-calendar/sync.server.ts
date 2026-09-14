import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sha256 } from "./crypto.server";
import { EventsApi } from "./events.server";
import { CalendarError, type Owner } from "./protocol";
import type { CalendarService } from "./service.server";
import {
  decide,
  equal,
  fromLocal,
  fromRemote,
  dateInZone,
  midnight,
  supported,
  syncValueSchema,
  toLocal,
  type LocalEvent,
  type SyncLink,
  type SyncSettings,
  type SyncValue,
} from "./sync-model";

export type Conflict = {
  id: string;
  fingerprint: string;
  local: SyncValue | null;
  google: SyncValue | null;
};
export type SyncReport = {
  pushed: number;
  pulled: number;
  skipped: number;
  partial: boolean;
  conflicts: Conflict[];
};
const resolutionSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string().min(1).max(100),
  side: z.enum(["local", "google"]),
});
export const syncInput = z.object({
  calendarId: z.string().min(1).max(1024).optional(),
  eventIds: z.array(z.string().uuid()).max(20).optional(),
  resolution: resolutionSchema.optional(),
});
export interface SyncStore {
  settings(): Promise<SyncSettings | null>;
  links(): Promise<SyncLink[]>;
  events(): Promise<LocalEvent[]>;
  write(action: string, data?: Record<string, unknown>): Promise<unknown>;
}
export class SyncRepository implements SyncStore {
  readonly lease = crypto.randomUUID();
  constructor(
    private db: SupabaseClient,
    private owner: Owner,
    private generation: string,
    private authorize: () => Promise<unknown>,
  ) {}
  async settings() {
    const { data, error } = await this.db
      .from("google_calendar_sync_settings")
      .select(
        "user_id,empresa_id,calendar_id,calendar_name,time_zone,last_synced_at,sync_from,configuration_version",
      )
      .eq("user_id", this.owner.userId)
      .eq("empresa_id", this.owner.empresaId)
      .maybeSingle();
    if (error) throw new CalendarError("storage_unavailable", 503);
    return data as SyncSettings | null;
  }
  async links() {
    const { data, error } = await this.db
      .from("google_calendar_event_links")
      .select("*")
      .eq("user_id", this.owner.userId)
      .eq("empresa_id", this.owner.empresaId)
      .limit(301);
    if (error) throw new CalendarError("storage_unavailable", 503);
    if (data.length > 300) throw new CalendarError("calendar_limit", 409);
    return data as SyncLink[];
  }
  async events() {
    const all: LocalEvent[] = [];
    let cursor: string | undefined;
    for (;;) {
      let query = this.db
        .from("eventos")
        .select(
          "id,empresa_id,titulo,descricao,local,inicio,fim,dia_todo,ref_tipo,calendar_revision",
        )
        .eq("empresa_id", this.owner.empresaId)
        .order("id")
        .limit(250);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new CalendarError("storage_unavailable", 503);
      all.push(...(data as LocalEvent[]));
      if (all.length > 1000) throw new CalendarError("calendar_limit", 409);
      if (data.length < 250) return all;
      cursor = data[data.length - 1].id;
    }
  }
  async write(action: string, data: Record<string, unknown> = {}) {
    await this.authorize();
    const { data: result, error } = await this.db.rpc("google_calendar_sync_write", {
      p_user: this.owner.userId,
      p_empresa: this.owner.empresaId,
      p_session: this.owner.sessionId,
      p_generation: this.generation,
      p_lease: this.lease,
      p_action: action,
      p_data: data,
    });
    if (error) {
      const codes = [
        "access_denied",
        "calendar_already_selected",
        "calendar_required",
        "sync_in_progress",
        "event_not_eligible",
        "calendar_limit",
        "event_changed",
      ];
      throw new CalendarError(
        codes.find((c) => error.message.includes(c)) ?? "storage_unavailable",
        409,
      );
    }
    return result;
  }
}
export async function eventId(namespace: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(namespace)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export class CalendarSync {
  constructor(
    private store: SyncStore,
    private api: EventsApi,
    private namespace: string,
  ) {}
  async status() {
    const [settings, links, events] = await Promise.all([
      this.store.settings(),
      this.store.links(),
      this.store.events(),
    ]);
    const enrolled = new Set(links.map((l) => l.local_event_id));
    return {
      settings,
      enrolled: links.filter((l) => !l.deleted).length,
      candidates: events
        .filter((e) => !e.ref_tipo && !enrolled.has(e.id))
        .map((e) => ({ id: e.id, title: e.titulo, start: e.inicio })),
    };
  }
  async configure(calendarId: string) {
    const calendar = await this.api.calendar(calendarId);
    if (!calendar.primary) throw new CalendarError("calendar_access_denied", 403);
    const syncFrom = midnight(
      dateInZone(new Date().toISOString(), calendar.timeZone),
      calendar.timeZone,
    );
    const previous = await this.store.settings();
    const switching = Boolean(
      previous && (previous.calendar_id !== calendar.id || previous.configuration_version < 2),
    );
    if (switching) await this.store.write("claim");
    try {
      await this.store.write("configure", {
        calendar_id: calendar.id,
        calendar_name: calendar.summary,
        time_zone: calendar.timeZone,
        sync_from: syncFrom,
        configuration_version: 2,
      });
    } finally {
      if (switching) await this.store.write("release", { complete: false }).catch(() => undefined);
    }
    const events = await this.store.events();
    await this.enroll(
      events
        .filter((event) => !event.ref_tipo && Date.parse(event.fim) >= Date.parse(syncFrom))
        .map((event) => event.id),
    );
  }
  async enroll(eventIds: string[]) {
    const s = await this.store.settings();
    if (!s) throw new CalendarError("calendar_required", 409);
    for (const id of new Set(eventIds))
      await this.store.write("enroll", {
        id: crypto.randomUUID(),
        local_event_id: id,
        google_event_id: await eventId(`${this.namespace}:${s.calendar_id}:${id}`),
      });
  }
  async run(resolution?: z.infer<typeof resolutionSchema>): Promise<SyncReport> {
    await this.store.write("claim");
    const report: SyncReport = { pushed: 0, pulled: 0, skipped: 0, partial: false, conflicts: [] };
    let complete = false;
    try {
      const s = await this.store.settings();
      if (!s) throw new CalendarError("calendar_required", 409);
      const calendar = await this.api.calendar(s.calendar_id);
      if (calendar.timeZone !== s.time_zone)
        throw new CalendarError("calendar_timezone_changed", 409);
      // Finish ALL pages before performing any writes. Missing pages never imply deletion.
      const [remote, links, events] = await Promise.all([
        this.api.list(s.calendar_id, s.sync_from),
        this.store.links(),
        this.store.events(),
      ]);
      const byRemote = new Map(remote.map((e) => [e.id, e]));
      const byLocal = new Map(events.map((e) => [e.id, e]));
      const known = new Set(links.map((l) => l.google_event_id));
      const deadline = Date.now() + 25000;
      for (const link of links) {
        if (Date.now() > deadline) {
          report.partial = true;
          break;
        }
        const localEvent = byLocal.get(link.local_event_id);
        const local = localEvent ? fromLocal(localEvent, s.time_zone) : null;
        if (
          link.deleted &&
          !local &&
          (!byRemote.has(link.google_event_id) ||
            byRemote.get(link.google_event_id)?.status === "cancelled")
        )
          continue;
        let googleEvent =
          byRemote.get(link.google_event_id) ??
          (await this.api.get(s.calendar_id, link.google_event_id));
        if (googleEvent?.status !== "cancelled" && googleEvent && !supported(googleEvent)) {
          report.skipped++;
          continue;
        }
        const managed = googleEvent?.extendedProperties?.private?.makershubLink === link.id;
        const google = googleEvent ? fromRemote(googleEvent, !managed) : null;
        const privateImport = googleEvent?.visibility === "private" && !managed;
        let decision =
          privateImport && !equal(local, google)
            ? "pull"
            : decide(link.base, local, google, link.pending);
        if (decision === "conflict") {
          const fingerprint = await sha256(
            JSON.stringify([
              link.id,
              localEvent?.calendar_revision ?? null,
              googleEvent?.etag ?? null,
              local ? syncValueSchema.parse(local) : null,
              google ? syncValueSchema.parse(google) : null,
            ]),
          );
          if (resolution?.id === link.id) {
            if (resolution.fingerprint !== fingerprint)
              throw new CalendarError("event_changed", 409);
            decision = resolution.side === "local" ? "push" : "pull";
          } else {
            report.conflicts.push({ id: link.id, fingerprint, local, google });
            continue;
          }
        }
        if (decision === "none") continue;
        if (decision === "ack") {
          await this.store.write("ack", { id: link.id, base: local });
          continue;
        }
        // Refresh Google immediately before writes, then use ETag for external mutations.
        const fresh = await this.api.get(s.calendar_id, link.google_event_id);
        if ((fresh?.etag ?? null) !== (googleEvent?.etag ?? null))
          throw new CalendarError("event_changed", 409);
        googleEvent = fresh;
        if (decision === "push") {
          await this.store.write("heartbeat", {
            id: link.id,
            revision: localEvent?.calendar_revision ?? null,
          });
          if (local) {
            let id = link.google_event_id;
            if (!google && (!link.pending || googleEvent?.status === "cancelled")) {
              id = await eventId(`${this.namespace}:${link.id}:${id}:${JSON.stringify(local)}`);
              // Persist the new id BEFORE insertion so a timeout/retry cannot create duplicates.
              await this.store.write("remap", { id: link.id, google_event_id: id });
              known.add(id);
            }
            const saved = await this.api.put(
              s.calendar_id,
              id,
              local,
              s.time_zone,
              link.id,
              google ? googleEvent : null,
            );
            if (!equal(fromRemote(saved, false), local))
              throw new CalendarError("event_changed", 409);
          } else if (googleEvent && google) await this.api.remove(s.calendar_id, googleEvent);
          await this.store.write("ack", { id: link.id, base: local });
          report.pushed++;
        } else {
          await this.store.write("apply", {
            id: link.id,
            revision: localEvent?.calendar_revision ?? null,
            event: google ? toLocal(google, s.time_zone) : null,
            base: google,
          });
          report.pulled++;
        }
      }
      if (!report.partial)
        for (const e of remote) {
          if (known.has(e.id) || e.status === "cancelled") continue;
          if (!supported(e)) {
            report.skipped++;
            continue;
          }
          // A private marker belongs to a managed link; never import an orphan as a new event.
          if (e.extendedProperties?.private?.makershubLink) {
            report.skipped++;
            continue;
          }
          if (Date.now() > deadline) {
            report.partial = true;
            break;
          }
          const fresh = await this.api.get(s.calendar_id, e.id);
          if (!fresh || fresh.status === "cancelled") continue;
          const value = fromRemote(fresh);
          if (!value) continue;
          await this.store.write("import", {
            id: crypto.randomUUID(),
            local_event_id: crypto.randomUUID(),
            google_event_id: e.id,
            event: toLocal(value, s.time_zone),
            base: value,
          });
          report.pulled++;
        }
      complete = !report.partial && report.conflicts.length === 0;
      return report;
    } finally {
      await this.store.write("release", { complete }).catch(() => undefined);
    }
  }
}
export async function syncRuntime(admin: SupabaseClient, service: CalendarService, owner: Owner) {
  await service.authorize(owner);
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("generation,status")
    .eq("user_id", owner.userId)
    .eq("empresa_id", owner.empresaId)
    .maybeSingle();
  if (error || data?.status !== "connected") throw new CalendarError("reconnect_required", 409);
  const store = new SyncRepository(admin, owner, data.generation, () => service.authorize(owner));
  const api = new EventsApi(() => service.accessToken(owner));
  return { sync: new CalendarSync(store, api, `${owner.userId}:${owner.empresaId}`), api };
}
