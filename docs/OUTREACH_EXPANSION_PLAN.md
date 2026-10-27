# Outreach and hosted workspace implementation

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](../CHANGELOG.md).

Authorized 25 October 2026 (Asia/Karachi). This extends the original backend scope to sequences, Gmail outreach, an inbox, sourced enrichment and team access. Gmail/Google Workspace is the first mail provider. The user chose a single hosted workspace server with browser access and Ollama on that server. Google Sheets remains the persistent application database.

## Keep the interface focused

- Keep Dashboard, Campaigns, Leads, Review queue, Activity and Settings. Add only Inbox to the main navigation.
- Configure a short, ordered sequence from an individual campaign. Existing campaigns retain their current behavior until a sequence is explicitly enabled. Do not add a separate automation dashboard or visual graph editor.
- Show enrichment and evidence in a lead detail dialog. Suggested facts require acceptance; do not silently overwrite CRM data or claim that a website email belongs to a particular person.
- Keep email and sequence messages in the existing Review queue, distinguished by channel, recipient and step. Inbox uses a conversation list and a plain-text conversation pane. Team assignment lives on the conversation.
- Put Gmail connection, sending controls and team invitations/roles in collapsed Settings sections. Show the current user and hosted/local mode accurately. Hide controls unavailable to the user's role; enforce those restrictions in the API as well.

## Sequence execution

Store versioned sequence definitions, enrollments and immutable reviewed send actions in dedicated control tabs. Use ordered steps with delays, not arbitrary branching initially. A send requires exact recipient/subject/body approval. Edits invalidate approval. Opt-outs, rejections, replies and delivery issues stop remaining steps. Pauses stop new work; recording the result of an already attempted action must always remain possible.

Persist intent before contacting a provider. Use a stable RFC Message-ID per action. A failed result save or transport timeout is uncertain, never an automatic resend. Reconcile a sent copy where possible; absence of a sent copy alone does not prove non-delivery. Track Gmail acceptance separately from confirmed recipient delivery. Do not infer opens or delivery from an accepted API call.

Keep campaign schedules and budgets and add shared Gmail mailbox budgets. Sequence-enabled campaigns do not also run the legacy queue. Do not reset existing history on enabling or changing a sequence. Reply-stop and duplicate prevention must work across competing campaigns for the same contact. Delays start from the previous completed step; downtime cannot bypass review or budgets.

LinkedIn steps can be explored in demo mode, but live LinkedIn remains blocked until authenticated session/profile/read/action verification from original stages 2-6 is implemented. Do not disguise unavailable LinkedIn actions as sent. Gmail is the first live sequence channel.

## Gmail and inbox

Use Google's OAuth authorization-code flow, exact callback/state validation, offline refresh and the Gmail API. Request only mail-reading and mail-sending scopes needed by the feature. Store OAuth client secrets and refresh tokens server-side in protected local infrastructure, never in Sheets records, API responses, logs or portable archives. A disconnected/revoked account pauses sending. Connection does not enable sending; provide a separate explicit sending switch.

Synchronize only conversations with known workspace leads/tracked outreach, not every private message in the mailbox. Store bounded plain text and provider IDs in Sheets. Render text safely; never render arbitrary mail HTML or load tracking images. Detect replies before another step; incomplete/failed synchronization must block follow-ups. Deduplicate messages by mailbox and provider message ID. Persist assignment, unread state and conversation status. A reply composer goes through exact-text review before sending.

External Google OAuth registration, enabled Gmail API, test users, consent and any required production scope verification are deployment prerequisites. Automated tests use a provider double and intended test recipients must be supplied for real sending. Nothing in automated validation authorizes sending to real prospects.

## Enrichment

First release: explicit public company-page lookup and email-domain MX checks. Pin DNS-resolved public addresses, reject private/link-local/metadata destinations and non-HTTPS URLs, revalidate redirects, cap response size/time and do not execute scripts. Save source URL, checked time and exact extracted evidence. Website metadata is company evidence, not a verified personal job history. MX records establish domain mail configuration, not address deliverability. Do not guess email addresses. Keep provenance and an acceptance/rejection decision. Paid data-provider integrations and authenticated LinkedIn profile enrichment remain later adapters.

## Hosted teams

One hosted process controls one workspace/control spreadsheet and runs all jobs. Teammates use browsers against that same server. This replaces simultaneous desktop writers; no horizontally scaled writers or distributed Sheets locking is claimed. The local portable app stays loopback-only by default. Hosted mode is explicit and requires a configured HTTPS public origin, Sheets mode and authentication before exposing workspace data. TLS terminates at a trusted reverse proxy; do not trust arbitrary forwarded headers.

Store member profiles/roles and invitation records in Sheets; password hashes/session material are private infrastructure. Roles: owner, admin, operator, reviewer and viewer. Owners/admins manage membership, operators manage campaigns/leads and prepare work, reviewers can approve/reject exact drafts, viewers read only. Prevent removal of the last owner. Invitations are expiring, single-use links accepted by the invited person; no email is sent automatically. Sessions use HttpOnly cookies, expiry and revocation on member removal or password changes. Use origin checks, login throttling and no-cache responses. Log actor IDs for important changes.

Hosted setup requires a server/domain/TLS endpoint, dedicated service-account/control sheet, durable private secret storage/backups and an Ollama runtime/model on the server. Deployment and actual multi-browser external verification require those resources; local simulations are not a hosted deployment.

## Delivery and acceptance

1. Implement schemas/migrations and pure sequence/reply/budget/role rules first.
2. Add Gmail authorization/transport and protected secret storage; exercise accepted, rejected and ambiguous sends with test doubles.
3. Wire source-backed enrichment and inbox synchronization; prove stop-on-reply and duplicate handling.
4. Add hosted authentication/invitations/roles and enforce them on every API route.
5. Add contextual UI and empty states, preserving old campaign forms and data.
6. Test restart, conflicts, permissions, stale approvals, paused/opted-out work, partial sync, wrong OAuth state, unknown send outcomes and migration. Build before running tests.
7. Rebuild Windows portable ZIP, verify a fresh extraction and inspect the release allowlist. Provide hosted setup instructions; report actual external validation separately. Do not claim any undeployed or unauthenticated integration is live-verified.
