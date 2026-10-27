import { APP_VERSION } from "../shared/version.ts";
import "dotenv/config";
import express from "express";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { acquireLock } from "./lock.ts";
import { z } from "zod";
import { aiHealth } from "./ai.ts";
import {
  canDispatch,
  emptyState,
  id,
  leadId,
  emailLeadId,
  log,
  now,
  profileUrl,
  queueCampaign,
} from "./domain.ts";
import { Sheets } from "./sheets.ts";
import { Store } from "./store.ts";
import { demoState } from "./seed.ts";
import { Runner } from "./runner.ts";
import { PrivateStore } from "./private-store.ts";
import { Gmail } from "./gmail.ts";
import { TeamAuth } from "./team.ts";
import { OutreachEngine, stopLead } from "./outreach.ts";
import { outreachApi, gmailCallback } from "./outreach-api.ts";
import { requestContext } from "./context.ts";
import { previewCompanyMigration, prepareCompanyMigration } from "./company.ts";
import { SetupConfiguration, setupApi } from "./setup.ts";
import type { Health, Relationship } from "../shared/types.ts";
const hosted = process.env.BREKTRA_HOSTED === "1";
const secrets = new PrivateStore(resolve(".runtime"));
const useSavedSetup = !hosted && process.env.BREKTRA_USE_ENV !== "1";
const setupConfiguration = useSavedSetup ? await SetupConfiguration.load(secrets, resolve(".runtime")) : new SetupConfiguration(secrets);
const savedSetup = setupConfiguration.snapshot();
let mode = savedSetup.sheets ? "sheets" : process.env.STORAGE_MODE || "demo";
if (savedSetup.model) process.env.OLLAMA_MODEL = savedSetup.model;
const port = Number(process.env.PORT || 4310);
const publicOrigin = hosted ? new URL(process.env.BREKTRA_PUBLIC_ORIGIN || "") : new URL(`http://127.0.0.1:${port}`);
if (hosted && (publicOrigin.protocol !== "https:" || publicOrigin.pathname !== "/" || publicOrigin.search || publicOrigin.hash || publicOrigin.username || publicOrigin.password))
  throw new Error("Hosted mode requires BREKTRA_PUBLIC_ORIGIN as a bare HTTPS origin.");
if (hosted && mode !== "sheets") throw new Error("Hosted workspaces require persistent Sheets mode.");
if (hosted && !process.env.BREKTRA_SECRET_KEY) throw new Error("Hosted mode requires a persistent BREKTRA_SECRET_KEY.");
if (hosted && Buffer.from(process.env.BREKTRA_SECRET_KEY || "", "base64").length !== 32) throw new Error("Hosted BREKTRA_SECRET_KEY must encode exactly 32 random bytes as base64.");
if (!["demo", "sheets"].includes(mode))
  throw new Error("STORAGE_MODE must be demo or sheets.");
const sheets =
  mode === "sheets"
    ? new Sheets(
        savedSetup.sheets?.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
        savedSetup.sheets?.spreadsheetId || process.env.CONTROL_SPREADSHEET_ID || "",
      )
    : undefined;
if (
  sheets && !savedSetup.sheets &&
  (!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !process.env.CONTROL_SPREADSHEET_ID)
)
  throw new Error(
    "Sheets mode requires GOOGLE_APPLICATION_CREDENTIALS and CONTROL_SPREADSHEET_ID.",
  );
