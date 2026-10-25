import { z } from "zod";
import type { State } from "../shared/types.ts";
import { normalizeCampaign } from "../shared/campaign.ts";

export const recordVersion = 1;
const key = z.string().min(1);
const text = z.string();
const at = z.iso.datetime();
const timezone = text.refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Invalid timezone");
const account = z.object({ id: key, name: key, role: text, initials: text,
  dailyBudget: z.number().int().min(1).max(100), status: z.enum(["demo", "not_connected"]) }).passthrough();
const source = z.object({ id: key, name: key, spreadsheetId: text, tab: key,
  mapping: z.record(text, text), importedAt: at, count: z.number().int().nonnegative() }).passthrough();
const lead = z.object({ id: key, sourceId: key, accountId: key, name: key, title: text,
  company: text, profileUrl: z.url().refine((value) => /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?$/i.test(value)),
  relationship: z.enum(["not_connected", "pending", "connected", "unknown"]),
  optedOut: z.boolean(), notes: text }).passthrough();
const campaign = z.object({ id: key, name: key, description: text,
  mode: z.enum(["requests", "pitching", "balanced"]), sourceId: key, accountId: key,
  status: z.enum(["draft", "running", "paused"]), dailyLimit: z.number().int().min(1).max(100),
  icp: text, company: text, selling: text, pitchStyle: z.enum(["conversational", "direct", "indirect"]),
  contextPrompt: text, pitchStrategy: text, pitchSamples: text,
  scheduleMode: z.enum(["scheduled", "continuous"]), startsAt: z.union([z.literal(""), at]),
  startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24),
  timezone, createdAt: at }).passthrough().refine((c) => c.scheduleMode === "continuous"
    ? !!c.startsAt : c.endHour > c.startHour, "Invalid campaign schedule");
const job = z.object({ id: key, campaignId: key, leadId: key, accountId: key,
  kind: z.enum(["request", "draft", "pitch"]),
  status: z.enum(["queued", "running", "simulated", "completed", "failed", "cancelled", "uncertain"]),
  createdAt: at, updatedAt: at, intentAt: at.optional(), detail: text }).passthrough();
const original = z.object({ text, fit: z.enum(["fit", "not_fit", "needs_review"]),
  evidence: z.array(text), generator: text }).passthrough();
const draft = original.extend({ id: key, campaignId: key, leadId: key,
  status: z.enum(["pending", "approved", "rejected"]), createdAt: at }).passthrough();
const activity = z.object({ id: key, campaignId: key.optional(), leadId: key.optional(),
  kind: text, title: text, detail: text, at, simulated: z.boolean(),
  eventType: z.enum(["pitch_review_required", "review_decision", "essential_error"]).optional() }).passthrough();
const settings = z.object({ id: z.literal("workspace"), trainingCollection: z.boolean() }).passthrough();
const example = z.object({ id: key, jobId: key, draftId: key.optional(), capturedAt: at,
  simulated: z.boolean(), status: z.enum(["generating", "completed", "failed", "interrupted", "discarded"]),
  input: z.object({ campaign, lead, generation: z.object({ model: key, promptVersion: key,
    temperature: z.number(), numCtx: z.number().int().positive() }) }), original: original.optional() }).passthrough();
const feedback = z.object({ id: key, exampleId: key, draftId: key, at, text,
  decision: z.enum(["pending", "approved", "rejected"]), reason: text }).passthrough();
const stateSchema = z.object({ accounts: z.array(account), sources: z.array(source),
  leads: z.array(lead), campaigns: z.array(campaign), jobs: z.array(job), drafts: z.array(draft),
  activity: z.array(activity), settings: z.array(settings).length(1),
  trainingExamples: z.array(example), trainingFeedback: z.array(feedback) });

export function validateState(input: unknown): State {
  const result = stateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid saved workspace at ${issue.path.join(".")}: ${issue.message}. Correct the control spreadsheet, then reconnect.`);
  }
  const s = result.data;
  const fail = (message: string): never => { throw new Error(`Invalid saved workspace: ${message}. Correct the control spreadsheet, then reconnect.`); };
  for (const [name, rows] of Object.entries(s)) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length) fail(`duplicate IDs in ${name}`);
  }
  for (const l of s.leads) {
    if (!s.accounts.some((a) => a.id === l.accountId) || !s.sources.some((v) => v.id === l.sourceId)) fail(`lead ${l.id} has a missing account/source`);
  }
  const leadIdentities = s.leads.map((l) => `${l.accountId}:${new URL(l.profileUrl).pathname.toLowerCase().replace(/\/$/, "")}`);
  if (new Set(leadIdentities).size !== leadIdentities.length) fail("duplicate profiles for the same account");
  for (const c of s.campaigns) {
    if (!s.accounts.some((a) => a.id === c.accountId) || !s.sources.some((v) => v.id === c.sourceId)) fail(`campaign ${c.id} has a missing account/source`);
  }
  for (const row of [...s.jobs, ...s.drafts]) {
    const c = s.campaigns.find((c) => c.id === row.campaignId);
    const l = s.leads.find((l) => l.id === row.leadId);
    if (!c || !l || c.accountId !== l.accountId || c.sourceId !== l.sourceId || ("accountId" in row && row.accountId !== c.accountId)) fail(`job/draft ${row.id} has inconsistent references`);
  }
  const active = s.jobs.filter((j) => !["failed", "cancelled"].includes(j.status));
  const identities = active.map((j) => `${j.accountId}:${j.leadId}:${j.kind}`);
  if (new Set(identities).size !== identities.length) fail("duplicate active jobs for the same account, lead and action");
  for (const e of s.trainingExamples) {
    if (!s.jobs.some((j) => j.id === e.jobId) || (e.draftId && !s.drafts.some((d) => d.id === e.draftId))) fail(`training example ${e.id} has missing references`);
  }
  for (const f of s.trainingFeedback) {
    if (!s.trainingExamples.some((e) => e.id === f.exampleId && e.draftId === f.draftId)) fail(`training feedback ${f.id} has missing references`);
  }
  return s as State;
}

export function decodeRecord(cell: string, rowId: string, tab: string, rowNumber: number): unknown {
  try {
    const stored = JSON.parse(cell);
    if (!stored || typeof stored !== "object") throw new Error();
    const value = "schemaVersion" in stored
      ? stored.schemaVersion === recordVersion ? stored.record : (() => { throw new Error(); })()
      : stored; // The original unversioned format is version 0.
    if (!value || value.id !== rowId) throw new Error();
    return value;
  } catch {
    throw new Error(`Invalid or unsupported stored record in ${tab}, row ${rowNumber}. Restore/correct this row before reconnecting; nothing has been overwritten.`);
  }
}
export function migrateState(state: State): State {
  // Do not infer historic generation inputs or approval history.
  if (!Array.isArray(state.campaigns) || !Array.isArray(state.jobs)) return validateState(state);
  state.campaigns = state.campaigns.map((c) => c && typeof c === "object" ? normalizeCampaign(c) : c);
  for (const j of state.jobs)
    if (j && !j.intentAt && ["running", "uncertain", "completed", "simulated"].includes(j.status)) j.intentAt = j.updatedAt;
  return validateState(state);
}
export function encodeRecord<T extends { id: string }>(record: T) {
  const encoded = JSON.stringify({ schemaVersion: recordVersion, record });
  if (encoded.length > 49000) throw new Error("A workspace record exceeds the safe Sheets cell size. Shorten its input text before saving.");
  return encoded;
}
