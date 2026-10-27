# BREKTRA implementation plan

Current release: **0.4.0** (major 0 · update 4 · patch 0). See [version history](../CHANGELOG.md).

Updated: 25 October 2026 (Asia/Karachi).
Status: implementation started with stage 1. See `IMPLEMENTATION_STATUS.md` for delivered behavior and validation limits. Live LinkedIn integration remains unavailable.

27 October 2026 extension: implementation of the [twelve-shard company roadmap](UPDATE_0.3.0_IMPLEMENTATION_PLAN.md) has started. The first 0.3.0 build adds [reviewed single-company preparation](COMPANY_MIGRATION.md); multiple companies remain blocked pending complete isolation. The new specification requires a compliant, authorized integration before enabling live LinkedIn; earlier stages below do not override that gate. No new live LinkedIn capability is delivered.

## What we are building

A local app that uses your selected LinkedIn account and Google Sheets CRM to find suitable leads, send connection requests, check acceptances, prepare pitches with local AI, and send reviewed pitches. It will keep the CRM updated and notify you when something needs attention.

Google Sheets stays the only persistent application database. We will extend the current app and keep its existing campaign settings and design. Every completed stage includes tests and a rebuilt portable Windows app.

## What already works

The app has campaign screens, schedules, daily limits, lead import from Sheets, saving to a dedicated control spreadsheet, AI draft generation through Ollama, and pitch review. Demo requests and deliveries are simulated.

LinkedIn login, real profile checks, live requests/messages, reply detection, source CRM updates, client approval and configurable system notifications still need implementation. Approving a pitch in the current real-data mode does not send it.

## 1. Save progress safely

- Keep campaigns, lead decisions, drafts and job progress after restarting the app.
- Check saved data before using it and upgrade older records without losing settings.
- Record a planned send before doing it, then save its verified result.
- If a send might have happened but its result is unclear, stop and ask for a check. Never automatically send it again. Keep its daily-limit allowance reserved.
- Prevent two local app processes from controlling the same workspace. Continue allowing only one computer at a time to control a spreadsheet until shared ownership is properly supported.
- Save only changed Sheets records where possible. Stop sending when saving fails, and provide a clear reconnect/recovery action.

Done when: restart, overlapping edits and connection-failure tests preserve progress and cannot cause duplicate sends. Invalid saved data gives a useful error instead of starting campaigns.

## 2. Connect accounts and services

Local setup portion delivered in 0.4.0: Settings provides Google credential selection, read-only sheet checks, encrypted configuration and activation without restarting, plus installed-Ollama start/download/selection controls. Google authorization/sharing and initial Ollama installation remain user actions. This does not implement LinkedIn sessions or establish live-provider validation. See `LOCAL_SETUP.md`.

- Add Settings controls to configure Google Sheets and the local AI model.
- Let you open LinkedIn and log in yourself. Remember a separate browser session for each account and confirm which account is logged in.
- Show whether an account is ready, needs login, or needs attention.
- Pause that account if login expires or LinkedIn asks for a check. Keep its pending work.
- Keep credentials and sessions private and out of the shareable ZIP.
- Test the browser connection on this machine before choosing and packaging its supporting software.

Done when: setup can be checked from Settings, account sessions survive restart, accounts remain separate, and private information is never returned to the frontend or shipped in a release.

## 3. Check leads and approve clients

- Read relevant profile facts and show where they came from and when they were checked.
- Check whether each person is connected, has a pending invitation, or can receive a request. Unclear results wait for review.
- Add a lead/client review list with approve and reject actions before outreach. Here, "client approval" means your decision that a prospect is suitable to contact; it is separate from someone accepting a LinkedIn invitation.
- Keep client approval separate from pitch approval. A rejected or opted-out lead cannot receive outreach; a pending lead waits for approval.
- Check pending invitations for acceptances and prepare drafts for eligible approved connections in active campaigns.
- Detect replies and stop future queued outreach to that person. Resuming requires an explicit user action.

Done when: verified profile and relationship checks work without sending anything, approval decisions persist, unapproved/rejected leads cannot send, and acceptance/reply events are recorded once.

## 4. Update the correct Google Sheets CRM rows

- Let you map CRM status columns and choose the actual dropdown values used by your sheet.
- Update statuses such as request pending, connected, pitch sent, replied, opted out and needs attention, where your sheet supports them.
- Find the lead again before writing, so moving rows does not update the wrong person.
- Stop and explain duplicate matches, missing rows or changed columns rather than guessing. Keep account-specific statuses separate when needed.
- Preserve formulas, formatting, dropdowns and unrelated cells.
- Retry a failed CRM update separately. Never repeat a LinkedIn send just because its CRM update failed.
- Define refresh/conflict rules so importing stale sheet data cannot undo an opt-out or verified result.

