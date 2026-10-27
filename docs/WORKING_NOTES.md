# BREKTRA working notes

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](../CHANGELOG.md).

Updated: 27 October 2026 (Asia/Karachi).

## Version and patch numbering — standing requirement

Current version: **0.4.0**. Use `MAJOR.UPDATE.PATCH`; `package.json` is the single source for the app version. Major 0 identifies the pre-release product, not a completed live LinkedIn backend.

- Increment UPDATE for a release that adds working features or substantial functionality; reset PATCH to 0. Increment PATCH for fixes, small refinements, packaging changes, or documentation-only releases without new functionality. Increment MAJOR for a breaking release or a deliberately validated stable milestone; reset UPDATE and PATCH to 0.
- Choose the number according to what was actually completed. Plans, mock tests, or unverified integrations must never be presented as delivered live functionality. Do not bump separately for each file, test rerun, or rebuild of the same release.
- For every delivered change, update the version or patch number everywhere applicable: package metadata, current-release labels in README/ABOUT and maintained docs, changelog, implementation status, distributed document copies, and release metadata. App UI and API obtain the number from package metadata; package scripts generate VERSION.txt from it.
- Keep historical release entries, third-party dependency versions, persisted schema versions, sequence revisions, and model/prompt versions unchanged unless those specific things actually change. Application release numbering is separate from data schema numbering.
- Run the version consistency check (included in `pnpm build`), build/tests, both release packagers when applicable, and fresh-package verification. Confirm the API, VERSION.txt, bundled documents, and frontend identify the same release. Preserve the stable archive filenames; VERSION.txt identifies their contents.
- Keep the maintained copies of working notes and backend plan in `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs` synchronized. Do not rewrite original requirements or historical PDFs/images to imply they describe the current release.

## Standing delivery requirement

Always build changes into the Windows portable app. Updating source code or running the frontend build alone does not finish a change.

For each app change:

1. Read the current implementation and Git status; preserve existing user work.
2. Implement the requested change within the existing React/TypeScript/Express architecture.
3. Run `pnpm build` before `pnpm test`; the API tests serve built frontend files. Resolve failures introduced by the change and distinguish any pre-existing failures.
4. Run `pnpm package:windows`. This rebuilds the frontend and bundles the backend with a Windows x64 Node runtime.
5. Extract the resulting ZIP into a fresh folder and verify startup, `/api/health`, `/api/workspace`, frontend serving, repeat-start reuse, and shutdown using the packaged launchers.
6. Inspect archive contents for credentials, `.env`, sessions, logs, and runtime state. Ship only the clean allowlisted package.
7. Report the exact release path and validation results. Explain any unverified external integration; do not claim live functionality from demo tests.

Shareable artifact: `release/BREKTRA-Windows-x64.zip`.
Portable folder: `release/BREKTRA-Windows-x64`.
Never distribute a configured working folder containing personal credentials or sessions.

## Product requirements to retain

- Local browser-based workspace; loopback server and double-click Windows start/stop launchers. No Node installation or terminal steps for the recipient.
- Google Sheets CRM is the persistent database. Do not introduce SQLite, PostgreSQL, or a JSON application database without a scope change. Local settings, session files, and process locks are infrastructure, not an alternative application database.
- Select the source spreadsheet/tab and LinkedIn account per campaign. Support multiple campaigns, request-only, pitching-only, and balanced modes.
- Preserve working hours, continuous schedules with start time, shared account budgets, and balanced allocations. Keep the app awake/running for scheduled work.
- Preserve company, ICP, selling context, pitch style, editable context prompt, strategy, and samples through editing, persistence, and AI generation.
- Use supplied or verified profile facts; show evidence and require draft review. Clearly distinguish demo templates from real Ollama inference.
- Keep opt-outs, duplicate prevention, persisted execution intent, and uncertainty handling. Never automatically repeat an outbound action whose result is unknown.
- Dashboard totals must distinguish simulated activity from verified live requests, acceptances, and pitches, with usable date filters.
- Keep credentials server-side. Exclude credentials, browser sessions, `.env`, logs, and personal workspace data from release artifacts.
- Planned system notifications must cover pitch review, lead/client approval, acceptances/replies and essential errors, with configurable categories, reminders, quiet hours, privacy and sound in Settings. Keep an in-app notification list and verify Windows alerts while the app runs with its browser tab closed.
- Build future AI training-data collection alongside the backend: snapshot generation inputs, original drafts, human revisions/reasons, approval decisions and verified outcomes in dedicated Sheets tabs. Include collection/privacy/retention controls and reviewed local exports; exclude demo/rejected-as-positive records and separate evaluation examples. Keep using Ollama until custom training is separately chosen; collecting examples does not train a model automatically.

