# BREKTRA

Current release: **0.12.3** (major 0 · update 12 · patch 2).

Windows first run: extract the complete release and open **Setup_BREKTRA.exe**. Its Obsidian Mint wizard checks the bundled runtime, installs/starts Ollama, downloads a supported model, guides account and Google Sheets setup, and opens BREKTRA after a readiness review. Google permissions and LinkedIn/Gmail authorization still require your actions. Use START BREKTRA for later quick launches. See [setup details](docs/LOCAL_SETUP.md).


The portable app keeps port **4310** instead of selecting another port. Stop old BREKTRA installations before starting a fresh one. Open `http://127.0.0.1:4310` on the host; teammates use the host LAN address shown in Settings. Team invitation links automatically use LAN addresses; select the correct network if several are offered. Reserve the host IP in your router to keep a lasting bookmark.

Sign in using your username or email. Choose a username when registering or accepting an invitation; existing users can add/change it in Team with their current password. Keep the configured installation’s `.runtime` folder when upgrading: a fresh extraction has separate registrations.

A local outreach workspace built with React, TypeScript, Express, Google Sheets, and Ollama.

Update 0.3.0 begins the company foundation: **Settings → Company setup** previews and prepares existing records for one named company, with backup acknowledgement and paused sending. Multiple companies and private company access remain disabled. See [migration instructions](docs/COMPANY_MIGRATION.md) and the [implementation roadmap](docs/UPDATE_0.3.0_IMPLEMENTATION_PLAN.md) for delivered scope and remaining work.

Working requirements, including rebuilding the portable app after changes, are recorded in [docs/WORKING_NOTES.md](docs/WORKING_NOTES.md). The phased live backend plan is in [docs/BACKEND_IMPLEMENTATION_PLAN.md](docs/BACKEND_IMPLEMENTATION_PLAN.md). Both documents are included in the portable package's `docs` folder. Planning does not enable live LinkedIn sending.

The outreach expansion adds campaign sequences, a Gmail transport/inbox, source-backed company enrichment and authenticated team access. The interface adds only **Inbox** to navigation; sequences belong to each campaign, contact/evidence review to Leads, and Gmail/team settings are collapsed in Settings. See [the implementation plan](docs/OUTREACH_EXPANSION_PLAN.md) and [Gmail/hosted setup](docs/HOSTED_SETUP.md) for capabilities, prerequisites and validation boundaries. Google Sheets remains the application database.

Gmail sending requires your OAuth setup, a Sheets workspace, separately approved leads, reviewed exact messages and an explicitly enabled mailbox. Accepted by Gmail does not mean delivered to the recipient. Live LinkedIn sending remains unavailable. Demo mail and conversations are simulated and reset on restart. Company-page enrichment is public-page evidence/MX checking, not personal-profile enrichment or address verification.

For a shared team, `pnpm package:server` creates `release/BREKTRA-Server.tar.gz`; `pnpm verify:server` checks its clean extraction. A single authenticated server coordinates all teammate browsers and runs Ollama on that server. It requires your hosting/domain/HTTPS configuration and dedicated Google resources. Packaging does not deploy it. The portable launcher enables trusted LAN sharing; set BREKTRA_LAN=0 for PC-only access.

## Appearance

Choose **Settings → Personalization → Dark** for BREKTRA’s Obsidian Mint color scheme. Light and Use device setting are also available. This preference is saved in your browser. The sidebar and navbar show current workspace identity, review counts and connection health.

## Open the app without commands (Windows)

On this computer, double-click **START BREKTRA.cmd** in the project folder. The app starts in the background and opens your browser. Double-click **STOP BREKTRA.cmd** to stop it. Clicking Start again reopens the existing copy instead of launching a second one.

For your partner, send **release/BREKTRA-Windows-x64.zip**. She should:

1. Extract the entire ZIP into a normal folder on her Windows 10/11 64-bit computer.
2. Open the extracted BREKTRA folder.
3. Double-click **Setup_BREKTRA.exe** for first-run setup. After setup, **START BREKTRA.cmd** is the quick launcher.

