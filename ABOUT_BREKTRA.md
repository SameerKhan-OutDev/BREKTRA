# ABOUT BREKTRA

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](CHANGELOG.md).

Feature overview as of 27 October 2026.

## Summary

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
