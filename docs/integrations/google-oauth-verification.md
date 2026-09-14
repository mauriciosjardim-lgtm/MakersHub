# Google OAuth verification packet

This is the source of truth for submitting the MakersHub Google Calendar integration.
The production project is `artful-winter-508611-e4` and the public app name is
`MakersHub`.

## Current classification

- Audience: External.
- Publishing status before submission: Testing, with one test user.
- Sensitive access: Google Calendar event access.
- Restricted access: none. An annual third-party security assessment is therefore not
  expected for the current scope set.
- Production origin: `https://makershub.app.br`.
- Authorized callback:
  `https://makershub.app.br/api/integrations/google-calendar/callback`.

## Exact Google Cloud configuration

Branding:

- App name: `MakersHub` (same spelling and capitalization as the site).
- Homepage: `https://makershub.app.br/lp` (public product page; `/` requires sign-in).
- Privacy policy: `https://makershub.app.br/privacidade`.
- Terms: `https://makershub.app.br/termos`.
- Authorized domain: `makershub.app.br`.
- Logo: the square MakersHub logo, 120 × 120 px, PNG, below 1 MB.
- Support email: an actively monitored address. Prefer `equipe@makershub.app.br` once
  it is available as a verified Google Account or Google Group; do not delay review if
  the current monitored project address is the only selectable option.
- Developer contacts: include an actively monitored owner address and keep it current.

Data Access must contain exactly:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.events.owned`

The Calendar list permission identifies the user's primary calendar and its time zone.
The owned-events permission reads and synchronizes events only on calendars owned by
the user. Do not add broader or future-use scopes.

OAuth client:

- Type: Web application.
- Keep JavaScript origins empty; this integration uses the server authorization-code
  flow.
- Keep only the production callback above. Development and staging clients belong in
  separate Google Cloud projects.

## Scope justification for the submission form

Paste and adapt only if the Google form separates the scopes:

### `calendar.calendarlist.readonly`

MakersHub uses this read-only scope to identify the Google account's primary calendar,
confirm that the connected user owns it, and read its configured time zone. This lets
the user connect without creating or manually selecting a separate MakersHub calendar.
The app does not modify the user's calendar list or sharing permissions. A narrower
scope cannot provide the primary-calendar and time-zone metadata required for correct
event synchronization.

### `calendar.events.owned`

MakersHub uses this scope to show and synchronize current and future events between the
MakersHub Agenda and the user's primary Google Calendar. When the user creates, edits,
or deletes a synchronized event in either service, MakersHub performs the corresponding
operation in the other service. The scope is limited to calendars owned by the user.
Read-only access would not support the user-facing two-way synchronization feature.

### `openid` and `email`

MakersHub uses these identity scopes during Calendar authorization to confirm that the
Google Account selected by the user matches the authenticated MakersHub account. The
Google identity is not used as a separate MakersHub sign-in method by this integration.

## Reviewer access instructions

The integration requires the Google Account selected during OAuth to have the same
email as the authenticated MakersHub account. Use Google's preferred reviewer-email
flow so this check remains active during review:

1. Submit the verification request with the demo video and navigation instructions.
2. When the verification team sends its reviewer email address, create a dedicated
   MakersHub account with that exact email, a temporary password and access to Agenda.
   Disable two-factor authentication for this temporary account.
3. Append its Supabase UUID to the comma-separated
   `GOOGLE_CALENDAR_ALLOWED_USER_IDS` Worker variable and deploy through the normal
   release process.
4. Reply to the verification email confirming that the reviewer address is enabled and
   provide the login URL and temporary password through that private channel.

Never send a real customer password. Include these navigation steps in the submission
and in the reply to the verification team:

1. Open `https://makershub.app.br/login` and sign in with the reviewer account.
2. Open `https://makershub.app.br/agenda`.
3. Select **Conectar agenda**, read the contextual data-use notice, and select
   **Continuar com Google**.
4. Choose the same Google reviewer account and grant the requested permissions.
5. Return to Agenda and select **Atualizar**.
6. Create an event in MakersHub and update to show it in the primary Google Calendar.
7. Create or edit an event in Google Calendar and update to show it in MakersHub.
8. Open **Configurações → Integrações** and show the connected account, privacy-policy
   link, and the disconnect/revocation control.

After the review closes, disconnect the temporary integration, remove the reviewer UUID
from the Worker variable and disable the temporary MakersHub account. After approval,
set the variable to `*` to open the integration to every eligible MakersHub user.

## Demonstration video script

Record one continuous, easy-to-follow video and upload it as an unlisted YouTube video
accessible to reviewers:

1. Begin on the public MakersHub homepage and show the app name, product description,
   Privacy Policy and Terms links.
2. Sign in to the production app and open Agenda.
3. Select **Conectar agenda** and pause on the MakersHub data-use notice.
4. Continue to Google. Set the consent-screen language to English and show the complete
   consent screen, app name, and every requested scope.
5. Grant access and show the return to the production callback and Agenda.
6. Demonstrate Google → MakersHub by creating an event in the primary Google Calendar,
   selecting **Atualizar**, and showing the event in MakersHub.
7. Demonstrate MakersHub → Google by creating or changing an event in MakersHub,
   selecting **Atualizar**, and showing the result in the primary Google Calendar.
8. Open Configurações → Integrações, show the privacy notice and demonstrate the
   disconnect confirmation. The final click may be omitted if preserving the test
   connection is necessary, but explain that it revokes Google access and deletes the
   stored OAuth credentials.

Avoid showing tokens, secrets, developer tools, database records, unrelated accounts,
or customer information.

## Submission order

1. Deploy this compliance release and verify the public homepage, privacy policy,
   terms, contextual notice, settings control, and both synchronization directions.
2. In Search Console, verify the Domain property `makershub.app.br` with the same Google
   account that is an Owner or Editor of the Cloud project. Keep the DNS verification
   record permanently.
3. In Google Auth Platform, align the app name, upload the logo, verify the URLs and
   contacts, and replace `calendar.events` with `calendar.events.owned`.
4. Disconnect and reconnect the pilot account so its stored grant contains the exact
   submitted scope set; repeat the two-way production test.
5. Record the demonstration video with the pilot account.
6. Change the External app from Testing to In production, select **Prepare for
   verification**, enter the scope justifications and video URL, then submit.
7. When Google sends the reviewer email address, provision and allowlist its matching
   MakersHub account using the instructions above.
8. Do not change the app name, logo, domains, client URLs, or scopes while review is in
   progress. Reply promptly to messages from `api-oauth-support@google.com`.

## Official references

- [Verification requirements](https://support.google.com/cloud/answer/13464321)
- [Submit an app for verification](https://support.google.com/cloud/answer/13461325)
- [Provide in-app testing access](https://support.google.com/cloud/answer/13807382)
- [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [OAuth production policy compliance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
- [OAuth security best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
