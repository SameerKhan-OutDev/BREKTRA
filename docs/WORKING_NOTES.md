# BREKTRA working notes

Updated: 25 October 2026 (Asia/Karachi).

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

The repository already has an Express API, an in-memory demo, Google Sheets persistence/import, queue scheduling, reviewed drafts, and an Ollama adapter. `server/linkedin.ts` is a disconnected interface; there is no authenticated LinkedIn session or live delivery implementation.

Real source CRM tabs are currently read-only. Sheets mode prepares drafts; approval does not send a real pitch. Demo changes reset on restart. Do not relabel these behaviors as completed live backend work.

The user subsequently authorized beginning real backend development under `BACKEND_IMPLEMENTATION_PLAN.md`. Stage 1 now includes versioned validated records, incremental atomic Sheets writes, external-edit detection, local ownership locks, safer generation cancellation/recovery and opt-in dataset capture hooks. See `IMPLEMENTATION_STATUS.md` and `PERSISTENCE.md`. Stages 2-9 remain future work; real integrations still require dedicated service validation.

The later planning revision adds client approval and configurable Windows notifications to that future build. Client approval means approving a prospect for outreach, separately from pitch approval and invitation acceptance. This revision updates the plan; it does not implement those features yet.

## Environment and records

- Project: `D:\BREKTRA`.
- Original requirements: `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs\BREKTRA_BuildUp_Doc.md`.
- Planning documents live in the repository's `docs` folder; copies can also be kept in `BREKTRA_Docs` for easy access.
- If pnpm is absent from PATH, use `C:\Users\FLIPTRONICS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`.
- Update these notes when a product decision changes. Keep implementation status and validation evidence current.