No Node.js install, dependency install, or terminal commands are needed. Keep the app's files together. This package contains the current demo; each computer runs its own copy. Demo changes reset after stopping/restarting. Sheets and AI require separate setup. Do not run two computers against the same control spreadsheet at once.

To share the app, send the original ZIP. Do not zip a configured copy containing credentials, `.env`, or logs. Developers can rebuild the clean portable package with `pnpm package:windows` on Windows x64. The packager includes only allowlisted application files, the Node runtime, and software license notices.

## Run locally

Requires Node.js 22.12+ (or Node 24) and pnpm.

```powershell
pnpm install
pnpm dev
```

Open <http://127.0.0.1:4310>. The server listens on loopback only.

If pnpm is not on PATH in this Codex environment, use:

```powershell
& 'C:\Users\FLIPTRONICS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' dev
```

For an installed checkout, the direct equivalent is `node --import tsx server/index.ts`.

```powershell
pnpm build
pnpm test
pnpm start
```

Build before running the API tests; they exercise the production entry point on a separate port (14311). `pnpm start` serves the built frontend. Restart the server after changing backend files or `.env`; frontend changes refresh during development.

## What works in this foundation

- Dashboard with date-filtered activity totals and a seven-day activity chart.
- Campaign creation/editing, three campaign modes, working hours, start/pause controls.
- Independent request and pitch queues, round-robin campaign scheduling, shared account budgets, reserved 50/50 allocations.
- Searchable leads, per-account relationship edits, opt-outs, and queued-job cancellation.
- Draft editing, evidence review, approval/rejection, and explicit demo delivery.
- Activity and job logs with waiting reasons, outcomes, and failures.
- Google service-account authentication, source sheet/tab preview, column mapping, lead import, and control spreadsheet persistence.
- Local Ollama detection and schema-validated draft generation from supplied lead facts in Sheets mode.
- Versioned/validated Sheets records, incremental atomic saves, external-edit conflict detection, local process ownership locks, and interrupted-job reconciliation.
- Opt-in generation-input snapshots, original drafts and linked human revision/review records in dedicated Sheets tabs; no automatic training.

## Demo mode

The default is `STORAGE_MODE=demo`. Eight sample leads, one demo account, one all-day sample campaign, and one sample pitch are loaded into memory. Demo data resets on server restart.

Try this flow:

1. Open Campaigns and start the sample campaign.
2. Open Activity → Job queue to watch eligible work process.
3. Open Review queue, edit a sample pitch, and approve it.
4. Watch the simulated delivery and dashboard update.
5. Try an opt-out, relationship edit, pause, or a campaign with narrower hours.

Demo drafts use a deterministic template, clearly labeled as such. Demo requests and pitches **never contact LinkedIn** and are always reported as simulated. The normal campaign hours default to 09:00–18:00; the bundled sample is open 00:00–24:00 so it can be tried at any time.

## Connect Google Sheets

1. Create a Google Cloud service account, enable the Google Sheets API, and download its JSON credentials outside this repository.
2. Create a **dedicated empty control spreadsheet** and share it with the service account email as an editor. Share source lead spreadsheets with the account too; viewer access is enough for source sheets in this version.
3. Open **Settings → Real workspace setup**, choose the JSON key, paste the control spreadsheet URL/ID, and click **Check spreadsheet**. The check is read-only.
4. Confirm the sheet and click **Connect workspace**. BREKTRA creates its control tabs and saves the connection encrypted. It switches from demo to Sheets immediately, with campaigns/mailbox sending paused; no environment-file edit or restart is needed. See [guided local setup](docs/LOCAL_SETUP.md) for Google permissions, recovery and advanced environment configuration.
5. Register an account from Settings, then import from Leads. Provide a source spreadsheet ID, select a tab and account, and map columns.

The source must have a unique header row. A name and either a LinkedIn profile URL or supplied email are required; title, company, website, notes, relationship, and opt-out columns are optional. Email-only leads use stable email IDs and cannot enter LinkedIn jobs. Imports inspect columns A–AZ and at most 5,000 data rows. Recognized relationship values are `connected`, `not_connected`, `pending`, and `unknown`; other values (or missing LinkedIn profiles) become `unknown`. Opt-out values `true`, `yes`, and `1` are recognized. Duplicate normalized profiles/emails are skipped per account; the import log reports duplicate and invalid row counts. Reimporting adds new leads; it does not refresh existing records or move them between sources.

