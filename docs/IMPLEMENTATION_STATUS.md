# Foundation status

Current release: **0.12.3** (major 0 · update 12 · patch 2). See [version history](../CHANGELOG.md).

The first milestone is a runnable local workspace with real integration adapters and a simulated outbound execution path.

## 0.12.3 — 1 November 2026 — Preserve administrator access on Sheets activation

Connecting an existing Sheets team now refuses an incompatible administrator identity before saving configuration or replacing the signed-in workspace. Matching emails do not transfer access. Regression coverage checks rejected activation, retained login/session, compatible activation and restart. Existing Sheets membership and private credentials remain authoritative.

## 0.12.2 — 1 November 2026 — Joint application purpose

The About document now identifies BREKTRA as a joint application by Out Game Breakpoint and Terra Labs, with intended scope covering Out Game Breakpoint's game-development workflows and Terra Labs' logistics workflows through LinkedIn and websites. This records product purpose without claiming those workflows are already implemented.

## 0.12.1 — 31 October 2026 — LinkedIn setup shortcuts

LinkedIn tutorial and administrator setup now show button links for the developer portal, Products and Auth beside their tasks and callback/credential fields. Links open a separate tab and explain selecting the team app and named tab. Existing manual confirmations, private credential handling and authorization remain unchanged.

Validation: production build and all 116 automated tests passed. Fresh Windows portable verification passed startup, health/workspace/frontend, repeat-start reuse, shutdown, LAN/auth protections and the 32-file allowlist. Hosted archive verification passed startup, frontend, document/version consistency and the 20-file allowlist. No real LinkedIn authorization or external app configuration performed.

## 0.12.0 — 31 October 2026 — Windows setup wizard

The Windows portable release now includes **Setup_BREKTRA.exe** beside the launchers. Its native Obsidian Mint wizard has animated steps, keyboard navigation and Windows reduced-motion support. It checks Windows 10 22H2+/x64, writable extraction, included Node 24 runtime, essential files and user-drive space. It downloads the official Ollama installer only when needed, requires a valid Ollama publisher signature before running it, installs for the current user, starts the local service and downloads/verifies a supported Qwen model. Downloads have progress, cancellation and deliberate retry; installation itself must finish before closing. Reopening setup reuses installed software/models and this installation's accounts/configuration.

The wizard starts BREKTRA without opening a browser for host-local owner registration/admin login, saves the selected model through the existing authenticated setup API, and offers Google Cloud/Sheets links for the user's required authorization actions. It reads the chosen service-account key locally, shows/copies only the email, checks spreadsheet access without writes, then asks for confirmation before preparing control tabs and saving the encrypted connection. Existing Sheets workspaces are preserved. Explicitly deferring Sheets opens demo data and is labeled in the readiness review. Final checks precede opening the app's Settings in the default browser; the browser still requires sign-in. Closing unfinished setup stops only a server it started. Existing START/STOP launchers remain available.

Setup never imports cookies, bypasses provider consent, enables sending, changes firewall settings automatically or bundles private setup data. LinkedIn/Gmail authorization and external approvals remain explicit Settings tasks. Ollama is separately installed software; local hardware determines inference performance. Real Google account/key sharing and a fresh Ollama installation/model download require external service testing; automated verification must be reported separately.

Validation for 0.12.0: production build and all 116 existing automated tests passed. A fresh Windows extraction passed the full portable verifier (32 allowlisted files), including fixed-port startup, authentication, frontend/document/version checks, LAN protections, competing-port refusal, repeat startup, shutdown and encrypted account persistence. The hosted archive verifier passed (20 allowlisted files). The separate setup worker verifier exercised real asynchronous Windows PowerShell runspaces, native packaged startup, owner registration/admin login, encrypted model selection across restart, mock Ollama pull/reuse/failure/cancellation/retry, invalid-key rejection and stale connection rejection. Windows 11 build 26300 passes preflight using CurrentBuildNumber rather than the compatibility-shimmed .NET OSVersion. The actual setup EXE opens the native Obsidian Mint interface; the host scopes script execution to its own runspace without changing Windows policy. Actual Ollama responds with qwen3:4b installed on this machine. A new external Ollama install/model download and real Google authorization/Sheets activation were not performed; successful download paths use a disposable local service. No new provider authorization or outbound sending is claimed.
## 0.11.1 — 31 October 2026 — fixed address and LAN invitations

The portable launcher keeps default port 4310 (or the explicitly configured PORT), reuses its own instance and refuses conflicts with another installation or application. It no longer shifts to another port/workspace. Stop older servers before a fresh user-facing launch; leave all servers stopped when requested. Existing installation data remains private and is preserved.

