import { describe, expect, test } from "bun:test";
import { CalendarSync, eventId, type SyncStore } from "./sync.server";
import { EventsApi, isTestCalendar } from "./events.server";
import { CalendarError } from "./protocol";
import {
  decide,
  equal,
  fromLocal,
  fromRemote,
  toGoogle,
  toLocal,
  type LocalEvent,
  type RemoteEvent,
  type SyncLink,
  type SyncSettings,
  type SyncValue,
} from "./sync-model";
const value: SyncValue = {
  title: "Teste",
  description: "",
  location: "",
  allDay: false,
  start: "2026-09-15T12:00:00.000Z",
  end: "2026-09-15T13:00:00.000Z",
};
const settings: SyncSettings = {
  user_id: "u",
  empresa_id: "tenant",
  calendar_id: "test",
  calendar_name: "MAKERShub - Testes",
  time_zone: "America/Sao_Paulo",
  last_synced_at: null,
};
function local(v = value): LocalEvent {
  return {
    id: "local",
    empresa_id: "tenant",
    ...toLocal(v, settings.time_zone),
    ref_tipo: null,
    calendar_revision: 1,
  };
}
function remote(v = value, id = "remote"): RemoteEvent {
  return { id, etag: '"1"', ...toGoogle(v, settings.time_zone) };
}
function link(base: SyncValue | null = value): SyncLink {
  return {
    id: "6f81d0bd-d204-4c09-bb90-fc38bded0630",
    user_id: "u",
    empresa_id: "tenant",
    calendar_id: "test",
    local_event_id: "local",
    google_event_id: "remote",
    base,
    pending: !base,
    deleted: false,
  };
}
class Store implements SyncStore {
  rows: LocalEvent[] = [local()];
  maps: SyncLink[] = [link()];
  actions: string[] = [];
  locked = false;
  failAck = false;
  deny = false;
  async settings() {
    return settings;
  }
  async links() {
    return structuredClone(this.maps);
  }
  async events() {
    return structuredClone(this.rows);
  }
  async write(action: string, d: Record<string, unknown> = {}) {
    this.actions.push(action);
    if (this.deny) throw new CalendarError("access_denied", 403);
    if (action === "claim") {
      if (this.locked) throw new CalendarError("sync_in_progress", 409);
      this.locked = true;
      return;
    }
    if (action === "release") {
      this.locked = false;
      return;
    }
    const l = this.maps.find((l) => l.id === d.id);
    if (action === "heartbeat" || action === "apply") {
      const e = this.rows.find((e) => e.id === l?.local_event_id);
      if ((e?.calendar_revision ?? null) !== d.revision)
        throw new CalendarError("event_changed", 409);
    }
    if (action === "remap" && l) {
      l.google_event_id = String(d.google_event_id);
      l.pending = true;
    }
    if (action === "apply" && l) {
      const prev = this.rows.find((e) => e.id === l.local_event_id);
      this.rows = this.rows.filter((e) => e.id !== l.local_event_id);
      if (d.event)
        this.rows.push({
          ...local(),
          ...(d.event as object),
          id: l.local_event_id,
          calendar_revision: (prev?.calendar_revision ?? 0) + 1,
        });
    }
    if ((action === "apply" || action === "ack") && l) {
      if (this.failAck) {
        this.failAck = false;
        throw new Error("lost write");
      }
      l.base = d.base as SyncValue | null;
      l.pending = false;
      l.deleted = !d.base;
    }
    if (action === "import") {
      if (this.maps.some((l) => l.google_event_id === d.google_event_id)) return;
      this.rows.push({ ...local(), ...(d.event as object), id: String(d.local_event_id) });
      this.maps.push({
        ...link(d.base as SyncValue),
        id: String(d.id),
        local_event_id: String(d.local_event_id),
        google_event_id: String(d.google_event_id),
      });
    }
  }
}
function harness(store = new Store()) {
  const events = new Map<string, RemoteEvent>([["remote", remote()]]);
  const writes: { method: string; headers: Headers; body: Record<string, unknown> | null }[] = [];
  let serial = 1;
  let failList = false;
  let beforeWrite: (() => void) | undefined;
  let tokenCalls = 0;
  const http = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    expect(init?.redirect).toBe("manual");
    if (url.pathname.includes("calendarList"))
      return Response.json({
        id: "test",
        summary: settings.calendar_name,
        accessRole: "owner",
        timeZone: settings.time_zone,
      });
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    if (id === "events" && method === "GET")
      return failList
        ? new Response(null, { status: 503 })
        : Response.json({ items: [...events.values()] });
    if (method === "GET")
      return events.has(id) ? Response.json(events.get(id)) : new Response(null, { status: 404 });
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const headers = new Headers(init?.headers);
    beforeWrite?.();
    if (method !== "POST" && events.get(id)?.etag !== headers.get("If-Match"))
      return new Response(null, { status: 412 });
    writes.push({ method, headers, body });
    if (method === "DELETE") {
      events.set(id, { id, status: "cancelled", etag: `"${++serial}"` });
      return new Response(null, { status: 204 });
    }
    const key = method === "POST" ? body.id : id;
    if (method === "POST" && events.has(key)) return new Response(null, { status: 409 });
    const saved = { ...(events.get(key) ?? {}), ...body, id: key, etag: `"${++serial}"` };
    events.set(key, saved);
    return Response.json(saved);
  }) as typeof fetch;
  const api = new EventsApi(async () => {
    tokenCalls++;
    if (store.deny) throw new CalendarError("access_denied", 403);
    return "fake-token";
  }, http);
  return {
    store,
    events,
    writes,
    api,
    sync: new CalendarSync(store, api, "tenant:u"),
    failList: () => {
      failList = true;
    },
    beforeWrite: (f: () => void) => {
      beforeWrite = f;
    },
    tokenCalls: () => tokenCalls,
  };
}
describe("three-way calendar reconciliation", () => {
  test("JSONB key order does not change equality", () => {
    expect(
      equal(value, {
        end: value.end,
        start: value.start,
        location: "",
        description: "",
        title: "Teste",
        allDay: false,
      }),
    ).toBe(true);
  });
  test("decision matrix includes edit/delete conflicts", () => {
    const changed = { ...value, title: "Changed" },
      other = { ...value, title: "Other" };
    expect(decide(value, value, value)).toBe("none");
    expect(decide(value, changed, value)).toBe("push");
    expect(decide(value, value, changed)).toBe("pull");
    expect(decide(value, changed, other)).toBe("conflict");
    expect(decide(value, null, changed)).toBe("conflict");
    expect(decide(value, changed, null)).toBe("conflict");
    expect(decide(value, null, value)).toBe("push");
    expect(decide(value, value, null)).toBe("pull");
    expect(decide(value, null, null)).toBe("ack");
    expect(decide(null, value, null, true)).toBe("push");
  });
  test("all-day exclusive ends round trip in several zones", () => {
    for (const zone of [
      "America/Sao_Paulo",
      "America/New_York",
      "Asia/Tokyo",
      "Pacific/Auckland",
    ]) {
      const v = { ...value, allDay: true, start: "2026-03-08", end: "2026-03-10" };
      expect(fromLocal({ ...local(), ...toLocal(v, zone) }, zone)).toEqual(v);
      expect(fromRemote(remote(v))).toEqual(v);
    }
  });
  test("invalid duration and recurring events are rejected", () => {
    expect(() => fromRemote(remote({ ...value, end: value.start }))).toThrow();
    expect(() => fromRemote({ ...remote(), recurrence: ["RRULE:FREQ=DAILY"] })).toThrow(
      "unsupported_event",
    );
  });
  test("only owned dedicated secondary calendars qualify", () => {
    const c = { id: "x", summary: settings.calendar_name, accessRole: "owner", timeZone: "UTC" };
    expect(isTestCalendar(c)).toBe(true);
    expect(isTestCalendar({ ...c, primary: true })).toBe(false);
    expect(isTestCalendar({ ...c, accessRole: "reader" })).toBe(false);
  });
  test("deterministic provider IDs are tenant scoped and valid", async () => {
    const a = await eventId("tenant-a:event");
    expect(a).toMatch(/^[0-9a-v]{64}$/);
    expect(await eventId("tenant-a:event")).toBe(a);
    expect(await eventId("tenant-b:event")).not.toBe(a);
  });
  test("pushes local edit once with ETag and no invitations", async () => {
    const h = harness();
    h.store.rows[0].titulo = "Local edit";
    expect((await h.sync.run()).pushed).toBe(1);
    expect((await h.sync.run()).pushed).toBe(0);
    expect(h.writes[0].headers.get("If-Match")).toBe('"1"');
    expect(h.writes[0].body?.attendees).toBeUndefined();
    expect(h.events.get("remote")?.summary).toBe("Local edit");
    expect(h.tokenCalls()).toBeGreaterThan(1);
  });
  test("pulls Google edit and deletion without echo", async () => {
    const h = harness();
    h.events.set("remote", remote({ ...value, title: "Google edit" }));
    expect((await h.sync.run()).pulled).toBe(1);
    expect(h.store.rows[0].titulo).toBe("Google edit");
    expect((await h.sync.run()).pushed).toBe(0);
    h.events.set("remote", { id: "remote", status: "cancelled", etag: '"2"' });
    expect((await h.sync.run()).pulled).toBe(1);
    expect(h.store.rows).toHaveLength(0);
    expect(h.store.maps[0].deleted).toBe(true);
    expect((await h.sync.run()).pulled).toBe(0);
  });
  test("local deletion propagates once", async () => {
    const h = harness();
    h.store.rows = [];
    expect((await h.sync.run()).pushed).toBe(1);
    expect(h.events.get("remote")?.status).toBe("cancelled");
    await h.sync.run();
    expect(h.writes).toHaveLength(1);
  });
  test("conflicts require a fresh explicit resolution", async () => {
    const h = harness();
    h.store.rows[0].titulo = "Local edit";
    h.events.set("remote", remote({ ...value, title: "Google edit" }));
    const conflict = (await h.sync.run()).conflicts[0];
    expect(conflict).toBeDefined();
    expect(h.writes).toHaveLength(0);
    await expect(h.sync.run({ ...conflict, fingerprint: "stale", side: "local" })).rejects.toThrow(
      "event_changed",
    );
    expect((await h.sync.run({ ...conflict, side: "google" })).pulled).toBe(1);
    expect(h.store.rows[0].titulo).toBe("Google edit");
  });
  test("edit versus deletion can recreate Google with a new persisted ID", async () => {
    const h = harness();
    h.store.rows[0].titulo = "Keep local";
    h.events.set("remote", { id: "remote", status: "cancelled", etag: '"2"' });
    const conflict = (await h.sync.run()).conflicts[0];
    await h.sync.run({ ...conflict, side: "local" });
    expect(h.store.maps[0].google_event_id).not.toBe("remote");
    expect(h.store.actions.indexOf("remap")).toBeLessThan(h.store.actions.lastIndexOf("ack"));
    expect(h.events.size).toBe(2);
  });
  test("crash after insert but before baseline acknowledgment does not duplicate", async () => {
    const h = harness();
    h.events.clear();
    h.store.maps = [link(null)];
    h.store.failAck = true;
    await expect(h.sync.run()).rejects.toThrow("lost write");
    expect(h.events.size).toBe(1);
    await h.sync.run();
    expect(h.events.size).toBe(1);
    expect(h.writes).toHaveLength(1);
    expect(h.store.maps[0].pending).toBe(false);
  });
  test("imports Google events once and never exports unrelated local events", async () => {
    const h = harness();
    h.store.maps = [];
    await h.sync.run();
    await h.sync.run();
    expect(h.store.rows).toHaveLength(2);
    expect(h.store.maps).toHaveLength(1);
    expect(h.writes).toHaveLength(0);
  });
  test("incomplete remote snapshot never deletes local events", async () => {
    const h = harness();
    h.failList();
    await expect(h.sync.run()).rejects.toThrow("google_retry_later");
    expect(h.store.rows).toHaveLength(1);
    expect(h.writes).toHaveLength(0);
    expect(h.store.locked).toBe(false);
  });
  test("recurring events and orphan managed markers are skipped", async () => {
    const h = harness();
    h.events.set("repeat", { ...remote(value, "repeat"), recurrence: ["RRULE:FREQ=DAILY"] });
    h.events.set("orphan", {
      ...remote(value, "orphan"),
      extendedProperties: { private: { makershubLink: "unknown" } },
    });
    expect((await h.sync.run()).skipped).toBe(2);
    expect(h.store.rows).toHaveLength(1);
  });
  test("concurrent remote modification fails conditional update", async () => {
    const h = harness();
    h.store.rows[0].titulo = "Local";
    h.beforeWrite(() =>
      h.events.set("remote", { ...remote({ ...value, title: "Concurrent" }), etag: '"new"' }),
    );
    await expect(h.sync.run()).rejects.toThrow("event_changed");
    expect(h.store.maps[0].base?.title).toBe("Teste");
    expect(h.events.get("remote")?.summary).toBe("Concurrent");
  });
  test("session/flag shutdown and concurrent runs cannot mutate", async () => {
    const h = harness();
    h.store.deny = true;
    await expect(h.sync.run()).rejects.toThrow("access_denied");
    expect(h.writes).toHaveLength(0);
    h.store.deny = false;
    h.store.locked = true;
    await expect(h.sync.run()).rejects.toThrow("sync_in_progress");
    expect(h.writes).toHaveLength(0);
  });
});

