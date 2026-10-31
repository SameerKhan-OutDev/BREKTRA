# BREKTRA working notes

Current release: **0.12.3** (major 0 · update 12 · patch 2). See [version history](../CHANGELOG.md).

Updated: 1 November 2026 (Asia/Karachi).

## Version and patch numbering — standing requirement

Current version: **0.12.3**. Use `MAJOR.UPDATE.PATCH`; `package.json` is the single source for the app version. Major 0 identifies the pre-release product, not a completed live LinkedIn backend.

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

## Server lifecycle and LAN address — standing requirement

Before starting a fresh user-facing BREKTRA instance, stop all identified older BREKTRA servers, including other extracted installations and temporary validation servers, and verify their listeners have stopped. Match the actual BREKTRA server process/executable or verified health identity; never stop unrelated Node apps, Codex helpers or Ollama. Preserve every installation's `.runtime`, credentials, account records and `.env`. If the user asks for BREKTRA to be stopped, leave all BREKTRA servers stopped when delivery is complete; disposable validation servers must also be shut down.

Keep one canonical configured installation. The portable launcher uses the fixed default port **4310** (or one deliberately configured `PORT` in that installation's `.env`); it reuses that same installation and refuses a port conflict instead of silently moving to 4311/4312 or opening another installation with different accounts. Use `http://127.0.0.1:4310` on the host and `http://<host-LAN-IP>:4310` on other devices. Addresses refer to the same server, not separate workspaces. Reserve the host PC's IP in the router for a lasting bookmark; do not claim DHCP addresses or machine names will stay stable or resolve on every device.

Team invitations created on the host must use a detected private LAN address when LAN sharing is enabled, never localhost/127.0.0.1. Preserve the current LAN interface when creating invitations from another device; offer alternate interface addresses on PCs with multiple networks. LAN invitation creation fails with guidance when no private interface is available. PC-only mode explicitly labels its invitations as local. Hosted invitations keep the configured HTTPS origin. Keep authentication, role checks, invitation expiry/single-use checks and local-only setup restrictions intact. Test host-created links through a LAN address without claiming a separate physical device was tested.

## Build cleanup — standing requirement

After each new build passes validation, always clean up older BREKTRA builds. Keep the latest validated build and only its most recent previous build for rollback; remove all earlier builds and redundant temporary staging or verification copies. Preserve the previous build before replacing the stable release files, and label the retained previous build clearly with its version. Never delete configured workspace data, credentials, sessions, source files, or uncommitted work during build cleanup.

## Product requirements to retain

- Local browser-based workspace; trusted LAN sharing in the portable launcher (BREKTRA_LAN=0 opts out), loopback available and double-click Windows start/stop launchers. No Node installation or terminal steps for the recipient.
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

## Setup wizard (0.12.0)

Windows releases must always include Setup_BREKTRA.exe and its supporting Setup-Brektra.ps1, Setup-Tasks.ps1 and Setup.xaml beside the launchers. Build the EXE with scripts/build-setup.ps1 during every Windows packaging run. Match the app's Obsidian Mint colors; preserve animated navigation and Windows reduced-motion support. Setup may install Ollama only after the user's explicit Install and prepare action and a valid official publisher signature check. Google permissions/provider approvals remain explicit user actions. Keep credential/configuration changes behind existing host-local management/authentication APIs; never store wizard secrets in plaintext. Verify actual readiness and label deferred integrations/demo mode. Preserve private .runtime on upgrades. START BREKTRA remains a quick launcher after setup; STOP BREKTRA retains its meaning.

## Current state and scope

Release 0.12.1 adds external-page buttons at LinkedIn tutorial and administrator setup tasks, including Products and Auth beside the callback/credential instructions. Buttons open a new tab; users select their team app and named tab. Opening a page never marks a task complete.


Release 0.11.0 adds username/email login, username selection during registration and invitation acceptance, and password-confirmed username editing in Team. Existing email-only accounts remain supported. Usernames persist with member records, are case-insensitive and unique (including disabled/deleted records). Preserve the configured `.runtime` on upgrades; clean extracts have separate identities.

Release 0.10.1 gives Light the same Obsidian Mint identity: mint action fills, green-tinted neutral surfaces, blue secondary accents, shared active navigation, gradients, status treatments and focus rings. Text/accent tones adapt for contrast in daylight; dark appearance and browser-saved preferences remain supported.

Release 0.10.0 preserves local registrations, roles, approval/revocation state and invitations as encrypted authentication infrastructure; sessions still reset. Sheets team records remain authoritative. Demo CRM/messages remain temporary. Login/register switching uses an animated selector and reduced-motion support; both forms expose the saved Light/Obsidian Mint appearance switch. Preserve `.runtime` when upgrading an installation. Older already-cleared registrations require registration again.

Release 0.9.1 refines Team: one page heading, team summary, searchable/filterable directory, selected-member profile and access disclosure, structured invitation role choices and copyable link, private conversation/composer, and account-security disclosure. Shared click feedback animates interactive icons by purpose, including bell swing, refresh rotation and send movement. Mouse, touch and keyboard click activation share one handler; disabled controls and existing progress spinners are excluded. Reduced-motion preferences suppress feedback and cancel running animations. Animations are visual feedback, not proof of task completion, and add no audio. Existing team authorization and Sheets storage remain unchanged.

Release 0.9.0 requires authentication by default, and always for LAN/hosted access (BREKTRA_AUTH=0 only opts out on loopback). First owner registration is restricted to a direct loopback connection; later registrations are pending viewer accounts until an owner/admin approves and assigns a role in Team. Administrators see pending/invited/disabled members and can delete others (access revocation with historical records retained); only owners manage other admins/owners, and the last owner is protected. All active roles can exchange private messages; workspace API returns only the caller's messages. Team/member messages persist in Sheets; since 0.10.0 local identities survive restart while demo messages reset. Passwords remain encrypted infrastructure, hashed with scrypt. Sessions expire after eight hours and on restart; role changes, disabling and deletion revoke sessions. Host-PC admin setup remains available after sign-in. Initializing an empty Sheets team retains the current member identities, without copying demo CRM/messages. Existing real teams remain authoritative.

Portable LAN sharing remains enabled by default; BREKTRA_LAN=0 opts out. Host/same-origin and host-PC setup restrictions remain. HTTP LAN mode is intended for trusted private networks; HTTPS hosted deployment is required outside LAN. OAuth callbacks remain on the host PC in portable mode.

Release 0.7.0 adds **Settings → Personalization → Dark (Obsidian Mint)**, alongside Light and device appearance. The user chose mint as BREKTRA's dark-mode signature. Save only the appearance preference in this browser; this is infrastructure, not a Sheets application record. Navigation must derive company/user identity and counts from authorized workspace data; local mode uses a device mark and “Local session”. Health labels must distinguish demo data, model readiness and LinkedIn identity-only access.

Release 0.6.0 adds an optional animated LinkedIn setup walkthrough in Settings. It starts only after Start walkthrough; Skip for now saves the choice, and Resume walkthrough returns to the last step. An already-started guide resumes after the account callback. Administrator and teammate paths differ. Browser-local per-company/user progress contains only route, step and status; it is infrastructure, not an application database. LinkedIn portal tasks are user-confirmed, not detected or automated. No external developer app or real authorization was performed during delivery; no new LinkedIn outreach capability is enabled.

Release 0.5.0 adds Settings LinkedIn account connection via an administrator-configured LinkedIn OIDC app, owner-bound accounts, reconnect/disconnect, automatic checks approximately every 15 minutes while running, and an approved-message manual handoff. Tokens remain in encrypted infrastructure; account metadata stays in Sheets. Hosted teammates connect their own accounts through one configured server. No real LinkedIn authorization has been performed or partner outreach access obtained. Use the approved integration gate; do not substitute cookie imports or browser automation. The portable callback must be accepted by LinkedIn for the registered origin; local versus hosted callback acceptance requires live validation.

Release 0.4.1 clarifies missing Ollama installation, shows startup progress and inline startup errors, and discovers Windows installations on absolute PATH entries. First-time installation remains explicit; starting BREKTRA does not install Ollama.

Release 0.4.0 adds **Settings → Real workspace setup**: local key-file selection, service email copy/share guidance, read-only Sheets checks, control-tab preparation and immediate demo-to-real activation without `.env` edits or a server restart. Credentials/configuration are encrypted infrastructure; Sheets remains the database. Activation never copies demo records, pauses target campaigns/mailboxes, reconciles interrupted intent, blocks competing mutations and rejects stale requests. Existing real connections use reconnect; switching between real workspaces is not exposed. Hosted/authenticated teams remain operator-managed. Local saved setup overrides local environment defaults; `BREKTRA_USE_ENV=1` opts into environment-only configuration and disables wizard changes.

Local AI setup has buttons to start a standard installed Windows Ollama, download supported models with progress/cancel/retry, and select installed models. Google authorization/sharing and first-time Ollama installation remain explicit user actions. Never bundle uploaded keys/private configuration or imply that mock setup tests validate real Google/Ollama operation. See `LOCAL_SETUP.md`.

On 27 October 2026 the user authorized implementation of the twelve-shard 0.3.0 roadmap. Work begins with the baseline and company foundation. Release 0.3.0 delivers reviewed **single-company ownership preparation**, not the full shared-company MVP: Settings preview/apply, company/membership/manifest records, immutable ownership and cross-reference validation, and a runtime gate that refuses additional/archived companies. Existing workspace permissions still govern access; company permission contracts are not active enforcement yet. See `UPDATE_0.3.0_IMPLEMENTATION_PLAN.md` for task status and `COMPANY_MIGRATION.md` for backup, schema v2, recovery and downgrade limits. No production workspace is migrated automatically.

Keep multiple companies disabled until all API projections, services, background jobs, callbacks, AI contexts and exports enforce company authorization and adversarial isolation tests pass. Do not infer tenant ownership from lead employer or campaign copy. The new roadmap requires a compliant, authorized integration before any live LinkedIn automation; it remains disabled. Keep Sheets as the database and one authoritative writer.

The repository already has an Express API, an in-memory demo, Google Sheets persistence/import, queue scheduling, reviewed drafts, and an Ollama adapter. `server/linkedin.ts` remains a disconnected outbound interface. Release 0.5.0 adds OAuth/OIDC account identity connection through server/linkedin-auth.ts and server/linkedin-api.ts; this does not grant profile scraping, invitations, messaging or reply sync.

Real source CRM tabs are currently read-only. Sheets mode prepares drafts; approval does not send a real pitch. Demo changes reset on restart. Do not relabel these behaviors as completed live backend work.

The later outreach expansion implements a Gmail transport, reviewed sequences, inbox, public company-page/MX evidence and a single-server authenticated team mode. Legacy LinkedIn approval still does not send. Gmail sequence/reply approval can permit real email only after a real Sheets workspace, Google OAuth connection, separate lead approval, an explicitly enabled mailbox and current dispatch checks. Do not disable or mislabel this new transport as demo-only, and do not claim it was live-verified: Google account/recipient testing and external hosted deployment are still outstanding. See `HOSTED_SETUP.md` and the latest `IMPLEMENTATION_STATUS.md` entry. Portable mode shares the host PC over the trusted LAN by default; hosted teammates share one server, runner, Sheets workspace and server-local Ollama.

The user subsequently authorized beginning real backend development under `BACKEND_IMPLEMENTATION_PLAN.md`. Stage 1 now includes versioned validated records, incremental atomic Sheets writes, external-edit detection, local ownership locks, safer generation cancellation/recovery and opt-in dataset capture hooks. See `IMPLEMENTATION_STATUS.md` and `PERSISTENCE.md`. Stages 2-9 remain future work; real integrations still require dedicated service validation.

The later planning revision adds client approval and configurable Windows notifications to that future build. Client approval means approving a prospect for outreach, separately from pitch approval and invitation acceptance. This revision updates the plan; it does not implement those features yet.

## Environment and records

On 25 October 2026 the user also authorized sequences, email outreach, enrichment, an inbox and team management. They selected Gmail/Google Workspace and a single hosted workspace server accessed by teammate browsers, with Ollama on that server. See `OUTREACH_EXPANSION_PLAN.md`. Keep portable access limited to trusted attached LANs; hosted mode must require explicit secure configuration and authentication. Keep Sheets as the application database, add only one Inbox navigation item, and place sequences/enrichment/team controls in their existing campaign/lead/settings contexts. Preserve live-integration validation boundaries.

- Project: `D:\BREKTRA`.
- Original requirements: `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs\BREKTRA_BuildUp_Doc.md`.
- Planning documents live in the repository's `docs` folder; copies can also be kept in `BREKTRA_Docs` for easy access.
- If pnpm is absent from PATH, use `C:\Users\FLIPTRONICS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`.
- Update these notes when a product decision changes. Keep implementation status and validation evidence current.
