# BREKTRA update 0.3.0 implementation plan

Current release: **0.4.0** (major 0 · update 4 · patch 0).

Roadmap target: shared-company platform. Status: implementation authorized 27 October 2026; first 0.3.0 company-preparation milestone implemented. Multi-company operation remains disabled.
Prepared: 26 October 2026 (Asia/Karachi).

Source specification: `C:\Users\FLIPTRONICS\Documents\BREKTRA_Docs\BREKTRA_Update_0.3.0 Plan.md` — “BREKTRA: Twelve-Shard Expansion Specification”. The source is preserved unchanged.

## 1. Objective and recommended release boundary

Extend the existing application so two independent companies can share SDR employees while keeping their leads, communications, credentials, campaigns, knowledge and results separate. Preserve the React/TypeScript/Express architecture, Google Sheets persistence, Ollama integration, reviewed Gmail workflow and portable Windows distribution.

The source describes a product roadmap across twelve shards. The first usable shared-company MVP requires **Phase 0 plus the minimum safe Phase 1**: company isolation, essential SDR queues, a basic pipeline, shifts and salary allocation. Phases 2–4 remain an explicit backlog. The user authorized starting this plan on 27 October 2026. Execution follows its small-batch rule: the first 0.3.0 build delivers reviewed single-company preparation only, with later shared-company capabilities still gated. The release number does not indicate completion of the whole roadmap or Phase 1; no source requirement has been dropped.

Increase versions only for actual delivered behavior. This document now tracks implementation as well as planning; the migration is optional and no production workspace has been automatically converted.

## 2. Planning audit: existing versus required

The original matrix below records the static baseline review. On 27 October a fresh baseline build, all 73 existing automated checks, both package workflows and extraction/start/stop checks passed. New foundation checks are tracked in implementation status. The repository has substantial uncommitted work; it remains preserved. Real service validation remains outstanding.

### Execution status — 27 October 2026

Subsequent 0.4.0 setup refinement: guided local Google Sheets/Ollama setup is implemented and validated with mock providers, local HTTP and encryption. This helps prepare P0.3 resources but does not close its live-provider gate or implement P1.2. See `LOCAL_SETUP.md` and implementation status for the new feature and verification limits.

| Task | Status | Evidence / remaining work |
| --- | --- | --- |
| P0.1 | Validated locally | Static inventory/matrix and pre-existing Git status captured; existing modules/work preserved. |
| P0.2 | Validated locally | Baseline build, 73 checks, Windows/server packages and fresh-package verifiers passed. |
| P0.3 | Blocked on test resources | No configured `.env`, dedicated Google resources or intended recipient available. No real send or production migration attempted; Ollama/provider validation remains open. |
| P0.4 | In progress | Single-sheet/single-writer architecture, role contracts, single-company atomic migration and rollback documented/tested. Local 5,000-lead CPU preview/preparation measured at 61/62 ms; live quota/payload/restore limits unverified. |
| P0.5 | In progress | Start authorization accepted for staged execution. 0.3.0 labels the preparation feature; shared-company MVP acceptance still requires the rest of Phase 1. |
| P1.1 | Implemented; locally validated | Ownership/membership/manifest schemas, role contracts, fingerprinted preview/apply, atomic persistence, recovery and runtime refusal of second/archived companies. Production backup/restore rehearsal and full multi-company fixtures/settings remain open. See `COMPANY_MIGRATION.md`. |
| P1.2 | Not started | Existing API/worker access remains shared-workspace access. New roles are contracts only; compatibility writes are deliberately restricted to one company. |
| P1.3–P1.7, Phases 2–4 | Not started | Company switching, full profiles, SDR workbench, pipeline, workforce and later features remain backlog. |

The existing/missing matrix is a baseline, not a claim that the new preparation step completes shard 1. Browser visual verification was attempted but the automation tool stopped it because it could not verify the browser URL; no visual pass is claimed.

Reviewed: `ABOUT_BREKTRA.md`, `README.md`, working notes, implementation status, persistence and hosted setup documents, backend/outreach plans, shared record types, Sheets collections/store, authentication/context and API entry points.

