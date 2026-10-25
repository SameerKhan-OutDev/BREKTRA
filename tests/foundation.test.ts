import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { acquireLock } from "../server/lock.ts";
import { Store } from "../server/store.ts";
import { Runner } from "../server/runner.ts";
import { demoState } from "../server/seed.ts";
import { canDispatch, now, queueCampaign } from "../server/domain.ts";
import { validateState, encodeRecord } from "../server/schema.ts";
import type { Sheets } from "../server/sheets.ts";
import type { State } from "../shared/types.ts";

function activeState() {
  const s = demoState();
  Object.assign(s.campaigns[0], { status: "running", scheduleMode: "continuous", startsAt: "2020-01-01T00:00:00Z" });
  queueCampaign(s, s.campaigns[0]);
  s.jobs = s.jobs.filter((j) => j.kind === "draft").slice(0, 1);
  return s;
}
function persistent(initial: State) {
  let saved = structuredClone(initial);
  const sheets = { initialize: async () => structuredClone(saved), save: async (state: State) => { saved = structuredClone(state); } } as unknown as Sheets;
  return { sheets, store: new Store(structuredClone(initial), sheets) };
}
const output = { text: "Hi, would it be useful to compare notes?", fit: "needs_review" as const, evidence: ["Supplied role"], generator: "Test double" };

test("OS lock rejects another owner and releases after close", async () => {
  const identity = `test:${randomUUID()}`;
  const release = await acquireLock(identity);
  try { await assert.rejects(acquireLock(identity), /Another BREKTRA process/); }
  finally { await release(); }
  await (await acquireLock(identity))();
});

test("saved state validation rejects duplicate action IDs, dangling references and unsafe cell sizes", () => {
  const s = activeState();
  validateState(s);
  s.jobs.push({ ...s.jobs[0], id: "duplicate-action" });
  assert.throws(() => validateState(s), /duplicate active jobs/);
  s.jobs.pop();
  s.jobs[0].accountId = "missing";
  assert.throws(() => validateState(s), /inconsistent references/);
  assert.throws(() => encodeRecord({ id: "oversized", value: "a".repeat(50000) } as any), /safe Sheets cell size/);
});

test("unresolved sends retain their original intent time and reserve account budgets across restart and dates", async () => {
  const s = activeState();
  const c = s.campaigns[0];
  s.accounts[0].dailyBudget = 1;
  const target = s.leads.find((l) => l.relationship === "not_connected")!;
  const j = { ...s.jobs[0], id: "outbound", leadId: target.id, kind: "request" as const, status: "running" as const, updatedAt: "2026-10-01T10:00:00Z" };
  s.jobs = [j];
  const { store } = persistent(s);
  await store.recover();
  assert.equal(store.state.jobs[0].status, "uncertain");
  assert.equal(store.state.jobs[0].intentAt, j.updatedAt);
  assert.match(canDispatch(store.state, c, { ...j, id: "next", status: "queued" }, new Date("2026-10-25T10:00:00Z"))!, /Shared account budget/);
  await store.recover();
  assert.equal(store.state.jobs.length, 1);
});

test("generation snapshots and originals persist once, remain immutable, and collection defaults off", async () => {
  const s = activeState();
  const disabled = persistent(s);
  await new Runner(disabled.store, async () => output).tick();
  assert.equal(disabled.store.state.trainingExamples.length, 0);
  s.settings[0].trainingCollection = true;
  const { store, sheets } = persistent(s);
  await new Runner(store, async () => output).tick();
  const example = structuredClone(store.state.trainingExamples[0]);
  assert.equal(example.original?.text, output.text);
  assert.equal(example.input.campaign.pitchSamples, s.campaigns[0].pitchSamples);
  assert.equal(example.status, "completed");
  assert.ok(example.draftId);
  await store.change((state) => { state.campaigns[0].pitchSamples = "Changed later"; });
  assert.deepEqual(store.state.trainingExamples[0], example);
  const restart = new Store(demoState(), sheets);
  await restart.recover();
  assert.deepEqual(restart.state.trainingExamples, [example]);
  assert.equal(restart.state.drafts.filter((d) => d.id === example.draftId).length, 1);
});

test("turning collection off during generation prevents original text collection", async () => {
  const s = activeState();
  s.settings[0].trainingCollection = true;
  const { store } = persistent(s);
  let complete!: (value: typeof output) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const runner = new Runner(store, () => { entered(); return new Promise((resolve) => { complete = resolve; }); });
  const running = runner.tick();
  await started;
  await store.change((state) => { state.settings[0].trainingCollection = false; });
  complete(output);
  await running;
  assert.equal(store.state.trainingExamples[0].status, "discarded");
  assert.equal(store.state.trainingExamples[0].original, undefined);
  assert.equal(store.state.drafts.length, s.drafts.length + 1);
});

for (const intervention of ["pause", "pause-resume", "opt-out", "opt-out-reversal", "edit", "reconnect"] as const) {
  test(`in-flight generation cannot publish after ${intervention}`, async () => {
    const s = activeState();
    s.settings[0].trainingCollection = true;
    const { store } = persistent(s);
    let complete!: (value: typeof output) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const runner = new Runner(store, () => { entered(); return new Promise((resolve) => { complete = resolve; }); });
    const running = runner.tick();
    await started;
    if (intervention === "reconnect") await store.recover();
    else await store.change((state) => {
      if (intervention === "pause" || intervention === "pause-resume") state.campaigns[0].status = "paused";
      if (intervention === "edit") state.leads.find((l) => l.id === state.jobs[0].leadId)!.notes = "Updated facts";
      if (intervention === "opt-out" || intervention === "opt-out-reversal") state.leads.find((l) => l.id === state.jobs[0].leadId)!.optedOut = true;
    });
    if (intervention === "pause-resume") await store.change((state) => { state.campaigns[0].status = "running"; });
    if (intervention === "opt-out-reversal") await store.change((state) => { state.leads.find((l) => l.id === state.jobs[0].leadId)!.optedOut = false; });
    complete(output);
    await running;
    assert.equal(store.state.drafts.length, s.drafts.length);
    assert.ok(["failed", "cancelled"].includes(store.state.jobs[0].status));
    assert.equal(store.state.trainingExamples[0].original, undefined);
  });
}

test("failed intent persistence prevents generation from starting", async () => {
  const s = activeState();
  let calls = 0;
  const sheets = { save: async () => { throw new Error("intent write failed"); } } as unknown as Sheets;
  const store = new Store(s, sheets);
  await new Runner(store, async () => { calls++; return output; }).tick();
  assert.equal(calls, 0);
  assert.equal(store.state.jobs[0].status, "queued");
  assert.ok(store.syncError);
});
