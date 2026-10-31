# BREKTRA version history

Current release: **0.12.3** (major 0 · update 12 · patch 2).

Numbering uses `MAJOR.UPDATE.PATCH`. New working functionality increments UPDATE and resets PATCH; fixes, refinements, packaging, and documentation-only releases increment PATCH. Breaking releases or a deliberately validated stable milestone increment MAJOR. Major 0 is pre-release. See [working notes](docs/WORKING_NOTES.md) for the standing release rule.


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

## 0.11.1 — 31 October 2026 — fixed address and LAN invitations

The portable launcher keeps default port 4310 (or the explicitly configured PORT), reuses its own instance and refuses conflicts with another installation or application. It no longer shifts to another port/workspace. Stop older servers before a fresh user-facing launch; leave all servers stopped when requested. Existing installation data remains private and is preserved.

Host-created team invitations use detected private LAN addresses automatically. LAN creators keep their current interface; PCs with multiple interfaces offer alternative addresses. LAN mode with no interface fails before creating an unusable invitation. PC-only links explain their local scope; hosted links retain the configured HTTPS origin. Settings explains stable-port bookmarks and router IP reservations. The firewall helper targets the configured single port. No firewall settings are changed automatically.

## 0.11.0 — 31 October 2026 — username sign-in

Registration and invitation acceptance offer unique usernames (3–30 letters/numbers/dots/underscores/hyphens, starting with a letter/number). Sign in with username or email, ignoring case and surrounding whitespace. Existing email-only accounts remain compatible and can choose/change a username in Team using their current password. Team search, directory, profiles and authenticated identity include usernames. Names remain separate from login identifiers. Pending/disabled/deleted accounts cannot sign in; reserved usernames cannot be reused by another member. Email and username share the per-account attempt limit. Usernames persist in Sheets team records or encrypted local authentication infrastructure.

Keep the configured installation's `.runtime` on upgrade. A fresh extraction is a separate installation; identities already cleared by older releases cannot be reconstructed. Login failures provide recovery guidance without revealing account existence. No personal account or credentials are included in the shareable artifacts.

## 0.10.1 — 31 October 2026

Light appearance now shares Obsidian Mint’s mint actions, tinted surfaces, blue secondary accents, active navigation, gradients and semantic status/focus treatments. Daylight text colors preserve readable contrast; palette swatches follow the selected lighting.

## 0.10.0 — remembered registrations and access appearance

Local account identities, roles, approval/deletion state and invitation metadata now persist alongside password hashes in encrypted authentication infrastructure. Sessions still expire on restart. Sheets remains authoritative for connected teams; demo CRM and messages remain temporary. Existing registrations already lost by older demo restarts cannot be recovered from password hashes alone. Keep the installation's private `.runtime` folder when upgrading; a fresh extraction is a separate installation.

Access screens default to sign-in when registered identities exist, provide a sliding Sign in/Register selector and animated form entrance with reduced-motion support, and expose a browser-saved Light/Obsidian Mint switch before login.

## 0.9.1 — 31 October 2026

- Refine Team directory, profile/access controls, invitation roles and link sharing, conversation layout, empty states and account security across desktop/mobile and light/dark themes.
- Add purposeful click animations to interface icons, including bell, refresh, send, arrows and access controls, with keyboard activation and reduced-motion support.

## 0.9.0 — 31 October 2026

- Require login for LAN access; add first-administrator registration on the host and admin-approved teammate registration.
- Add sidebar Team directory, basic profiles, private messaging, role assignment, invitations, disable/delete controls and password changes.
- Hide administration controls from non-admins and review navigation from viewers; enforce role restrictions and participant-only message projection at the API.
- Persist team messages in Sheets. Demo identities/messages reset on restart; no real Sheets/provider or hosted deployment validation is claimed.

## 0.8.0 - 31 October 2026

- Enable trusted LAN sharing from the portable launcher; Settings shows network addresses for phones, tablets and computers.
- Restrict access to attached private IPv4 subnets and actual interface addresses; preserve same-origin checks and host-PC-only server setup.
- Include an administrator-run, app-specific LocalSubnet firewall helper. Portable browsers share the current workspace directly unless authentication is configured.
- Keep one runner and Sheets writer on the host PC; retain PC-only opt-out and authenticated HTTPS hosted mode.

