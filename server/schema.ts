import { z } from "zod";
import type { State } from "../shared/types.ts";
import { normalizeCampaign } from "../shared/campaign.ts";
import { outreachShape } from "./outreach-schema.ts";
import { companyShape, ownership, validateCompanyOwnership } from "./company-schema.ts";

export const recordVersion = 2;
const key = z.string().min(1);
const text = z.string();
const at = z.iso.datetime();
const timezone = text.refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Invalid timezone");
const account = z.object({ ...ownership, id: key, name: key, role: text, initials: text,
  dailyBudget: z.number().int().min(1).max(100), status: z.enum(["demo", "not_connected"]) }).passthrough();
const source = z.object({ ...ownership, id: key, name: key, spreadsheetId: text, tab: key,
  mapping: z.record(text, text), importedAt: at, count: z.number().int().nonnegative() }).passthrough();
const lead = z.object({ ...ownership, id: key, sourceId: key, accountId: key, name: key, title: text,
  company: text, profileUrl: z.union([z.literal(""), z.url().refine((value) => /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?$/i.test(value))]),
  relationship: z.enum(["not_connected", "pending", "connected", "unknown"]),
  optedOut: z.boolean(), notes: text, email: z.union([z.literal(""), z.email()]).optional(),
  website: z.union([z.literal(""), z.url()]).optional(), repliedAt: at.optional(),
  outreachApproval: z.enum(["pending", "approved", "rejected"]).optional(),
  outreachReviewedAt: at.optional(), outreachReviewedBy: key.optional() }).passthrough().refine((l) => !!l.profileUrl || !!l.email, "A lead needs a LinkedIn profile or supplied email");
const campaign = z.object({ ...ownership, id: key, name: key, description: text,
  mode: z.enum(["requests", "pitching", "balanced"]), sourceId: key, accountId: key,
  status: z.enum(["draft", "running", "paused"]), dailyLimit: z.number().int().min(1).max(100),
  icp: text, company: text, selling: text, pitchStyle: z.enum(["conversational", "direct", "indirect"]),
  contextPrompt: text, pitchStrategy: text, pitchSamples: text,
  scheduleMode: z.enum(["scheduled", "continuous"]), startsAt: z.union([z.literal(""), at]),
  startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24),
  timezone, createdAt: at }).passthrough().refine((c) => c.scheduleMode === "continuous"
    ? !!c.startsAt : c.endHour > c.startHour, "Invalid campaign schedule");
const job = z.object({ ...ownership, id: key, campaignId: key, leadId: key, accountId: key,
  kind: z.enum(["request", "draft", "pitch"]),
  status: z.enum(["queued", "running", "simulated", "completed", "failed", "cancelled", "uncertain"]),
  createdAt: at, updatedAt: at, intentAt: at.optional(), detail: text }).passthrough();
const original = z.object({ text, fit: z.enum(["fit", "not_fit", "needs_review"]),
  evidence: z.array(text), generator: text }).passthrough();
const draft = original.extend({ ...ownership, id: key, campaignId: key, leadId: key,
  status: z.enum(["pending", "approved", "rejected"]), createdAt: at, revision: z.number().int().positive().optional() }).passthrough();
const activity = z.object({ ...ownership, id: key, campaignId: key.optional(), leadId: key.optional(),
  kind: text, title: text, detail: text, at, simulated: z.boolean(),
  eventType: z.enum(["pitch_review_required", "review_decision", "essential_error"]).optional(), actorId: key.optional() }).passthrough();
const settings = z.object({ ...ownership, id: z.literal("workspace"), trainingCollection: z.boolean() }).passthrough();
const example = z.object({ ...ownership, id: key, jobId: key, draftId: key.optional(), capturedAt: at,
  simulated: z.boolean(), status: z.enum(["generating", "completed", "failed", "interrupted", "discarded"]),
  input: z.object({ campaign, lead, generation: z.object({ model: key, promptVersion: key,
    temperature: z.number(), numCtx: z.number().int().positive() }) }), original: original.optional() }).passthrough();
const feedback = z.object({ ...ownership, id: key, exampleId: key, draftId: key, at, text,
  decision: z.enum(["pending", "approved", "rejected"]), reason: text }).passthrough();
const stateSchema = z.object({ ...companyShape, accounts: z.array(account), sources: z.array(source),
  leads: z.array(lead), campaigns: z.array(campaign), jobs: z.array(job), drafts: z.array(draft),
  activity: z.array(activity), settings: z.array(settings).length(1),
  trainingExamples: z.array(example), trainingFeedback: z.array(feedback), ...outreachShape });

