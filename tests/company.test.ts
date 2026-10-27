import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../server/seed.ts";
import { emptyState, now, queueCampaign } from "../server/domain.ts";
import { companyFingerprint, prepareCompanyMigration, previewCompanyMigration } from "../server/company.ts";
import { ownedCollections, assertSingleCompanyRuntime, validateCompanyOwnership } from "../server/company-schema.ts";
import { validateState, decodeRecord, encodeRecord, migrateState } from "../server/schema.ts";
import { companyPermits } from "../shared/company.ts";
import { Store } from "../server/store.ts";
import { Runner } from "../server/runner.ts";
import type { State } from "../shared/types.ts";
import type { Sheets } from "../server/sheets.ts";

function legacy() {
  const s = demoState();
  s.members = ["owner", "admin", "operator", "reviewer", "viewer"].map((role, i) => ({
    id: `member-${i}`, name: role, email: `${role}@example.invalid`, role: role as State["members"][number]["role"], status: "active", createdAt: now(),
  }));
  return s;
}
function migrate(s = legacy()) {
  return prepareCompanyMigration(s, { name: "Original business", fingerprint: companyFingerprint(s), actorId: "member-0", backupConfirmed: true });
}

test("company preview is read-only and covers the whole legacy workspace and role mapping", () => {
  const s = legacy(), before = structuredClone(s), preview = previewCompanyMigration(s);
  assert.deepEqual(s, before);
  assert.deepEqual(preview.members.map((m) => m.to), ["admin", "admin", "sdr", "reviewer", "viewer"]);
  assert.equal(preview.counts.leads, s.leads.length);
  assert.deepEqual(preview.blockers, []);
  const reordered = structuredClone(s); reordered.leads.reverse();
  assert.equal(companyFingerprint(reordered), preview.fingerprint);
  reordered.leads[0].notes += "changed";
  assert.notEqual(companyFingerprint(reordered), preview.fingerprint);
});

test("company migration requires a backup, fresh preview and no in-flight work; reruns are blocked", () => {
  const s = legacy(), fingerprint = companyFingerprint(s);
  const input = { name: "Original business", actorId: "member-0", fingerprint, backupConfirmed: false };
  assert.throws(() => prepareCompanyMigration(s, input), /restorable backup/);
  s.leads[0].notes += "new note";
  assert.throws(() => prepareCompanyMigration(s, { ...input, backupConfirmed: true }), /changed since preview/);
  const migrated = migrate(s);
  assert.throws(() => migrate(migrated), /cannot run twice/);
  Object.assign(s.campaigns[0], { status: "running" });
  queueCampaign(s, s.campaigns[0]);
  Object.assign(s.jobs[0], { status: "running", intentAt: now() });
  assert.throws(() => migrate(s), /in-flight work/);
});

test("company migration preserves IDs, facts, opt-outs, exact approvals and uncertain send ledgers", () => {
  const s = legacy();
  s.leads[0].optedOut = true;
  s.leads[1].repliedAt = now();
  s.campaigns[0].status = "running";
  s.mailboxes[0].sendingEnabled = true;
  queueCampaign(s, s.campaigns[0]);
  Object.assign(s.jobs[0], { kind: "request", status: "uncertain", intentAt: "2026-10-01T08:00:00Z" });
  s.outreachActions.push({ id: "historic-action", campaignId: s.campaigns[0].id, leadId: s.leads[0].id, mailboxId: s.mailboxes[0].id,
    kind: "email", purpose: "sequence", recipient: "test@example.invalid", subject: "Exact reviewed subject", body: "Exact reviewed body",
    revision: 4, approvedRevision: 4, approvedBy: "member-3", status: "uncertain", createdAt: now(), updatedAt: now(),
    intentAt: "2026-10-01T08:00:00Z", messageId: "<never-repeat@example.invalid>", detail: "Unknown result" });
  const original = structuredClone(s), next = migrate(s), companyId = next.companies[0].id;
  assert.deepEqual(s, original);
  assert.equal(next.campaigns[0].status, "paused"); assert.equal(next.mailboxes[0].sendingEnabled, false);
  for (const key of ownedCollections) for (const row of next[key]) assert.equal(row.companyId, companyId);
  for (const key of ownedCollections) for (let i = 0; i < original[key].length; i++) {
    const row: any = structuredClone(next[key][i]); delete row.companyId;
    if (key === "campaigns") row.status = original.campaigns[i].status;
    if (key === "mailboxes") row.sendingEnabled = original.mailboxes[i].sendingEnabled;
    assert.deepEqual(row, original[key][i], key);
  }
  assert.equal(next.companyMemberships.length, original.members.length);
  assertSingleCompanyRuntime(validateState(next));
});

