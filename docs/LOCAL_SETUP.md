# Guided local workspace setup

Current release: **0.12.3** (major 0 · update 12 · patch 2). See [version history](../CHANGELOG.md).

Use **Settings → Real workspace setup** in the portable Windows app. There are no environment-file edits, terminal commands or server restarts in this flow.

## Windows first-run setup (0.12.0)

Extract the entire Windows ZIP and double-click **Setup_BREKTRA.exe** in the BREKTRA folder. Keep the EXE, setup scripts/XAML, runtime and app files together. The wizard uses Windows PowerShell/.NET Framework supplied with Windows, without requiring Node, WebView2 or another UI runtime installation. Windows 10 22H2+/Windows 11 x64 is required; allow at least 8 GB free on the Windows user drive and several GB of downloads. Custom model storage drives need sufficient space too. BREKTRA's setup EXE is currently unsigned; managed computers may require administrator approval of the release. Do not disable Windows security protections.

Choose Next through the checks and local AI step. Automatic Ollama installation uses the official HTTPS installer, verifies its Windows publisher signature, and runs its per-user installer. Cancellation stops downloads, not an installer already applying changes; retry resumes model layers retained by Ollama. If publisher verification, a proxy, policy or installation blocks automation, use the official download button, install Ollama yourself, and retry. Ollama/model storage is outside the portable folder and is not removed when closing BREKTRA. Setup does not replace existing installations just to update them.

Create the first owner or sign in to the existing installation as owner/admin. Google requires your actions in its portal: enable Sheets API in your project, create/select a service account and JSON key, and share a dedicated spreadsheet with the service-account email as Editor. The wizard provides the portal buttons, file picker and email copy. Next checks access; **Connect workspace** explicitly confirms creation of control tabs, pauses campaigns/mailboxes and never copies demo records. Keys/passwords remain in memory during setup and are saved only by the existing encrypted server infrastructure. A configured workspace is preserved; an explicit **Set up Sheets later** choice leaves demo mode, clearly labeled at review.

**Launch BREKTRA** verifies readiness and opens Settings in your default browser. Sign in again there. Continue any Gmail/LinkedIn provider approvals in Settings; these are not dependencies the installer can grant. No outreach is enabled by setup. On upgrades keep the existing installation's private .runtime; never distribute that configured folder. Reopening setup rechecks files and reuses installed models. Closing unfinished setup stops a server it started, while leaving a pre-existing server alone. **START BREKTRA** remains the quick launcher after setup, and **STOP BREKTRA** stops the app. LAN firewall access remains an explicit ALLOW LAN ACCESS action when needed.

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
2. Click **Start Ollama** to start an installed Windows copy on the configured loopback endpoint. Standard install folders and absolute PATH locations are checked. A spinner shows startup progress and any startup error appears beside the button. If Ollama is missing, use **Install Ollama** and finish the installer first. If it is already running, starting is a no-op. Other custom installation locations can be opened manually, then checked with **Check connection**. BREKTRA does not install software silently.
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

## LinkedIn account connection (0.5.0)

In 0.6.0, choose **Start walkthrough** or **Skip for now** in LinkedIn accounts. The optional animated guide shows one task at a time, with progress, Back/Continue, pause/resume and reduced-motion support. Administrators follow app creation/selection, product access, callback copying, private credential entry and authorization. Teammates reuse the configured application. Portal tasks are confirmed by the user; real account completion requires a current saved connection. Progress is browser-local per user/company and contains no credentials; clearing browser storage resets it. The guide does not operate LinkedIn or enable outreach.

Guide references: [OpenID Connect setup](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [application and HTTPS callback setup](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow), [Page association](https://www.linkedin.com/help/billing/answer/a548360).

Settings → LinkedIn accounts guides users through connecting their own account. An administrator creates a LinkedIn developer application, enables Sign In with LinkedIn using OpenID Connect, registers the exact callback shown in Settings, and saves the client ID/secret privately once per server. Teammates then use Connect LinkedIn and authorize on LinkedIn. A healthy persistent Sheets workspace is required; demo cannot save real connections. Connect an existing unused account label through the administrator selector to preserve campaign references. Hosted teammates use their own authenticated BREKTRA sessions and one shared HTTPS server; portable mode uses the host PC with optional trusted LAN browser access.

BREKTRA requests only openid/profile for account identity. It does not request posting or email permissions. Tokens stay encrypted on the server; users never paste cookies or LinkedIn passwords into BREKTRA. Expired/revoked connections need a new authorization; automatic refresh is not assumed. Read-only checks run approximately every 15 minutes while the app runs. Reconnect/disconnect/check controls apply to the owner; failed checks and disconnect pause campaigns. Disconnect removes the locally stored token; users can additionally revoke BREKTRA through LinkedIn permitted services.

Account connected does not mean outreach enabled. Invitations, messages and reply sync require separate approved access and remain disabled. Approved drafts can be copied and their lead profile opened for manual sending after current owner/approval/opt-out/reply checks; this does not record delivery or advance a sequence. Actual LinkedIn app/consent/callback testing remains unverified, including whether LinkedIn accepts the portable loopback callback. A registered HTTPS hosted origin may be needed; do not assume sign-in alone permits sending.

## Access from phones and other LAN devices (0.8.0)

Start BREKTRA on one PC. Portable startup enables BREKTRA_LAN=1 unless .env or the process environment sets it to 0. Open Settings → Access from other devices and use the WiFi/Ethernet IPv4 URL on devices connected to the same network. Keep the PC awake. All devices use this one workspace and runner; do not start another copy against the same Sheet.

Run ALLOW LAN ACCESS on the host PC and approve the Windows administrator prompt to permit BREKTRA through Windows Firewall. The rule permits only the bundled executable, the current app port and ten fallback ports, and LocalSubnet peers. It supports Public WiFi profiles without changing the profile or disabling the firewall. Guest WiFi/AP isolation may still prevent device-to-device connections. Addresses can change after reconnecting WiFi.

LAN mode uses HTTP and now requires a separate login for every browser. Create the initial administrator on the host PC; subsequent registrations need admin approval in Team. Roles apply to UI actions and API permissions. Team provides basic profiles and private member messages. Local registrations and access settings survive restart in encrypted authentication storage; demo messages reset. Sheets stores the lasting workspace team. Keep `.runtime` when upgrading this installation. Only use it on networks whose users you trust. Server credential/AI setup is restricted to the host PC browser. LinkedIn/Google callbacks remain loopback URLs; authorize accounts on the host PC. Use the authenticated HTTPS deployment for individual user accounts or access outside the LAN. Set BREKTRA_LAN=0 in .env and restart for PC-only access. The source/server entry point remains loopback by default unless explicitly enabled.
