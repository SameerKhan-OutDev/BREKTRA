# Foundation status

The first milestone is a runnable local workspace with real integration adapters and a simulated outbound execution path.

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
