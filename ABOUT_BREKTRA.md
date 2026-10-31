# ABOUT BREKTRA

Current release: **0.12.3** (major 0 · update 12 · patch 2).

Windows first run: extract the complete release and open **Setup_BREKTRA.exe**. Its Obsidian Mint wizard checks the bundled runtime, installs/starts Ollama, downloads a supported model, guides account and Google Sheets setup, and opens BREKTRA after a readiness review. Google permissions and LinkedIn/Gmail authorization still require your actions. Use START BREKTRA for later quick launches. See [setup details](docs/LOCAL_SETUP.md).


The portable app keeps port **4310** instead of selecting another port. Stop old BREKTRA installations before starting a fresh one. Open `http://127.0.0.1:4310` on the host; teammates use the host LAN address shown in Settings. Team invitation links automatically use LAN addresses; select the correct network if several are offered. Reserve the host IP in your router to keep a lasting bookmark.

Sign in using your username or email. Choose a username when registering or accepting an invitation; existing users can add/change it in Team with their current password. Keep the configured installation’s `.runtime` folder when upgrading: a fresh extraction has separate registrations.

Feature overview as of 31 October 2026.

## Obsidian Mint appearance

Settings → Personalization offers Light, Dark (Obsidian Mint), and device appearance. Company/user names and navigation counts come from the workspace; local sessions use a device icon. Appearance is saved per browser.

## Summary

BREKTRA is a joint application by **Out Game Breakpoint** and **Terra Labs**. Its intended scope covers all game-development-related workflows for Out Game Breakpoint, and logistics-related workflows through LinkedIn and websites for Terra Labs.

BREKTRA is an outreach and lead-management workspace that combines a Google Sheets CRM, campaign management, local AI pitch writing, human message review, Gmail outreach, follow-up sequences, and a shared conversation inbox.

It runs as a portable Windows application accessed through a browser. It can also be configured as one authenticated hosted server for a team, with a shared workspace, job runner, and server-local Ollama model. Google Sheets remains the persistent application database.

Live LinkedIn automation is unfinished. Gmail sending is implemented, but real Google account and intended-recipient testing remains outstanding. Implemented integrations should not be treated as live-verified solely because automated tests pass.

## Implemented features

### Company ownership foundation (0.3.0)

- Settings preview of existing records and proposed member-role mapping; backup acknowledgement and stale-preview protection before applying.
- Explicit preparation of one company with scoped records, memberships and an immutable migration manifest. Original facts, IDs, approvals and uncertain send history are retained; campaigns and mailbox sending are paused.
- Ownership/reference validation, schema v2 protection against older apps discarding company scope, and failure/restart reconciliation.
- New single-company records inherit ownership; existing ownership cannot be silently changed. The server refuses multiple/archived companies until complete isolation is implemented.

This is the first company-preparation milestone, not completion of the twelve-shard roadmap. Current workspace roles/visibility remain unchanged. Company switching, independent permissions, SDR tasks, pipeline and workforce features remain planned. See [company migration](docs/COMPANY_MIGRATION.md).

### Dashboard and reporting

- Outreach totals and a seven-day activity chart.
- Recent activity and campaign visibility.
- Date filters for the last seven days, current month, current year, and custom dates.
- Distinction between simulated activity and verified live results.

### Campaign management

- Create and edit multiple campaigns.
- Select the source spreadsheet/tab and account for each campaign.
- Request-only, pitching-only, and balanced modes.
- Start and pause controls.
- Saved campaign name, description, company information, ideal customer profile, and selling context.
- Conversational, direct, and indirect pitch styles.
- Editable AI context prompt, pitch strategy, and sample messages.

### Scheduling, queues, and budgets

- Daily working hours and campaign timezones.
- Continuous running from a chosen start date/time until paused.
- Separate request and pitch queues.
- Round-robin campaign scheduling.
- Campaign daily limits and shared account/mailbox budgets.
- Reserved 50/50 request/pitch allocations for balanced campaigns; requests receive an odd extra action and unused allocations do not spill over.
- Eligibility checks, waiting reasons, cancellation, and explicit retry requirements for failed work.
- Active continuous campaigns can pick up newly imported eligible leads.

The app must remain running for scheduled work. Working-hour windows are same-day; overnight windows are not supported.

### Lead and prospect management

