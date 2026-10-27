import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Workspace } from "../shared/types.ts";

test("local API supports the campaign / review workflow and rejects invalid or cross-origin changes", async (t) => {
  const port = 14311;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts", "--production"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        STORAGE_MODE: "demo",
        BREKTRA_USE_ENV: "1",
        OLLAMA_URL: "http://127.0.0.1:1",
      },
      windowsHide: true,
      stdio: "pipe",
    },
  );
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  child.on("error", (error) => (output += error.message));
  const request = async (
    path: string,
    method = "GET",
    body?: unknown,
    headers = {},
  ) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  try {
    let ready = false;
    for (let i = 0; i < 300; i++) {
      try {
        if ((await request("/api/workspace")).status === 200) {
          ready = true;
          break;
        }
      } catch {}
      if (child.exitCode !== null) break;
      await delay(100);
    }
    assert.ok(ready, output || "API did not start.");
    const initial = (await request("/api/workspace")).body as Workspace;
    assert.equal(initial.health.mode, "demo");
    assert.equal(initial.health.linkedin.connected, false);
    await t.test("a second server cannot control the same workspace on another port", async () => {
      const second = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
        cwd: process.cwd(), env: { ...process.env, PORT: "14312", STORAGE_MODE: "demo", BREKTRA_USE_ENV: "1" }, windowsHide: true, stdio: "pipe",
      });
      let failure = "";
      second.stderr.on("data", (b) => { failure += b; });
      try {
        const code = await new Promise<number | null>((resolve, reject) => {
          second.once("exit", resolve);
          second.once("error", reject);
          setTimeout(() => reject(new Error("Second server did not reject workspace ownership")), 5000).unref();
        });
        assert.notEqual(code, 0);
        assert.match(failure, /Another BREKTRA process/);
        assert.equal((await request("/api/health")).body.pid, child.pid);
      } finally { if (second.exitCode === null) second.kill(); }
    });
    await t.test("training collection is explicit, validated, and does not backfill old drafts", async () => {
      assert.equal(initial.state.settings[0].trainingCollection, false);
      assert.equal((await request("/api/settings/training", "PATCH", { enabled: "true" })).status, 400);
      assert.equal((await request("/api/settings/training", "PATCH", { enabled: true })).status, 200);
      const workspace = (await request("/api/workspace")).body as Workspace;
      assert.equal(workspace.state.settings[0].trainingCollection, true);
      assert.equal(workspace.state.trainingExamples.length, 0);
      assert.equal((await request("/api/settings/training", "PATCH", { enabled: false })).status, 200);
    });
    await t.test("portable launcher can identify the correct local app instance", async () => {
      const health = await request("/api/health");
      assert.equal(health.status, 200);
      assert.equal(health.body.app, "BREKTRA");
      assert.equal(health.body.pid, child.pid);
      assert.match(health.body.workspaceId, /^[a-f0-9]{64}$/);
    });
    await t.test("cross-origin mutation is blocked", async () => {
      const result = await request(
        "/api/accounts",
        "POST",
        { name: "Malicious origin", dailyBudget: 10 },
        { Origin: "https://example.com" },
      );
      assert.equal(result.status, 403);
    });
    await t.test("invalid campaign does not mutate data", async () => {
      assert.equal(
        (await request("/api/campaigns", "POST", { name: "x" })).status,
        400,
      );
      assert.equal(
        (await request("/api/workspace")).body.state.campaigns.length,
        1,
      );
    });
    await t.test("create, start, pause, and edit a campaign", async () => {
      const {
        id: _id,
        createdAt: _created,
        status: _status,
        ...fields
      } = initial.state.campaigns[0];
      const created = await request("/api/campaigns", "POST", {
        ...fields,
        name: "Integration test",
        startHour: 0,
        endHour: 24,
      });
      assert.equal(created.status, 201);
      const id = created.body.id;
      assert.equal(
        (
          await request(`/api/campaigns/${id}/status`, "POST", {
            status: "running",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(`/api/campaigns/${id}`, "PUT", {
            ...fields,
            name: "Cannot edit running",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/api/campaigns/${id}/status`, "POST", {
            status: "paused",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(`/api/campaigns/${id}`, "PUT", {
            ...fields,
            name: "Updated campaign",
          })
        ).status,
        200,
      );
    });
    await t.test("continuous campaign saves context and requires a valid start time", async () => {
      const fields = { ...initial.state.campaigns[0], name: "Continuous context test", company: "Example Co", pitchStyle: "direct", contextPrompt: "Use {{company}} and {{selling}} with a concise question.", pitchStrategy: "Lead with a relevant outcome, then ask for a call.", pitchSamples: "Hi, would a short conversation be useful?", scheduleMode: "continuous", startsAt: "2099-10-25T08:30:00Z", startHour: 18, endHour: 9 };
      const created = await request("/api/campaigns", "POST", fields);
      assert.equal(created.status, 201);
      assert.equal(created.body.company, fields.company);
      assert.equal(created.body.contextPrompt, fields.contextPrompt);
      assert.equal(created.body.pitchStrategy, fields.pitchStrategy);
      assert.equal(created.body.pitchSamples, fields.pitchSamples);
      assert.equal(created.body.startsAt, fields.startsAt);
      assert.ok(!("offer" in created.body));
      assert.equal((await request("/api/campaigns", "POST", { ...fields, startsAt: "" })).status, 400);
      assert.equal((await request("/api/campaigns", "POST", { ...fields, startsAt: "not-a-date" })).status, 400);
      assert.equal((await request("/api/campaigns", "POST", { ...fields, scheduleMode: "scheduled" })).status, 400);
      const updated = { ...fields, pitchStyle: "indirect", contextPrompt: "Edited context about {{selling}}", startsAt: "2099-11-01T09:15:00Z" };
      assert.equal((await request(`/api/campaigns/${created.body.id}`, "PUT", updated)).status, 200);
      const saved = (await request("/api/workspace")).body.state.campaigns.find((c: { id: string }) => c.id === created.body.id);
      assert.equal(saved.contextPrompt, updated.contextPrompt);
      assert.equal(saved.pitchStyle, updated.pitchStyle);
      assert.equal(saved.startsAt, updated.startsAt);
    });
    await t.test(
      "review is editable, approval queues a demo pitch, and repeat approval is rejected",
      async () => {
        const draft = initial.state.drafts[0];
        const text = `${draft.text} Happy to share more.`;
        assert.equal(
          (
            await request(`/api/drafts/${draft.id}`, "PUT", {
              text,
              status: "pending",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/api/drafts/${draft.id}`, "PUT", {
              text,
              status: "approved",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/api/drafts/${draft.id}`, "PUT", {
              text,
              status: "approved",
            })
          ).status,
          400,
        );
        const workspace = (await request("/api/workspace")).body as Workspace;
        assert.equal(
          workspace.state.jobs.filter(
            (j) => j.kind === "pitch" && j.leadId === draft.leadId,
          ).length,
          1,
        );
      },
    );
    await t.test(
      "opt-out cancels queued work and blocks draft generation",
      async () => {
        const lead = initial.state.leads.find(
          (l) => l.relationship === "not_connected",
        )!;
        assert.equal(
          (await request(`/api/leads/${lead.id}`, "PATCH", { optedOut: true }))
            .status,
          200,
        );
        const workspace = (await request("/api/workspace")).body as Workspace;
        assert.ok(
          workspace.state.jobs
            .filter((j) => j.leadId === lead.id)
            .every((j) => j.status === "cancelled"),
        );
        assert.equal(
          (
            await request(`/api/leads/${lead.id}/draft`, "POST", {
              campaignId: initial.state.campaigns[0].id,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "all job records expose a waiting reason or an outcome",
      async () => {
        const jobs = await request("/api/jobs");
        assert.equal(jobs.status, 200);
        assert.ok(jobs.body.length);
        assert.ok(
          jobs.body.every(
            (j: any) => typeof j.waiting === "string" && j.waiting.length,
          ),
        );
      },
    );
    await t.test("production entry point serves the app", async () => {
      const response = await fetch(`http://127.0.0.1:${port}`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /BREKTRA/);
    });
    await t.test("generation and human review records link once and preserve negative feedback", async () => {
      const before = (await request("/api/workspace")).body as Workspace;
      const campaign = before.state.campaigns.find((c) => c.name === "Updated campaign")!;
      await request("/api/settings/training", "PATCH", { enabled: true });
      await request(`/api/campaigns/${campaign.id}/status`, "POST", { status: "running" });
      let example: Workspace["state"]["trainingExamples"][number] | undefined;
      for (let i = 0; i < 100; i++) {
        const workspace = (await request("/api/workspace")).body as Workspace;
        example = workspace.state.trainingExamples.find((e) => e.draftId);
        if (example) break;
        await delay(100);
      }
      assert.ok(example?.draftId, "Runner did not capture a generated draft");
      await request(`/api/campaigns/${campaign.id}/status`, "POST", { status: "paused" });
      assert.equal(example.simulated, true);
      const revised = "Hi, could we compare notes about your team's workflow?";
      assert.equal((await request(`/api/drafts/${example.draftId}`, "PUT", { text: revised, status: "pending", reason: "Simpler wording" })).status, 200);
      // Retrying the same body (including its reason) cannot duplicate feedback.
      await request(`/api/drafts/${example.draftId}`, "PUT", { text: revised, status: "pending", reason: "Simpler wording" });
      let state = (await request("/api/workspace")).body.state as Workspace["state"];
      assert.equal(state.trainingFeedback.length, 1);
      await request("/api/settings/training", "PATCH", { enabled: false });
      await request(`/api/drafts/${example.draftId}`, "PUT", { text: `${revised} An extra edit.`, status: "pending" });
      state = (await request("/api/workspace")).body.state;
      assert.equal(state.trainingFeedback.length, 1);
      await request("/api/settings/training", "PATCH", { enabled: true });
      assert.equal((await request(`/api/drafts/${example.draftId}`, "PUT", { text: revised, status: "rejected", reason: "Not relevant" })).status, 200);
      assert.equal((await request(`/api/drafts/${example.draftId}`, "PUT", { text: revised, status: "rejected" })).status, 400);
      state = (await request("/api/workspace")).body.state;
      assert.equal(state.trainingFeedback.length, 2);
      assert.equal(state.trainingFeedback[1].decision, "rejected");
      assert.equal(state.trainingFeedback[1].reason, "Not relevant");
      assert.equal(state.trainingFeedback[1].exampleId, example.id);
      assert.equal(state.trainingExamples.find((e) => e.id === example.id)!.original!.text, example.original!.text);
      assert.ok(state.activity.some((e) => e.eventType === "pitch_review_required"));
    });
    await t.test("sequence and inbox APIs preserve review versions, pauses, opt-outs and safe evidence checks", async () => {
      const created = await request("/api/campaigns", "POST", {...initial.state.campaigns[0], name:"Email sequence API test", mode:"pitching", startHour:0, endHour:24});
      assert.equal(created.status,201);
      const campaignId=created.body.id, mailboxId=initial.state.mailboxes[0].id;
      assert.equal((await request(`/api/mailboxes/${mailboxId}`,"PATCH",{sendingEnabled:true,dailyBudget:20})).status,200);
      const sequence={enabled:true,mailboxId,steps:[{id:"intro",kind:"email",delayHours:0,subject:"Question for {{leadCompany}}",body:"Hi {{firstName}}, would a conversation be useful?"}]};
      assert.equal((await request(`/api/campaigns/${campaignId}/sequence`,"PUT",sequence)).status,200);
      assert.equal((await request(`/api/campaigns/${campaignId}/sequence`,"PUT",{...sequence,steps:[...sequence.steps,...sequence.steps]})).status,400);
      const lead=initial.state.leads[2];
      assert.equal((await request(`/api/campaigns/${campaignId}/enrollments`,"POST",{leadIds:[lead.id]})).status,200);
      assert.equal((await request(`/api/campaigns/${campaignId}/status`,"POST",{status:"running"})).status,200);
      let action:any;
      for(let i=0;i<100;i++) {
        action=(await request("/api/workspace")).body.state.outreachActions.find((a:any)=>a.campaignId===campaignId);
        if(action)break;await delay(100);
      }
      assert.ok(action,"Sequence did not create a review item");assert.equal(action.status,"pending");
      await request(`/api/campaigns/${campaignId}/status`,"POST",{status:"paused"});
      const edited={expectedRevision:action.revision,subject:action.subject,body:"Hi Amara, would a short conversation about your workflow be useful?",status:"pending"};
      assert.equal((await request(`/api/outreach/${encodeURIComponent(action.id)}`,"PUT",edited)).status,200);
      assert.equal((await request(`/api/outreach/${encodeURIComponent(action.id)}`,"PUT",{...edited,status:"approved"})).status,400);
      let state=(await request("/api/workspace")).body.state;
      const latest=state.outreachActions.find((a:any)=>a.id===action.id);
      assert.equal(latest.revision,2);
      assert.equal((await request(`/api/outreach/${encodeURIComponent(action.id)}`,"PUT",{...edited,expectedRevision:2,status:"approved"})).status,200);
      const waiting=(await request("/api/outreach/status")).body.find((a:any)=>a.id===action.id);
      assert.match(waiting.waiting,/paused/);
      assert.equal((await request(`/api/leads/${lead.id}`,"PATCH",{optedOut:true})).status,200);
      state=(await request("/api/workspace")).body.state;assert.equal(state.outreachActions.find((a:any)=>a.id===action.id).status,"cancelled");
      assert.ok(state.outreachReviews.some((r:any)=>r.actionId===action.id&&r.decision==="approved"));
      const conversation=initial.state.conversations[0],path=`/api/conversations/${encodeURIComponent(conversation.id)}`;
      assert.equal((await request(path,"PATCH",{unread:false,status:"done"})).status,200);
      assert.equal((await request(`${path}/reply`,"POST",{body:"Thanks, here are the details.",expectedUpdatedAt:"2020-01-01T00:00:00Z"})).status,400);
      assert.equal((await request(`${path}/reply`,"POST",{body:"Thanks, here are the details.",expectedUpdatedAt:conversation.updatedAt})).status,201);
      assert.equal((await request(`${path}/reply`,"POST",{body:"Do not create a duplicate reply.",expectedUpdatedAt:conversation.updatedAt})).status,400);
      assert.equal((await request(`/api/leads/${lead.id}/enrich`,"POST",{website:"https://127.0.0.1"})).status,400);
      assert.equal((await request(`/api/leads/${lead.id}/approval`,"PATCH",{decision:"approved"})).status,400); // Still opted out.
    });
  } finally {
    child.kill();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else {
        child.once("exit", () => resolve());
        setTimeout(resolve, 3000).unref();
      }
    });
  }
});
