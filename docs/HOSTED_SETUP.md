# Hosted workspace, Gmail and feature setup

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](../CHANGELOG.md).

25 October 2026 (Asia/Karachi). The server bundle implements a single shared workspace for teammates using separate browsers. Hosting, DNS, HTTPS, Google consent and intended-recipient tests have not been provisioned automatically. The Windows portable app remains local and uses sample data by default.

## What is implemented

| Feature | Current behavior | External setup/limits |
| --- | --- | --- |
| Sequences | Ordered steps, delays, manual enrollment, exact-version review, campaign hours/budgets, reply/opt-out stops, explicit reasoned resumption | Gmail is the live transport adapter. LinkedIn steps remain disconnected outside demo. |
| Gmail outreach | OAuth state/PKCE, protected refresh tokens, sending switch, shared mailbox budget, plain-text MIME send, provider acceptance and uncertain-result reconciliation | Requires your Google OAuth client, enabled Gmail API, consent and a persistent Sheets workspace. No recipient-delivery/open tracking is claimed. |
| Inbox | Tracked conversations, deduplicated messages, text-only view, unread/done, assignment and reviewed replies | Initial adapter supports 100 tracked contacts/conversations and at most 500 search matches per contact batch. Incomplete sync stops sending; it never skips pages and assumes there was no reply. |
| Enrichment | Explicit company-page metadata/email evidence and email-domain MX lookup, provenance and accept/reject | Public HTTPS IPv4 websites only. No personal-email guessing, personal-profile enrichment, paid databases or deliverability verification. |
| Teams | Separate password logins, expiring one-use invitations, owner/admin/operator/reviewer/viewer roles, protected API access, session revocation, audit actors | One shared server/process and one Sheets workspace. Not a multi-tenant SaaS or horizontally scaled deployment. |

## Local walkthrough

1. Extract/start the portable app. Inbox contains a clearly labeled sample conversation; its reply composer sends text to Review queue, not to a recipient.
2. In Campaigns, open **Sequence**. Add up to eight steps, configure delays and select a mailbox for email. Enable and save while the campaign is paused/draft. If the campaign has old queued jobs, explicitly cancel those queued jobs first; running/uncertain work must be resolved.
3. Open Leads' contact/evidence button to supply an email/website and separately approve a lead for outreach. Sample leads are already approved only in demo. Real imported leads start pending. Sheet imports need a name and either a supplied email or LinkedIn profile; email-only leads cannot run LinkedIn steps. Check a company page if useful, then accept/reject its sourced evidence. Website addresses are not automatically treated as the person's email.
4. Enroll selected approved leads, then start the campaign. Each due step appears in **Review queue → Sequence & email**. Approve its exact recipient/subject/body. Demo actions simulate only, and its sample mailbox starts with sending paused.
5. Replies/opt-outs/rejections stop future sequence actions. Preparing a manual inbox reply also stops automatic follow-ups for that lead. Resumption requires an explicit reason, current lead approval and another review of unsent text. Sequence changes stop older enrollments; a new version can be explicitly enrolled without deleting old history.
6. An uncertain action has no automatic resend. Use **Check Gmail sent copy** after reconnecting a real mailbox. A unique matching RFC Message-ID, sender, recipient, subject and text are required to verify acceptance. No matching copy leaves it uncertain. An admin can alternatively expand **Resolve after manual investigation**, independently verify non-sending, attest to it and record a reason. This audited human resolution requires another exact-text review before any future attempt; an empty search alone never resolves the action. Recording a send result remains possible if a pause/opt-out happens during transport.

## Deploy the shared server

Prerequisites: a domain and HTTPS reverse proxy, a persistent machine with Node 24, a dedicated control spreadsheet shared with the service account, private persistent storage, and Ollama/model on that machine. The server operator must arrange backups and keep the machine awake/running.

Before moving an existing workspace, pause campaigns, stop every old desktop/server copy using that spreadsheet, and back up the control sheet and private infrastructure. Do not leave a portable copy running alongside the shared server. Local OS locks are not cross-computer ownership enforcement.

