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
