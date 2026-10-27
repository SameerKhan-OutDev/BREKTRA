import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sheets, collections, quoteTab } from "../server/sheets.ts";
import { emptyState, now } from "../server/domain.ts";
import { demoState } from "../server/seed.ts";
import { Store } from "../server/store.ts";
import { encodeRecord } from "../server/schema.ts";
import { prepareCompanyMigration, companyFingerprint, previewCompanyMigration } from "../server/company.ts";

// Exercise the real OAuth/Sheets adapter against a stateful HTTP double. No
// real spreadsheet or credentials are required or claimed by these tests.
test("Sheets persistence safety", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "brektra-sheets-test-"));
  const credentials = join(directory, "test-credentials.json");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  await writeFile(credentials, JSON.stringify({ client_email: "test@example.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }));
  const originalFetch = globalThis.fetch;
  const titles = Object.values(collections);
  let tabs = new Map<string, string[][]>();
  let gridRows = new Map<string, number>();
  let writes: any[] = [];
  let loseResponse = false;
  let rejectBatch = false;
  let tokens = 0;
  let sourceRead = "";
  function reset() {
    tabs = new Map(titles.map((title) => [title, [["id", "data"]]]));
    gridRows = new Map(titles.map((title) => [title, 2]));
    writes = []; loseResponse = false; rejectBatch = false;
  }
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com")) { tokens++; return Response.json({ access_token: "fake-token", expires_in: 3600 }); }
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer fake-token");
    if (url.includes("?fields=")) return Response.json({ sheets: titles.map((title, sheetId) => ({ properties: { sheetId, title, gridProperties: { rowCount: gridRows.get(title), columnCount: 2 } } })) });
    if (url.includes("/values:batchGet")) return Response.json({ valueRanges: titles.map((title) => ({ values: tabs.get(title) })) });
    if (url.includes("/values/")) { sourceRead = decodeURIComponent(url); return Response.json({ values: [] }); }
    if (url.endsWith(":batchUpdate")) {
      const payload = JSON.parse(String(init?.body));
      writes.push(payload);
      if (rejectBatch) { rejectBatch = false; return Response.json({}, { status: 400 }); }
      // Apply to a clone, then commit the whole batch as the real endpoint does.
      const next = structuredClone(tabs);
      for (const request of payload.requests) {
        if (request.appendDimension) {
          const g = request.appendDimension;
          const title = titles[g.sheetId];
          gridRows.set(title, gridRows.get(title)! + g.length);
        }
        if (request.updateCells) {
          const u = request.updateCells;
          assert.equal(u.fields, "userEnteredValue");
          assert.equal(u.start.columnIndex, 0);
          const title = titles[u.start.sheetId];
          u.rows.forEach((row: any, offset: number) => {
            const index = u.start.rowIndex + offset;
            assert.ok(index < gridRows.get(title)!);
            next.get(title)![index] = row.values.map((v: any) => v.userEnteredValue.stringValue);
          });
        }
      }
      tabs = next;
      if (loseResponse) { loseResponse = false; throw new Error("response lost after commit"); }
      return Response.json({ replies: [] });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };
  try {
    await t.test("atomic growth, string values, changed rows, no-op saves and deletion survive restart", async () => {
      reset(); tokens = 0;
      const sheets = new Sheets(credentials, "control-test");
      await sheets.initialize();
      assert.equal(quoteTab("Founder's leads"), "'Founder''s leads'");
      await sheets.rows("control-test", "Accounts");
      assert.match(sourceRead, /Accounts'!A1:B2/);
      const s = emptyState();
      s.accounts = Array.from({ length: 7 }, (_, i) => ({ id: `a-${i}`, name: "=A1", initials: "A", role: "", dailyBudget: 10, status: "not_connected" }));
      await sheets.save(s);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].requests[0].appendDimension.length, 6);
      assert.equal(JSON.parse(tabs.get("Accounts")![1][1]).record.name, "=A1");
      assert.equal(tokens, 1);
      const count = writes.length;
      await sheets.save(s);
      assert.equal(writes.length, count);
      s.accounts[3].dailyBudget = 11;
      await sheets.save(s);
      assert.equal(writes.at(-1).requests.length, 1);
      assert.equal(writes.at(-1).requests[0].updateCells.start.rowIndex, 4);
      assert.equal(writes.at(-1).requests[0].updateCells.rows.length, 1);
      s.accounts.splice(1, 1);
      await sheets.save(s);
      assert.deepEqual(tabs.get("Accounts")![2], ["", ""]);
      const restored = await new Sheets(credentials, "control-test").initialize();
      assert.equal(restored.accounts.length, 6);
      assert.equal(restored.accounts.find((a) => a.id === "a-3")!.dailyBudget, 11);
    });
    await t.test("legacy records migrate without losing context and unknown versions fail before a write", async () => {
      reset();
      const legacy: any = demoState();
      legacy.campaigns[0].offer = "Historic offer";
      delete legacy.campaigns[0].selling;
      delete legacy.campaigns[0].pitchStrategy;
      for (const [key, title] of Object.entries(collections))
        tabs.set(title, [["id", "data"], ...legacy[key].map((row: any) => [row.id, JSON.stringify(row)])]);
      const adapter = new Sheets(credentials, "control-test");
      const migrated = await adapter.initialize();
      assert.equal(migrated.campaigns[0].selling, "Historic offer");
      assert.equal(migrated.campaigns[0].contextPrompt, legacy.campaigns[0].contextPrompt);
      assert.equal(migrated.trainingExamples.length, 0);
      await adapter.save(migrated);
      assert.equal(JSON.parse(tabs.get("Campaigns")![1][1]).schemaVersion, 1);
      tabs.get("Accounts")![1][1] = JSON.stringify({ schemaVersion: 999, record: legacy.accounts[0] });
      const before = writes.length;
      await assert.rejects(new Sheets(credentials, "control-test").initialize(), /Accounts, row 2/);
      assert.equal(writes.length, before);
    });
    await t.test("invalid stored booleans and inconsistent references cannot activate campaigns", async () => {
      reset();
      const s: any = demoState();
      for (const [key, title] of Object.entries(collections))
        tabs.set(title, [["id", "data"], ...s[key].map((row: any) => [row.id, encodeRecord(row)])]);
      const bad = { ...s.leads[0], optedOut: "false" };
      tabs.get("Relationships")![1][1] = encodeRecord(bad);
      const store = new Store(emptyState(), new Sheets(credentials, "control-test"));
      await assert.rejects(store.recover(), /leads.0.optedOut/);
      assert.equal(store.state.campaigns.length, 0);
      assert.ok(store.syncError);
      assert.equal(writes.length, 0);
      bad.optedOut = false as any;
      bad.accountId = "missing";
      tabs.get("Relationships")![1][1] = encodeRecord(bad);
      await assert.rejects(store.recover(), /missing account/);
    });
    await t.test("reviewed company ownership and manifest commit atomically and survive a fresh adapter", async () => {
      reset();
      const adapter = new Sheets(credentials, "control-test");
      await adapter.initialize();
      const legacy = demoState();
      await adapter.save(legacy);
      const store = new Store(legacy, adapter), before = writes.length;
      await store.change((state) => Object.assign(state, prepareCompanyMigration(state, {
        name: "Original company", fingerprint: companyFingerprint(state), actorId: "local-owner", backupConfirmed: true,
      })));
      assert.equal(writes.length, before + 1);
      assert.equal(tabs.get("Companies")!.length, 2);
      assert.equal(tabs.get("CompanyMigrations")!.length, 2);
      assert.equal(JSON.parse(tabs.get("Relationships")![1][1]).schemaVersion, 2);
      const restored = await new Sheets(credentials, "control-test").initialize();
      assert.deepEqual(restored.companies, store.state.companies);
      assert.deepEqual(restored.leads, store.state.leads);
      assert.equal(previewCompanyMigration(restored).blockers.length, 1);
      const bad = JSON.parse(tabs.get("Relationships")![1][1]);
      delete bad.record.companyId;
      tabs.get("Relationships")![1][1] = JSON.stringify(bad);
      const count = writes.length;
      await assert.rejects(new Sheets(credentials, "control-test").initialize(), /company ownership/);
      assert.equal(writes.length, count);
    });
    await t.test("external edits pause instead of overwriting; reconnect adopts remote records", async () => {
      reset();
      const sheets = new Sheets(credentials, "control-test");
      const store = new Store(emptyState(), sheets);
      await store.recover();
      tabs.get("WorkspaceSettings")![1][1] = encodeRecord({ id: "workspace", trainingCollection: true });
      await assert.rejects(store.change((s) => { s.settings[0].trainingCollection = true; }), /changed outside/);
      const count = writes.length;
      await assert.rejects(store.change(() => {}), /dispatch paused/);
      assert.equal(writes.length, count);
      await store.recover();
      assert.equal(store.state.settings[0].trainingCollection, true);
    });
    await t.test("a lost commit response blocks mutations and restart reloads the committed result", async () => {
      reset();
      const store = new Store(emptyState(), new Sheets(credentials, "control-test"));
      await store.recover();
      loseResponse = true;
      await assert.rejects(store.change((s) => { s.settings[0].trainingCollection = true; }), /response lost/);
      assert.equal(store.state.settings[0].trainingCollection, false);
      await assert.rejects(store.change(() => {}), /dispatch paused/);
      const fresh = new Store(emptyState(), new Sheets(credentials, "control-test"));
      await fresh.recover();
      assert.equal(fresh.state.settings[0].trainingCollection, true);
      assert.equal(fresh.state.trainingExamples.length, 0);
    });
    await t.test("rejected atomic write preserves previous remote values and requires recovery", async () => {
      reset();
      const store = new Store(emptyState(), new Sheets(credentials, "control-test"));
      await store.recover();
      const before = structuredClone(tabs);
      rejectBatch = true;
      await assert.rejects(store.change((s) => { s.settings[0].trainingCollection = true; }), /Sheets request failed/);
      assert.deepEqual(tabs, before);
      await store.recover();
      assert.equal(store.state.settings[0].trainingCollection, false);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(credentials);
    await rmdir(directory);
  }
});