export function validateState(input: unknown): State {
  const result = stateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid saved workspace at ${issue.path.join(".")}: ${issue.message}. Correct the control spreadsheet, then reconnect.`);
  }
  const s = result.data;
  validateCompanyOwnership(s as State);
  const fail = (message: string): never => { throw new Error(`Invalid saved workspace: ${message}. Correct the control spreadsheet, then reconnect.`); };
  for (const [name, rows] of Object.entries(s)) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length) fail(`duplicate IDs in ${name}`);
  }
  for (const l of s.leads) {
    if (!s.accounts.some((a) => a.id === l.accountId) || !s.sources.some((v) => v.id === l.sourceId)) fail(`lead ${l.id} has a missing account/source`);
  }
  const leadIdentities = s.leads.map((l) => `${l.accountId}:${l.profileUrl ? new URL(l.profileUrl).pathname.toLowerCase().replace(/\/$/, "") : `email:${l.email?.toLowerCase()}`}`);
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
  const has = (rows: {id:string}[], id: string) => rows.some((r) => r.id === id);
  for (const q of s.sequences) {
    if (!has(s.campaigns, q.campaignId) || (q.steps.some((v) => v.kind === "email") && !has(s.mailboxes, q.mailboxId))) fail(`sequence ${q.id} has missing campaign/mailbox`);
    if (new Set(q.steps.map((v) => v.id)).size !== q.steps.length) fail(`sequence ${q.id} has duplicate step IDs`);
  }
  for (const e of s.enrollments) {
    const q = s.sequences.find((q) => q.id === e.sequenceId), l = s.leads.find((l) => l.id === e.leadId);
    const c = s.campaigns.find((c) => c.id === e.campaignId);
    if (!q || !l || !c || q.campaignId !== e.campaignId || c.accountId !== l.accountId || c.sourceId !== l.sourceId) fail(`enrollment ${e.id} has inconsistent references`);
  }
  for (const a of s.outreachActions) {
    if (!has(s.campaigns, a.campaignId) || !has(s.leads, a.leadId) || (a.kind === "email" && !has(s.mailboxes, a.mailboxId)) ||
        (a.enrollmentId && !has(s.enrollments, a.enrollmentId)) || (a.conversationId && !has(s.conversations, a.conversationId))) fail(`outreach action ${a.id} has missing references`);
    if (["approved", "running", "accepted"].includes(a.status) && (a.approvedRevision !== a.revision || !a.approvedBy)) fail(`outreach action ${a.id} lacks exact-version approval`);
    const lead = s.leads.find((l) => l.id === a.leadId), campaign = s.campaigns.find((c) => c.id === a.campaignId);
    const enrollment = s.enrollments.find((e) => e.id === a.enrollmentId);
    if (!lead || !campaign || lead.accountId !== campaign.accountId || lead.sourceId !== campaign.sourceId ||
        (a.enrollmentId && (!enrollment || enrollment.campaignId !== a.campaignId || enrollment.leadId !== a.leadId))) fail(`outreach action ${a.id} has inconsistent ownership`);
  }
  if (new Set(s.outreachActions.map((a) => a.messageId)).size !== s.outreachActions.length) fail("duplicate outbound Message-IDs");
  const stepActions = s.outreachActions.filter((a) => a.enrollmentId).map((a) => `${a.enrollmentId}:${a.stepId}`);
  if (new Set(stepActions).size !== stepActions.length) fail("duplicate actions for one enrollment step");
  const activeRecipients = s.enrollments.filter((e) => e.status === "active").map((e) => {
    const lead = s.leads.find((l) => l.id === e.leadId)!; return lead.email?.toLowerCase() || lead.id;
  });
  if (new Set(activeRecipients).size !== activeRecipients.length) fail("competing active enrollments for the same contact");
  for (const c of s.conversations)
    if (!has(s.leads, c.leadId) || !has(s.campaigns, c.campaignId) || !has(s.mailboxes, c.mailboxId) || (c.assigneeId && !has(s.members, c.assigneeId))) fail(`conversation ${c.id} has missing references`);
  for (const m of s.messages) if (!has(s.conversations, m.conversationId)) fail(`message ${m.id} has no conversation`);
  for (const r of s.outreachReviews) if (!has(s.outreachActions, r.actionId)) fail(`outreach review ${r.id} has no action`);
  for (const e of s.enrichments) if (!has(s.leads, e.leadId)) fail(`enrichment ${e.id} has no lead`);
  for (const i of s.invitations) if (!has(s.members, i.memberId)) fail(`invitation ${i.id} has no member`);
  if (new Set(s.members.map((m) => m.email.toLowerCase())).size !== s.members.length) fail("duplicate team emails");
  if (s.members.length && !s.members.some((m) => m.role === "owner" && m.status === "active")) fail("workspace needs an active owner");
  return s as State;
}

export function decodeRecord(cell: string, rowId: string, tab: string, rowNumber: number): unknown {
  try {
    const stored = JSON.parse(cell);
    if (!stored || typeof stored !== "object") throw new Error();
    const value = "schemaVersion" in stored
      ? [1, recordVersion].includes(stored.schemaVersion) ? stored.record : (() => { throw new Error(); })()
      : stored; // The original unversioned format is version 0.
    if (!value || value.id !== rowId) throw new Error();
    return value;
  } catch {
    throw new Error(`Invalid or unsupported stored record in ${tab}, row ${rowNumber}. Restore/correct this row before reconnecting; nothing has been overwritten.`);
  }
}
export function migrateState(state: State): State {
  for (const name of Object.keys(companyShape)) (state as any)[name] ??= [];
  for (const name of Object.keys(outreachShape)) (state as any)[name] ??= [];
  // Do not infer historic generation inputs or approval history.
  if (!Array.isArray(state.campaigns) || !Array.isArray(state.jobs)) return validateState(state);
  state.campaigns = state.campaigns.map((c) => c && typeof c === "object" ? normalizeCampaign(c) : c);
  for (const j of state.jobs)
    if (j && !j.intentAt && ["running", "uncertain", "completed", "simulated"].includes(j.status)) j.intentAt = j.updatedAt;
  return validateState(state);
}
export function encodeRecord<T extends { id: string }>(record: T) {
  // Old applications must refuse owned records rather than drop their scope.
  // Unmigrated workspaces retain their original envelope until reviewed cutover.
  const encoded = JSON.stringify({ schemaVersion: "companyId" in record ? recordVersion : 1, record });
  if (encoded.length > 49000) throw new Error("A workspace record exceeds the safe Sheets cell size. Shorten its input text before saving.");
  return encoded;
}