## Current state and scope

Release 0.4.0 adds **Settings → Real workspace setup**: local key-file selection, service email copy/share guidance, read-only Sheets checks, control-tab preparation and immediate demo-to-real activation without `.env` edits or a server restart. Credentials/configuration are encrypted infrastructure; Sheets remains the database. Activation never copies demo records, pauses target campaigns/mailboxes, reconciles interrupted intent, blocks competing mutations and rejects stale requests. Existing real connections use reconnect; switching between real workspaces is not exposed. Hosted/authenticated teams remain operator-managed. Local saved setup overrides local environment defaults; `BREKTRA_USE_ENV=1` opts into environment-only configuration and disables wizard changes.

Local AI setup has buttons to start a standard installed Windows Ollama, download supported models with progress/cancel/retry, and select installed models. Google authorization/sharing and first-time Ollama installation remain explicit user actions. Never bundle uploaded keys/private configuration or imply that mock setup tests validate real Google/Ollama operation. See `LOCAL_SETUP.md`.

On 27 October 2026 the user authorized implementation of the twelve-shard 0.3.0 roadmap. Work begins with the baseline and company foundation. Release 0.3.0 delivers reviewed **single-company ownership preparation**, not the full shared-company MVP: Settings preview/apply, company/membership/manifest records, immutable ownership and cross-reference validation, and a runtime gate that refuses additional/archived companies. Existing workspace permissions still govern access; company permission contracts are not active enforcement yet. See `UPDATE_0.3.0_IMPLEMENTATION_PLAN.md` for task status and `COMPANY_MIGRATION.md` for backup, schema v2, recovery and downgrade limits. No production workspace is migrated automatically.

Keep multiple companies disabled until all API projections, services, background jobs, callbacks, AI contexts and exports enforce company authorization and adversarial isolation tests pass. Do not infer tenant ownership from lead employer or campaign copy. The new roadmap requires a compliant, authorized integration before any live LinkedIn automation; it remains disabled. Keep Sheets as the database and one authoritative writer.

The repository already has an Express API, an in-memory demo, Google Sheets persistence/import, queue scheduling, reviewed drafts, and an Ollama adapter. `server/linkedin.ts` is a disconnected interface; there is no authenticated LinkedIn session or live delivery implementation.

Real source CRM tabs are currently read-only. Sheets mode prepares drafts; approval does not send a real pitch. Demo changes reset on restart. Do not relabel these behaviors as completed live backend work.

The later outreach expansion implements a Gmail transport, reviewed sequences, inbox, public company-page/MX evidence and a single-server authenticated team mode. Legacy LinkedIn approval still does not send. Gmail sequence/reply approval can permit real email only after a real Sheets workspace, Google OAuth connection, separate lead approval, an explicitly enabled mailbox and current dispatch checks. Do not disable or mislabel this new transport as demo-only, and do not claim it was live-verified: Google account/recipient testing and external hosted deployment are still outstanding. See `HOSTED_SETUP.md` and the latest `IMPLEMENTATION_STATUS.md` entry. Portable mode remains local by default; hosted teammates share one server, runner, Sheets workspace and server-local Ollama.

The user subsequently authorized beginning real backend development under `BACKEND_IMPLEMENTATION_PLAN.md`. Stage 1 now includes versioned validated records, incremental atomic Sheets writes, external-edit detection, local ownership locks, safer generation cancellation/recovery and opt-in dataset capture hooks. See `IMPLEMENTATION_STATUS.md` and `PERSISTENCE.md`. Stages 2-9 remain future work; real integrations still require dedicated service validation.

The later planning revision adds client approval and configurable Windows notifications to that future build. Client approval means approving a prospect for outreach, separately from pitch approval and invitation acceptance. This revision updates the plan; it does not implement those features yet.

## Environment and records

On 25 October 2026 the user also authorized sequences, email outreach, enrichment, an inbox and team management. They selected Gmail/Google Workspace and a single hosted workspace server accessed by teammate browsers, with Ollama on that server. See `OUTREACH_EXPANSION_PLAN.md`. Keep the portable default local; hosted mode must require explicit secure configuration and authentication. Keep Sheets as the application database, add only one Inbox navigation item, and place sequences/enrichment/team controls in their existing campaign/lead/settings contexts. Preserve live-integration validation boundaries.

- Project: `D:\BREKTRA`.
- Original requirements: `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs\BREKTRA_BuildUp_Doc.md`.
- Planning documents live in the repository's `docs` folder; copies can also be kept in `BREKTRA_Docs` for easy access.
- If pnpm is absent from PATH, use `C:\Users\FLIPTRONICS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`.
- Update these notes when a product decision changes. Keep implementation status and validation evidence current.
