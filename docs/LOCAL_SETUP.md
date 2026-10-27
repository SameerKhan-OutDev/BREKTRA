# Guided local workspace setup

Current release: **0.4.0** (major 0 · update 4 · patch 0).

Use **Settings → Real workspace setup** in the portable Windows app. There are no environment-file edits, terminal commands or server restarts in this flow.

## Connect Google Sheets

1. Choose your Google service-account JSON key using the file picker. BREKTRA shows only its email. The private key is never returned by the API or saved to Sheets.
2. Click **Create a blank spreadsheet**, or paste the URL/ID of your dedicated control spreadsheet. In Google Sheets, use Share to give the displayed service-account email Editor access. The **Copy email** button helps with this step.
3. Click **Check spreadsheet**. This reads and validates access and existing BREKTRA data without creating tabs or changing records. The check shows existing lead/campaign/conversation counts and the number of control tabs needed.
4. Confirm the selected sheet, then click **Connect workspace**. BREKTRA creates missing control tabs, recovers interrupted intents as uncertain, pauses campaigns and mailbox sending, saves the connection encrypted on this computer, and switches to the real workspace immediately. It never copies demo data into the sheet.
5. Register an account in Settings and import your source sheet from Leads. Share that source sheet with the same service-account email; read access is sufficient while source CRM writeback is unavailable.

Google still requires you or your administrator to enable its Sheets API and authorize the service account. The setup contains buttons to open the appropriate Google pages. Creating a key and granting spreadsheet access remain your actions in Google; BREKTRA cannot bypass account permissions. Use a dedicated control sheet, not your original CRM tab.

Pause demo campaigns and mailbox sending before switching, and wait for in-flight work to finish. Checks expire after five minutes. If either the current workspace or target sheet changes after a check, check it again. Connection checks are one-use. Once connected, use **Reconnect & sync**; switching an already active real workspace through this wizard is deliberately unavailable.

Existing hosted/authenticated team workspaces retain operator-managed configuration. Their owner/admin can inspect setup health, but local file/launch controls are disabled. All setup routes require management permission, with the existing Host/Origin protections.

## Prepare local AI

1. If needed, click **Install Ollama** to open its official Windows download page and complete installation yourself.
2. Click **Start Ollama** to start a standard installed Windows copy on the configured loopback endpoint. If it is already running, this is a no-op. Custom installation locations can be opened manually, then checked with **Check connection**. BREKTRA does not install software silently.
3. Choose the standard `qwen3:4b` model or the smaller `qwen3:1.7b` download. Click **Download model**. Progress, failure and cancellation status appear in Settings; you can cancel and deliberately retry. Downloads require internet access and disk space.
4. After a verified successful download, the model is selected and saved automatically. You can instead choose any compatible installed model and click **Use this model**. No app restart is required.

The model list is checked before selection. A pull must report success and the model must appear in Ollama's installed models before BREKTRA reports it ready. Only the two bundled model choices can be downloaded by this API; browser-provided executable paths, commands and model registry URLs are not accepted.

Ollama runs separately from BREKTRA and may continue running when the app stops. A download is cancelled if the BREKTRA process stops; check installed models or retry after restarting. Download status itself is transient, while successful model selection is persisted. Setup does not send prospect information, start a campaign or enable Gmail sending.

## Storage, upgrades and recovery

Connection settings and uploaded credentials are stored as encrypted private infrastructure under `.runtime`, alongside the existing Gmail private storage. On personal Windows installations its encryption key is protected for the current Windows user. This is configuration, not a replacement application database; business records remain in Sheets. Keep matching private storage/key material in your private backups. Never share a configured app folder.

Local settings saved by this flow take precedence over local `.env` connection/model defaults on subsequent starts. Hosted mode uses its server environment and ignores local setup choices. Advanced operators/tests can set `BREKTRA_USE_ENV=1` to use environment configuration exclusively and disable the local wizard's mutation controls; the encrypted choices are retained for later use. An unreadable encrypted configuration fails visibly rather than silently reverting to demo or overwriting it.

Activation holds the existing single-writer control-sheet lock. Failed setup leaves the current workspace active. If a target save commits but configuration saving fails, the target remains safely paused and a new read check is required. Requests from the previous workspace cannot mutate the newly activated one. No automatic external send or resend is part of recovery.

The clean Windows/server archives exclude uploaded files, `.env`, `.runtime`, private keys, sessions, personal settings and collected business data. Source updates alone do not update a running server: restart once after installing the new app version; subsequent wizard choices do not need a restart.

## Verification limits and references

Automated tests use fake Google/Ollama endpoints, real local HTTP requests and actual local encryption. They verify setup, stale/expired checks, atomic settings merge/reload, privacy, permission denial, workspace activation, interrupted-intent recovery and download failure/cancellation/retry. They do not establish successful real Google authorization, a downloaded model or inference on the recipient's hardware. No large model was downloaded during implementation validation.

API implementation references: [Google Sheets metadata](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get), [Sheets range reads](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet), [Ollama pull endpoint](https://docs.ollama.com/api/pull), [Ollama Windows installation](https://docs.ollama.com/windows), and the [smaller model listing](https://ollama.com/library/qwen3:1.7b).