test("Google pagination completes before returning a snapshot", async () => {
  const pages: string[] = [];
  const api = new EventsApi(async () => "fake", (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    pages.push(url.searchParams.get("pageToken") ?? "first");
    return Response.json(
      pages.length === 1
        ? { items: [remote()], nextPageToken: "next" }
        : { items: [remote(value, "second")] },
    );
  }) as typeof fetch);
  expect(await api.list("test")).toHaveLength(2);
  expect(pages).toEqual(["first", "next"]);
});
test("page two failure rejects the entire Google snapshot", async () => {
  let calls = 0;
  const api = new EventsApi(async () => "fake", (async () =>
    ++calls === 1
      ? Response.json({ items: [remote()], nextPageToken: "next" })
      : new Response(null, { status: 429 })) as typeof fetch);
  await expect(api.list("test")).rejects.toThrow("google_retry_later");
});
test("concurrent local update is not overwritten by an import", async () => {
  const h = harness();
  h.events.set("remote", remote({ ...value, title: "Google edit" }));
  h.store.events = async () => {
    const snapshot = structuredClone(h.store.rows);
    h.store.rows[0].calendar_revision++;
    h.store.rows[0].titulo = "Concurrent local";
    return snapshot;
  };
  await expect(h.sync.run()).rejects.toThrow("event_changed");
  expect(h.store.rows[0].titulo).toBe("Concurrent local");
  expect(h.store.maps[0].base).toEqual(value);
});
test("Google write without ETag is rejected before fetching", async () => {
  const h = harness();
  await expect(
    h.api.put("test", "remote", value, "UTC", "link", { ...remote(), etag: undefined }),
  ).rejects.toThrow("event_changed");
  expect(h.writes).toHaveLength(0);
});
