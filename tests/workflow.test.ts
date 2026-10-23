import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canDispatch,
  id,
  leadId,
  now,
  profileUrl,
  queueCampaign,
} from "../server/domain.ts";
import { demoState } from "../server/seed.ts";
import { Store } from "../server/store.ts";
import { Runner } from "../server/runner.ts";
import type { Sheets } from "../server/sheets.ts";
import type { Campaign, Job } from "../shared/types.ts";
const noon = new Date("2026-10-24T07:00:00Z");
const makeJob = (
  campaign: Campaign,
  kind: Job["kind"],
  leadId: string,
): Job => ({
  id: id(),
  campaignId: campaign.id,
  accountId: campaign.accountId,
  leadId,
  kind,
  status: "queued",
  createdAt: noon.toISOString(),
  updatedAt: noon.toISOString(),
  detail: "",
});

test("profile IDs normalize query strings, scheme, casing, and trailing slashes", () => {
  assert.equal(
    profileUrl("http://linkedin.com/in/Example/?trk=feed"),
    "https://www.linkedin.com/in/example",
  );
  assert.equal(
    leadId("a", "https://linkedin.com/in/Example/"),
    leadId("a", "https://www.linkedin.com/in/example"),
  );
  assert.notEqual(
    leadId("a", "https://linkedin.com/in/example"),
    leadId("b", "https://linkedin.com/in/example"),
  );
  for (const input of [
    "https://linkedin.com.evil.com/in/person",
    "https://www.linkedin.com/company/example",
    "javascript:alert(1)",
    "https://example.com/in/person",
  ])
    assert.throws(() => profileUrl(input));
});

test("starting competing campaigns never queues duplicate outreach to the same account and lead", () => {
  const s = demoState();
  const first = s.campaigns[0];
  const second = { ...first, id: "second" };
  s.campaigns.push(second);
  const count = queueCampaign(s, first);
  assert.equal(count, 5); // 3 requests, 2 new drafts; existing draft and unknown/pending leads are excluded.
  assert.equal(queueCampaign(s, second), 0);
  assert.equal(queueCampaign(s, first), 0);
  assert.ok(
    s.jobs.every((j) => !s.leads.find((l) => l.id === j.leadId)?.optedOut),
  );
});

test("an unconnected real account can prepare drafts but can never queue outbound actions", () => {
  const s = demoState();
  s.accounts[0].status = "not_connected";
  queueCampaign(s, s.campaigns[0]);
  assert.equal(s.jobs.length, 2);
  assert.ok(s.jobs.every((j) => j.kind === "draft"));
});

test("dispatch rechecks opt-outs, relationship eligibility, and working hours", () => {
  const s = demoState();
  const c = s.campaigns[0];
  c.status = "running";
  c.startHour = 9;
  c.endHour = 18;
  const lead = s.leads.find((l) => l.relationship === "not_connected")!;
  const job = makeJob(c, "request", lead.id);
  assert.equal(canDispatch(s, c, job, noon), null);
  lead.optedOut = true;
  assert.match(canDispatch(s, c, job, noon)!, /opted out/);
  lead.optedOut = false;
  lead.relationship = "pending";
  assert.match(canDispatch(s, c, job, noon)!, /eligible/);
  lead.relationship = "not_connected";
  assert.match(
    canDispatch(s, c, job, new Date("2026-10-24T20:00:00Z"))!,
    /working hours/,
  );
});

test("balanced mode reserves each queue allocation even when the other queue has no work", () => {
  const s = demoState();
  const c = s.campaigns[0];
  c.status = "running";
  c.dailyLimit = 3;
  const lead = s.leads.find((l) => l.relationship === "not_connected")!;
  s.jobs.push(
    ...[0, 1].map(() => ({
      ...makeJob(c, "request", lead.id),
      status: "simulated" as const,
    })),
  );
  assert.match(
    canDispatch(s, c, makeJob(c, "request", lead.id), noon)!,
    /50\/50/,
  );
  const connected = s.leads.find((l) => l.relationship === "connected")!;
  assert.equal(
    canDispatch(s, c, makeJob(c, "pitch", connected.id), noon),
    null,
  );
  s.jobs.push({ ...makeJob(c, "pitch", connected.id), status: "simulated" });
  assert.match(
    canDispatch(s, c, makeJob(c, "pitch", connected.id), noon)!,
    /daily allocation/,
  );
});