| Shard | Existing foundation and evidence | Required work | First phase |
| --- | --- | --- | --- |
| 1. Multi-company | `shared/outreach.ts` defines workspace-wide roles; `shared/types.ts` has no tenant ownership on business records. | Companies, memberships, company permissions, scoped persistence/services, switcher, audit and migration. | 1; prerequisite to all later shards |
| 2. Discovery/enrichment | Sheets import; `server/enrichment.ts` supplies bounded public HTTPS evidence and MX checks. | CSV import, configurable discovery/provider adapters, filters, provenance/freshness, company deduplication and recoverable discovery jobs. | 2 |
| 3. Qualification | Ollama draft suitability and supplied campaign ICP context exist. | Separate explainable scoring, service relevance, confidence, missing-data warnings, overrides and fallback. | 2 |
| 4. SDR workbench | Leads, review queue, Inbox and assignments exist; assignments do not enforce privacy. | Personal work queue, claims, priorities, due dates, qualification checklist, research/notes, escalation, shift summary and handoff. | 1 essentials; 2–3 extensions |
| 5. Outreach intelligence | `server/outreach.ts` and `server/gmail.ts`: reviewed ordered sequences, inbox sync, budgets, stop rules, uncertain-send recovery. | Company identities, reply/objection intelligence, conditional branching, experiments, suppression and mailbox-health improvements. | 1 isolation; 2 intelligence |
| 6. CRM/pipeline | Lead records and control-sheet persistence exist. Source CRM remains read-only. | Opportunities, custom stages, board/table, owners, history, value, follow-up, proposals, exports and safe mapped writeback. | 1 essentials; 2–3 extensions |
| 7. Meetings/handoffs | Conversation and campaign context can be reused; no calendar integration. | Authorized calendar adapter, availability/conflicts/timezones, booking/rescheduling, summaries, outcomes and no-shows. | 3 |
| 8. Shared workforce | Global members/roles exist. | Company assignments, shifts, time/break records, approved salary splits, workload, expenses/incentives/commissions and payroll exports. | 1 essentials; 3–4 extensions |
| 9. Analytics | Activity totals/date filters and simulated/live distinctions exist. | Company funnel, recorded revenue, qualified-meeting quality/cost, forecasts, historical comparisons and authorized aggregates. | 1 basic summaries; 3 full reporting |
| 10. Feedback/knowledge | Optional input snapshots, originals and linked feedback in Sheets exist. | Company knowledge/retrieval, inspection/deletion/retention, reviewed JSONL export and controlled evaluation. | 1 isolation; 3 completion |
| 11. Reliability/security | Validated records, serialized saves, conflict detection, local locks, private secrets, sessions and intent recovery exist. | Tenant/role coverage, backup drills, rotation, capacity measurements, integration health, notifications and real-provider evidence. | 0 onward; final hardening in 4 |
| 12. Commercial/deployment | Local portable and hosted-server packaging/setup exist. | Company onboarding/invitations, usage, exports/deactivation, licensing/billing interfaces and commercial operating documentation. | 1 basic onboarding; 4 completion |

Important gaps: real Sheets mutation, Gmail OAuth/recipient testing, hosted Ollama, external hosting/TLS and Docker remain unverified in the latest records. Live LinkedIn is unavailable. Source CRM writeback, Windows notifications and complete AI dataset controls remain unfinished.

## 3. Architecture and non-negotiable constraints

### Deployment and storage

- Keep one authoritative server and runner for the shared deployment. Teammates use authenticated browsers. Preserve loopback portable mode; do not permit independent portable writers against the shared workspace.
- Keep Google Sheets as the application database. Start with one dedicated control spreadsheet containing company-scoped records and separately mapped source spreadsheets/tabs per company. Separate source connection records even where an operator grants one service account access to multiple sheets.
- Review this design in Phase 0 before enabling tenants. It provides application-enforced isolation, not isolation from the trusted server operator or people granted direct access to the control spreadsheet. Company users must not receive direct access to other companies' storage or secrets.
- Retain serialized mutations and atomic control-sheet batches. Do not assume atomicity across the control spreadsheet, source CRMs and external providers. Persist reconciliation work and retry only safe operations.
- Benchmark Sheets reads, writes, validation, job latency and growth with a representative two-company workload. Record measured limits before rollout. An optional future transactional database migration is a design study only; adding one requires a separate scope decision.