- Search people and companies.
- Filter leads by source, relationship, and opt-out state.
- Account-specific relationship records: connected, not connected, pending, or unknown.
- Supplied contact email, company website, notes, and profile information.
- Separate prospect approval/rejection before sequence outreach.
- Opt-outs and queued-work cancellation.
- Recorded reply stops and explicit, audited resumption controls.
- Email-only leads; these cannot enter LinkedIn steps.

### Google Sheets CRM

- Google service-account authentication.
- Source spreadsheet/tab preview and column mapping.
- Lead import with duplicate detection and invalid-row reporting.
- Import of name plus a LinkedIn URL or supplied email, with optional contextual fields.
- Persistent campaigns, decisions, drafts, jobs, conversations, team records, and other workspace data in dedicated control tabs.
- Import scope of columns A–AZ and up to 5,000 data rows.

Source CRM tabs are read-only. Reimporting adds new leads; it does not refresh existing records. Google Sheets is the only persistent application database.

### Local AI pitch generation

- Ollama connection and model health checks.
- Structured pitch generation from supplied lead facts and saved campaign instructions.
- Suitability decisions and supporting evidence alongside generated drafts.
- Model/prompt metadata capture where supported.
- Review required for every generated draft.
- Clearly labeled deterministic templates in demo mode.

The current app does not extract LinkedIn profiles. AI uses supplied facts. Actual model quality, latency, and hosted Ollama operation still require service validation.

### Draft and message review

- Review queue for pitches, sequence messages, and inbox replies.
- Evidence inspection and suitability review.
- Draft editing, approval, and rejection.
- Exact recipient, subject, and body approval for email actions.
- Revision checks; edits invalidate message approval.
- New incoming messages invalidate stale reply approval.
- Explicit simulated delivery in demo mode.

Approving a legacy LinkedIn pitch in a real workspace saves the decision without sending a LinkedIn message.

### Follow-up sequences

- Campaign-local sequence editor with ordered steps and configurable delays.
- Email, LinkedIn request, and LinkedIn message step definitions.
- Templates populated from supplied facts.
- Explicit enrollment of approved leads.
- Enrollment status and step progress.
- Exact-message review before outbound execution.
- Campaign schedules and shared budgets remain enforced.
- Stops for replies, opt-outs, rejection, and delivery issues.
- Explicit, reasoned resumption after a stop.
- Isolation from the legacy queue when a sequence is enabled.

Live Gmail is the implemented transport. LinkedIn steps simulate in demo and remain blocked in real workspaces. Arbitrary branching is not implemented.

### Gmail outreach

- Gmail/Google Workspace OAuth authorization with state and PKCE protection.
- Encrypted server-side client credentials and refresh tokens.
- Separate mailbox connection and sending enable/disable controls.
- Shared mailbox daily budgets.
- Reviewed plain-text email sending with stable Message-IDs.
- Distinction between provider acceptance, known rejection, and uncertain outcomes.
- Sent-copy reconciliation.
- Audited administrator resolution after independent verification that an uncertain message was not sent; another review is required before sending again.
- Mailbox synchronization and disconnection.

Gmail acceptance does not establish recipient delivery. Real sending requires configured Google OAuth, a real Sheets workspace, approved leads, an explicitly enabled mailbox, exact-message approval, and current dispatch checks. Real Google authorization and recipient testing remain outstanding.

### Conversation inbox

- Searchable conversation list and conversation pane.
- Inbound and outbound message history.
- Safe plain-text display without remote tracking images or arbitrary email HTML.
- Unread/read state and done/reopen controls.
- Team assignment.
- Synchronization limited to known workspace leads and tracked outreach.
- Provider-message deduplication and paginated synchronization.
- Reply composer that sends the exact reply to review first.
- Manual replies stop automatic follow-ups.
- Incomplete synchronization blocks sending.

### Company enrichment and evidence

- Explicit public HTTPS company-page lookup.
- Page title, summary, and listed email evidence.
- Email-domain MX checks.
- Source URL, checked time, and evidence acceptance/rejection.
- Network safeguards against private/reserved destinations and unsafe redirects, plus response limits and DNS pinning.

This is company-page evidence, not authenticated personal-profile enrichment. Website emails are not proof of personal ownership, and MX records do not verify address deliverability. The app does not guess email addresses.

### Shared team workspace