Host-created team invitations use detected private LAN addresses automatically. LAN creators keep their current interface; PCs with multiple interfaces offer alternative addresses. LAN mode with no interface fails before creating an unusable invitation. PC-only links explain their local scope; hosted links retain the configured HTTPS origin. Settings explains stable-port bookmarks and router IP reservations. The firewall helper targets the configured single port. No firewall settings are changed automatically.

Validation: production build and all 116 automated tests passed. Fresh Windows extraction verified fixed default port 4310, repeat-launch reuse, refusal of a competing installation and an unrelated occupied port, host-created LAN invitation URLs, invitation acceptance/username login through a LAN address, authentication and host-only setup restrictions, document/frontend/version checks, stop/restart and private-file allowlists. Server bundle verification also passed. LAN endpoint checks ran on the host through its private interface addresses; no separate physical phone/computer or router IP reservation was tested. The launcher prints private LAN addresses before sign-in. The older configured installation is updated without changing private runtime/settings; final delivery leaves BREKTRA servers stopped.

## 0.11.0 — 31 October 2026 — username sign-in

Registration and invitation acceptance offer unique usernames (3–30 letters/numbers/dots/underscores/hyphens, starting with a letter/number). Sign in with username or email, ignoring case and surrounding whitespace. Existing email-only accounts remain compatible and can choose/change a username in Team using their current password. Team search, directory, profiles and authenticated identity include usernames. Names remain separate from login identifiers. Pending/disabled/deleted accounts cannot sign in; reserved usernames cannot be reused by another member. Email and username share the per-account attempt limit. Usernames persist in Sheets team records or encrypted local authentication infrastructure.

Keep the configured installation's `.runtime` on upgrade. A fresh extraction is a separate installation; identities already cleared by older releases cannot be reconstructed. Login failures provide recovery guidance without revealing account existence. No personal account or credentials are included in the shareable artifacts.

Validation: production build and all 115 automated tests passed. Tests cover case/whitespace normalization, invalid and duplicate usernames, approval/deletion restrictions, password-confirmed changes, email compatibility, shared login-attempt limits, invitation selection, encrypted restart persistence and mock Sheets username roundtrips. Browser review verified registration, username sign-in, Team username search/profile and editing controls. Fresh Windows/server package checks passed version/frontend/document consistency and private-file allowlists; Windows also passed LAN restrictions, repeat launch, stop/restart, session revocation and username login after restart. The configured local test account was recreated only in the installation and verified after a launcher restart; no private account is bundled. Real Google Sheets/provider operation was not tested.

## 0.10.1 — 31 October 2026

Light appearance now shares Obsidian Mint’s mint actions, tinted surfaces, blue secondary accents, active navigation, gradients and semantic status/focus treatments. Daylight text colors preserve readable contrast; palette swatches follow the selected lighting.

Validation: production build and all 113 automated tests passed. Browser review verified the light dashboard, light/dark Personalization controls and light persistence after reload without desktop page overflow. Fresh Windows/server extraction checks passed release/API/frontend/document consistency and private-file allowlists; Windows additionally passed launcher reuse, shutdown, registration persistence and session revocation. No external integration changes.

## 0.10.0 — remembered registrations and access appearance

Local account identities, roles, approval/deletion state and invitation metadata now persist alongside password hashes in encrypted authentication infrastructure. Sessions still expire on restart. Sheets remains authoritative for connected teams; demo CRM and messages remain temporary. Existing registrations already lost by older demo restarts cannot be recovered from password hashes alone. Keep the installation's private `.runtime` folder when upgrading; a fresh extraction is a separate installation.

Access screens default to sign-in when registered identities exist, provide a sliding Sign in/Register selector and animated form entrance with reduced-motion support, and expose a browser-saved Light/Obsidian Mint switch before login.

Validation: production build and all 113 automated tests pass. New tests use a fresh encrypted private-store instance on each restart to verify stable identities, pending approval, approved roles, invitations, deletion, session revocation, duplicate rejection, failed-write rollback, corrupt-storage refusal and Sheets precedence. Browser review covered light/dark access screens at a narrow mobile viewport and 1280x900 desktop, selector/form changes, theme persistence after reload, default sign-in after registration and successful test-account login. Windows/server packages are rebuilt and checked from fresh extractions; Windows verification additionally checks registration persistence and expired sessions after a real launcher stop/start. No external provider verification is implied.

## 0.9.1 — Team design and icon feedback