### Authorization and ownership

- Separate platform administration from company membership. A platform owner manages platform configuration and membership; access to company content or aggregate reports requires an explicit audited grant. Company admin, SDR, reviewer, closer and viewer roles are company-specific.
- Define an action-level permission matrix before wiring screens. Include read, edit, assign, approve lead, approve message, start campaign, connect integration, export, payroll, membership and reporting actions. Do not silently equate the legacy operator role with new roles.
- Resolve actor and selected company at the server. Verify active membership on every request; client-supplied company IDs are selectors, never authorization. Deny missing, archived or unauthorized scopes.
- Replace unrestricted workspace serialization with authorized company projections. Apply scope to search, counts, activity, errors, exports, notifications and AI context, as well as individual record routes.
- Use explicit company scope in background jobs, OAuth connection state and callbacks, caches and secret lookup. Recheck archive status, integration assignment and approver permissions immediately before dispatch. Do not rely on request-local actor context for background work.
- Validate same-company references on writes and during load/migration. Reassigning an SDR cannot transfer a company's records to another company.
- Use globally unique record IDs; company-aware deduplication keys permit the same prospect in both companies. Keep opt-outs effective within their intended scope and honor provider/global suppression where applicable without revealing another company's records.
- Require authentication for multiple companies, including local deployment. Keep unauthenticated personal mode restricted to a single company.

### Existing safety behavior

- Preserve campaign modes, schedules/timezones, daily/shared budgets, balanced allocations, lead approval and exact recipient/content review. New AI suggestions never approve or send by themselves.
- Persist intent before an external action. Unknown results remain uncertain with budget reserved; reconnecting, migrating, retrying CRM writes or changing companies must not repeat the send.
- Keep source facts, timestamps and missing-information labels. No guessed personal contacts or fabricated company needs. Keep demo/test outcomes out of live reports and learning exports.
- Keep credentials server-side and outside Sheets business records and release archives. Initially assign a mailbox exclusively to one company; shared SDR employment does not require a shared mailbox. If future mailbox sharing is needed, design explicit routing/privacy and shared budget rules first.
- Follow the new source restriction: leave live LinkedIn disabled unless a compliant, authorized integration is available. Earlier backend milestones do not override that gate.
- No paid provider, payment processor, automatic model training or horizontally scaled writer is introduced by this plan.

## 4. Proposed data model

Extend the existing validated record envelopes and Sheets collections. These are proposed contracts to finalize during Phase 0; do not rewrite persisted schemas merely to match this table.

| Record group | Proposed records/fields | Invariants |
| --- | --- | --- |
| Platform identity | Existing members as identities; platform grants; company memberships with role/status | A person can hold different roles in different companies. Protect the last active platform owner and company admin. |
| Companies | Company, profile/branding, offerings, ICP, approved facts, AI instructions, lifecycle status | Campaign `company` text and lead employer `company` text are not tenant ownership. Add a distinct `companyId`. |
| Integrations | Company integration/source mappings; company-owned mailbox/calendar metadata; private credential references | No cross-company credential lookup. No OAuth callback may bind a connection to an unauthorized company. |
| Existing business records | Add `companyId` to leads, campaigns, jobs, drafts, accounts/sources, sequences, enrollments, actions/reviews, conversations/messages, enrichment, activity and examples/feedback | Every referenced business record belongs to the same company; global identities/settings are explicitly classified. Split company settings from platform/computer settings. |
| SDR operations | Task, claim/assignment, research/qualification, interaction note, handoff | Revision checks and atomic claims prevent conflicting ownership; overrides are audited. |
| Pipeline | Stage, opportunity, stage history, proposal/attachment reference, recorded outcome/revenue | Company-scoped opportunity uniqueness; explicit currency; forecasts distinct from recorded revenue. Define attachment storage/access/backup before accepting files. |
| Workforce | Employee profile, company assignment, shift, time entry, break, allocation rule, payroll period, adjustment | Private salary/payment details have restricted access. Global employee identity exposes only allowed company information. |
| Compensation | Expense/reimbursement, incentive/commission rule, approved earning, dispute/adjustment | Versioned rules, explicit currency/rounding, approval and correction history; company cost is separate from employee earnings. |
| Events/integrations | Audit event, persisted notification/reminder, discovery/CRM/calendar reconciliation job | Company plus actor/provenance; idempotency keys; safe retry class; notification delivery never triggers outbound approval. |
| Knowledge | Approved fact/document, example links, retrieval metadata, retention/exclusion/deletion controls | Company-bound retrieval and caches; no sensitive conversation learning without authorization; deletion prevents automatic return. |