- Explicit hosted mode with one shared server, Sheets workspace, and runner.
- Individual password logins and owner bootstrap/recovery.
- Owner, admin, operator, reviewer, and viewer roles.
- Server-enforced permissions.
- Expiring, single-use invitation links; invitations are not automatically emailed.
- Member role changes and enable/disable controls.
- Password changes and session revocation.
- Protection against removing the last owner.
- Actor audit records and revision checks against stale edits.

All team members read the shared workspace; assignments do not provide row-level privacy. Hosting requires secure external configuration and has not been provisioned or externally validated. Independent desktop writers against the same spreadsheet and horizontal scaling are unsupported.

### Activity, persistence, and recovery

- Activity history and job queue with outcomes, waiting reasons, failures, cancellations, and uncertain states.
- Versioned, validated Sheets records and migration of older records.
- Incremental atomic saves and external-edit conflict detection.
- Reconnect/sync recovery.
- Local workspace/control-spreadsheet ownership locks.
- Persisted outbound intent before provider actions.
- Interrupted outbound actions become uncertain and cannot automatically resend; their budget remains reserved.
- Interrupted draft generation fails and requires explicit restart.
- Cancellation of stale generation results after pause, edit, opt-out, or reconnect.

### Future AI example collection

- Explicit, default-off collection switch.
- Generation-input snapshots and original drafts.
- Model, prompt, and generation-setting metadata.
- Linked human revisions, approval/rejection decisions, and optional feedback reasons.
- Dedicated Sheets tabs and deduplication of repeated revision capture.
- Demo labels and negative rejection feedback.
- Turning collection off stops new capture without inventing missing history.

Collection does not automatically export, upload, or train a model. Full privacy/export controls remain planned.

### Settings and service health

- Guided local setup: credential file picker, service-account email copying, spreadsheet URL/ID, read-only check, control-tab preparation and immediate Sheets activation with sending paused.
- Encrypted setup choices restored on startup; no `.env` editing or restart required for local setup choices.
- Buttons to start an installed Ollama, download supported models with progress/cancel/retry, and select installed models.

- Sheets, Ollama, and LinkedIn availability/status information.
- Account registration and daily budgets.
- Workspace reconnect/sync controls.
- Future AI example collection switch.
- Gmail OAuth configuration and mailbox controls.
- Hosted team invitations, roles, access controls, and password management.

Google permissions/sharing and initial Ollama installation require user action. Hosted/authenticated workspace configuration remains operator-managed. A status screen is not proof that an external integration has been verified. See [guided setup](docs/LOCAL_SETUP.md).

### Portable Windows app and demo

- Windows x64 package with bundled Node runtime.
- Double-click START and STOP launchers; recipients need no Node installation or terminal commands.
- Background server and browser-based interface.
- Repeated starts reopen the existing instance.
- Local loopback access by default.
- Sample leads, account, campaign, pitch, and simulated conversations/outreach.
- Demo data resets on server restart.
- Responsive interface with Dashboard, Campaigns, Leads, Review queue, Inbox, Activity, and Settings.

### Security and distribution

- Credentials and sessions remain server-side.
- Encrypted Gmail secrets and private authentication infrastructure.
- Origin/host checks and hosted authentication/permission enforcement.
- Clean allowlisted Windows and hosted-server release archives.
- Credentials, browser sessions, environment files, logs, and personal runtime data excluded from shareable releases.
- Hosted server bundle, environment template, setup documentation, and optional Dockerfile.

## Planned or incomplete features

| Area | Remaining work |
| --- | --- |
| Live LinkedIn | Authenticated login/session management, profile extraction, relationship verification, real invitations/messages, acceptance detection, and reply detection. |
| Source CRM writeback | Safely update mapped statuses in original source tabs while preserving formulas, formatting, dropdowns, and unrelated cells. |
| Windows notifications | Desktop alerts, persistent in-app notification list, reminders, category switches, quiet hours, privacy, sound, and background notification helper. |
| Complete AI dataset controls | Inspection, exclusion/deletion, retention, privacy-reviewed JSONL exports, and training/evaluation separation. Custom-model training is a later decision. |
| Advanced sequences | Branching beyond ordered steps and delays. |
| Advanced enrichment | Paid data-provider integrations and authenticated personal-profile enrichment. |
| Deployment and scale | External hosted deployment, actual multi-browser service validation, multi-tenant SaaS, and horizontal scaling. |

## Validation status

The latest setup implementation passes TypeScript/Vite build and 101 automated checks. Package verifiers cover fresh startup/shutdown, clean workspace, setup status, bundled setup UI, document hashes and the demo company-preparation workflow. These checks include mocked providers; they do not establish successful live outreach or multi-company privacy. Browser visual verification remains incomplete after the automation tool's URL-verification block.