Done when: a dedicated test CRM stays correct after row moves, duplicate matches, failed saves and restarts, without damaging other cells.

## 5. Send real connection requests

- Use the selected campaign account, approved leads, working hours and daily limits.
- Recheck the account, relationship, campaign status, approval and opt-out immediately before sending.
- Confirm that a request was actually sent before counting it as successful.
- Pause for uncertain outcomes, expired login or account checks. Provide a way to inspect and resolve the issue before retrying.
- Update activity totals and queue the CRM status update after confirmation.

Done when: an intended test recipient receives a verified request, and crash, timeout, pause and saving-failure tests cannot create duplicate requests. Shared account limits and the existing 50/50 campaign rules still apply.

## 6. Prepare, review and send pitches

- Give local AI the verified lead facts and your saved company, target customer, selling context, pitch style, prompt, strategy and samples.
- Show the facts used and record the model/prompt version. Do not invent profile details.
- Put drafts into the review queue. Let you edit, approve or reject them. Unsuitable leads cannot send; unclear suitability remains visible for review.
- Send only the exact approved version. Editing an approved version requires another review.
- Before sending, check again for replies, opt-outs, client approval, connection status, campaign hours and daily limits.
- Verify delivery before marking a pitch sent. Uncertain delivery waits for investigation instead of an automatic resend.
- Prevent work completed after a pause or opt-out from publishing an outdated result.

Done when: real local AI produces useful evidence-based drafts, reviewed test delivery is verified once, and stale, rejected or unapproved drafts cannot send.

## 7. Add system notifications and Settings controls

Show Windows desktop notifications as well as an in-app notification list. Clicking a notification opens the relevant review item, client, campaign or Settings issue. A notification never approves or sends anything by itself.

Notify for:

- New pitches ready for review or approval.
- Leads/clients waiting for your approval, and recorded approval/rejection decisions.
- Connection requests accepted and new replies received.
- Login required, expired sessions or account checks.
- Sheets saving/update failures, failed AI generation, and campaign errors that need action.
- Sends with an uncertain result that need checking.
- Campaign completion or no eligible work remaining, and daily limits reached, if enabled.

In Settings, provide:

- A main system-notification on/off switch.
- Separate switches for each notification type, including separate review reminders and approval-decision updates.
- Immediate alerts or grouped summaries for routine updates.
- Optional reminders for outstanding pitch/client reviews, with an interval and a way to stop reminders once resolved.
- Quiet hours with a chosen timezone, optional sound, and an explicit choice of which urgent errors may interrupt quiet hours.
- A privacy choice: show names/message previews or use a generic "BREKTRA needs your attention" message.
- A test-notification button and a clear status explaining whether Windows allows notifications.

Implementation requirements:

- Use app events so notifications match saved results, not repeated screen refreshes. Group repeated alerts and avoid duplicates after restarting.
- Save unread notifications and review reminders in the Sheets workspace. Save this computer's desktop preferences as local settings; do not bundle them into a release.
- Build and validate a Windows notification helper for the portable app. Do not rely only on a browser tab being open. Notifications should work while BREKTRA runs in the background, including after closing its browser tab; they cannot fire while BREKTRA is stopped or the computer is asleep.
- If desktop notifications are blocked, keep the in-app list available and show how to enable them. Mark demo notifications clearly.

Done when: Settings choices persist, test notifications work from a fresh portable extraction, closing the browser tab does not stop alerts, clicks open the correct page, quiet hours/privacy choices work, and reminders stop after review. Verify blocked-permission behavior and no repeated alerts after restart.

## 8. Collect useful examples for a future custom AI

Keep using Ollama while collecting examples from normal work. This prepares us to fine-tune an existing model later; it does not start training automatically or guarantee an instantly good custom model.

For each generation and review, save:

- The exact campaign instructions, context prompt, pitch strategy, samples and lead facts available when the draft was generated. Save a snapshot, so later campaign edits cannot change the meaning of an old example.
- The original AI draft, its fit decision/evidence, model name and version where available, prompt version, generation settings and time.
- Each saved revision and the final edited pitch, linked to the original draft. Distinguish AI text from human edits and record the version that was approved.
- Approval/rejection decisions and optional plain-language reasons, such as "too pushy", "not relevant" or "invented a fact". Keep lead/client approval separate from pitch approval.
- Confirmed sending results and later replies/outcomes, with timestamps and links to the relevant attempt and approved revision. Record unknown results as unknown. A reply or approval alone does not prove the example is high quality.