Keep computer notification preferences and encrypted session/credential infrastructure outside business tables. Define retention and backup coverage for new records before collecting them.

## 5. Migration and rollback approach

1. Inventory every collection, reference, secret key, cache, API projection, job and export. Capture a migration manifest with counts, schema versions and a complete list of unscoped records.
2. Pause campaigns and dispatch, stop all writers, and back up control/source sheets plus matching private secret material. Prove the backup can be restored in an isolated test workspace.
3. Run a dry-run migration against a copy. Create one explicitly named legacy company and preserve record IDs, timestamps, campaign context, opt-outs, revisions, message IDs, uncertain actions and history. Do not infer tenant ownership from free-text company names or lead employers.
4. Produce a reviewed legacy-role mapping. Assign existing members only to the legacy company; grant no automatic access to the second company. Preserve the platform owner deliberately and resolve roles that cannot map safely before activation.
5. Add ownership and validate reference closure across all records and private integration bindings. Unresolvable ownership/reference records block migration; never guess or discard history. Stop outbound work throughout migration.
6. Make migration resumable with explicit checkpoints/version checks. Never activate a partially migrated workspace. Stage and verify data before committing activation; if work exceeds one atomic batch, keep the workspace in maintenance mode until all checkpoints reconcile.
7. Compare before/after counts, relationships, content and uncertainty state. Test old IDs in the migrated company and deny them from another company. Invalidate stale sessions, review integration grants, keep campaigns/mailboxes paused, then explicitly re-enable selected test work.
8. Create the second company through onboarding and assign its sources, mailbox and memberships separately. Verify that both companies can independently own the same prospect.
9. Roll back before production activity by restoring the verified backup with the matching old app/private configuration, with every other writer stopped. Never start the old app on migrated records. If external actions occurred after cutover, reconcile provider outcomes and preserve their ledger before any restore/resume; a pre-send backup must not make them sendable again.

## 6. Execution phases and acceptance gates

Task IDs below are stable references for implementation status. Use the status table above for actual progress; acceptance gates below remain the full intended requirements. Do not advance a blocked live-provider gate by substituting mock results.

### Phase 0 — establish a verified baseline

| ID | Work and concrete output | Acceptance gate |
| --- | --- | --- |
| P0.1 | Inventory current behavior/uncommitted work; map all twelve shards to modules, permissions and data flows. | Baseline inventory and existing/missing matrix reviewed; existing work preserved. |
| P0.2 | Run build, then tests, both package workflows and fresh-extraction checks; record commands, artifacts and failures. | Reproducible baseline; pre-existing failures distinguished from regressions. |
| P0.3 | Validate dedicated Sheets imports/save/restart/conflict and Gmail OAuth/refresh/revoke/exact-message acceptance/reply-stop with intended test recipient; check real Ollama. | Evidence per provider, with mock and live results separate. Required resources listed if unavailable. |
| P0.4 | Finalize permissions, storage topology, capacity target, contracts, migration/restore rehearsal and dependency risks. | Approved architecture decisions and successful rehearsal before any multi-company activation. |
| P0.5 | Set the 0.3.0 release boundary and prioritized acceptance checklist. | Phase 1 essentials versus later scope explicit; no shard silently omitted. |

