# Foundation status

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](../CHANGELOG.md).

The first milestone is a runnable local workspace with real integration adapters and a simulated outbound execution path.

## 27 October 2026 - release 0.4.0: guided local setup

- Replaced `.env`/terminal instructions in Settings with credential selection, service-account email copying, spreadsheet URL/ID, a read-only access/data check and a checked connection action. Missing control tabs are created only on connection. Checks expire and cannot be reused; changed current/target data requires a fresh check.
- Local setup choices and credentials save through existing encrypted private storage and reload on startup. Activation switches the app to real Sheets mode immediately without importing demo data. Target campaigns and mailbox sending are paused and interrupted intents remain uncertain; concurrent mutations and requests from the old workspace cannot overwrite newly loaded state. Single-writer locking remains enforced.
- Added local buttons to start an installed Windows Ollama, download curated models with streamed progress/cancel/retry, and select compatible installed models. Successful model installation is verified before it is selected. No model was downloaded during automated testing.
- Management permissions protect setup; hosted/authenticated or explicit environment-only configurations disable local mutations. Advanced `BREKTRA_USE_ENV=1` preserves operator/test control. Existing real connections retain reconnect rather than exposing unsafe workspace switching.
- Updated setup documentation and packaging. Google account authorization, key creation, sheet sharing and first-time Ollama installation still require the user. Live Google/Ollama acceptance and browser visual verification remain unverified; tests use mocks/local HTTP and actual local encryption.

Validation: production build and all 101 automated checks pass (92 existing checks plus 9 setup checks), including read-only/expired/stale checks, safe activation, encryption/reload, permission denial and model failure/cancel/retry. Both distributions pass fresh-extraction verification with clean demo/setup status, private-file allowlists (26 Windows files, 20 server files), release/API/document identity, frontend serving, and bundled company preparation. Windows additionally verifies the setup UI asset, repeat-start reuse, shutdown, ownership reacquisition and demo reset. The server bundle rejects incomplete hosted configuration. No live send, actual model download or production workspace setup was performed; real provider and visual walkthrough checks remain unverified.

Artifacts: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip` and `D:\BREKTRA\release\BREKTRA-Server.tar.gz`. Both contain `LOCAL_SETUP.md`. Local source/documents are suitable for GitHub; private infrastructure and generated archives remain excluded by `.gitignore`.

## 27 October 2026 - release 0.3.0: company-preparation foundation

Implementation of the twelve-shard roadmap is authorized and started. This release delivers optional **single-company preparation**, not the completed shared-company MVP.

- Settings → Company setup provides a read-only complete-state preview, record counts, unresolved-send counts and conservative role mapping. Applying requires a backup acknowledgement, an unchanged state fingerprint and no in-flight send/generation. No production data migrates automatically.
- Added Companies, CompanyMemberships and immutable CompanyMigrations records. Scoped business records and historical input snapshots retain IDs, facts, reviews, provider IDs and uncertainty while gaining company ownership. Campaigns and mailbox sending are paused at cutover. Owned records use schema v2 so older apps reject them rather than silently discard scope.
- Validates ownership/reference closure, memberships and active admins. New single-company writes inherit scope; ownership edits/foreign references fail. Legacy team changes mirror into prepared memberships. Existing workspace permissions remain unchanged; the proposed company permission matrix is a tested contract only.
- Runtime refuses multiple/archived companies on load, mutation and reconnect before publishing or saving them. P1.2 API/service/worker isolation, P1.3 company switching and the remaining roadmap are not implemented.
- Added migration/downgrade/restore guidance and synchronized roadmap status. Source specification and existing uncommitted application work are preserved.

Baseline validation: build and all 73 existing checks passed; both 0.2.0 distribution workflows and fresh-extraction verifiers passed before editing. Foundation validation: build and 92 checks passed, including new ownership/migration/recovery checks, mocked atomic Sheets persistence and authenticated HTTP admin/stale-preview workflows.

Both 0.3.0 distribution bundles passed fresh-extraction verification: API/VERSION.txt release identity, clean initial state, frontend/assets, bundled document hashes, actual bundled demo company preview/apply and private-file allowlists (25 Windows files, 19 server files). Windows repeat-start reuse, shutdown, ownership reacquisition and demo reset passed; the server bundle rejected incomplete hosted configuration. These are local/demo packaging checks, not external deployment or live Google acceptance.

Artifacts: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip` and `D:\BREKTRA\release\BREKTRA-Server.tar.gz`. The archives include the roadmap and company migration guide; configured personal/runtime/company data is excluded. Existing configured copies need a restart to load rebuilt code.