**Existing source tabs are read-only in this version.** Relationship edits and workspace results persist in the control spreadsheet. Writing mapped dropdown statuses back to original CRM tabs is a later milestone. Do not use a pre-existing CRM as the control spreadsheet or edit control records while the server is running. Only one server process should own a control spreadsheet.

Sheets is the only persistent application database. Demo state is in memory; there is no SQLite, PostgreSQL, or JSON-file database. Changed records, intent, audit events and collected examples commit in one atomic Sheets batch. Saves first check for outside edits; a conflict, failed or uncertain write blocks further changes and dispatch. Use Settings → Reconnect & sync to validate and reload remote state. Interrupted outbound jobs become `uncertain`, cannot automatically repeat, and reserve budget while unresolved; interrupted draft generations fail and require an explicit restart. Local OS locks reject competing processes even on different ports or in copies using the same control spreadsheet. Cross-computer simultaneous use remains unsupported. See [persistence and recovery](docs/PERSISTENCE.md) for upgrade, backup and recovery instructions.

Settings → Future AI examples starts off. Enabling it captures new generation inputs and original drafts, plus subsequent edits/reviews while collection stays on. Existing drafts do not get invented history. Demo records remain labeled; turning collection off stops new capture without deleting existing records or changing ordinary draft storage. Inspection/deletion, retention, privacy-reviewed exports and evaluation splits remain stage 8 work. No dataset is exported, uploaded or trained automatically.

## Connect local AI

In **Settings → Real workspace setup**, use **Install Ollama** if needed, then **Start Ollama** and **Download model**. Progress and cancellation are shown in the app; a successful download selects the model automatically. **Use this model** selects an already installed model. No terminal command or app restart is needed. Installing Ollama itself remains a one-time user action.

The default local endpoint is `http://127.0.0.1:11434`; advanced operators can configure `OLLAMA_URL` in the environment. Only loopback HTTP endpoints are accepted. One inference job runs at a time, with a 4K context and a two-minute request timeout. Hosted servers keep operator-managed setup. See [local setup](docs/LOCAL_SETUP.md).

In Sheets mode, import confirmed connections with factual notes, create a pitching campaign with your company, ICP, what you’re selling, pitch style, editable context prompt, and pitch strategy with samples, and choose Prepare drafts. Working hours apply to draft preparation too. Generated output must contain a fit decision, evidence, and a draft. All drafts require review. No LinkedIn profile extraction is available yet; generation uses only supplied sheet facts. Model quality, performance, and actual Sheets credentials have not been benchmarked or verified on this machine by the test suite.

## Boundaries of this milestone

Live LinkedIn login/session management, profile extraction, invitation/acceptance/reply checks and sending remain unavailable. Registered LinkedIn accounts are labels with budgets, not authenticated sessions. The legacy LinkedIn path prepares drafts; approval saves a decision without sending. The Gmail transport, inbox, reviewed sequences and uncertain-send reconciliation are implemented separately, with real Google/recipient validation still outstanding. Source CRM writeback remains planned.

Daily limits are workspace settings, not claims about LinkedIn activity allowances. Balanced campaigns reserve outbound action counts 50/50 (requests receive an odd extra action); unused allocations do not spill over. Account budgets reset on the Asia/Karachi day boundary; campaign allocations reset in the campaign’s timezone. Working-hour windows are same-day only; overnight windows are not supported yet.

## Structure

```text
src/            React screens and responsive styles
shared/         Application types
server/         Local API, domain rules, runner, Sheets and Ollama adapters
tests/          Domain/recovery tests and production API workflow tests
```

The app uses local system fonts. Its UI does not require a third-party font service. The source entry point binds to loopback unless LAN is enabled; the portable launcher enables trusted LAN access. The API validates input, restricts socket peers and Host/Origin headers, and does not send credentials to the browser. Do not expose this development server publicly.