Needs: dedicated test control/source sheets, server-private Google configuration, authorized Gmail account and intended recipient, Ollama model/runtime; hosted DNS/TLS and calendar access only for their respective later validation. Do not place these resources in the plan or distributable packages.

### Phase 1 — minimum safe shared-company workflow

Implement in order: **P1.1 → P1.2 → P1.3 → P1.4 → P1.5/P1.6 → P1.7**. P1.5 and P1.6 may proceed independently once the common foundation is verified.

| ID | Work and concrete output | Acceptance gate |
| --- | --- | --- |
| P1.1 | Versioned companies/memberships, permission matrix, ownership/reference validation and migration tooling. | Two-company fixture loads; legacy migration preserves history; invalid/cross-company references fail closed. |
| P1.2 | Scope every API/read projection/mutation, store operation, queue, Gmail binding/sync, AI context, audit and export. | Adversarial isolation tests pass for direct IDs, payloads, search/counts, background work, callbacks, stale sessions and membership removal. No multi-company UI enabled before this gate. |
| P1.3 | Company create/edit/archive, branding/profile/ICP/settings, source/mailbox assignments, invitations and switcher. | User sees only assigned companies; roles differ by company; archive pauses new actions and preserves history/result recording. |
| P1.4 | Essential SDR workbench using existing Leads/Review/Inbox: priority/due tasks, claim/reassign, research/checklist, notes, approval requests and explicit handoff. | Two SDRs cannot claim the same task silently; revoked members lose access; qualified work and interested replies are visible before routine outreach. |
| P1.5 | Basic company pipeline: default/custom stages, board/table, owner/SDR, value/currency/close date, notes, stage history, lead conversion, lost reason and CSV export. | Stage moves persist with revision checks; duplicate conversion blocked; authorized exports contain one company's data and safe text values. |
| P1.6 | Shared employee assignments, company shifts, manual time/breaks, time attribution and salary allocation with explicit period/currency/rounding. | Four-hours-per-company example works; overlap/total validation and adjustments are audited; allocation totals reconcile without double-counting salary or exposing another company's payroll. |
| P1.7 | Two-company end-to-end rehearsal, basic company/SDR summaries, setup/migration guide, release validation. | Shared SDR can complete separate workflows for both companies; company-only users cannot access the other; historical uncertainty/opt-outs survive restart; fresh packages pass. |

**Phase 1 completion scenario:** one SDR belongs to companies A and B with different permissions. Each company has separate source data, mailbox, campaign, approved leads and pipeline. The same prospect may exist in both. The SDR claims work, records research, submits an exact message for review, handles a reply, moves an opportunity and logs a shift. A viewer in A cannot read B through any UI/API/export/AI/notification path. Salary cost allocation reconciles and sensitive payroll remains restricted. Gmail's accepted status remains distinct from recipient delivery.

Meeting booking, discovery automation, compensation incentives, full notifications and advanced pipeline extras do not become implicitly delivered by this scenario; they have explicit later tasks below.

### Phase 2 — lead acquisition and outreach intelligence

| ID | Work and concrete output | Acceptance gate |
| --- | --- | --- |
| P2.1 | CSV/Sheets import, configurable permitted discovery adapters/searches, geographic/industry/size/keyword/service filters, company deduplication and queue controls. | Preview/validation and source attribution work; pause/resume/cancel survive restart; throttling/cache/failure behavior measured; robots/provider restrictions honored. |
| P2.2 | Evidence extraction/freshness, qualification configuration, scoring/ranking, research summary, suggested roles, confidence/missing-data and disqualification reasons. | Every substantive claim traces to evidence; deterministic fallback is labeled when Ollama fails; human override/rejected-prospect handling and high-value alerts persist. |
| P2.3 | Company-specific AI drafting/replies, reply sentiment/meeting intent/objections, reviewed response suggestions, versioned experiments and conditional follow-ups. | Uncertain classification requests review; conditions use persisted known outcomes; edits invalidate approval; replies/opt-outs/invalid recipients stop work; unknown sends never retry automatically. |
| P2.4 | Suppression/unsubscribe and mailbox health controls; safe mapped CRM status writeback and reconciliation. | Opt-out stops every applicable queued action; moved/duplicate/missing source rows never receive guessed writes; formulas/dropdowns survive; write failure cannot repeat a send. |

