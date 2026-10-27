import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import { SetupConfiguration, parseServiceAccount, spreadsheetId, setupApi } from "../server/setup.ts";
import { PrivateStore, type Secrets } from "../server/private-store.ts";
import { Store } from "../server/store.ts";
import { emptyState } from "../server/domain.ts";
import { demoState } from "../server/seed.ts";
import { companyFingerprint } from "../server/company.ts";
import { collections, type Sheets } from "../server/sheets.ts";
import type { TeamAuth } from "../server/team.ts";
import type { State } from "../shared/types.ts";
import { requestContext } from "../server/context.ts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const credentials = { type: "service_account" as const, client_email: "setup-test@example.invalid",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
class MemorySecrets implements Secrets {
  values = new Map<string, unknown>(); fail = false;
  async get<T>(key: string) { return structuredClone(this.values.get(key)) as T | undefined; }
  async set(key: string, value: unknown) { if (this.fail) throw new Error("storage unavailable"); this.values.set(key, structuredClone(value)); }
}

test("setup validates Google IDs/key files without following arbitrary URLs or exposing invalid key contents", () => {
  assert.equal(spreadsheetId("https://docs.google.com/spreadsheets/d/control-test/edit#gid=0"), "control-test");
  assert.equal(spreadsheetId(" control-test "), "control-test");
  for (const input of ["http://docs.google.com/spreadsheets/d/control-test", "https://evil.invalid/spreadsheets/d/control-test", "https://user@docs.google.com/spreadsheets/d/control-test", "../../private", "https://docs.google.com/spreadsheets/d/short"]) assert.throws(() => spreadsheetId(input), /Google Sheets/);
  assert.deepEqual(parseServiceAccount(JSON.stringify({ ...credentials, ignored: "not saved" })), credentials);
  assert.throws(() => parseServiceAccount("SECRET BAD FILE CONTENTS"), (e) => e instanceof Error && !e.message.includes("SECRET BAD"));
  assert.throws(() => parseServiceAccount(JSON.stringify({ ...credentials, private_key: "PRIVATE SECRET" })), /valid Google/);
});

