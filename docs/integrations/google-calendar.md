# Google Calendar pilot

## Implemented and verified

The OAuth connection stage was deployed in v0.8.19 through PR #20, initially disabled.
The server-side pilot is enabled for the fixed verified identity below. Bidirectional
event synchronization uses that Google account's primary calendar.
Set `GOOGLE_CALENDAR_ENABLED=false` to pause new integration operations.

Only the verified Supabase identity belonging to `mauriciosjardim@gmail.com` can
participate. Authorization uses its fixed UUID, not a client-provided email, admin
role, query parameter or localStorage setting. Anonymous and portal users are denied.

Implemented endpoints under `/api/integrations/google-calendar`:

- `GET /status`: authenticated connection metadata; no tokens.
- `POST /start`: authenticated, same-origin initiation with PKCE S256.
- `GET /callback`: single-use state and browser cookie validation, fresh identity,
  active Supabase session and current tenant checks before storing credentials.
- `POST /disconnect`: authenticated revocation and deletion, available with flag off.

OAuth state expires after ten minutes. The callback cookie is HttpOnly, Secure and
SameSite=Lax in production. Tokens and PKCE verifiers are encrypted with AES-256-GCM;
authenticated data binds ciphertext to its owner, tenant and connection generation.
Refresh uses a database lease and compare-and-swap writes. A stale callback or refresh
cannot resurrect a disconnected connection. Revocation failures retain encrypted
credentials in a blocked state for retry. Provider errors and credentials are never
returned to the browser or logged by this integration.

The Agenda shows `Conectar agenda` before authorization and a compact `Atualizar`
button after authorization. The first update chooses the primary calendar
automatically; the user does not need to create or select a MAKERShub calendar.

## Database

Migration `20260914125848_google_calendar_oauth_pilot.sql` was applied to the
Makers HUB Supabase project `smsqhbbbyjacatxvihks` on 2026-09-14.
Both new tables have RLS enabled and no browser policies. Table access and RPC
execution are limited to the service role. The service also checks user, tenant and
session on each operation. No real Google tokens or events were stored during setup.

The Supabase advisor reports informational `rls_enabled_no_policy` for these two
tables. This is intentional: browser roles must have no access. Do not add permissive
policies to silence it. See the [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Validation

- Unit and integration suite: 146 passing tests, 398 assertions.
- Coverage includes encryption integrity and owner isolation, OAuth replay/expiry,
  PKCE, wrong browser/account/tenant/session, flag shutdown, logout and disconnect
  races, refresh contention, revocation retry and sanitized provider failures.
- TypeScript, changed-file ESLint and production build passed.
- Built browser assets were checked for accidental credentials/server-code exposure.
- `tests/integration/google-calendar-storage.sql` exercises real database isolation
  and state consumption with synthetic records inside a transaction rolled back at
  the end. It requires an active pilot session and no existing pilot connection.
- Real Google consent and browser end-to-end connection have not yet been tested.

## Configuration and next steps, in order

1. OAuth consent scopes are configured in Google Cloud: `openid`, `email`,
   `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and
   `https://www.googleapis.com/auth/calendar.events`. Reassess scopes before public
   release against the final synchronization behavior.
2. Server secrets `GOOGLE_CALENDAR_CLIENT_SECRET` and
   `GOOGLE_CALENDAR_ENCRYPTION_KEY` are configured in Worker `nervon1` (2026-09-14).
   The encryption key is a base64-encoded random 32-byte key. The server
   also requires its existing `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`. Never expose secrets through VITE variables or Git.
   The downloaded OAuth JSON was verified and local `.dev.vars` prepared with mode
   0600, ignored by Git. Both Calendar secrets were created successfully in Cloudflare; the existing Supabase service-role secret was confirmed present. Preserve the
   encryption key securely; replacing it makes existing ciphertext unreadable.
3. Follow `docs/quality/release-readiness.md`: green PR, merge, version/tag and
   deployment of the exact published main commit through `bun run deploy`.
   The first disabled deployment was completed in v0.8.19.
4. Enable the pilot and sign in as `mauriciosjardim@gmail.com`. Connect the same
   Google account, check persisted status after reload, reject consent and reconnect,
   disconnect/revoke, and verify a second MAKERShub account has no access.
5. The initial synchronization imports current and future primary-calendar events.
   Private Google events are represented as `Ocupado` without their details.
6. Verify published homepage/privacy/terms, domain ownership and the actual data
   practices before requesting Google verification or any public rollout.

Google project: `artful-winter-508611-e4`. Calendar API is enabled. OAuth app is in
Testing and the pilot email is registered as a test user. Web client:
`890288732678-ej2mellqsjuglc22omi41rimop2kt7dr.apps.googleusercontent.com`.
Registered callback:
`https://makershub.app.br/api/integrations/google-calendar/callback`.
Two Google client secrets remain active; retire the old one only after validating
which credential the deployment uses. No existing secret was removed.

## References

- [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Calendar synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