Depends on Phase 1 tenant enforcement and provider baseline. Optional provider selection requires verification of supported capabilities, terms, cost and privacy before installation; no paid service becomes mandatory.

### Phase 3 — conversion, evidence and workforce depth

| ID | Work and concrete output | Acceptance gate |
| --- | --- | --- |
| P3.1 | Authorized calendar adapter, company appointment rules, availability/timezone/conflict checks, booking/rescheduling/cancellation, reviewed confirmations and handoff summaries. | Intended test accounts show the correct meeting/timezone; duplicate/ambiguous bookings reconcile; revoked authorization blocks actions; outcomes/no-shows/rescheduling and proposal follow-up persist. |
| P3.2 | Complete CRM reminders/stagnation, attachments/proposal references, discovery summaries, budget/requirement notes and founder/closer workflow. | Qualification criteria gate handoff; attachments have scoped access/backup limits; meeting preparation, outcome and follow-up tasks trace to the right opportunity. |
| P3.3 | Company sales/revenue dashboards, authorized aggregates, conversions, acquisition/SDR cost, qualified-meeting cost, forecasts, historical comparisons and exports. | Event definitions, date/timezone boundaries, attribution, denominators and currencies documented; no summing mixed currencies without an explicit conversion policy; demo/unknown outcomes never become verified results. |
| P3.4 | Company knowledge/retrieval, example inspection/correction/exclusion/deletion, retention, reviewed JSONL export and prompt/model evaluation. | Cross-company retrieval/cache tests pass; sensitive messages require authorization; deletion prevents backfill; train/evaluation groups do not leak; no automatic upload/training. |
| P3.5 | Activity-assisted time proposals, flexible allocations/workload, optional overhead/reimbursements, incentives, commissions/disputes and payroll exports. | Human-reviewed time and approved versioned compensation rules reconcile; corrections retain history; earnings and company cost remain distinct; presence is never reported as proof of productivity. |
| P3.6 | Persistent in-app notifications/reminders and portable Windows helper: review, lead decisions, replies, health, uncertainty and optional routine summaries. | Company/role-scoped alerts; settings/categories/timezone quiet hours/privacy/sound persist; no duplicates after restart; resolved reminders stop; Windows alerts/clicks work with browser closed and blocked alerts have an in-app fallback. |

Define company-scoped event and notification contracts during Phase 1; implement useful categories as their underlying features become available. Desktop background delivery is a separate verified feature, not implied by a saved event.

### Phase 4 — operating reliability and commercial foundations

| ID | Work and concrete output | Acceptance gate |
| --- | --- | --- |
| P4.1 | Complete security/role review, abuse limits, session/secret rotation, backups/restore, quota/capacity tests, recovery, audit and integration-health dashboards. | Restore drill succeeds; permission/job/export/AI isolation regressions pass; measured supported workload and operational limits documented. |
| P4.2 | External hosted deployment/multi-browser rehearsal and remaining portable/platform validation. | Actual TLS/hosting/Ollama and approved provider workflows verified; Docker claimed only after execution; startup/shutdown/recovery and clean archives pass. |
| P4.3 | Organization onboarding, modular integrations, company data export, deactivation, usage accounting and deployment/configuration/migration guides. | Deactivation stops new work and revokes access while preserving audited result/reconciliation and retention obligations; exports remain scoped and omit secrets. |
| P4.4 | Document future licensing, optional subscription/billing interfaces and multi-tenant hosting architecture. | Software ownership versus tenant permissions defined; no payment provider or paid dependency required; any future storage/scaling change is separately reviewed. |

Security, backups, idempotency and safe provider operation apply in every phase. Phase 4 completes operating depth; it does not postpone basic protections.

## 7. Risk register and decisions

