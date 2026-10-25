# Workspace storage, upgrades and recovery

Stage 1 implementation, 25 October 2026 (Asia/Karachi). Google Sheets remains the only persistent application database. Demo mode is deliberately in memory.

## Upgrade an existing Sheets workspace

1. Stop all BREKTRA processes using that control spreadsheet, on every computer.
2. Make a Google Sheets copy of the dedicated control spreadsheet as a backup. Preserve your existing private `.env` and credentials outside the shareable package.
3. Extract the new portable ZIP into a fresh folder, then configure that copy to use the existing control spreadsheet. Do not run the old copy simultaneously.
4. Start BREKTRA and inspect Settings, campaigns, leads and the job queue before starting campaigns. Existing running campaigns can resume queued eligible work after successful recovery; pause them before upgrading if this is unwanted. No live LinkedIn sending exists in this build.

The existing `id`/`data` columns stay intact. New/updated `data` cells use `{ "schemaVersion": 1, "record": { ... } }`. Original unversioned JSON records are accepted, migrated, validated, and saved without resetting campaign context, working hours, modes or allocations. Missing legacy messaging fields use the existing migration defaults. Unknown future versions are rejected instead of being downgraded. Downgrading to the old app after migration is unsupported; use the backed-up spreadsheet with the old app.

The app creates WorkspaceSettings, TrainingExamples and TrainingFeedback alongside its original control tabs. New collection starts off. Existing drafts have missing generation history; the app never reconstructs that history from today's campaign settings. Invalid records, duplicate IDs/profiles/actions, inconsistent references, malformed dates and unsafe enum/boolean values block loading and dispatch with the collection/field or row needing correction. Invalid state is not replaced with demo data or an empty save.

## Save and ownership rules

- Local OS locks are acquired before reading/recovering Sheets. One lock covers the physical workspace folder; a second covers the control spreadsheet ID, across copies and ports on this Windows machine. Process death releases ownership without trusting stale PID files. The portable launcher's existing process-reuse behavior remains.
- Only one computer may control a spreadsheet. These are local locks, not a distributed lease. A read-before-write comparison detects edits between saves but cannot make cross-computer concurrent writers safe. Do not manually edit control tabs while BREKTRA is running.
- A save reads all control `A:B` ranges in one batch, checks against the last confirmed snapshot, and writes only changed rows. Rows retain their physical locations; new records reuse empty slots and removed records clear their two cells. Activity is sorted newest-first on reload.
- Growth and value changes across all tabs commit in one `spreadsheets.batchUpdate` using `updateCells` with only `userEnteredValue`. Values are explicit strings, so imported text is never evaluated as a formula. Formatting and unrelated cells are preserved. Source CRM tabs remain read-only.
- A successful HTTP response is required before publishing candidate state in memory. Failed/ambiguous saves are never blindly retried. Dispatch and further mutations stop until reconciliation. Full control reads and linear validation are intended for the present small workspace; quota/size benchmarking remains stage 9 work.

Atomic batch semantics follow [Google's Sheets batch documentation](https://developers.google.com/workspace/sheets/api/guides/batch). This does not create a compare-and-swap transaction across independent writers.

## Reconnect and uncertainty

After a connection/write conflict, stop other copies and outside edits, then use **Settings → Reconnect & sync**. The app reloads and validates remote records before resuming mutations; an unknown save may already have committed, so reconnect adopts its actual stored result. If a row is malformed, stop the app, restore/correct that row from the backup, then restart/reconnect. Do not delete job history to retry an action.

An interrupted outbound intent becomes `uncertain` without creating another job. Its original intent time is preserved, and its allowance remains reserved even across day boundaries until resolved. It cannot be automatically retried. This build has no live outbound actions or user-facing uncertain-send resolution; the later verified-delivery milestone must add explicit outcome investigation/resolution before enabling sends.

An interrupted generation becomes failed, because it cannot have sent anything. Restart the campaign explicitly to queue another generation. A pause, changed lead/campaign, opt-out or reconnect invalidates an in-flight generation. Quickly resuming or reversing the opt-out cannot revive that old job. Its outdated result cannot enter review.

## Initial training-data and notification contracts

Settings stores the collection choice in WorkspaceSettings. When enabled, a generation's job intent and immutable campaign/lead/model/prompt-version/settings snapshot save together. The result and original text/fit/evidence link to its draft when committed. Subsequent saved edits and decisions record the exact reviewed text and optional reason in TrainingFeedback. Identical revision retries are deduplicated; rejected decisions remain negative feedback. Captured records remain when collection is switched off; new text capture stops, including a generation that completes after the switch. Ordinary app drafts still save normally.

Events share the workspace commit: Activity now identifies pitch-review, review-decision and essential-error event types. A desktop preference type defines computer-local notification settings. Desktop delivery, unread notifications, reminders and the full set of categories are not implemented yet. These contracts do not imply Windows alerts work.

Collection inspection/deletion, exclusions, retention, reviewed anonymized exports, evaluation separation and verified live outcomes remain stage 8/later-stage work. There is no backfill, export, upload or training action in this build. Demo/test examples stay labeled. The clean ZIP includes application code and documents only, never collected records or credentials.

## Validation boundaries

Automated tests use a stateful mocked Google endpoint and mock/template inference. They cover migration, row deltas/deletion/growth, invalid saved state, external conflicts, accepted-but-unacknowledged/rejected writes, restart, local overlapping mutations, ownership, budget reservations, cancellation and collection/review behavior. This is not live Google Sheets or Ollama validation. Dedicated service-account/control-sheet tests, actual model inference and authenticated LinkedIn tests remain outstanding.