test("owned envelopes reject downgrade and scope survives schema decode/reload", () => {
  const s = migrate();
  const cell = encodeRecord(s.leads[0]);
  assert.equal(JSON.parse(cell).schemaVersion, 2);
  assert.deepEqual(decodeRecord(cell, s.leads[0].id, "Relationships", 2), s.leads[0]);
  assert.equal(JSON.parse(encodeRecord(legacy().leads[0])).schemaVersion, 1);
  assert.equal(migrateState(structuredClone(s)).leads[0].companyId, s.companies[0].id);
  assert.throws(() => decodeRecord(JSON.stringify({ schemaVersion: 3, record: s.leads[0] }), s.leads[0].id, "Relationships", 2), /unsupported/);
  const old: any = legacy(); delete old.companies; delete old.companyMemberships; delete old.companyMigrations;
  assert.equal(migrateState(old).companies.length, 0); // Never silently assign legacy data.
});

test("partial ownership, missing manifests/admins and foreign references fail closed", async (t) => {
  for (const [label, corrupt] of [
    ["missing ownership", (s: State) => { delete s.leads[0].companyId; }],
    ["unknown company", (s: State) => { s.mailboxes[0].companyId = "foreign"; }],
    ["partial migration", (s: State) => { s.companies = []; }],
    ["missing manifest", (s: State) => { s.companyMigrations = []; }],
    ["missing administrator", (s: State) => { s.companyMemberships = s.companyMemberships.filter((m) => m.role !== "admin"); }],
    ["foreign assignee", (s: State) => { s.conversations[0].assigneeId = "not-a-member"; }],
    ["duplicate membership", (s: State) => { s.companyMemberships.push({ ...s.companyMemberships[0], id: "duplicate" }); }],
  ] as const) await t.test(label, () => {
    const s = migrate(); corrupt(s); assert.throws(() => validateState(s), /company ownership/);
  });
});