Limits: no dedicated Google workspace credentials/recipient are configured here, so live Sheets mutation/backup restore, Gmail OAuth/recipient testing, actual Ollama and external deployment are unverified. A 5,000-lead CPU-only preview/preparation check measured 61/62 ms; it does not validate Sheets capacity or quotas. Browser visual verification was attempted but the automation tool stopped it because it could not verify the browser URL. No visual pass or multi-company privacy is claimed.

## 26 October 2026 - release 0.2.0 (update 2, patch 0)

Established MAJOR.UPDATE.PATCH numbering for the existing outreach feature set, using package.json as the source for UI/API and generated package metadata. Added current-release labels across maintained Markdown documents, a changelog, bundled ABOUT/version history, build-time consistency checking, and the standing requirement to keep versions aligned with actual delivered work. Earlier dated entries retain their historical meaning and validation limits.

Validation: version consistency across all 9 maintained Markdown documents, TypeScript/Vite build, and all 73 automated checks pass. Both distribution bundles passed fresh-extraction checks for matching API/VERSION.txt release numbers, clean workspace, frontend/assets, bundled document hashes, and private-file allowlists (23 Windows files and 17 server files). Windows launcher repeat-start reuse, shutdown, and ownership reacquisition passed; the server bundle rejected incomplete hosted configuration. No external service validation or new LinkedIn transport is implied.

Release paths: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip` and `D:\BREKTRA\release\BREKTRA-Server.tar.gz`. Archive names stay stable; each bundle contains VERSION.txt identifying 0.2.0.

## 25 October 2026 - outreach expansion and shared team server

The user authorized implementing the five missing product areas and selected Gmail/Google Workspace plus a single hosted workspace server accessed by teammate browsers, with Ollama on that server. `OUTREACH_EXPANSION_PLAN.md` records the scope and `HOSTED_SETUP.md` records setup/acceptance limits.

Implemented in source:

- Campaign-local sequence editor with ordered steps, delays, explicit enrollment, separate lead approval, per-message exact-version review, legacy-queue isolation, schedule/shared budgets, reply/opt-out/rejection stops and audited explicit resumption. Template values use supplied facts only. LinkedIn steps simulate in demo and remain blocked in real workspaces.
- Gmail API authorization-code/state/PKCE flow, encrypted server-side refresh/client credentials, explicit mailbox sending switch, shared budgets, plain-text MIME sending, stable Message-IDs, known rejection versus unknown-result handling, sent-copy reconciliation and audited admin not-sent resolution followed by another review. Gmail acceptance is never labeled recipient delivery. Real Google authorization has not been performed.
- One new Inbox navigation item: conversation list/pane, safe plain text, unread/done, team assignment, exact-text reviewed replies, scoped/paginated provider sync and duplicate prevention. New incoming messages invalidate stale reply approval. Manual replies stop automatic follow-ups. Closed, finished conversations stop consuming active tracking capacity. Incomplete sync blocks sending.
- Lead detail/evidence dialog with public HTTPS company-page metadata, listed website email evidence, domain MX checks, source/time and accept/reject. Private/reserved destinations, credentials/custom ports, oversized/invalid pages and unsafe redirects are blocked; DNS is pinned for the TLS connection. No guessed personal addresses/profile facts, paid enrichment database or deliverability guarantee. Imports can now use name plus email without a LinkedIn URL; such leads cannot enter LinkedIn steps.
- Explicit hosted mode: one Sheets-backed workspace/runner, HTTPS public-origin configuration, owner bootstrap, separate password sessions, expiring one-use invitation links, owner/admin/operator/reviewer/viewer permissions, session revocation, owner recovery and actor audit records. API guards cover original routes too; draft/sequence revision checks prevent stale team edits. All team roles read the shared workspace; assignments are not row-level privacy. No external hosting was provisioned.
- Progressive disclosure: only Inbox is added to navigation; sequences belong to campaigns, enrichment to lead details, and Gmail/team controls are collapsed in Settings. Original campaigns remain unchanged unless a sequence is enabled. Browser demo walkthrough verified Inbox-to-review and sequence setup, with layout checks at normal, 800px and 390px widths and no horizontal overflow. Screenshot: `docs/outreach-preview.png` (demo only).
- A clean hosted server bundle (`pnpm package:server`), startup/allowlist verifier (`pnpm verify:server`), environment template and optional Dockerfile. Docker execution and external DNS/TLS deployment remain unverified; Node bundle smoke tests are reported separately from real deployment.

Validation: TypeScript/Vite build and all 73 automated checks pass. The tests use stateful mocked Gmail/Sheets, local HTTP browser-session equivalents and real local credential encryption. They cover permissions, invitations/password changes, version conflicts, exact payloads, MIME/header safety, sync pagination/reply races, stopped/rejected/unknown sends, result-save failures/restart, SSRF guards, source evidence and email-only leads. No real invitation/email was sent. Fresh Windows ZIP extraction passed startup, health/workspace, frontend/assets, document hashes, repeat-start reuse, shutdown and ownership reacquisition. The server archive passed standalone bundle startup/API/frontend/document checks and rejected incomplete hosted configuration. All 19 Windows archive files and 13 server archive files matched their allowlists, excluding private credentials, sessions and runtime data. Docker and external TLS/Google deployment were not tested. All earlier entries below are historical.

Still required before live use: dedicated Sheets service testing; Google OAuth project/consent/test-user setup and any production verification; an intended test mailbox/recipient; hosted domain/TLS/private storage/backup deployment; actual hosted Ollama validation. Live LinkedIn login/profile checks/invitations/messages, source CRM writeback, Windows system notifications, advanced branching, paid/profile enrichment, multi-tenant SaaS/horizontal scaling and the remainder of the training-data privacy/export controls are not delivered by this expansion.

Release targets: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip` and `D:\BREKTRA\release\BREKTRA-Server.tar.gz`. Share these fresh allowlisted archives, never a configured working directory.

