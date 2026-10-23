import "dotenv/config";
import express from "express";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { aiHealth } from "./ai.ts";
import {
  canDispatch,
  emptyState,
  id,
  leadId,
  log,
  now,
  profileUrl,
  queueCampaign,
} from "./domain.ts";
import { Sheets } from "./sheets.ts";
import { Store } from "./store.ts";
import { demoState } from "./seed.ts";
import { Runner } from "./runner.ts";
import type { Health, Relationship } from "../shared/types.ts";
const mode = process.env.STORAGE_MODE || "demo";
if (!["demo", "sheets"].includes(mode))
  throw new Error("STORAGE_MODE must be demo or sheets.");
const sheets =
  mode === "sheets"
    ? new Sheets(
        process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
        process.env.CONTROL_SPREADSHEET_ID || "",
      )
    : undefined;
if (
  sheets &&
  (!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !process.env.CONTROL_SPREADSHEET_ID)
)
  throw new Error(
    "Sheets mode requires GOOGLE_APPLICATION_CREDENTIALS and CONTROL_SPREADSHEET_ID.",
  );
const store = new Store(sheets ? emptyState() : demoState(), sheets);
if (sheets) {
  try {
    await store.recover();
  } catch (e) {
    store.syncError =
      e instanceof Error ? e.message : "Unable to connect to Sheets.";
    console.error("Sheets unavailable:", store.syncError);
  }
}
const app = express();
app.disable("x-powered-by");
const port = Number(process.env.PORT || 4310);
const allowedHosts = new Set([
  `127.0.0.1:${port}`,
  `localhost:${port}`,
  `[::1]:${port}`,
]);
app.use((req, res, next) => {
  if (!allowedHosts.has(req.headers.host || "")) {
    res.status(403).json({ error: "Local host only." });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!allowedHosts.has(new URL(origin).host)) throw new Error();
    } catch {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json({ limit: "256kb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const runner = new Runner(store);
const startedAt = now();
const workspaceId = createHash("sha256")
  .update(resolve(".").replaceAll("\\", "/").toLowerCase())
  .digest("hex");
let ai = await aiHealth();
let aiBusy = false;
const refreshAI = async () => {
  if (aiBusy) return;
  aiBusy = true;
  try {
    ai = await aiHealth();
  } finally {
    aiBusy = false;
  }
};
const aiTimer = setInterval(() => void refreshAI(), 30000);
const runnerTimer = setInterval(() => void runner.tick(), 2200);
const health = (): Health => ({
  mode: mode as "demo" | "sheets",
  sheets: {
    connected: !!sheets && !store.syncError,
    detail:
      store.syncError ||
      (sheets
        ? "Control spreadsheet connected"
        : "Demo uses memory. Connect Sheets for persistence."),
  },
  ollama: ai,
  linkedin: {
    connected: false,
    detail:
      "Browser integration is not implemented. Live sending is unavailable.",
  },
  timezone: "Asia/Karachi",
  startedAt,
});
const ready = () => {
  if (store.syncError)
    throw new Error(
      `Dispatch paused: ${store.syncError} Reconnect from Settings.`,
    );
};
const existing = <T extends { id: string }>(rows: T[], key: string) => {
  const item = rows.find((x) => x.id === key);
  if (!item)
    throw new Error("This item no longer exists. Refresh the workspace.");
  return item;
};
app.get("/api/health", (_req, res) =>
  res.json({ app: "BREKTRA", version: "0.1.0", workspaceId, pid: process.pid }),
);
app.get("/api/workspace", (_req, res) =>
  res.json({ state: store.state, health: health() }),
);
app.get("/api/jobs", (_req, res) =>
  res.json(
    store.state.jobs.map((j) => ({
      ...j,
      waiting:
        j.status === "queued"
          ? canDispatch(
              store.state,
              existing(store.state.campaigns, j.campaignId),
              j,
            ) || "Ready for next runner cycle"
          : j.detail,
    })),
  ),
);
app.post("/api/integrations/check", async (_req, res) => {
  await refreshAI();
  res.json(health());
});
app.post("/api/integrations/reconnect", async (_req, res) => {
  await store.recover();
  await refreshAI();
  res.json(health());
});
const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    description: z.string().max(400).default(""),
    mode: z.enum(["requests", "pitching", "balanced"]),
    sourceId: z.string().min(1),
    accountId: z.string().min(1),
    dailyLimit: z.number().int().min(1).max(100),
    icp: z.string().trim().min(5).max(2000),
    offer: z.string().trim().min(5).max(2000),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    timezone: z.string().refine((t) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: t });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA timezone."),
  })
  .refine((c) => c.endHour > c.startHour, "End hour must be after start hour.");
app.post("/api/campaigns", async (req, res) => {
  ready();
  const input = campaignSchema.parse(req.body);
  const campaign = await store.change((state) => {
    existing(state.sources, input.sourceId);
    existing(state.accounts, input.accountId);
    if (
      !state.leads.some(
        (l) => l.sourceId === input.sourceId && l.accountId === input.accountId,
      )
    )
      throw new Error(
        "Import leads for this account before creating the campaign.",
      );
    const campaign = {
      ...input,
      id: id(),
      status: "draft" as const,
      createdAt: now(),
    };
    state.campaigns.push(campaign);
    log(
      state,
      "Campaign created",
      campaign.name,
      "campaign",
      false,
      campaign.id,
    );
    return campaign;
  });
  res.status(201).json(campaign);
});
app.put("/api/campaigns/:id", async (req, res) => {
  ready();
  const input = campaignSchema.parse(req.body);
  await store.change((state) => {
    const campaign = existing(state.campaigns, req.params.id);
    if (campaign.status === "running")
      throw new Error("Pause the campaign before editing it.");
    if (
      campaign.accountId !== input.accountId ||
      campaign.sourceId !== input.sourceId
    )
      throw new Error("Create a new campaign to change its source or account.");
    Object.assign(campaign, input);
    log(
      state,
      "Campaign updated",
      campaign.name,
      "campaign",
      false,
      campaign.id,
    );
  });
  res.json({ ok: true });
});
app.post("/api/campaigns/:id/status", async (req, res) => {
  ready();
  const { status } = z
    .object({ status: z.enum(["running", "paused"]) })
    .parse(req.body);
  await store.change((state) => {
    const campaign = existing(state.campaigns, req.params.id);
    const count = status === "running" ? queueCampaign(state, campaign) : 0;
    campaign.status = status;
    log(
      state,
      status === "running"
        ? !sheets
          ? "Demo campaign started"
          : "Draft preparation started"
        : "Campaign paused",
      `${campaign.name}${status === "running" ? ` · ${count} new jobs queued` : ""}`,
      "campaign",
      !sheets && status === "running",
      campaign.id,
    );
  });
  res.json({ ok: true });
});
app.patch("/api/leads/:id", async (req, res) => {
  ready();
  const input = z
    .object({
      relationship: z
        .enum(["not_connected", "pending", "connected", "unknown"])
        .optional(),
      optedOut: z.boolean().optional(),
    })
    .parse(req.body);
  await store.change((state) => {
    const lead = existing(state.leads, req.params.id);
    Object.assign(lead, input);
    if (lead.optedOut)
      for (const job of state.jobs)
        if (job.leadId === lead.id && job.status === "queued") {
          job.status = "cancelled";
          job.detail = "Lead opted out";
          job.updatedAt = now();
        }
    log(
      state,
      lead.optedOut ? "Lead opted out" : "Lead relationship updated",
      `${lead.name} · ${lead.relationship.replaceAll("_", " ")}`,
      "lead",
      false,
      undefined,
      lead.id,
    );
  });
  res.json({ ok: true });
});
app.post("/api/leads/:id/draft", async (req, res) => {
  ready();
  const { campaignId } = z.object({ campaignId: z.string() }).parse(req.body);
  await store.change((state) => {
    const lead = existing(state.leads, req.params.id);
    const campaign = existing(state.campaigns, campaignId);
    if (campaign.mode === "requests")
      throw new Error(
        "This campaign is configured for connection requests only.",
      );
    if (
      lead.sourceId !== campaign.sourceId ||
      lead.accountId !== campaign.accountId ||
      lead.relationship !== "connected" ||
      lead.optedOut
    )
      throw new Error(
        "Drafts require an eligible confirmed connection in this campaign.",
      );
    if (
      state.drafts.some(
        (d) => d.leadId === lead.id && d.status !== "rejected",
      ) ||
      state.jobs.some(
        (j) =>
          j.leadId === lead.id &&
          j.kind === "draft" &&
          ["queued", "running"].includes(j.status),
      )
    )
      throw new Error("This lead already has a draft or a generation job.");
    state.jobs.push({
      id: id(),
      campaignId,
      leadId: lead.id,
      accountId: lead.accountId,
      kind: "draft",
      status: "queued",
      createdAt: now(),
      updatedAt: now(),
      detail: "Generate from supplied lead facts",
    });
    log(
      state,
      "Draft generation queued",
      `${lead.name} · Start the campaign to process the queue.`,
      "draft",
      !sheets,
      campaignId,
      lead.id,
    );
  });
  res.json({ ok: true });
});
app.put("/api/drafts/:id", async (req, res) => {
  ready();
  const input = z
    .object({
      text: z.string().trim().min(10).max(1500),
      status: z.enum(["pending", "approved", "rejected"]),
    })
    .parse(req.body);
  await store.change((state) => {
    const draft = existing(state.drafts, req.params.id);
    if (draft.status !== "pending")
      throw new Error("This draft has already been reviewed.");
    const lead = existing(state.leads, draft.leadId);
    const campaign = existing(state.campaigns, draft.campaignId);
    if (
      input.status === "approved" &&
      (lead.optedOut ||
        lead.relationship !== "connected" ||
        draft.fit === "not_fit")
    )
      throw new Error("This lead is not eligible for approval.");
    Object.assign(draft, input);
    if (input.status === "approved" && !sheets) {
      if (
        state.jobs.some(
          (j) =>
            j.leadId === lead.id &&
            j.accountId === lead.accountId &&
            j.kind === "pitch" &&
            !["failed", "cancelled"].includes(j.status),
        )
      )
        throw new Error("A pitch is already queued for this account and lead.");
      state.jobs.push({
        id: id(),
        campaignId: campaign.id,
        leadId: lead.id,
        accountId: lead.accountId,
        kind: "pitch",
        status: "queued",
        createdAt: now(),
        updatedAt: now(),
        detail: "Approved for simulation only",
      });
    }
    log(
      state,
      input.status === "pending" ? "Draft saved" : `Draft ${input.status}`,
      `${lead.name} · ${!sheets && input.status === "approved" ? "Demo delivery queued" : "No message sent"}`,
      "review",
      !sheets,
      campaign.id,
      lead.id,
    );
  });
  res.json({ ok: true });
});
app.post("/api/accounts", async (req, res) => {
  ready();
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      dailyBudget: z.number().int().min(1).max(100),
    })
    .parse(req.body);
  const account = await store.change((state) => {
    const account = {
      ...input,
      id: id(),
      role: "Local account · session not connected",
      initials: input.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      status: "not_connected" as const,
    };
    state.accounts.push(account);
    log(
      state,
      "Account registered",
      `${input.name} · Browser session setup is not yet available.`,
      "account",
    );
    return account;
  });
  res.status(201).json(account);
});
const spreadsheetId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{15,150}$/, "Enter the spreadsheet ID from its URL.");
app.post("/api/sheets/preview", async (req, res) => {
  if (!sheets)
    throw new Error(
      "Configure Sheets mode in .env to preview a real spreadsheet.",
    );
  const input = z
    .object({ spreadsheetId, tab: z.string().max(100).optional() })
    .parse(req.body);
  const tabs = await sheets.tabs(input.spreadsheetId);
  const tab = input.tab || tabs[0];
  if (!tabs.includes(tab))
    throw new Error("Select a tab from this spreadsheet.");
  const rows = await sheets.rows(input.spreadsheetId, tab);
  res.json({
    tabs,
    tab,
    headers: rows[0] ?? [],
    rows: rows.slice(1, 6),
    total: Math.max(0, rows.length - 1),
  });
});
app.post("/api/sheets/import", async (req, res) => {
  ready();
  if (!sheets) throw new Error("Configure Sheets mode first.");
  const input = z
    .object({
      spreadsheetId,
      tab: z.string().min(1).max(100),
      name: z.string().trim().min(2).max(100),
      accountId: z.string(),
      mapping: z.record(z.string(), z.string()),
    })
    .parse(req.body);
  const rows = await sheets.rows(input.spreadsheetId, input.tab);
  const headers = rows[0] ?? [];
  if (new Set(headers).size !== headers.length)
    throw new Error(
      "Source headers must be unique. Rename duplicate columns first.",
    );
  for (const field of ["name", "profileUrl"])
    if (!headers.includes(input.mapping[field]))
      throw new Error(`Map the ${field} column before importing.`);
  const value = (row: string[], field: string) =>
    String(row[headers.indexOf(input.mapping[field])] ?? "").trim();
  const result = await store.change((state) => {
    existing(state.accounts, input.accountId);
    let source = state.sources.find(
      (s) => s.spreadsheetId === input.spreadsheetId && s.tab === input.tab,
    );
    if (!source) {
      source = {
        id: id(),
        name: input.name,
        spreadsheetId: input.spreadsheetId,
        tab: input.tab,
        mapping: input.mapping,
        importedAt: now(),
        count: 0,
      };
      state.sources.push(source);
    }
    let imported = 0;
    let skipped = 0;
    let invalid = 0;
    for (const row of rows.slice(1)) {
      if (!row.some(Boolean)) continue;
      let url: string;
      try {
        url = profileUrl(value(row, "profileUrl"));
      } catch {
        invalid++;
        continue;
      }
      if (!value(row, "name")) {
        invalid++;
        continue;
      }
      const key = leadId(input.accountId, url);
      if (state.leads.some((l) => l.id === key)) {
        skipped++;
        continue;
      }
      const relationship = value(row, "relationship")
        .toLowerCase()
        .replaceAll(" ", "_");
      state.leads.push({
        id: key,
        sourceId: source.id,
        accountId: input.accountId,
        name: value(row, "name"),
        profileUrl: url,
        title: value(row, "title"),
        company: value(row, "company"),
        notes: value(row, "notes"),
        relationship: ([
          "not_connected",
          "pending",
          "connected",
          "unknown",
        ].includes(relationship)
          ? relationship
          : "unknown") as Relationship,
        optedOut: ["true", "yes", "1"].includes(
          value(row, "optedOut").toLowerCase(),
        ),
      });
      imported++;
    }
    source.count = state.leads.filter((l) => l.sourceId === source!.id).length;
    source.importedAt = now();
    source.mapping = input.mapping;
    log(
      state,
      "Leads imported from Sheets",
      `${imported} imported · ${skipped} duplicates · ${invalid} invalid rows`,
      "sheet",
    );
    return { imported, skipped, invalid };
  });
  res.json(result);
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({
          error: error.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join("; "),
        });
      return;
    }
    res
      .status(400)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "The operation could not be completed.",
      });
  },
);
if (process.argv.includes("--production")) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `\n  BREKTRA · http://127.0.0.1:${port}\n  Storage: ${mode} · LinkedIn sending disabled\n`,
  ),
);
function stop() {
  clearInterval(aiTimer);
  clearInterval(runnerTimer);
  server.close(() => process.exit(0));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