test("shared account budget counts competing campaigns using one workspace day boundary", () => {
  const s = demoState();
  const c = s.campaigns[0];
  c.status = "running";
  s.accounts[0].dailyBudget = 1;
  const other = { ...c, id: "other", timezone: "America/New_York" };
  s.campaigns.push(other);
  const lead = s.leads.find((l) => l.relationship === "not_connected")!;
  s.jobs.push({ ...makeJob(other, "request", lead.id), status: "uncertain" });
  assert.match(
    canDispatch(s, c, makeJob(c, "request", lead.id), noon)!,
    /Shared account/,
  );
});

test("failed persistence rolls back local changes and pauses dispatch until reconciliation", async () => {
  const s = demoState();
  const sheets = {
    save: async () => {
      throw new Error("network unavailable");
    },
  } as unknown as Sheets;
  const store = new Store(s, sheets);
  await assert.rejects(
    store.change((state) => {
      state.campaigns[0].name = "must not commit";
    }),
    /network unavailable/,
  );
  assert.equal(store.state.campaigns[0].name, s.campaigns[0].name);
  assert.equal(store.syncError, "network unavailable");
  await new Runner(store).tick();
  assert.equal(store.state.jobs.length, 0);
});

test("simultaneous mutations serialize and cannot lose one another’s updates", async () => {
  const store = new Store(demoState());
  await Promise.all(
    Array.from({ length: 10 }, () =>
      store.change(async (state) => {
        const previous = state.accounts[0].dailyBudget;
        await Promise.resolve();
        state.accounts[0].dailyBudget = previous + 1;
      }),
    ),
  );
  assert.equal(store.state.accounts[0].dailyBudget, 30);
});

test("mutations queued behind a failed write stay blocked until remote state is reconciled", async () => {
  let saves = 0;
  const sheets = {
    save: async () => {
      saves++;
      if (saves === 1) throw new Error("unknown write outcome");
    },
  } as unknown as Sheets;
  const store = new Store(demoState(), sheets);
  const results = await Promise.allSettled([
    store.change((state) => {
      state.accounts[0].dailyBudget = 30;
    }),
    store.change((state) => {
      state.accounts[0].dailyBudget = 40;
    }),
  ]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(saves, 1);
  assert.equal(store.state.accounts[0].dailyBudget, 20);
});

test("a failed reconnect pauses a previously healthy store", async () => {
  const sheets = {
    initialize: async () => {
      throw new Error("network unavailable");
    },
  } as unknown as Sheets;
  const store = new Store(demoState(), sheets);
  await assert.rejects(store.recover());
  assert.equal(store.syncError, "network unavailable");
  await assert.rejects(
    store.change(() => {}),
    /dispatch paused/,
  );
});

test("restart reconciliation leaves interrupted jobs uncertain without requeuing", async () => {
  const s = demoState();
  const lead = s.leads[1];
  s.jobs.push({
    ...makeJob(s.campaigns[0], "request", lead.id),
    status: "running",
  });
  const sheets = {
    initialize: async () => structuredClone(s),
    save: async () => {},
  } as unknown as Sheets;
  const store = new Store(demoState(), sheets);
  await store.recover();
  assert.equal(store.state.jobs[0].status, "uncertain");
  queueCampaign(store.state, store.state.campaigns[0]);
  assert.equal(
    store.state.jobs.filter((j) => j.leadId === lead.id && j.kind === "request")
      .length,
    1,
  );
});

test("runner records simulated outcomes and generates review drafts without live actions", async () => {
  const s = demoState();
  const c = s.campaigns[0];
  c.status = "running";
  c.startHour = 0;
  c.endHour = 24;
  queueCampaign(s, c);
  const store = new Store(s);
  const runner = new Runner(store);
  for (let i = 0; i < 8; i++) await runner.tick();
  assert.equal(
    store.state.jobs.filter((j) => j.status === "simulated").length,
    3,
  );
  assert.equal(store.state.drafts.length, 3);
  assert.ok(store.state.drafts.every((d) => d.status === "pending"));
  assert.ok(
    store.state.activity
      .filter((a) => a.kind === "request")
      .every((a) => a.simulated),
  );
  assert.ok(
    store.state.jobs.every((j) =>
      ["simulated", "completed"].includes(j.status),
    ),
  );
});