Dedicated Google Sheets testing, real Gmail OAuth/mailbox/recipient testing, actual hosted Ollama operation, external domain/TLS deployment, and Docker execution remain unverified. Live LinkedIn sending is unavailable.

This document is a feature overview based on the repository, not a fresh test-run report.

## Project references

- [README](README.md)
- [Working notes](docs/WORKING_NOTES.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Backend implementation plan](docs/BACKEND_IMPLEMENTATION_PLAN.md)
- [Outreach expansion plan](docs/OUTREACH_EXPANSION_PLAN.md)
- [Hosted and Gmail setup](docs/HOSTED_SETUP.md)
- [Persistence and recovery](docs/PERSISTENCE.md)

## LinkedIn account connection (0.5.0)

0.6.0 adds an optional animated LinkedIn setup walkthrough. Start or skip it before opening; resume later from the saved step. Administrators follow app/product/callback/credential setup, while teammates reuse the configured application. One task is shown at a time, with keyboard navigation, reduced motion and inline recovery help. Browser-local progress stores no credentials. Illustrations do not operate LinkedIn; actual account authorization remains user-controlled and live outreach is unavailable. See [setup details](docs/LOCAL_SETUP.md).

Settings → LinkedIn accounts guides users through connecting their own account. An administrator creates a LinkedIn developer application, enables Sign In with LinkedIn using OpenID Connect, registers the exact callback shown in Settings, and saves the client ID/secret privately once per server. Teammates then use Connect LinkedIn and authorize on LinkedIn. A healthy persistent Sheets workspace is required; demo cannot save real connections. Connect an existing unused account label through the administrator selector to preserve campaign references. Hosted teammates use their own authenticated BREKTRA sessions and one shared HTTPS server; portable mode uses the host PC with optional trusted LAN browser access.

BREKTRA requests only openid/profile for account identity. It does not request posting or email permissions. Tokens stay encrypted on the server; users never paste cookies or LinkedIn passwords into BREKTRA. Expired/revoked connections need a new authorization; automatic refresh is not assumed. Read-only checks run approximately every 15 minutes while the app runs. Reconnect/disconnect/check controls apply to the owner; failed checks and disconnect pause campaigns. Disconnect removes the locally stored token; users can additionally revoke BREKTRA through LinkedIn permitted services.

Account connected does not mean outreach enabled. Invitations, messages and reply sync require separate approved access and remain disabled. Approved drafts can be copied and their lead profile opened for manual sending after current owner/approval/opt-out/reply checks; this does not record delivery or advance a sequence. Actual LinkedIn app/consent/callback testing remains unverified, including whether LinkedIn accepts the portable loopback callback. A registered HTTPS hosted origin may be needed; do not assume sign-in alone permits sending.

## Access from phones and other LAN devices (0.8.0)

Start BREKTRA on one PC. Portable startup enables BREKTRA_LAN=1 unless .env or the process environment sets it to 0. Open Settings → Access from other devices and use the WiFi/Ethernet IPv4 URL on devices connected to the same network. Keep the PC awake. All devices use this one workspace and runner; do not start another copy against the same Sheet.

Run ALLOW LAN ACCESS on the host PC and approve the Windows administrator prompt to permit BREKTRA through Windows Firewall. The rule permits only the bundled executable, the current app port and ten fallback ports, and LocalSubnet peers. It supports Public WiFi profiles without changing the profile or disabling the firewall. Guest WiFi/AP isolation may still prevent device-to-device connections. Addresses can change after reconnecting WiFi.

LAN mode uses HTTP and now requires a separate login for every browser. Create the initial administrator on the host PC; subsequent registrations need admin approval in Team. Roles apply to UI actions and API permissions. Team provides basic profiles and private member messages. Local registrations and access settings survive restart in encrypted authentication storage; demo messages reset. Sheets stores the lasting workspace team. Keep `.runtime` when upgrading this installation. Only use it on networks whose users you trust. Server credential/AI setup is restricted to the host PC browser. LinkedIn/Google callbacks remain loopback URLs; authorize accounts on the host PC. Use the authenticated HTTPS deployment for individual user accounts or access outside the LAN. Set BREKTRA_LAN=0 in .env and restart for PC-only access. The source/server entry point remains loopback by default unless explicitly enabled.
