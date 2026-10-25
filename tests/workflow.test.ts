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
import { normalizeCampaign, renderContext } from "../shared/campaign.ts";
import { generateDraft } from "../server/ai.ts";
const noon = new Date("2026-10-24T07:00:00Z");
test("continuous schedules wait for the start instant, run across days, and respect pause and budgets", () => {
  const s = demoState();
  const c = s.campaigns[0];
  Object.assign(c, { status: "running", scheduleMode: "continuous", startsAt: noon.toISOString(), startHour: 9, endHour: 18 });
  const lead = s.leads.find((l) => l.relationship === "not_connected")!;
  const job = makeJob(c, "request", lead.id);
  assert.ok(canDispatch(s, c, job, new Date(noon.getTime() - 1)));
  assert.equal(canDispatch(s, c, job, noon), null);
  assert.equal(canDispatch(s, c, job, new Date("2026-11-01T20:00:00Z")), null);
  c.status = "paused";
  assert.ok(canDispatch(s, c, job, noon));
  c.status = "running";
  s.accounts[0].dailyBudget = 1;
  s.jobs.push({ ...job, status: "simulated" });
  assert.match(canDispatch(s, c, job, noon)!, /budget/);
  assert.equal(canDispatch(s, c, job, new Date("2026-10-25T07:00:00Z")), null);
});

test("existing campaign messaging migrates to the editable context without changing working hours", () => {
  const { company, selling, pitchStyle, contextPrompt, pitchStrategy, pitchSamples, scheduleMode, startsAt, ...legacy } = demoState().campaigns[0];
  const migrated = normalizeCampaign({ ...legacy, offer: "Legacy selling text" } as unknown as Campaign);
  assert.equal(migrated.selling, "Legacy selling text");
  assert.equal(migrated.scheduleMode, "scheduled");
  assert.equal(migrated.startHour, legacy.startHour);
  assert.ok(!("offer" in migrated));
  assert.match(renderContext(migrated), /Legacy selling text/);
  assert.match(renderContext(migrated), /Conversational/);
  migrated.contextPrompt = "Custom guidance for {{company}}: {{selling}}";
  migrated.company = "Example";
  assert.equal(renderContext(migrated), "Custom guidance for Example: Legacy selling text");
});
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

test("an active campaign picks up new leads without restarting or retrying failed work", async () => {
  const s = demoState();
  Object.assign(s.campaigns[0], { status: "running", scheduleMode: "continuous", startsAt: "2020-01-01T00:00:00Z" });
  queueCampaign(s, s.campaigns[0]);
  for (const job of s.jobs) job.status = "failed";
  const fresh = { ...s.leads.find((l) => l.relationship === "not_connected")!, id: "fresh-lead", profileUrl: "https://www.linkedin.com/in/fresh-lead" };
  s.leads.push(fresh);
  const store = new Store(s);
  await new Runner(store).tick();
  assert.equal(store.state.jobs.find((j) => j.leadId === fresh.id)?.status, "simulated");
  assert.equal(store.state.jobs.length, s.jobs.length + 1);
});

test("draft generation supplies the edited context, style, strategy and samples to the local model", async () => {
  const s = demoState();
  const c = s.campaigns[0];
  c.contextPrompt = "Custom context for {{company}} selling {{selling}} to {{icp}} in a {{pitchStyle}} style.";
  c.pitchStyle = "direct";
  c.pitchStrategy = "Ask one relevant question.";
  c.pitchSamples = "Hi Alex, is workflow automation a priority?";
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      const context = JSON.parse(body.messages[1].content);
      assert.equal(context.contextPrompt, renderContext(c));
      assert.equal(context.company, c.company);
      assert.equal(context.selling, c.selling);
      assert.equal(context.pitchStyle, "direct");
      assert.equal(context.pitchStrategy, c.pitchStrategy);
      assert.equal(context.pitchSamples, c.pitchSamples);
      assert.equal(context.lead.name, s.leads[0].name);
      return Response.json({ message: { content: JSON.stringify({ fit: "needs_review", evidence: ["Provided role"], text: "Hi Sofia, is workflow automation a priority?" }) } });
    };
    const draft = await generateDraft(s.leads[0], c, false);
    assert.equal(draft.fit, "needs_review");
    assert.match(draft.text, /workflow automation/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
