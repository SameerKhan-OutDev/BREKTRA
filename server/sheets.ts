import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import type { State } from "../shared/types.ts";
import { emptyState } from "./domain.ts";
import { decodeRecord, encodeRecord, migrateState, validateState } from "./schema.ts";
export const collections = {
  accounts: "Accounts",
  sources: "Sources",
  leads: "Relationships",
  campaigns: "Campaigns",
  jobs: "Jobs",
  drafts: "Drafts",
  activity: "Activity",
  settings: "WorkspaceSettings",
  trainingExamples: "TrainingExamples",
  trainingFeedback: "TrainingFeedback",
} as const;
export const quoteTab = (tab: string) => `'${tab.replaceAll("'", "''")}'`;
const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
export class Sheets {
  private token = "";
  private expiresAt = 0;
  private savedRows = new Map<string, string[][]>();
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
    const snapshot = await this.readControl();
    for (const [key, tab] of Object.entries(collections)) {
      const rows = snapshot.get(tab)!;
      if (rows.length && (rows[0][0] !== "id" || rows[0][1] !== "data"))
        throw new Error(`Control tab ${tab} has an unexpected schema. Use a dedicated control spreadsheet.`);
      const records = rows.slice(1).flatMap((row, index) => {
        if (!row[0] && !row[1]) return [];
        if (!row[0] || !row[1]) throw new Error(`Incomplete record in ${tab}, row ${index + 2}. Correct it before reconnecting.`);
        return [decodeRecord(row[1], row[0], tab, index + 2)];
      });
      if (key !== "settings" || records.length) (state as any)[key] = records;
    }
    const validated = migrateState(state);
    validated.activity.sort((a, b) => b.at.localeCompare(a.at));
    this.savedRows = snapshot;
    return validated;
  }
  private async readControl(): Promise<Map<string, string[][]>> {
    const ranges = Object.values(collections).map((tab) => `ranges=${encodeURIComponent(`${quoteTab(tab)}!A:B`)}`).join("&");
    const result = await this.request(`${this.controlId}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`);
    if (result.valueRanges?.length !== Object.keys(collections).length)
      throw new Error("Incomplete control spreadsheet response. Reconnect before saving.");
    return new Map(Object.values(collections).map((tab, index) => {
      const rows = (result.valueRanges[index].values ?? []).map((r: unknown[]) => [String(r[0] ?? ""), String(r[1] ?? "")]) as string[][];
      while (rows.length && rows.at(-1)!.every((cell) => !cell)) rows.pop();
      return [tab, rows];
    }));
  }
  async save(state: State) {
    validateState(state);
    if (this.savedRows.size !== Object.keys(collections).length)
      throw new Error("Load and validate the control spreadsheet before saving.");
    // Only one computer may control a spreadsheet. Detect edits between our saves;
    // this is a conflict check, not a cross-computer compare-and-swap lock.
    const remote = await this.readControl();
    for (const [tab, rows] of remote)
      if (JSON.stringify(rows) !== JSON.stringify(this.savedRows.get(tab)))
        throw new Error(`Control tab ${tab} changed outside this process. Dispatch paused. Reconnect to load its current records.`);
    const requests: object[] = [];
    const next = new Map<string, string[][]>();
    const grown: { grid: { rowCount: number }; needed: number }[] = [];
    for (const [key, tab] of Object.entries(collections)) {
      const previous = this.savedRows.get(tab)!;
      const values = structuredClone(previous);
      values[0] = ["id", "data"];
      const items = state[key as keyof State];
      const ids = new Set(items.map((item) => item.id));
      const positions = new Map(previous.slice(1).map((r, i) => [r[0], i + 1]));
      for (let i = 1; i < values.length; i++)
        if (!ids.has(values[i][0])) values[i] = ["", ""];
      for (const item of items) {
        let index = positions.get(item.id);
        if (index === undefined) {
          const free = values.findIndex((row, i) => i > 0 && !row[0]);
          index = free < 0 ? values.length : free;
        }
        values[index] = [item.id, encodeRecord(item)];
      }
      const grid = this.grids.get(`${this.controlId}:${tab}`);
      if (!grid || grid.columnCount < 2) throw new Error(`Control tab ${tab} metadata is unavailable. Reconnect before saving.`);
      if (values.length > grid.rowCount) {
        requests.push({ appendDimension: { sheetId: grid.sheetId, dimension: "ROWS", length: values.length - grid.rowCount } });
        grown.push({ grid, needed: values.length });
      }
      // Group adjacent changed rows. Deletions clear only our two value cells.
      for (let i = 0; i < values.length;) {
        if (JSON.stringify(values[i]) === JSON.stringify(previous[i])) { i++; continue; }
        const start = i++;
        while (i < values.length && JSON.stringify(values[i]) !== JSON.stringify(previous[i])) i++;
        requests.push({ updateCells: {
          start: { sheetId: grid.sheetId, rowIndex: start, columnIndex: 0 },
          rows: values.slice(start, i).map((row) => ({ values: row.map((cell) => ({ userEnteredValue: { stringValue: cell } })) })),
          fields: "userEnteredValue",
        } });
      }
      while (values.length && values.at(-1)!.every((cell) => !cell)) values.pop();
      next.set(tab, values);
    }
    if (!requests.length) return;
    // One atomic batch commits intent, audit events and examples together. Never
    // retry an ambiguous write; Store blocks dispatch until a fresh reconciliation.
    await this.request(`${this.controlId}:batchUpdate`, {
      method: "POST", body: JSON.stringify({ requests }),
    });
    for (const { grid, needed } of grown) grid.rowCount = needed;
    this.savedRows = next;
  }
}