Team now uses a searchable/filterable directory, selected-member profile, access disclosure, structured invitation form and role choices, copyable invitation link, conversation composer and account-security disclosure. Removed the duplicate heading and repeated per-row admin controls. Theme tokens cover light/dark surfaces, borders and status colors; layouts adapt to mobile. Shared purpose-based SVG click feedback covers enabled interface controls without changing their actions, suppresses effects under reduced motion and leaves progress spinners alone. No backend/permission changes or notification sound were added.

Validation: production build and all 111 automated tests pass. A disposable demo workspace was visually reviewed in light/dark themes at desktop and 390×844 phone dimensions. Directory pending filtering, selected profiles/access disclosure, invitation role choices, one-message submission/composer clearing, phone conversation navigation and bell review navigation were exercised without browser console errors. Reduced-motion suppression/cancellation was reviewed in the shared handler. Fresh Windows/server release extraction checks cover startup, authenticated API/frontend, LAN restrictions, repeat-start reuse, shutdown, versions/documents and private-file allowlists. No live-provider verification is implied by this interface refinement.

## 0.9.0 — authenticated LAN and Team

Implemented default authentication, host-only first owner registration, admin-approved teammate registration, role-aware UI and existing API permission enforcement, sidebar Team, profiles, private messaging, invitations, membership controls and session revocation. Member deletion retains historical references and removes access/credentials. Sheets adds TeamMessages; demo team records remain ephemeral. Empty real workspace setup carries current member identities only. Real Sheets writes, real mobile browser use and externally hosted HTTPS deployment require separate live validation.

Validation: production build and 111 automated tests passed, including registration approval, role enforcement, participant-only message visibility, deletion/session revocation and mock Sheets recovery of messages and identities. Fresh Windows verification passed required login on host/LAN, first-owner registration, frontend/assets, setup restrictions, same-origin enforcement, document/version checks, repeat-start reuse, shutdown and restart/session reset; the ZIP contains 28 allowlisted files. Server bundle verification covers clean extraction/startup and hosted prerequisites. Computer Use ended its visual check because it could not confidently determine the browser URL; visual and real mobile verification are not claimed.

## 31 October 2026 - release 0.8.0: trusted LAN browser access

- User requested LAN-wide device access. Portable startup enables attached private IPv4 subnet access; Settings lists current URLs. One host retains the runner, Sheets writer and server-local Ollama. PC-only opt-out is BREKTRA_LAN=0.
- LAN browsers share the current authentication mode (direct full access in default portable mode). Strict actual-interface Host, same-origin and socket-peer subnet checks remain enforced. Local credential/AI setup is host-PC-only. Hosted HTTPS authentication remains separate; portable OAuth callbacks still require the host PC browser.
- ALLOW LAN ACCESS requests Windows administrator elevation to create an executable/port-scoped LocalSubnet firewall rule, including WiFi using a Public profile. No Internet exposure or router configuration is added.
- Validation: production build and all 109 automated tests passed, including subnet/peer rejection. Fresh Windows/server extractions passed release/version, frontend/API, document and private-file allowlists (28/20 files); Windows additionally passed LAN health/workspace/frontend, blocked remote setup and foreign origins, same-origin mutation, repeat-start reuse, shutdown, ownership reacquisition, demo reset and PC-only opt-out. Installed D:/BREKTRA-app/BREKTRA was updated with its encrypted setup file unchanged; Sheets remains connected. Browser inspection via the WiFi URL confirmed direct dashboard access and the Settings LAN section. Windows Firewall rule was verified enabled for the installed executable, TCP 4310-4320 and LocalSubnet peers. Host WiFi address during validation: http://192.168.100.166:4310. Real mobile browser and router device-isolation behavior require a device on the network; no such check is implied by a host-side HTTP test.

## 31 October 2026 - release 0.7.0: Obsidian Mint personalization

- User selected Obsidian Mint from four SVG design studies. Settings → Personalization exposes light, dark and device appearance to every role; preferences remain browser-local infrastructure, with storage-failure feedback.
- Shared semantic CSS colors cover all existing screens, dialogs, onboarding, forms, charts and access/loading states; light appearance retains previous colors.
- Navigation shows saved company identity, authenticated initials/name/role or an honest local session, review/inbox/campaign counts, server state and current Sheets/Ollama/LinkedIn identity status. Profile, company and health controls open Settings; review actions open the existing queue. Company switching, global search and the planned notification system are not added.
- Validation: production build and all 108 automated tests passed. Browser checks confirmed saved dark appearance after reload and in a new tab, live cross-tab switching, light and device selection, keyboard radio navigation, review navigation, dashboard/table/dialog colors and a 390px mobile drawer/settings layout without page overflow. Fresh Windows/server packages passed startup, API/version/frontend/document and private-file allowlists (26/20 files); Windows additionally passed repeat-start reuse, shutdown, ownership reacquisition and demo reset. No external integration changes are included.