Campaign scheduling supports daily working hours or continuous running from a chosen start date and time until paused. Start the campaign from its card to arm the schedule. Start dates use the browser’s local timezone; campaign timezone controls daily limits and daily working hours. Continuous campaigns retain daily budgets and pick up newly imported eligible leads while active. Keep the local app running; Sheets mode preserves campaigns across restarts, while demo mode resets. Failed jobs require an explicit campaign restart to retry.

## LinkedIn account connection (0.5.0)

0.6.0 adds **Start walkthrough / Skip for now** in LinkedIn accounts: an optional animated guide with one task per step, progress, Back/Continue and pause/resume. Administrators follow developer-app setup; teammates reuse it and authorize their own account. The guide supports keyboard navigation/reduced motion and stores no credentials in its browser-local progress. External portal steps are confirmed by the user; completion requires a current saved connection. See [setup and references](docs/LOCAL_SETUP.md). Live invitations and messaging remain unavailable.

Settings → LinkedIn accounts guides users through connecting their own account. An administrator creates a LinkedIn developer application, enables Sign In with LinkedIn using OpenID Connect, registers the exact callback shown in Settings, and saves the client ID/secret privately once per server. Teammates then use Connect LinkedIn and authorize on LinkedIn. A healthy persistent Sheets workspace is required; demo cannot save real connections. Connect an existing unused account label through the administrator selector to preserve campaign references. Hosted teammates use their own authenticated BREKTRA sessions and one shared HTTPS server; portable mode uses the host PC with optional trusted LAN browser access.

BREKTRA requests only openid/profile for account identity. It does not request posting or email permissions. Tokens stay encrypted on the server; users never paste cookies or LinkedIn passwords into BREKTRA. Expired/revoked connections need a new authorization; automatic refresh is not assumed. Read-only checks run approximately every 15 minutes while the app runs. Reconnect/disconnect/check controls apply to the owner; failed checks and disconnect pause campaigns. Disconnect removes the locally stored token; users can additionally revoke BREKTRA through LinkedIn permitted services.

Account connected does not mean outreach enabled. Invitations, messages and reply sync require separate approved access and remain disabled. Approved drafts can be copied and their lead profile opened for manual sending after current owner/approval/opt-out/reply checks; this does not record delivery or advance a sequence. Actual LinkedIn app/consent/callback testing remains unverified, including whether LinkedIn accepts the portable loopback callback. A registered HTTPS hosted origin may be needed; do not assume sign-in alone permits sending.

## Access from phones and other LAN devices (0.8.0)

Start BREKTRA on one PC. Portable startup enables BREKTRA_LAN=1 unless .env or the process environment sets it to 0. Open Settings → Access from other devices and use the WiFi/Ethernet IPv4 URL on devices connected to the same network. Keep the PC awake. All devices use this one workspace and runner; do not start another copy against the same Sheet.

Run ALLOW LAN ACCESS on the host PC and approve the Windows administrator prompt to permit BREKTRA through Windows Firewall. The rule permits only the bundled executable, the current app port and ten fallback ports, and LocalSubnet peers. It supports Public WiFi profiles without changing the profile or disabling the firewall. Guest WiFi/AP isolation may still prevent device-to-device connections. Addresses can change after reconnecting WiFi.

LAN mode uses HTTP and now requires a separate login for every browser. Create the initial administrator on the host PC; subsequent registrations need admin approval in Team. Roles apply to UI actions and API permissions. Team provides basic profiles and private member messages. Local registrations and access settings survive restart in encrypted authentication storage; demo messages reset. Sheets stores the lasting workspace team. Keep `.runtime` when upgrading this installation. Only use it on networks whose users you trust. Server credential/AI setup is restricted to the host PC browser. LinkedIn/Google callbacks remain loopback URLs; authorize accounts on the host PC. Use the authenticated HTTPS deployment for individual user accounts or access outside the LAN. Set BREKTRA_LAN=0 in .env and restart for PC-only access. The source/server entry point remains loopback by default unless explicitly enabled.