How to collect and store it:

- Add dedicated training-example and feedback tabs to the Sheets control workspace, with stable IDs and a versioned record format. Keep Google Sheets as the persistent database.
- Define the records and collection hooks in stage 1, add lead decisions in stage 3, and connect original drafts, human edits and approved versions in stage 6. Add delivery/reply outcomes when those features are verified. Do not wait until a future training project to begin collecting.
- Save examples from committed app events, not screen refreshes. Prevent duplicate examples after retries or restarts and preserve their revision history. Record collection failures clearly without repeating an external send.
- Keep demo, test and simulated records labeled and excluded from real training exports by default. Preserve rejected examples as negative feedback; never export them as preferred answers.
- Existing work can be imported only where the original inputs and decisions are actually available. Mark missing history as missing; do not reconstruct it as if it were captured at generation time.

In Settings, provide:

- An explicit training-data collection switch, with a clear explanation of what is saved. When off, stop new training-example collection; ordinary app records still follow normal workspace storage rules.
- Controls to inspect, exclude and delete collected examples, plus retention settings. Do not let deleted/excluded training examples return through an automatic backfill.
- A local export action with a preview and personal-data removal options. Remove credentials, cookies, account identifiers and unnecessary names/contact details; replace personal details consistently so examples still make sense. Review free-text notes and pitches for remaining personal details.
- Export a versioned JSONL dataset (one example per line), including input/final-answer pairs and separate original-versus-edited preference examples where the human decision supports that pairing. Keep metadata and negative/outcome labels explicit. No automatic upload or training.

Before future training:

- Clean duplicates, unsupported claims, incomplete records and conflicting labels. Only include examples allowed by the collection/privacy settings and reviewed for the intended use.
- Keep a separate set of examples for evaluation, grouped by lead/conversation and similar templates so near-identical examples cannot appear in both training and evaluation.
- Compare the trained model against the current Ollama baseline for factual accuracy, instruction following, style and usefulness, not just reply counts. Decide whether training helps based on these results; data quantity alone is not enough.

Done when: a generated draft can be traced through edits, feedback and verified outcomes after restart; turning collection off stops new examples; exclusion/deletion and demo filtering work; an export contains valid, correctly linked and privacy-reviewed examples without duplicates. Keep exports and collected data out of the portable release ZIP. Tests must cover these controls and the separation of training/evaluation examples. Actual custom-model training remains a later decision.

## 9. Check the full workflow and build the portable app

- Show clear account, Sheets, AI and campaign health with useful waiting reasons and recovery actions.
- Test several campaigns/accounts, daily limit resets, scheduled and continuous running, new imports, expired sessions and restarts.
- Measure Sheets usage and practical workspace size. Retry safe reads/updates with delays; never blindly retry a send.
- Test with a dedicated spreadsheet, local AI, an authenticated test account and intended recipients. Report separately what was verified with real services and what used test data.
- Document setup and upgrades. Preserve configured users' data while keeping credentials, sessions, logs and personal preferences out of the release ZIP.
- Build and test the Windows portable app after every stage, including any required browser and notification helpers.

Done when: the complete intended test workflow works, all checks pass, and a clean extracted copy starts, serves the app, reuses its running process, shows notifications and stops correctly without requiring Node installation.

## Working order and completion rules

Build stages 1–6 in order. Define notification events/preferences alongside stages 1–3, then finish desktop notifications in stage 7 before final end-to-end validation. A notification type only becomes active when its underlying feature works. Start stage 8's dataset structure and collection hooks in stage 1, connect reviews in stages 3/6 and outcomes in stages 3/5/6, then complete dataset controls/export before stage 9. Do not postpone collection until the rest of the backend is finished.

For every completed stage:

1. Update `docs/IMPLEMENTATION_STATUS.md` with what works and what remains.
2. Run `pnpm build`, then `pnpm test` with checks relevant to the change.
3. Run `pnpm package:windows` and test a fresh ZIP extraction.
4. Inspect the ZIP for private files and report the release path and any unverified integrations.

Actual service testing requires dedicated Sheets credentials/control and CRM spreadsheets, intended dropdown values, Ollama with its model, and an interactively logged-in LinkedIn account with intended test recipients. Do not include these private resources in the release.

The user subsequently authorized automatic follow-up sequences, Gmail outreach, sourced enrichment, a conversation inbox and a hosted team workspace. See `OUTREACH_EXPANSION_PLAN.md` for that extension and its acceptance rules. Hosted team access uses one shared workspace server/runner, not simultaneous independent desktop writers. A replacement application database and horizontally scaled Sheets writers remain outside scope. The original live LinkedIn integration stages still apply.