## 25 October 2026 - stage 1 backend implementation

The backend plan is now being implemented. Existing uncommitted application work was preserved. Stage 1's persistence/recovery foundation and the initial stage 8 collection hooks are implemented:

- Versioned, validated control records with legacy migration, duplicate/profile/action and reference checks, useful invalid-state errors, and no fallback overwrite of bad saved data.
- Incremental row writes/deletions and grid growth in one atomic Sheets batch. External-edit detection pauses mutations/dispatch until reconnect; lost commit responses reconcile from remote state. Google Sheets remains the only application database.
- OS ownership locks for the physical local workspace and control spreadsheet ID across ports/copies. Cross-computer simultaneous use remains unsupported.
- Original intent timestamps and conservative budget reservation for unresolved outbound jobs. Interrupted outbound intents remain uncertain and cannot automatically repeat. Interrupted generations fail instead. Pause/edit/opt-out/reconnect cancels stale generations, including fast pause/resume and opt-out reversals.
- Explicit default-off example collection; immutable generation-input snapshots, model/prompt/settings metadata, original drafts, linked human revision/review records, and optional API review reasons. Identical revision retries deduplicate; demo data stays labeled, rejected feedback remains negative, and switching collection off stops new text capture. Existing drafts get no invented history.
- Initial committed Activity event types and a computer-local desktop preference contract. Windows alerts remain unimplemented.
- Upgrade/recovery instructions in `PERSISTENCE.md`, bundled alongside the plan, notes and this status document. A reusable `scripts/verify-portable.ps1` checks the packaged release.

Validation: `pnpm build`, all 48 automated checks and `pnpm package:windows` pass. A fresh extraction outside the repository passed packaged startup, health identity, clean demo workspace, frontend/assets, document hashes, repeat-start reuse, shutdown and ownership reacquisition after forced stop. All 17 packaged files matched the release allowlist; credentials, `.env`, sessions, collected records, logs and runtime state were excluded. Current delivery: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip`. The entries below are historical releases.

Tests cover stateful mocked Sheets transactions, accepted-but-unacknowledged and rejected writes, invalid records/migrations/conflicts/deletions/restart, overlapping mutations, ownership, budgets, cancellation, and collection/review hooks. Dedicated live Sheets mutation/restart tests remain necessary before stage 1's real-service acceptance is complete. No live Sheets credentials, actual Ollama inference or LinkedIn actions were verified. No invitation or pitch was sent.

Remaining: stage 2 configuration UI/account sessions; stages 3-6 profile/client approval/CRM/live sending; stage 7 desktop notifications; stage 8 inspection/exclusion/deletion/retention/privacy-reviewed exports/evaluation splits; stage 9 service validation and practical size/quota benchmarks. Human-readable reasons can already be supplied through the review API; a review-reason UI remains future work.

## 25 October 2026 — future AI dataset planning

Added stage 8 to `BACKEND_IMPLEMENTATION_PLAN.md` for generation-input snapshots, original drafts, human revisions/reasons, separate lead/pitch decisions, verified outcomes, dedicated Sheets records, collection/privacy/deletion/retention controls, reviewed local exports and separate evaluation examples. Collection hooks start with backend stage 1 so early work can be captured; actual training remains a later decision. Final release validation is now stage 9. Updated working notes and their copies in `BREKTRA_Docs`. Dataset collection itself is not implemented.

Rebuilt the portable ZIP with the updated documents. Build and all 27 tests passed. A fresh extraction passed health/workspace, frontend/assets, document hashes, repeat-start process reuse, shutdown and private-file inspection. Current release: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip`; SHA-256: `26875B7B8E57D837C2842F1F04553041B32AF931813786B9D3AEDC16F728C11E`. This supersedes the archives recorded below.

