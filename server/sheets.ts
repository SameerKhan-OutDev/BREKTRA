import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import type { State } from "../shared/types.ts";
import { emptyState } from "./domain.ts";
const collections = {
  accounts: "Accounts",
  sources: "Sources",
  leads: "Relationships",
  campaigns: "Campaigns",
  jobs: "Jobs",
  drafts: "Drafts",
  activity: "Activity",
} as const;
export const quoteTab = (tab: string) => `'${tab.replaceAll("'", "''")}'`;
const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
export class Sheets {
  private token = "";
  private expiresAt = 0;
  private rowCounts = new Map<string, number>();
  private grids = new Map<
    string,
    { sheetId: number; rowCount: number; columnCount: number }
  >();
  constructor(
    private credentialsPath: string,
    readonly controlId: string,
  ) {}
  private async auth() {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    const credentials = JSON.parse(
      await readFile(this.credentialsPath, "utf8"),
    );
    if (!credentials.client_email || !credentials.private_key)
      throw new Error(
        "Service account file must contain client_email and private_key.",
      );
    const iat = Math.floor(Date.now() / 1000);
    const payload = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
    const sign = createSign("RSA-SHA256");
    sign.update(payload);
    const assertion = `${payload}.${sign.sign(credentials.private_key, "base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "Google authentication failed. Check your service account credentials.",
      );
    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = json.access_token;
    this.expiresAt = Date.now() + (json.expires_in - 90) * 1000;
    return this.token;
  }
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.auth();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${path}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) {
      if (response.status === 429)
        throw new Error(
          "Google Sheets quota reached. Dispatch is paused; retry after a minute.",
        );
      throw new Error(
        `Sheets request failed (${response.status}). Check spreadsheet sharing and Google Sheets API access.`,
      );
    }
    return response.json();
  }
  async tabs(spreadsheetId: string) {
    const data = await this.request(
      `${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties)`,
    );
    for (const sheet of data.sheets)
      this.grids.set(`${spreadsheetId}:${sheet.properties.title}`, {
        sheetId: sheet.properties.sheetId,
        ...sheet.properties.gridProperties,
      });
    return data.sheets.map((s: any) => s.properties.title) as string[];
  }
  async rows(spreadsheetId: string, tab: string) {
    if (!this.grids.has(`${spreadsheetId}:${tab}`))
      await this.tabs(spreadsheetId);
    const grid = this.grids.get(`${spreadsheetId}:${tab}`);
    if (!grid) throw new Error("The requested source tab does not exist.");
    const column = Math.min(52, grid.columnCount);
    const endColumn =
      column <= 26
        ? String.fromCharCode(64 + column)
        : `A${String.fromCharCode(64 + column - 26)}`;
    const data = await this.request(
      `${spreadsheetId}/values/${encodeURIComponent(`${quoteTab(tab)}!A1:${endColumn}${Math.min(5001, grid.rowCount)}`)}`,
    );
    return (data.values ?? []) as string[][];
  }
  async initialize(): Promise<State> {
    const tabs = await this.tabs(this.controlId);
    const missing = Object.values(collections).filter((t) => !tabs.includes(t));
    if (missing.length) {
      await this.request(`${this.controlId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: missing.map((title) => ({
            addSheet: {
              properties: {
                title,
                gridProperties: { rowCount: 1000, columnCount: 2 },
              },
            },
          })),
        }),
      });
      await this.tabs(this.controlId);
    }
    const state = emptyState();
    // Sequential reads avoid an unnecessary burst against per-user quotas.
    for (const [key, tab] of Object.entries(collections)) {
      const data = await this.request(
        `${this.controlId}/values/${encodeURIComponent(`${quoteTab(tab)}!A:B`)}`,
      );
      const rows = (data.values ?? []) as string[][];
      this.rowCounts.set(tab, Math.max(1, rows.length));
      if (rows.length && (rows[0][0] !== "id" || rows[0][1] !== "data"))
        throw new Error(
          `Control tab ${tab} has an unexpected schema. Use a dedicated control spreadsheet.`,
        );
      (state as any)[key] = rows
        .slice(1)
        .filter((r) => r[0])
        .map((row) => {
          try {
            const value = JSON.parse(row[1]);
            if (value.id !== row[0]) throw new Error();
            return value;
          } catch {
            throw new Error(
              `Invalid stored record in ${tab}. Fix the row before starting the runner.`,
            );
          }
        });
    }
    return state;
  }
  async save(state: State) {
    const data = Object.entries(collections).map(([key, tab]) => {
      const items = state[key as keyof State];
      const values: string[][] = [
        ["id", "data"],
        ...items.map((item) => [item.id, JSON.stringify(item)]),
      ];
      // Blank trailing rows so deletions cannot return after a restart.
      const target = Math.max(values.length, this.rowCounts.get(tab) ?? 1);
      while (values.length < target) values.push(["", ""]);
      return { range: `${quoteTab(tab)}!A1:B${target}`, values };
    });
    const growth = Object.entries(collections).flatMap(([key, tab]) => {
      const grid = this.grids.get(`${this.controlId}:${tab}`);
      if (!grid)
        throw new Error(
          "Control spreadsheet metadata is unavailable. Reconnect before saving.",
        );
      const needed = state[key as keyof State].length + 1;
      return needed > grid.rowCount
        ? [
            {
              appendDimension: {
                sheetId: grid.sheetId,
                dimension: "ROWS",
                length: needed - grid.rowCount,
              },
            },
          ]
        : [];
    });
    if (growth.length) {
      await this.request(`${this.controlId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests: growth }),
      });
      await this.tabs(this.controlId);
    }
    await this.request(`${this.controlId}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    for (const [key, tab] of Object.entries(collections))
      this.rowCounts.set(
        tab,
        Math.max(
          this.rowCounts.get(tab) ?? 1,
          state[key as keyof State].length + 1,
        ),
      );
  }
}