test("setup choices merge atomically, stay encrypted and reload without an environment file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brektra-setup-config-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  try {
    const key = randomBytes(32).toString("base64"), secrets = new PrivateStore(directory, key), config = new SetupConfiguration(secrets);
    await Promise.all([config.update({ model: "qwen3:4b" }), config.update({ sheets: { spreadsheetId: "control-test", credentials } })]);
    const stored = await readFile(join(directory, "private.enc"), "utf8");
    assert.ok(!stored.includes(credentials.client_email)); assert.ok(!stored.includes(credentials.private_key));
    const reloaded = await SetupConfiguration.load(new PrivateStore(directory, key), directory);
    assert.deepEqual(reloaded.snapshot(), config.snapshot());
    const failing = new MemorySecrets(), safe = new SetupConfiguration(failing); failing.fail = true;
    await assert.rejects(safe.update({ model: "qwen3:4b" }), /unavailable/);
    assert.deepEqual(safe.snapshot(), { version: 1 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

function targetStore(remote = demoState()) {
  let saved = structuredClone(remote), writes = 0;
  const adapter = { controlId: "control-test", initialize: async () => structuredClone(saved), save: async (s: State) => { writes++; saved = structuredClone(s); } } as unknown as Sheets;
  return { adapter, saved: () => saved, writes: () => writes };
}

test("live activation uses only target-sheet data, pauses outbound work, reconciles intent and rejects old requests", async () => {
  const remote = demoState(); remote.leads[0].name = "Saved lead in target sheet";
  remote.campaigns[0].status = "running"; remote.mailboxes[0].sendingEnabled = true;
  remote.jobs.push({ id: "previous-intent", campaignId: remote.campaigns[0].id, leadId: remote.leads[1].id, accountId: remote.accounts[0].id,
    kind: "request", status: "running", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T01:00:00Z", intentAt: "2026-10-01T01:00:00Z", detail: "Interrupted" });
  const target = targetStore(remote), source = demoState(), store = new Store(source);
  let persisted = false;
  await store.connectSheets(target.adapter, companyFingerprint(source), companyFingerprint(remote), async () => {
    assert.equal(store.sheets, undefined); assert.equal(store.state, source); persisted = true;
  });
  assert.ok(persisted); assert.equal(store.state.leads[0].name, "Saved lead in target sheet");
  assert.equal(store.state.campaigns[0].status, "paused"); assert.equal(store.state.mailboxes[0].sendingEnabled, false);
  assert.equal(store.state.jobs[0].status, "uncertain"); assert.equal(store.state.jobs[0].intentAt, remote.jobs[0].intentAt);
  assert.equal(store.workspaceEpoch, 1); assert.equal(target.writes(), 1);
  await assert.rejects(requestContext.run({ actorId: "old-tab", workspaceEpoch: 0 }, () => store.change((s) => { s.leads[0].name = "Old tab overwrite"; })), /Workspace changed/);
  assert.equal(store.state.leads[0].name, "Saved lead in target sheet");
});

test("activation rejects stale checks, active source work, parallel mutations and configuration failures", async () => {
  const store = new Store(demoState()), target = targetStore(emptyState());
  await assert.rejects(store.connectSheets(target.adapter, "stale", companyFingerprint(emptyState()), async () => {}), /changed/);
  assert.equal(target.writes(), 0); assert.equal(store.changingWorkspace, false);
  store.state.campaigns[0].status = "running";
  await assert.rejects(store.connectSheets(target.adapter, companyFingerprint(store.state), companyFingerprint(emptyState()), async () => {}), /Pause demo/);
  store.state.campaigns[0].status = "paused";
  let release!: () => void;
  target.adapter.initialize = () => new Promise((resolve) => { release = () => resolve(emptyState()); });
  const connecting = store.connectSheets(target.adapter, companyFingerprint(store.state), companyFingerprint(emptyState()), async () => { throw new Error("configuration save failed"); });
  await delay(0);
  await assert.rejects(store.change(() => {}), /setup is in progress/);
  release(); await assert.rejects(connecting, /configuration save failed/);
  assert.equal(store.sheets, undefined); assert.equal(store.state.leads.length, 8); assert.equal(store.changingWorkspace, false);
  assert.equal(target.writes(), 1); // Target is safely paused; source is never replaced on failure.
});

test("guided setup API checks without writing, connects once, reports progress and keeps secrets out of responses", async (t) => {
  const originalFetch = globalThis.fetch, previousModel = process.env.OLLAMA_MODEL;
  const previousOrigin = process.env.OLLAMA_URL; process.env.OLLAMA_URL = "http://127.0.0.1:11434";
  const sheets = new Map<string, { id: number; rows: string[][] }>();
  let writes = 0, models: string[] = [], pullFailure = false, pullHeld = false, pullController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "fake", expires_in: 3600 });
    if (url.includes("sheets.googleapis.com")) {
      if (url.includes("?fields=")) return Response.json({ sheets: [...sheets].map(([title, s]) => ({ properties: { title, sheetId: s.id, gridProperties: { rowCount: 1000, columnCount: 2 } } })) });
      if (url.includes("values:batchGet")) {
        const ranges = new URL(url).searchParams.getAll("ranges");
        return Response.json({ valueRanges: ranges.map((range) => ({ values: sheets.get(range.slice(1, range.lastIndexOf("'")))?.rows || [] })) });
      }
      if (url.endsWith(":batchUpdate")) {
        writes++;
        for (const request of JSON.parse(String(init?.body)).requests) {
          if (request.addSheet) sheets.set(request.addSheet.properties.title, { id: sheets.size + 1, rows: [] });
          if (request.updateCells) {
            const update = request.updateCells, sheet = [...sheets.values()].find((s) => s.id === update.start.sheetId)!;
            update.rows.forEach((row: any, i: number) => { sheet.rows[update.start.rowIndex + i] = row.values.map((v: any) => v.userEnteredValue.stringValue); });
          }
        }
        return Response.json({});
      }
      throw new Error("Unexpected Sheets test operation");
    }
    if (url.startsWith("http://127.0.0.1:11434")) {
      if (url.endsWith("/api/tags")) return Response.json({ models: models.map((name) => ({ name })) });
      if (url.endsWith("/api/pull")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { model: "qwen3:4b", stream: true });
        if (pullFailure) return new Response('{"error":"bad download"}\n');
        if (pullHeld) return new Response(new ReadableStream({ start(c) { pullController = c; c.enqueue(encoder.encode('{"status":"pulling","total":100,"completed":40}\n')); init?.signal?.addEventListener("abort", () => c.error(new Error("aborted")), { once: true }); } }));
        models = ["qwen3:4b"];
        return new Response('{"status":"pulling","total":100,"completed":100}\n{"status":"success"}\n');
      }
    }
    return originalFetch(input, init);
  };
  const store = new Store(demoState()), secrets = new MemorySecrets(), config = new SetupConfiguration(secrets);
  let launches = 0, local = true, clock = Date.now();
  const auth = { require: (req: any) => { if (req.headers["x-test-role"] === "viewer") throw Object.assign(new Error("Forbidden"), { status: 403 }); return { id: "test-owner" }; } } as unknown as TeamAuth;
  const app = express(); app.use(express.json());
  app.use(setupApi({ configuration: config, store, auth, get local() { return local; }, now: () => clock, refreshAI: async () => {}, startOllama: async () => { launches++; },
    connect: async (adapter, source, target, connection) => store.connectSheets(adapter, source, target, () => config.update({ sheets: connection })) }));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = async (path: string, method = "GET", body?: unknown, role = "owner") => {
    const response = await originalFetch(`http://127.0.0.1:${address.port}/setup${path}`, { method, headers: { "Content-Type": "application/json", "x-test-role": role }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const jobDone = async () => { for (let i = 0; i < 100; i++) { const status = (await request("")).body; if (status.download?.status !== "downloading") return status; await delay(5); } throw new Error("Download did not finish"); };
  try {
    await t.test("permissions and operator-managed mode reject local setup actions", async () => {
      assert.equal((await request("", "GET", undefined, "viewer")).status, 403);
      assert.equal((await request("/ollama/start", "POST", {}, "viewer")).status, 403);
      local = false; assert.equal((await request("/ollama/start", "POST", {})).status, 400); assert.equal(launches, 0); local = true;
    });
    await t.test("Sheets access check is read-only and activation never copies demo records", async () => {
      const expired = await request("/sheets/check", "POST", { spreadsheet: "control-test", credentialFile: JSON.stringify(credentials) });
      assert.equal(expired.status,200); clock += 300001;
      assert.equal((await request("/sheets/connect", "POST", { checkId: expired.body.checkId, confirmed: true })).status,400);
      assert.equal(writes,0);
      const stale = await request("/sheets/check", "POST", { spreadsheet: "control-test", credentialFile: JSON.stringify(credentials) });
      sheets.set("WorkspaceSettings", { id: 1, rows: [["id", "data"], ["workspace", JSON.stringify({ id: "workspace", trainingCollection: true })]] });
      assert.equal((await request("/sheets/connect", "POST", { checkId: stale.body.checkId, confirmed: true })).status,400);
      assert.equal(store.sheets,undefined); assert.equal(config.snapshot().sheets,undefined);
      assert.equal(JSON.parse(sheets.get("WorkspaceSettings")!.rows[1][1]).trainingCollection,true);
      const beforeCheck = writes;
      const checked = await request("/sheets/check", "POST", { spreadsheet: "https://docs.google.com/spreadsheets/d/control-test/edit", credentialFile: JSON.stringify(credentials) });
      assert.equal(checked.status, 200); assert.equal(writes, beforeCheck); assert.equal(checked.body.missingTabs, 0);
      assert.ok(!JSON.stringify(checked.body).includes(credentials.private_key));
      const connected = await request("/sheets/connect", "POST", { checkId: checked.body.checkId, confirmed: true });
      assert.equal(connected.status, 200); assert.equal(store.state.leads.length, 0); assert.ok(store.sheets); assert.ok(writes > 0);
      assert.equal((await request("/sheets/connect", "POST", { checkId: checked.body.checkId, confirmed: true })).status, 400);
      assert.equal((await request("/sheets/check", "POST", { spreadsheet: "control-test", credentialFile: JSON.stringify(credentials) })).status, 400);
      const status = (await request("")).body; assert.equal(status.connected, true);
      assert.ok(!JSON.stringify(status).includes("private_key")); assert.ok(!JSON.stringify(store.state).includes("PRIVATE KEY"));
    });
    await t.test("model start, verified download and selection are explicit and persisted", async () => {
      assert.equal((await request("/ollama/start", "POST", {})).status, 200); assert.equal(launches, 1);
      assert.equal((await request("/ollama/model", "POST", { model: "missing-model" })).status, 400);
      assert.equal((await request("/ollama/pull", "POST", { model: "untrusted.example/model" })).status, 400);
      assert.equal((await request("/ollama/pull", "POST", { model: "qwen3:4b" })).status, 202);
      const status = await jobDone(); assert.equal(status.download.status, "completed");
      assert.equal(config.snapshot().model, "qwen3:4b"); assert.ok(config.snapshot().sheets);
      assert.equal((await request("/ollama/model", "POST", { model: "qwen3:4b" })).status, 200);
    });
    await t.test("failed and cancelled downloads remain visible and permit a deliberate retry", async () => {
      pullFailure = true; assert.equal((await request("/ollama/pull", "POST", { model: "qwen3:4b" })).status, 202);
      assert.equal((await jobDone()).download.status, "failed");
      pullFailure = false; pullHeld = true;
      assert.equal((await request("/ollama/pull", "POST", { model: "qwen3:4b" })).status, 202);
      assert.equal((await request("/ollama/pull", "POST", { model: "qwen3:4b" })).status, 400);
      const progress = (await request("")).body.download; assert.equal(progress.completed, 40); assert.equal(progress.total, 100);
      assert.equal((await request("/ollama/cancel", "POST", {})).status, 200);
      assert.equal((await jobDone()).download.status, "cancelled");
      pullHeld = false; assert.equal((await request("/ollama/pull", "POST", { model: "qwen3:4b" })).status, 202);
      assert.equal((await jobDone()).download.status, "completed");
    });
  } finally {
    try { pullController?.close(); } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
    globalThis.fetch = originalFetch;
    if (previousModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = previousModel;
    if (previousOrigin === undefined) delete process.env.OLLAMA_URL; else process.env.OLLAMA_URL = previousOrigin;
  }
});
