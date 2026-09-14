import { z } from "zod";
import { CalendarError } from "./protocol";
import { type RemoteEvent, type SyncValue, toGoogle } from "./sync-model";
const calendarSchema = z.object({
  id: z.string(),
  summary: z.string(),
  primary: z.boolean().optional(),
  accessRole: z.string(),
  timeZone: z.string().default("UTC"),
});
export type GoogleCalendar = z.infer<typeof calendarSchema>;
export function isTestCalendar(c: GoogleCalendar) {
  return !c.primary && c.accessRole === "owner" && /^makershub.*test/i.test(c.summary);
}
export class EventsApi {
  constructor(
    private token: () => Promise<string>,
    private http: typeof fetch = fetch.bind(globalThis),
  ) {}
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    etag?: string,
  ): Promise<Response> {
    const token = await this.token();
    let r: Response;
    try {
      r = await this.http(`https://www.googleapis.com/calendar/v3/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(etag ? { "If-Match": etag } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new CalendarError("google_unavailable", 503);
    }
    if (r.status === 401) throw new CalendarError("reconnect_required", 409);
    if (r.status === 412) throw new CalendarError("event_changed", 409);
    if (r.status === 429 || r.status >= 500) throw new CalendarError("google_retry_later", 503);
    return r;
  }
  async calendars(): Promise<GoogleCalendar[]> {
    const all: GoogleCalendar[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const q = new URLSearchParams({
        minAccessRole: "owner",
        maxResults: "250",
        ...(page ? { pageToken: page } : {}),
      });
      const r = await this.request(`users/me/calendarList?${q}`);
      if (!r.ok) throw new CalendarError("calendar_access_denied", 403);
      const data = z
        .object({
          items: z.array(calendarSchema).default([]),
          nextPageToken: z.string().optional(),
        })
        .parse(await r.json());
      all.push(...data.items);
      page = data.nextPageToken;
      if (!page) return all.filter(isTestCalendar);
    }
    throw new CalendarError("calendar_limit", 409);
  }
  async calendar(id: string) {
    const r = await this.request(`users/me/calendarList/${encodeURIComponent(id)}`);
    if (!r.ok) throw new CalendarError("calendar_access_denied", 403);
    const c = calendarSchema.parse(await r.json());
    if (!isTestCalendar(c)) throw new CalendarError("test_calendar_required", 403);
    return c;
  }
  async list(id: string): Promise<RemoteEvent[]> {
    const all: RemoteEvent[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const q = new URLSearchParams({
        maxResults: "250",
        showDeleted: "true",
        singleEvents: "false",
        ...(page ? { pageToken: page } : {}),
      });
      const r = await this.request(`calendars/${encodeURIComponent(id)}/events?${q}`);
      if (!r.ok) throw new CalendarError("calendar_access_denied", 403);
      const data = (await r.json()) as { items?: RemoteEvent[]; nextPageToken?: string };
      if (data.items && !Array.isArray(data.items))
        throw new CalendarError("google_response_invalid", 502);
      all.push(...(data.items ?? []));
      if (all.length > 1000) throw new CalendarError("calendar_limit", 409);
      page = data.nextPageToken;
      if (!page) return all;
    }
    throw new CalendarError("calendar_limit", 409);
  }
  private path(c: string, e: string) {
    return `calendars/${encodeURIComponent(c)}/events/${encodeURIComponent(e)}`;
  }
  async get(c: string, id: string): Promise<RemoteEvent | null> {
    const r = await this.request(this.path(c, id));
    if (r.status === 404 || r.status === 410) return null;
    if (!r.ok) throw new CalendarError("google_unavailable", 503);
    return (await r.json()) as RemoteEvent;
  }
  async put(
    c: string,
    id: string,
    value: SyncValue,
    zone: string,
    linkId: string,
    previous: RemoteEvent | null,
  ): Promise<RemoteEvent> {
    if (previous && !previous.etag) throw new CalendarError("event_changed", 409);
    const body = toGoogle(value, zone);
    const r = await this.request(
      previous
        ? `${this.path(c, id)}?sendUpdates=none`
        : `calendars/${encodeURIComponent(c)}/events?sendUpdates=none`,
      previous ? "PATCH" : "POST",
      previous
        ? body
        : {
            ...body,
            id,
            extendedProperties: { private: { makershubLink: linkId } },
            reminders: { useDefault: false },
          },
      previous?.etag,
    );
    if (r.status === 409 && !previous) {
      const found = await this.get(c, id);
      if (
        found?.status !== "cancelled" &&
        found?.extendedProperties?.private?.makershubLink === linkId
      )
        return found;
      throw new CalendarError("event_changed", 409);
    }
    if (!r.ok) throw new CalendarError("google_unavailable", 503);
    return (await r.json()) as RemoteEvent;
  }
  async remove(c: string, event: RemoteEvent) {
    if (!event.etag) throw new CalendarError("event_changed", 409);
    const r = await this.request(
      `${this.path(c, event.id)}?sendUpdates=none`,
      "DELETE",
      undefined,
      event.etag,
    );
    if (!r.ok && r.status !== 404 && r.status !== 410)
      throw new CalendarError("google_unavailable", 503);
  }
}