| Risk/decision | Planned response and when it blocks work |
| --- | --- |
| Global workspace APIs and actor-only request context can expose other companies if UI filtering is used. | Replace projections and add explicit scope across services/jobs before company activation. |
| Legacy roles and unowned records have no safe automatic multi-company meaning. | Reviewed mapping, legacy company, dry-run manifest and fail-closed validation; blocks migration. |
| Sheets whole-workspace reads/linear validation may exceed acceptable latency or quotas. | Measure representative data in Phase 0 and growth in Phase 4; agree supported bounds before rollout. Keep a database migration optional. |
| Control/source spreadsheets and mail/calendar operations cannot commit as one transaction. | Persist intent/result/reconciliation separately; uncertainty blocks repeat outbound actions. |
| Shared mailbox or employee/payroll metadata could reveal company information. | Exclusive company mailbox binding initially; minimal employee projections and explicit payroll permissions. |
| Restoring a backup after a real send can erase its intent ledger. | Retain/reconcile post-backup external outcomes before resume; never blindly replay. |
| External service access may be unavailable during development. | Continue independent schema/UI/mock coverage; record live gates as blocked, never as passing. |
| New navigation competes with the earlier focused-interface constraint. | Keep queues/knowledge/sequences contextual. Use Leads for board/table initially and Settings for company/workforce configuration; review any additional top-level navigation before adding it. |
| Full twelve-shard delivery is much larger than the Phase 1 MVP. | Confirm the release boundary at P0.5; estimate individual work packages after the audit, without promising dates now. |
| New libraries/providers may add costs, operational dependencies or exposure. | Prefer existing modules; assess necessity, licensing, maintenance, credentials and privacy before adding dependencies. |

Decisions needed before dependent implementation: 0.3.0 MVP versus full-roadmap release; approved company role/action matrix including self-approval/payroll visibility; legacy ownership/role mapping; workload target; salary/time allocation and currency rules. Calendar/provider choices can wait until their phase. Use reasonable prototypes and test fixtures to make decisions concrete; do not request production credentials in chat.

## 8. Validation and delivery checklist for each implemented milestone

- Preserve existing user work; keep changes modular and migrations recoverable.
- Add meaningful tests for new permissions, reference validation, migrations, race/conflict behavior, stale review, archive/revocation, opt-outs, uncertain sends and restart recovery.
- Test both demo and migrated Sheets modes, plus the unauthenticated single-company portable boundary and authenticated multi-company mode. Distinguish mocked providers from actual service tests in every report.
- Run `pnpm build` before `pnpm test`; API tests use built frontend files. Update version labels/change history only for the actual release being delivered.
- Run `pnpm package:windows`; verify a fresh ZIP extraction: launch, `/api/health`, authorized `/api/workspace`, frontend/assets, repeat-start reuse, shutdown and ownership reacquisition. Multi-company data must require authentication; the default demo remains usable.
- When hosted code/docs are affected, run `pnpm package:server` and `pnpm verify:server`; record external TLS/multi-browser/provider verification separately.
- Inspect both archives against allowlists. Exclude credentials, `.env`, tokens/sessions, logs, runtime/workspace state, salary records, customer data and dataset exports. Verify API, frontend, VERSION.txt and bundled maintained docs agree.
- Update implementation status, ABOUT, setup/persistence/migration docs and maintained external copies. Update working notes/backend plan when product decisions change; preserve historical requirements and test evidence.
- Report exact artifacts (`D:\BREKTRA\release\BREKTRA-Windows-x64.zip` and, when applicable, `D:\BREKTRA\release\BREKTRA-Server.tar.gz`), checks run, provider evidence, remaining issues and rollback instructions.

Each task status should record: **not started / in progress / implemented / validated / blocked**, dependency, evidence, remaining issue and next action. “Implemented” alone does not close a live integration or release gate.

## 9. First implementation batch

Continue P0's remaining real-service/restore checks and **P1.2**, building on the reviewed P1.1 preparation foundation. Do not enable a second company until complete migration, permission and isolation gates pass. Continue to full company setup and essential workflows only after that gate.

Planning deliverables are present and baseline execution is complete locally. The first implementation adds optional single-company ownership preparation and safety gates. Live-provider testing, production migration/restore rehearsal, full access isolation and the remainder of the roadmap remain open. See `IMPLEMENTATION_STATUS.md` for exact validation evidence and release artifacts.
