import { z } from "zod";
import type { State } from "../shared/types.ts";

const key = z.string().min(1);
export const ownership = { companyId: key.optional() };
export const companyShape = {
  companies: z.array(z.object({ id: key, name: z.string().trim().min(1).max(100),
    status: z.enum(["active", "archived"]), createdAt: z.iso.datetime() }).strict()),
  companyMemberships: z.array(z.object({ id: key, companyId: key, memberId: key,
    role: z.enum(["admin", "sdr", "reviewer", "closer", "viewer"]),
    status: z.enum(["active", "invited", "disabled"]) }).strict()),
  companyMigrations: z.array(z.object({ id: z.literal("company-foundation-v1"), companyId: key,
    at: z.iso.datetime(), actorId: key, inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    recordCounts: z.record(key, z.number().int().nonnegative()),
    memberRoles: z.array(z.object({ memberId: key, from: z.enum(["owner", "admin", "operator", "reviewer", "viewer"]),
      to: z.enum(["admin", "sdr", "reviewer", "closer", "viewer"]) }).strict()) }).strict()),
};
export const ownedCollections = ["accounts", "sources", "leads", "campaigns", "jobs", "drafts", "activity", "settings",
  "trainingExamples", "trainingFeedback", "mailboxes", "sequences", "enrollments", "outreachActions", "outreachReviews",
  "conversations", "messages", "enrichments", "invitations"] as const;
type OwnedCollection = typeof ownedCollections[number];

// Also used by migration tooling. Runtime activation has a separate, stricter
// one-company gate until all service/API projections are scoped.
export function validateCompanyOwnership(state: State) {
  const fail = (detail: string): never => { throw new Error(`Invalid company ownership: ${detail}. No company data has been activated.`); };
  const companies = new Set(state.companies.map((c) => c.id));
  if (!companies.size) {
    if (state.companyMemberships.length || state.companyMigrations.length ||
        ownedCollections.some((name) => state[name].some((row) => row.companyId !== undefined)))
      fail("partial migration without a company");
    return;
  }
  for (const name of ownedCollections) for (const row of state[name]) {
    if (!row.companyId || !companies.has(row.companyId)) fail(`${name}/${row.id} needs a valid company`);
  }
  const ref = (owner: {id:string;companyId?:string}, field: string | undefined, target: OwnedCollection) => {
    if (!field) return;
    const row = state[target].find((v) => v.id === field);
    if (!row || row.companyId !== owner.companyId) fail(`${owner.id} references another company's or missing ${target}`);
  };
  for (const l of state.leads) { ref(l, l.accountId, "accounts"); ref(l, l.sourceId, "sources"); }
  for (const c of state.campaigns) { ref(c, c.accountId, "accounts"); ref(c, c.sourceId, "sources"); }
  for (const r of [...state.jobs, ...state.drafts, ...state.enrollments, ...state.outreachActions, ...state.conversations, ...state.activity]) {
    ref(r, r.campaignId, "campaigns"); ref(r, r.leadId, "leads");
  }
  for (const j of state.jobs) ref(j, j.accountId, "accounts");
  for (const q of state.sequences) { ref(q, q.campaignId, "campaigns"); ref(q, q.mailboxId, "mailboxes"); }
  for (const e of state.enrollments) ref(e, e.sequenceId, "sequences");
  for (const a of state.outreachActions) {
    ref(a, a.mailboxId, "mailboxes"); ref(a, a.enrollmentId, "enrollments"); ref(a, a.conversationId, "conversations");
  }
  for (const c of state.conversations) ref(c, c.mailboxId, "mailboxes");
  for (const r of state.outreachReviews) ref(r, r.actionId, "outreachActions");
  for (const m of state.messages) ref(m, m.conversationId, "conversations");
  for (const e of state.enrichments) ref(e, e.leadId, "leads");
  for (const e of state.trainingExamples) {
    ref(e, e.jobId, "jobs"); ref(e, e.draftId, "drafts");
    if (e.input.campaign.companyId !== e.companyId || e.input.lead.companyId !== e.companyId)
      fail(`training example ${e.id} has foreign snapshot ownership`);
  }
  for (const f of state.trainingFeedback) { ref(f, f.exampleId, "trainingExamples"); ref(f, f.draftId, "drafts"); }
  const membershipKeys = new Set<string>();
  for (const m of state.companyMemberships) {
    const identity = `${m.companyId}:${m.memberId}`;
    if (!companies.has(m.companyId) || !state.members.some((v) => v.id === m.memberId) || membershipKeys.has(identity))
      fail(`membership ${m.id} has invalid or duplicate references`);
    membershipKeys.add(identity);
  }
  for (const c of state.companies) if (state.members.length && !state.companyMemberships.some((m) => m.companyId === c.id &&
      m.role === "admin" && m.status === "active" && state.members.some((v) => v.id === m.memberId && v.status === "active")))
    fail(`company ${c.id} requires an active administrator`);
  for (const c of state.conversations) if (c.assigneeId && !state.companyMemberships.some((m) =>
      m.companyId === c.companyId && m.memberId === c.assigneeId)) fail(`conversation ${c.id} has a foreign assignee`);
  for (const i of state.invitations) if (!state.companyMemberships.some((m) =>
      m.companyId === i.companyId && m.memberId === i.memberId)) fail(`invitation ${i.id} has no company membership`);
  if (state.companyMigrations.length !== 1 || !companies.has(state.companyMigrations[0].companyId))
    fail("missing migration manifest");
}

export function assertSingleCompanyRuntime(state: State) {
  validateCompanyOwnership(state);
  if (state.companies.length > 1 || state.companies.some((c) => c.status !== "active"))
    throw new Error("Multi-company or archived-company operation is disabled until API and background-job isolation is validated. Restore a supported single-company workspace.");
}
