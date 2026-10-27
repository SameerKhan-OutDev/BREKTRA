# Company ownership preparation

Current release: **0.4.0** (major 0 · update 4 · patch 0).

27 October 2026 (Asia/Karachi). First implementation milestone of the [0.3.0 roadmap](UPDATE_0.3.0_IMPLEMENTATION_PLAN.md).

## What is available

Settings → Company setup lets a workspace owner/admin review and apply company ownership to the existing workspace. Demo mode supports a temporary rehearsal. Company ownership is never assigned automatically on startup.

Preparation creates one company, maps existing team members, and assigns the existing business records to it. It preserves IDs, source facts, campaign copy, schedules, opt-outs, replies, draft revisions, exact-message approvals, provider IDs, uncertain results and their original intent times. Running campaigns become paused and all mailbox sending switches are turned off. Resuming work requires the existing explicit campaign/mailbox controls.

This milestone does **not** enable multiple companies or private company access. Existing team roles and shared-workspace visibility remain in effect. The runtime refuses a second company, an archived company or inconsistent ownership before it can be loaded, saved or used by workers. Company creation/switching, isolated API projections, background-job scoping and company-role enforcement remain P1.2/P1.3 work.

## Apply to a real workspace

1. Stop other copies controlling this spreadsheet. Keep exactly one server authoritative.
2. Back up the control spreadsheet and matching private configuration/secret material outside the distributable app folder. Verify that you can restore them in an isolated environment; the checkbox records your acknowledgement, not an automated restore test.
3. Open Settings → Company setup → Review preparation. Inspect counts, unresolved sends and the proposed member mapping. Wait for any in-flight generation/send to finish or reconcile it first.
4. Enter the name for the company that owns **all** current records. Employer names and free-text campaign company descriptions are never used to infer ownership. If the existing workspace already contains records that must be split between owners, stop here and arrange a separate reviewed split migration.
5. Confirm the backup and apply. Any intervening workspace change invalidates the preview and requires another review. No partial result becomes active in memory before Sheets confirms the atomic save.
6. Review campaigns, leads, history and mailbox settings. Campaigns and mailbox sending remain paused after preparation. Do not use a second company yet.

If a response is lost, do not repeat a send or assume the save failed. Use Settings → Reconnect & sync to load the actual stored state. A committed migration is recognized on recovery and cannot run again. Invalid/mixed ownership stops recovery and leaves dispatch blocked.

## Data and compatibility

New control tabs: `Companies`, `CompanyMemberships`, `CompanyMigrations`. They use the existing `id`/`data` layout. Existing business collections gain `companyId`; member identities remain workspace-global. Historical AI input snapshots gain ownership labels without changing their original facts/text. The manifest records actor/time, the original state fingerprint, collection counts and role mapping. Its original contents are immutable during normal workspace mutations.

Company-owned records use envelope `schemaVersion: 2`. Unmigrated records retain version 1 and continue to load; unversioned legacy records still follow the existing migration/validation path. Older apps reject owned v2 records, preventing a downgrade from silently dropping ownership. App release numbering is independent of record schema numbering.

Existing single-company writers inherit ownership for newly created records only. Editing/removing ownership on an existing record or adding a foreign-company reference fails. Team invitations/role/status changes keep the prepared memberships aligned with legacy workspace access. This compatibility bridge will be replaced by explicit scoped writers in P1.2.

| Existing workspace role | Prepared company role | Current access |
| --- | --- | --- |
| Owner | Admin | Existing owner access retained |
| Admin | Admin | Existing admin access retained |
| Operator | SDR | Existing operator access retained, including its review permission |
| Reviewer | Reviewer | Existing reviewer access retained |
| Viewer | Viewer | Existing viewer access retained |

The proposed company action matrix in `shared/company.ts` is tested as a future contract; it is not a new runtime permission policy. In that contract SDRs prepare work, reviewers approve, and payroll/integration/member management is admin-only. Platform owners do not gain implicit future company-content access through that contract. Final role policy belongs to P1.2.

## Rollback and limits

Before any post-cutover external action, rollback requires stopping every writer and restoring the verified control-sheet backup with the matching older application and private infrastructure. Do not run the old app against migrated records. If an external action occurred after the backup, preserve/reconcile those outcomes before restoring or resuming; the backup must not make a completed send eligible again.

The migration fits one existing atomic control-spreadsheet batch. If it exceeds provider/cell/request limits, do not split it manually or activate a partial workspace: keep the workspace paused and plan a maintenance-mode staged migration. Large multi-batch migrations are not implemented. The server operator and people with direct spreadsheet/secret access remain trusted; application ownership is not isolation from those operators.

Automated evidence uses mocked Sheets/Gmail and local HTTP sessions. A 5,000-lead local CPU check took 61 ms for preview and 62 ms for preparation on this machine; this excludes network, quota, payload, backup and live-provider work and is not a supported production capacity claim. Actual Sheets backup/restore and provider validation are still required before production migration. Browser visual verification was attempted but stopped by the automation tool because it could not verify the current browser URL; it is not reported as passed.
