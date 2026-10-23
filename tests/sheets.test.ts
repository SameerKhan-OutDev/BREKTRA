import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sheets, quoteTab } from "../server/sheets.ts";
import { emptyState } from "../server/domain.ts";

test("Sheets adapter authenticates, bounds source reads, expands control grids, and writes RAW values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brektra-sheets-test-"));
  const credentials = join(directory, "test-credentials.json");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  await writeFile(
    credentials,
    JSON.stringify({
      client_email: "test@example.invalid",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    }),
  );
  const originalFetch = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  const titles = [
    "Accounts",
    "Sources",
    "Relationships",
    "Campaigns",
    "Jobs",
    "Drafts",
    "Activity",
  ];
  let rows = 2;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    let body: unknown = {};
    if (url.includes("oauth2.googleapis.com"))
      body = { access_token: "fake-token", expires_in: 3600 };
    else if (url.includes("?fields="))
      body = {
        sheets: titles.map((title, sheetId) => ({
          properties: {
            sheetId,
            title,
            gridProperties: { rowCount: rows, columnCount: 2 },
          },
        })),
      };
    else if (
      url.includes(":batchUpdate") &&
      !url.includes("values:batchUpdate")
    )
      rows = 8;
    else if (
      url.includes("/values/") &&
      decodeURIComponent(url).includes("A:B")
    )
      body = { values: [["id", "data"]] };
    else if (url.includes("/values/"))
      body = {
        values: [
          ["Name", "Profile URL"],
          ["Sample", "https://linkedin.com/in/sample"],
        ],
      };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    assert.equal(quoteTab("Founder's leads"), "'Founder''s leads'");
    const sheets = new Sheets(credentials, "control-test");
    await sheets.initialize();
    await sheets.rows("control-test", "Accounts");
    assert.ok(
      calls.some((c) => decodeURIComponent(c.url).includes("'Accounts'!A1:B2")),
    );
    const s = emptyState();
    s.accounts = Array.from({ length: 7 }, (_, i) => ({
      id: `a-${i}`,
      name: "=A1",
      initials: "A",
      role: "",
      dailyBudget: 10,
      status: "not_connected",
    }));
    await sheets.save(s);
    const growth = calls.find((c) =>
      c.url.endsWith("control-test:batchUpdate"),
    )!;
    assert.equal(
      JSON.parse(String(growth.init?.body)).requests[0].appendDimension.length,
      6,
    );
    const write = calls.find((c) => c.url.includes("/values:batchUpdate"))!;
    const payload = JSON.parse(String(write.init?.body));
    assert.equal(payload.valueInputOption, "RAW");
    assert.equal(payload.data[0].values.length, 8);
    assert.equal(JSON.parse(payload.data[0].values[1][1]).name, "=A1");
    assert.equal(
      (write.init?.headers as Record<string, string>).Authorization,
      "Bearer fake-token",
    );
    assert.equal(
      calls.filter((c) => c.url.includes("oauth2.googleapis.com")).length,
      1,
    );
    await sheets.save(emptyState());
    const last = calls
      .filter((c) => c.url.includes("/values:batchUpdate"))
      .at(-1)!;
    const cleared = JSON.parse(String(last.init?.body));
    assert.deepEqual(cleared.data[0].values[7], ["", ""]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(credentials);
    await rmdir(directory);
  }
});