1. Build `pnpm package:server`. Extract `release/BREKTRA-Server.tar.gz` into a new server directory. This archive contains bundled backend code, frontend assets, documentation, software notices, a Dockerfile and `hosted.env.example`; no Node install/dependency install is needed beyond the server's Node 24 runtime. The portable ZIP still includes its own Windows runtime.
2. Store the filled environment file and service-account JSON outside the release directory. Set `BREKTRA_HOSTED=1`, `STORAGE_MODE=sheets`, the control ID/credentials path, a bare HTTPS `BREKTRA_PUBLIC_ORIGIN`, and a persistent secret key. A server operator can generate the key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`; place its output only in private server configuration. Never paste real credentials into a support chat or commit them.
3. Set the initial `BREKTRA_OWNER_EMAIL`, `BREKTRA_OWNER_NAME` and a strong `BREKTRA_OWNER_PASSWORD` of 12-200 characters. Start `node server.mjs --production` from the extracted directory, with that environment loaded by your service manager. Node's `--env-file=/private/path/hosted.env` is another option. Bootstrap creates a member in Sheets and an encrypted password hash in private infrastructure. Remove the bootstrap password from the environment after the owner exists; it is not an automatic recurring password reset.
4. Keep the default bind address `127.0.0.1`. Put the HTTPS reverse proxy in front of it, preserve the public Host header, and publish only the proxy's HTTPS endpoint. The server rejects unrelated hosts/origins and uses Secure, HttpOnly, SameSite cookies in hosted mode. Do not trust client-supplied forwarded headers or expose the bare HTTP application port.
5. Run exactly one workspace server instance per control spreadsheet. All teammate browsers connect to that instance; they never run competing desktop writers. A process restart signs browsers out; membership and work stay in Sheets. Existing running send intents recover as uncertain and are never automatically repeated.
6. Start Ollama on this server, install the configured model and leave its API loopback-only. Hosted inference runs on the workspace server, not on each teammate's laptop. In a Linux container, use a carefully configured host network with the same loopback services/reverse proxy, or run Node directly. The supplied Dockerfile is an optional deployment recipe; a Docker image/runtime has not been validated in this Windows environment.

Example reverse-proxy routing (adapt for your infrastructure; TLS/DNS setup is operator work):

```text
brektra.your-domain.example {
    reverse_proxy 127.0.0.1:4310
}
```

The proxy must forward the original public Host header. Add appropriate edge request/rate limits, monitoring and backups. Application login throttling deliberately uses the actual socket peer, not untrusted forwarded addresses; behind a local proxy the initial limit is shared across the workspace (30 attempts/15 minutes, and 8/email/15 minutes). This small-workspace design needs load/size validation before a broad paid launch.

## Prepare company ownership

The new [local setup wizard](LOCAL_SETUP.md) applies to personal local workspaces. Hosted/authenticated servers keep the operator-managed configuration in this guide; users cannot upload replacement server credentials or start executables through the local wizard.

In 0.3.0 an owner/admin can use Settings → Company setup to preview and assign the existing workspace to one company. This is optional, requires a restorable backup acknowledgement, and pauses campaigns/mailbox sending. It does not change the shared team visibility described below. Multi-company operation is blocked pending complete API/worker isolation. See [company migration and rollback](COMPANY_MIGRATION.md); older app versions cannot open company-owned schema v2 records.

## Connect Gmail

1. In your Google Cloud project, enable Gmail API, configure the OAuth consent screen/test users and create a **web application** OAuth client. In Settings → Gmail & email outreach → Google OAuth setup, copy the exact callback shown and register it with Google. Hosted callbacks use your HTTPS public origin; the portable callback uses `http://127.0.0.1:<port>/api/gmail/callback`.
2. Enter the client ID/secret in Settings. They are encrypted on the workspace machine. Windows personal mode wraps its encryption key with Windows DPAPI; hosted mode requires the stable `BREKTRA_SECRET_KEY`. Keep the key and `.runtime` volume private and backed up together. Configured folders are never shareable releases.
3. Click **Connect Gmail**, sign in yourself and grant the requested reading/sending scopes. The app verifies the mailbox identity and offline refresh grant. On returning, the mailbox is connected but **sending remains paused**. Workspace members can read the tracked messages copied into Sheets; disclose that before connecting a mailbox.
4. Set its shared budget and explicitly enable sending. Only approved actions can run, after a complete reply check and current schedule/permission/opt-out checks. Sync errors stop dispatch until an explicit successful sync/reconnect. A revoked account must be reconnected. Disconnect removes this server's stored mailbox tokens and pauses sending; provider-account access can also be revoked in Google.
5. Validate with a dedicated test mailbox/control spreadsheet and intended recipient. Verify exact content, acceptance, incoming reply, stopped follow-up and restart behavior before using real prospect data.

Google classifies Gmail scopes and may require OAuth verification/security assessment depending on scopes, deployment and use. This code does not obtain Google's production approval. See the official [scope requirements](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server) and [Gmail send API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).

## Team access and recovery

An owner/admin creates a 24-hour one-use invitation link in Settings. No invitation email is sent automatically. Share it privately with the named recipient; they set their password and sign in using the invited email. All active roles can read the workspace, so conversation assignment is an organizational feature, not private row-level access.

- Owner: all actions; manage other owners/admins, with protection against removing the last active owner.
- Admin: workspace configuration and ordinary membership management; cannot modify owner/admin privileges.
- Operator: campaigns, leads, enrichment, inbox and message review/approval. Operators can approve their own work in this initial policy.
- Reviewer: lead/message approval and draft editing, with read access; cannot start campaigns, connect mailboxes or manage members.
- Viewer: read-only API and UI.

Role/member changes revoke that member's existing sessions. Password changes revoke all their sessions. An outstanding action approved by someone who no longer has review permission cannot dispatch. Draft version checks prevent stale browser edits from overwriting a teammate's changes. Authentication/invitations/sessions are not added to portable packages.

For lost owner access, the server operator can stop the server, set the exact active owner's email and a new password in the private environment, set `BREKTRA_RESET_OWNER_PASSWORD=1`, start once, then remove the recovery flag/password and restart. This is an explicit operator recovery action and records an audit event. It does not bypass the last-owner rule or invent a new owner in an existing workspace. Restore encrypted infrastructure and the matching key from backup if either is lost; the app never silently overwrites unreadable private storage.

## Validation boundaries

Automated tests use mocked Gmail and Sheets plus real local HTTP sessions and local encryption. Browser checks use demo content. The clean Windows ZIP is tested from a fresh extraction. Hosted DNS/TLS deployment, Google OAuth production approval, real mailbox sending/receiving, live CRM mutation and actual hosted Ollama require the operator resources and dedicated integration test. LinkedIn login, profile verification, live invitations/messages and source CRM writeback remain unfinished original backend work; none is implied by the Gmail feature.
