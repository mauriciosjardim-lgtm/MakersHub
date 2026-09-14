# Google Calendar: bidirectional pilot

The existing verified-user feature flag still gates every endpoint. The pilot chooses an owned, non-primary Google calendar named `MAKERShub - Testes`. It imports supported events from that calendar into the user's company agenda. New manual events created by the pilot user are enrolled automatically; project/task-generated events and older local events are excluded.

## Behavior

Title, description, location, start/end, all-day status and deletions synchronize both ways. Google attendees, invitations, attachments, reminders and recurrence rules are not mapped. Recurring, locked and special Google events are skipped. All-day dates use the selected calendar time zone and Google's exclusive end date. The current local event editor remains a date/time editor; preserve all-day boundaries when editing an imported all-day event.

Sync runs every 60 seconds while the Agenda page is visible, plus the compact `Atualizar` button. This is not background synchronization when the page is closed. The interface otherwise shows only `Conectar agenda`, with short errors and conflict choices when action is required. Disconnect/flag shutdown stops subsequent operations and preserves mappings and events for reconnect.

## Consistency and access

Service-only metadata tables have RLS and no browser grants. The write RPC checks user/tenant/session, current connected OAuth generation and an expiring per-user lease. Local updates increment a database-controlled revision; imported updates/deletes compare that revision and commit the event and baseline atomically. External writes use Google ETags and `If-Match`.

Three-way comparison uses the last acknowledged payload. Independent edits or edit-versus-delete return a conflict; no last-writer-wins overwrite. Explicit resolution includes a fresh fingerprint. JSONB key ordering does not affect payload equality. Deterministic Google IDs, persisted remapping before recreation, private markers and retained tombstones prevent duplicate insertion after uncertain responses.

The pilot reads complete paginated snapshots before mutations and confirms missing Google events individually. Local reads use keyset pagination. Limits: 300 lifetime mappings, 1,000 local or remote snapshot events, 20 enrollments per request; oversized snapshots fail closed. Processing is bounded to 25 seconds after snapshot collection, with a 120-second lease and a fresh lease/revision check before remote writes. Partial runs ask the user to continue. A request already in flight can finish during disconnect; subsequent requests and local commits revalidate access.

## Validation

`bun test src/lib/google-calendar` covers OAuth plus reconciliation, duplication recovery, conflicts, edit/delete cases, all-day DST round trips, ETags, incomplete snapshots and access shutdown. `tests/integration/google-calendar-sync-storage.sql` exercises lease/CAS/isolation/idempotence against Supabase using synthetic events within a rolled-back transaction. Run it before selecting the pilot calendar; it intentionally refuses to overwrite an existing configuration.

Migration `20260914134620_google_calendar_bidirectional.sql` was applied and its SQL fixture passed on 2026-09-14. Existing OAuth connection remained connected. Table/RPC browser grants are absent. Supabase advisor reports INFO `rls_enabled_no_policy` for these private server tables, expected by design; unrelated existing project warnings were not changed. See [Supabase RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Rollback: set `GOOGLE_CALENDAR_ENABLED=false` through the normal release process, or disconnect the pilot account. Do not drop mappings or delete calendar events to roll back code. Resume with the same Google account and calendar.

References: [Google conditional modifications](https://developers.google.com/workspace/calendar/api/guides/version-resources), [Google event pagination](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Supabase function privileges](https://supabase.com/docs/guides/database/functions).
