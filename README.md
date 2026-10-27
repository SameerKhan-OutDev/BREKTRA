# BREKTRA

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](CHANGELOG.md).

A local outreach workspace built with React, TypeScript, Express, Google Sheets, and Ollama.

Update 0.3.0 begins the company foundation: **Settings → Company setup** previews and prepares existing records for one named company, with backup acknowledgement and paused sending. Multiple companies and private company access remain disabled. See [migration instructions](docs/COMPANY_MIGRATION.md) and the [implementation roadmap](docs/UPDATE_0.3.0_IMPLEMENTATION_PLAN.md) for delivered scope and remaining work.

Working requirements, including rebuilding the portable app after changes, are recorded in [docs/WORKING_NOTES.md](docs/WORKING_NOTES.md). The phased live backend plan is in [docs/BACKEND_IMPLEMENTATION_PLAN.md](docs/BACKEND_IMPLEMENTATION_PLAN.md). Both documents are included in the portable package's `docs` folder. Planning does not enable live LinkedIn sending.

The outreach expansion adds campaign sequences, a Gmail transport/inbox, source-backed company enrichment and authenticated team access. The interface adds only **Inbox** to navigation; sequences belong to each campaign, contact/evidence review to Leads, and Gmail/team settings are collapsed in Settings. See [the implementation plan](docs/OUTREACH_EXPANSION_PLAN.md) and [Gmail/hosted setup](docs/HOSTED_SETUP.md) for capabilities, prerequisites and validation boundaries. Google Sheets remains the application database.

Gmail sending requires your OAuth setup, a Sheets workspace, separately approved leads, reviewed exact messages and an explicitly enabled mailbox. Accepted by Gmail does not mean delivered to the recipient. Live LinkedIn sending remains unavailable. Demo mail and conversations are simulated and reset on restart. Company-page enrichment is public-page evidence/MX checking, not personal-profile enrichment or address verification.

For a shared team, `pnpm package:server` creates `release/BREKTRA-Server.tar.gz`; `pnpm verify:server` checks its clean extraction. A single authenticated server coordinates all teammate browsers and runs Ollama on that server. It requires your hosting/domain/HTTPS configuration and dedicated Google resources. Packaging does not deploy it. The portable ZIP stays loopback-only by default.

## Open the app without commands (Windows)

On this computer, double-click **START BREKTRA.cmd** in the project folder. The app starts in the background and opens your browser. Double-click **STOP BREKTRA.cmd** to stop it. Clicking Start again reopens the existing copy instead of launching a second one.

For your partner, send **release/BREKTRA-Windows-x64.zip**. She should:

1. Extract the entire ZIP into a normal folder on her Windows 10/11 64-bit computer.
2. Open the extracted BREKTRA folder.
3. Double-click **START BREKTRA.cmd**.

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

The app uses local system fonts. Its UI does not require a third-party font service. The API is bound to loopback, validates input, rejects foreign Host/Origin headers, and does not send credentials to the browser. Do not expose this development server publicly.

Campaign scheduling supports daily working hours or continuous running from a chosen start date and time until paused. Start the campaign from its card to arm the schedule. Start dates use the browser’s local timezone; campaign timezone controls daily limits and daily working hours. Continuous campaigns retain daily budgets and pick up newly imported eligible leads while active. Keep the local app running; Sheets mode preserves campaigns across restarts, while demo mode resets. Failed jobs require an explicit campaign restart to retry.