## 31 October 2026 - release 0.6.0: optional animated LinkedIn walkthrough

- Settings offers Start walkthrough / Skip for now before a tutorial opens. Users can resume the saved step; return from authorization resumes only an explicitly started guide.
- One task per step with illustrative animation, progress, Back/Continue, confirmations for portal work, callback copying, masked administrator credential entry, inline errors and pending-access guidance. Teammates reuse the configured application.
- Progress stores only status, step and route in browser-local per-user/company infrastructure. Credentials and tutorial choices never enter Sheets or release artifacts. Keyboard focus/Escape and reduced motion are supported. Completion checks the current saved account record rather than a URL success flag.
- No developer app was created, product access requested or real LinkedIn authorization performed. Portal layout and approval are external; visual walkthrough validation uses isolated local fixtures.
- Validation: production build and all 108 automated tests passed. Isolated browser fixtures verified initial opt-in, Skip persistence, exact-step resume, administrator setup confirmations, callback copying, masked/cleared credentials, save errors, simulated authorization return, account-backed completion, teammate and waiting-for-admin paths, viewer exclusion, Escape/pause, focus containment and narrow-screen layout. Reduced-motion CSS was confirmed present in the browser. These are UI simulations, not real LinkedIn service validation.
- Windows and server bundles passed fresh-extraction checks: release/API/document identity, frontend assets, clean state and private-file allowlists (26/20 files). Windows also passed repeat-start reuse, shutdown and ownership reacquisition. The installed Desktop copy preserves its private runtime; retain the immediately previous 0.5.0 archives alongside 0.6.0 and recycle older build copies.

## 31 October 2026 - release 0.5.0: LinkedIn account connection

- Implemented OAuth/OIDC authorization with one-time cookie/state, nonce and RSA signature/issuer/audience/expiry validation, matching userinfo, initiating-session validation, active membership and current workspace/company checks.
- Settings has Connect LinkedIn, automatic account naming, owner-bound reconnect/disconnect/check, a short onboarding checklist, capability explanations and collapsed administrator configuration. Existing labels can be connected by their administrator without replacing account/campaign IDs.
- Store access tokens only in encrypted private infrastructure; store validated owner/account metadata in Sheets. Reconnect checks account identity, removes superseded local tokens, and never restarts paused campaigns. Automatic read-only checks run about every 15 minutes while the server runs; failures/expiry pause campaigns. No automatic token refresh is promised.
- Approved-message handoff checks current message revision, account ownership, lead approval, replies and opt-out server-side. Copy/open does not send, count delivery, advance sequences or update CRM outcomes.
- Live invitations, messages, relationship/profile checks and reply sync remain unavailable. No LinkedIn developer app was configured or real account authorization performed during delivery. Local callback acceptance, actual consent/reconnect/revocation and hosted browser/domain behavior still need dedicated service validation.
- Validation: production build and all 108 automated tests passed, including cryptographic token validation, replay/ownership/stale-session rejection, save failure rollback, credential expiry/restart and handoff eligibility. Windows and server packages passed fresh-extraction startup/API/frontend/document/allowlist checks (26/20 files). Windows repeat-start, shutdown and ownership reacquisition passed. Visual inspection of Settings passed in the updated installed portable app; its existing Sheets connection and local model remained available. LinkedIn developer configuration is absent, so actual LinkedIn authorization and outreach remain unverified.
- Delivery retains only the current 0.5.0 distributions and immediately previous 0.4.1 archives; obsolete build test extractions are recycled. Desktop has one BREKTRA launcher; the share-ZIP shortcut is in release. Private runtime/configuration files are preserved.

## 30 October 2026 - release 0.4.1: Ollama startup feedback

- Confirmed the running 0.4.0 API returns an installation-required error on this PC; no standard or PATH Ollama installation was found.
- Added explicit missing-installation health guidance, startup progress and inline startup errors beside the AI controls. Added absolute PATH discovery for custom Windows installations.
- First-time installation and model download remain separate steps; these changes do not imply verified inference.
- Validation: build and all 102 tests passed; Windows and server packages passed fresh extraction/startup, release/document, frontend and private-file allowlist checks. With user approval, installed the signature-verified official Windows Ollama; the configured running app returned success from Start Ollama and detected its real local API. No model is installed yet, so inference remains unverified. Restored the same Sheets connection from the user's original key after discovering a pre-existing saved-key mismatch on restart; retained the unreadable encrypted files locally.

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