const releaseWorkspaceLock = await acquireLock(`workspace:${realpathSync.native(resolve(".")).toLowerCase()}`);
let releaseControlLock = sheets ? await acquireLock(`sheets:${sheets.controlId}`) : undefined;
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
const auth = new TeamAuth(store, secrets, hosted, hosted || process.env.BREKTRA_AUTH === "1");
await auth.bootstrap(process.env.BREKTRA_OWNER_EMAIL || "", process.env.BREKTRA_OWNER_PASSWORD || "", process.env.BREKTRA_OWNER_NAME || "Workspace owner", process.env.BREKTRA_RESET_OWNER_PASSWORD === "1");
const gmail = new Gmail(secrets, publicOrigin.origin);
const outreach = new OutreachEngine(store, gmail);
const allowedHosts = new Set([
  `127.0.0.1:${port}`,
  `localhost:${port}`,
  `[::1]:${port}`,
  ...(hosted ? [publicOrigin.host] : []),
]);
app.use((req, res, next) => {
  if (!allowedHosts.has(req.headers.host || "")) {
    res.status(403).json({ error: "Local host only." });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (hosted ? new URL(origin).origin !== publicOrigin.origin : !allowedHosts.has(new URL(origin).host)) throw new Error();
    } catch {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
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
const outreachTimer = setInterval(() => void outreach.tick(), 2700);
let pollingMail = false;
const inboxTimer = setInterval(() => {
  if (pollingMail || store.syncError || store.changingWorkspace) return;
  pollingMail = true;
  void (async () => {
    for (const mailbox of store.state.mailboxes.filter((m) => m.provider === "gmail" && m.status === "connected" && !m.syncError))
      await outreach.sync(mailbox.id).catch(() => {});
  })().finally(() => { pollingMail = false; });
}, 60000);
const health = (): Health => ({
  mode: mode as "demo" | "sheets",
  sheets: {
    connected: !!store.sheets && !store.syncError,
    detail:
      store.syncError ||
      (store.sheets
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
  hosted,
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
  res.json({ app: "BREKTRA", version: APP_VERSION, workspaceId, pid: process.pid }),
);
app.get("/api/auth/status", (req, res) => res.json(auth.status(req)));
app.post("/api/auth/login", async (req, res) => {
  const input = z.object({ email: z.email(), password: z.string().min(1).max(200) }).parse(req.body);
  const token = await auth.login(input.email, input.password, req.socket.remoteAddress || "local");
  auth.setCookie(res, token);
  res.json({ ok: true });
});
app.post("/api/auth/logout", (req, res) => { auth.logout(req, res); res.json({ ok: true }); });
app.post("/api/auth/accept", async (req, res) => {
  const input = z.object({ token: z.string().min(20).max(200), password: z.string().min(12).max(200) }).parse(req.body);
  ready(); await auth.accept(input.token, input.password); res.json({ ok: true });
});
app.get("/api/gmail/callback", async (req, res) => { ready(); await gmailCallback(store, gmail, req, res); });
app.use("/api", (req, _res, next) => {
  try {
    auth.require(req);
    // New feature routes apply their own finer-grained permissions below. These
    // guards protect all pre-existing mutations from direct API access as well.
    if (!["GET", "HEAD"].includes(req.method)) {
      if (/^\/(accounts|integrations|settings)(\/|$)/.test(req.path)) auth.require(req, "manage");
      else if (/^\/sheets(\/|$)/.test(req.path)) auth.require(req, "operate");
      else if (/^\/drafts(\/|$)/.test(req.path)) auth.require(req, "review");
      else if (/^\/(campaigns|leads)(\/|$)/.test(req.path) && !/^\/leads\/[^/]+\/approval$/.test(req.path)) auth.require(req, "operate");
    }
    requestContext.run({ actorId: auth.require(req).id, workspaceEpoch: store.workspaceEpoch }, next);
  } catch (error) { next(error); }
});
app.use("/api", outreachApi(store, gmail, secrets, outreach, auth));
app.use("/api", setupApi({ configuration: setupConfiguration, store, auth, local: useSavedSetup && !auth.required, refreshAI,
  connect: async (adapter, source, target, connection) => {
    if (store.sheets || !connection) throw new Error("A Sheets workspace is already configured.");
    const release = await acquireLock(`sheets:${adapter.controlId}`);
    try { await store.connectSheets(adapter, source, target, () => setupConfiguration.update({ sheets: connection })); }
    catch (e) { await release(); throw e; }
    releaseControlLock = release;
    mode = "sheets";
  },
}));
app.get("/api/workspace", (_req, res) =>
  res.json({ state: store.state, health: health(), auth: auth.status(_req) }),
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
app.patch("/api/settings/training", async (req, res) => {
  ready();
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  await store.change((state) => {
    state.settings[0].trainingCollection = enabled;
  });
  res.json({ ok: true });
});
app.get("/api/settings/company-migration", (req, res) => {
  auth.require(req, "manage"); ready();
  res.json(previewCompanyMigration(store.state));
});
app.post("/api/settings/company-migration", async (req, res) => {
  const actor = auth.require(req, "manage"); ready();
  const input = z.object({ name: z.string().trim().min(1).max(100),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/), backupConfirmed: z.literal(true) }).strict().parse(req.body);
  await store.change((state) => {
    const migrated = prepareCompanyMigration(state, { ...input, actorId: actor.id });
    log(migrated, "Company foundation prepared", "Existing records assigned to one company. Campaigns and mailbox sending are paused. Multi-company access remains unavailable.", "company", mode === "demo");
    migrated.activity[0].companyId = migrated.companies[0].id;
    Object.assign(state, migrated);
  });
  res.json({ ok: true });
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
    company: z.string().trim().min(1).max(2000),
    selling: z.string().trim().min(5).max(2000),
    pitchStyle: z.enum(["conversational", "direct", "indirect"]),
    contextPrompt: z.string().trim().min(5).max(8000),
    pitchStrategy: z.string().trim().min(5).max(4000),
    pitchSamples: z.string().trim().min(5).max(8000),
    scheduleMode: z.enum(["scheduled", "continuous"]).default("scheduled"),
    startsAt: z.union([z.literal(""), z.iso.datetime()]).default(""),
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
  .refine((c) => c.scheduleMode !== "scheduled" || c.endHour > c.startHour, "End hour must be after start hour.")
  .refine((c) => c.scheduleMode !== "continuous" || !!c.startsAt, "Choose a start date and time for continuous running.");
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
        ? !store.sheets
          ? "Demo campaign started"
          : "Draft preparation started"
        : "Campaign paused",
      `${campaign.name}${status === "running" ? ` · ${count} new jobs queued` : ""}`,
      "campaign",
      !store.sheets && status === "running",
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
      email: z.union([z.literal(""), z.email()]).optional(),
      website: z.union([z.literal(""), z.url()]).optional(),
    })
    .parse(req.body);
  await store.change((state) => {
    const lead = existing(state.leads, req.params.id);
    Object.assign(lead, input);
    if (lead.email) lead.email = lead.email.trim().toLowerCase();
    if (lead.optedOut) stopLead(state, lead.id, "Lead opted out");
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
      !store.sheets,
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
      reason: z.string().trim().max(1000).default(""),
      expectedRevision: z.number().int().positive().optional(),
    })
    .parse(req.body);
  await store.change((state) => {
    const draft = existing(state.drafts, req.params.id);
    if ((auth.required && input.expectedRevision === undefined) || (input.expectedRevision !== undefined && input.expectedRevision !== (draft.revision || 1)))
      throw new Error("This draft changed or has no version check. Refresh and review its latest revision.");
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
    const example = state.trainingExamples.find((e) => e.draftId === draft.id);
    const lastFeedback = [...state.trainingFeedback].reverse().find((f) => f.draftId === draft.id);
    if (state.settings[0].trainingCollection && example &&
        (draft.text !== input.text || draft.status !== input.status ||
          (input.reason && (lastFeedback?.reason !== input.reason || lastFeedback.text !== input.text || lastFeedback.decision !== input.status))))
      state.trainingFeedback.push({ id: id(), exampleId: example.id, draftId: draft.id,
        at: now(), text: input.text, decision: input.status, reason: input.reason });
    if (draft.text !== input.text) draft.revision = (draft.revision || 1) + 1;
    draft.text = input.text;
    draft.status = input.status;
    if (input.status === "approved" && !store.sheets) {
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
      `${lead.name} · ${!store.sheets && input.status === "approved" ? "Demo delivery queued" : "No message sent"}`,
      "review",
      !store.sheets,
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
  if (!store.sheets)
    throw new Error(
      "Use Settings → Real workspace setup to connect Google Sheets first.",
    );
  const input = z
    .object({ spreadsheetId, tab: z.string().max(100).optional() })
    .parse(req.body);
  const tabs = await store.sheets.tabs(input.spreadsheetId);
  const tab = input.tab || tabs[0];
  if (!tabs.includes(tab))
    throw new Error("Select a tab from this spreadsheet.");
  const rows = await store.sheets.rows(input.spreadsheetId, tab);
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
  if (!store.sheets) throw new Error("Configure Sheets mode first.");
  const input = z
    .object({
      spreadsheetId,
      tab: z.string().min(1).max(100),
      name: z.string().trim().min(2).max(100),
      accountId: z.string(),
      mapping: z.record(z.string(), z.string()),
    })
    .parse(req.body);
  const rows = await store.sheets.rows(input.spreadsheetId, input.tab);
  const headers = rows[0] ?? [];
  if (new Set(headers).size !== headers.length)
    throw new Error(
      "Source headers must be unique. Rename duplicate columns first.",
    );
  for (const field of ["name"])
    if (!headers.includes(input.mapping[field]))
      throw new Error(`Map the ${field} column before importing.`);
  if (!headers.includes(input.mapping.profileUrl) && !headers.includes(input.mapping.email)) throw new Error("Map a LinkedIn URL or email column before importing.");
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
      let url = "";
      const suppliedEmail = z.email().safeParse(value(row, "email"));
      if (value(row, "profileUrl")) {
        try { url = profileUrl(value(row, "profileUrl")); }
        catch { invalid++; continue; }
      }
      if (!url && !suppliedEmail.success) { invalid++; continue; }
      if (!value(row, "name")) {
        invalid++;
        continue;
      }
      const email = suppliedEmail.success ? suppliedEmail.data.toLowerCase() : "";
      const key = url ? leadId(input.accountId, url) : emailLeadId(input.accountId, email);
      if (state.leads.some((l) => l.id === key || (email && l.accountId === input.accountId && l.email?.toLowerCase() === email))) {
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
        email,
        website: z.url().safeParse(value(row, "website")).success ? value(row, "website") : "",
        outreachApproval: "pending",
        relationship: (url && [
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
      .status(typeof error === "object" && error && "status" in error && [401, 403, 429].includes(Number(error.status)) ? Number(error.status) : 400)
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
const server = app.listen(port, hosted ? (process.env.BREKTRA_BIND_HOST || "127.0.0.1") : "127.0.0.1", () =>
  console.log(
    `\n  BREKTRA ${APP_VERSION} · http://127.0.0.1:${port}\n  Storage: ${mode} · LinkedIn sending disabled\n`,
  ),
);
function stop() {
  clearInterval(aiTimer);
  clearInterval(runnerTimer);
  clearInterval(outreachTimer);
  clearInterval(inboxTimer);
  server.close(() => {
    void Promise.all([releaseWorkspaceLock(), releaseControlLock?.()]).finally(() => process.exit(0));
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