## 25 October 2026 — notes, backend plan and portable rebuild

Later planning revision: rewrote `BACKEND_IMPLEMENTATION_PLAN.md` in plain language and added lead/client approval plus configurable Windows system notifications (review alerts, approval decisions, replies/acceptances, essential errors, reminders, quiet hours, privacy, sound, test notifications and background delivery). These remain planned features. Updated working notes and the copies in `BREKTRA_Docs`.

Rebuilt the portable package with these revised documents. Build and all 27 tests passed; a fresh extraction passed API/workspace, frontend/assets, document hashes, repeat-start reuse, shutdown and private-file inspection. No live integrations or notifications were implemented/tested. The current release supersedes the earlier archive below; current ZIP SHA-256: `D18560D9CB010CC4C046CAE6B73D9CEA080BBAFCE9AFBA42EB5A7219366B8835`.

The user scoped this step to documenting the live backend implementation plan and rebuilding the current app. No live backend features were added. See `WORKING_NOTES.md` for standing requirements and `BACKEND_IMPLEMENTATION_PLAN.md` for the phased implementation and acceptance criteria. Root `AGENTS.md` points future work to these documents; both documents are also copied to `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs` and bundled in the portable ZIP.

`pnpm package:windows` passed (TypeScript, Vite and portable bundling); `pnpm test` passed all 27 checks. A first packaging attempt encountered the running portable runtime's Windows file lock. The packager now reuses an existing runtime only when its bytes match the staged runtime, and the repeated build passed without stopping that app session.

A fresh ZIP extraction outside the repository passed startup, health identity, demo workspace, frontend/assets, packaged-document hash checks, repeat-start process reuse, and shutdown. The archive had 20 entries and no `.env`, credentials, sessions, runtime state or logs. Validation used the packaged PowerShell launch scripts with `-NoBrowser`; no interactive visual walkthrough or live integration validation was performed in this step.

Release: `D:\BREKTRA\release\BREKTRA-Windows-x64.zip`.
SHA-256: `5016325A0568389F5F3599EB46E95BE51D5004FD02B97EB0A6BB3049F400371D`.
Existing uncommitted application changes were preserved and included in this build. The previously running app needs a restart to load the rebuilt version.

## Delivered

- Six connected screens: dashboard, campaigns, leads, review queue, activity/jobs, settings.
- React frontend and Node API served from a single loopback port.
- Sample campaign flow and explicit demo-only outbound simulations.
- Google Sheets source preview/import and control persistence adapter.
- Ollama structured draft generation adapter and health checks.
- Queue eligibility, opt-outs, budgets, deduplication, intent recording, failure pause, and restart uncertainty handling.

## Earlier foundation sequence (superseded by BACKEND_IMPLEMENTATION_PLAN.md)

1. Validate real Sheets credentials, source mapping, persistence, and restart recovery against a test spreadsheet.
2. Validate Ollama quality/latency on representative supplied facts; record model/prompt versions.
3. Prove local LinkedIn session reuse, profile reads, relationship checks, and outcome verification behind the isolated adapter.
4. Add mapped status writeback to source CRM tabs with stable row lookup and reconciliation.
5. Add explicitly reviewed live action experiments only after the adapter can verify outcomes; retain uncertain states instead of retrying blindly.
6. Add acceptance/reply checks, automatic follow-up stops, session-expiry handling, and account controls.
7. Strengthen schema migrations, incremental control writes, single-process locking, and workspace-size benchmarks before scaling.
8. Expand templates, reporting, message variants, prompt versions, and multiple active accounts based on measurements.

## Validation limits

The production build and 22 automated checks pass. The browser walkthrough verified campaign creation/start, queue processing, draft editing/approval, and recorded simulated delivery. The narrow local preview was visually checked. Test-created demo state was cleared by restarting the server.

A portable Windows x64 ZIP includes the app, its Node runtime, double-click start/stop launchers, and software license notices. Startup, repeat-start reuse, stopping, and standalone operation from an extracted folder outside the repository were verified. The archive was checked to exclude credentials, `.env`, sessions, and runtime logs.

Automated tests use demo data and mocked persistence failures. Live Google credentials, real spreadsheet mutation, Ollama inference, and LinkedIn browser actions require separate integration validation. No LinkedIn message or invitation is sent by this codebase.