test("two-company contracts reject foreign references, and the runtime refuses even valid second-company metadata", () => {
  const s = migrate(), secondId = "second-company";
  s.companies.push({ ...s.companies[0], id: secondId, name: "Second company" });
  s.companyMemberships.push({ ...s.companyMemberships[0], id: "second-membership", companyId: secondId });
  // No API or worker may activate multiple companies, even if structural checks pass.
  validateCompanyOwnership(s);
  assert.throws(() => new Store(s), /Multi-company/);
  const archived = migrate(); archived.companies[0].status = "archived";
  assert.throws(() => new Store(archived), /archived-company/);
  s.accounts.push({ ...s.accounts[0], id: "foreign-account", companyId: secondId });
  s.leads[0].accountId = "foreign-account";
  assert.throws(() => validateState(s), /another company's/);
});

test("company permission contracts require matching company, active membership and explicit action", () => {
  const membership = migrate().companyMemberships.find((m) => m.role === "sdr")!;
  assert.equal(companyPermits(membership, membership.companyId, "prepare"), true);
  assert.equal(companyPermits(membership, membership.companyId, "approve"), false);
  assert.equal(companyPermits(membership, membership.companyId, "payroll"), false);
  assert.equal(companyPermits(membership, "another-company", "read"), false);
  assert.equal(companyPermits({ ...membership, status: "disabled" }, membership.companyId, "read"), false);
  assert.equal(companyPermits(undefined, membership.companyId, "read"), false);
});

test("single-company compatibility assigns only new records, rejects ownership edits, and keeps member changes aligned", async () => {
  const s = migrate(), store = new Store(s), companyId = s.companies[0].id;
  await store.change((next) => {
    next.accounts.push({ ...next.accounts[0], id: "new-account", companyId: undefined });
    next.members.find((m) => m.role === "operator")!.status = "disabled";
  });
  assert.equal(store.state.accounts.at(-1)!.companyId, companyId);
  assert.equal(store.state.companyMemberships.find((m) => m.role === "sdr")!.status, "disabled");
  await assert.rejects(store.change((next) => { delete next.leads[0].companyId; }), /ownership is immutable/);
  await assert.rejects(store.change((next) => { next.companyMigrations[0].recordCounts.leads = 0; }), /manifest is immutable/);
  await assert.rejects(store.change((next) => { next.accounts.push({ ...next.accounts[0], id: "foreign", companyId: "foreign" }); }), /company ownership/);
  assert.equal(store.state.leads[0].companyId, companyId);
});

test("migrated generation keeps snapshot ownership without modifying historical inputs", async () => {
  const s = migrate();
  Object.assign(s.campaigns[0], { status: "running", scheduleMode: "continuous", startsAt: "2020-01-01T00:00:00Z" });
  s.settings[0].trainingCollection = true;
  queueCampaign(s, s.campaigns[0]);
  s.jobs = s.jobs.filter((j) => j.kind === "draft").slice(0, 1);
  // Direct fixture construction mimics legacy writers; the store bridge scopes new rows.
  s.jobs[0].companyId = s.companies[0].id;
  const store = new Store(s);
  await new Runner(store, async () => ({ text: "A grounded draft for review.", fit: "needs_review", evidence: [], generator: "Test" })).tick();
  const e = store.state.trainingExamples[0];
  assert.ok(e); assert.equal(e.companyId, s.companies[0].id);
  assert.equal(e.input.lead.companyId, e.companyId); assert.equal(e.input.campaign.companyId, e.companyId);
  validateState(store.state);
});

test("failed/ambiguous migration saves block writes; restart adopts the committed company exactly once", async () => {
  const initial = legacy(); let saved = structuredClone(initial), writes = 0;
  const sheets = { initialize: async () => structuredClone(saved), save: async (s: State) => {
    saved = structuredClone(s); writes++; throw new Error("migration response lost after commit");
  } } as unknown as Sheets;
  const store = new Store(initial, sheets);
  await assert.rejects(store.change((s) => Object.assign(s, migrate(s))), /response lost/);
  assert.equal(store.state.companies.length, 0); assert.ok(store.syncError);
  await assert.rejects(store.change(() => {}), /paused/); assert.equal(writes, 1);
  sheets.save = async (s) => { saved = structuredClone(s); };
  await store.recover(); assert.equal(store.state.companies.length, 1);
  assert.equal(previewCompanyMigration(store.state).blockers.length, 1);
});

test("reconnect refuses a second company before saving or publishing any remote state", async () => {
  const remote = migrate(); remote.companies.push({ ...remote.companies[0], id: "second-company" });
  remote.companyMemberships.push({ ...remote.companyMemberships[0], id: "second-membership", companyId: "second-company" });
  let writes = 0;
  const store = new Store(emptyState(), { initialize: async () => remote, save: async () => { writes++; } } as unknown as Sheets);
  await assert.rejects(store.recover(), /Multi-company/);
  assert.equal(writes, 0); assert.equal(store.state.companies.length, 0); assert.ok(store.syncError);
});