## 0.7.0 - 31 October 2026

- Add Settings → Personalization with Light, Dark (Obsidian Mint), and device appearance. Save the preference per browser and synchronize other tabs.
- Apply mint, charcoal and semantic status colors across the app, including access screens, charts, forms, dialogs and onboarding.
- Derive company and authenticated-user marks from saved names. Local mode uses a device icon and Local session.
- Add actionable review counts and current connection health to navigation. No sample names or connection claims are inserted into workspace data.

## 0.6.0 - 31 October 2026

- Add an optional animated LinkedIn setup walkthrough with Start/Skip, one task at a time, Back/Continue, pause/resume and per-user browser progress.
- Guide administrators through app/product/callback/credential setup; teammates skip that work when the team application is configured.
- Show completion only for a current saved account connection. Illustrations explain the steps without controlling LinkedIn.
- Support keyboard focus, reduced motion and inline recovery; tutorial progress never stores credentials.

## 0.5.0 - 31 October 2026

- Add owner-bound LinkedIn OAuth/OIDC account connection, reconnect/disconnect, automatic checks and an administrator-only setup panel.
- Guide SDRs through workspace, account and campaign preparation; provide approved-message copy/open handoff without claiming delivery.
- Keep LinkedIn outbound transport disabled and package no account tokens or personal settings.
- Retain the immediately preceding clean build and clarify Desktop launcher/share shortcut labels.
- Real LinkedIn authorization and partner outreach access remain unverified.

## 0.4.1 — 30 October 2026

- Explains when Ollama is missing and keeps startup errors beside the Start Ollama button.
- Shows a startup spinner and waiting message. Detects custom Windows installations on an absolute PATH as well as standard install folders.
- Ollama installation remains an explicit setup step; starting BREKTRA does not install Ollama.

## 0.4.0 — 27 October 2026

- Replaces local environment/terminal setup instructions with a guided Settings flow: key file, spreadsheet URL, read-only check and one-use connection confirmation.
- Saves setup encrypted and activates the real Sheets workspace immediately, without copying demo data or requiring a restart. Keeps target work paused, preserves uncertain intents and rejects stale requests.
- Adds installed-Ollama start, supported-model downloads with progress/cancel/retry, and installed-model selection. Google permissions/sharing and initial Ollama installation remain user actions; hosted/authenticated teams keep operator-managed configuration.
- Adds local setup documentation, meaningful mocked-provider/HTTP/encryption coverage and fresh-package setup checks. Live-provider and visual-validation limits remain explicit.

## 0.3.0 — 27 October 2026

First company-ownership preparation milestone for the twelve-shard roadmap; full multi-company operation remains unavailable.

- Adds Settings preview/apply for assigning all legacy records to one company, with backup acknowledgement, complete-state fingerprint checks and in-flight-work blockers.
- Adds company/membership/migration tables, preserved historical state, paused dispatch, immutable ownership, cross-reference checks and recoverable atomic saves. Scoped records use schema v2; app and schema versions remain separate.
- Adds tested future company-role contracts. Current workspace permissions remain in effect; the runtime blocks second/archived companies until API/worker isolation is implemented.
- Adds migration/recovery documentation and new automated coverage, bundled with fresh Windows/server distributions. Live-provider validation and browser visual verification retain their documented limits.

## 0.2.0 — 26 October 2026

Establish the first consistently numbered release of the existing outreach expansion. This is update 2, patch 0; it does not imply that live integration validation has been completed.

- Includes the existing campaign sequences, Gmail transport, inbox, sourced company enrichment, hosted team controls, persistence/recovery foundation, and opt-in AI example collection documented in ABOUT_BREKTRA.md and IMPLEMENTATION_STATUS.md.
- Adds one package-derived release number in the UI and health API, generated VERSION.txt in both distribution packages, consistent current-release document labels, and a build-time version consistency check.
- Includes the ABOUT_BREKTRA overview and version history in both distributions.
- Live LinkedIn remains unavailable. Real Gmail/Sheets/Ollama and external hosting validation retain their documented limits.

## Before consistent numbering

The package and health API previously identified the app as 0.1.0. Earlier work was recorded by date in docs/IMPLEMENTATION_STATUS.md without separate release numbers. Historical entries remain unchanged; no patch history has been invented.
