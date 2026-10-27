import { createHash, randomUUID } from "node:crypto";
import type { State } from "../shared/types.ts";
import type { CompanyMigrationPreview, CompanyRole } from "../shared/company.ts";
import type { TeamRole } from "../shared/outreach.ts";
import { ownedCollections, assertSingleCompanyRuntime } from "./company-schema.ts";
import { validateState } from "./schema.ts";

export const legacyCompanyRole: Record<TeamRole, CompanyRole> = {
  owner: "admin", admin: "admin", operator: "sdr", reviewer: "reviewer", viewer: "viewer",
};
// Sort object keys and row IDs so a Sheets reload/activity sort cannot make an
// unchanged preview stale. Include all content, not only counts or timestamps.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function companyFingerprint(state: State) {
  const sorted = Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, [...rows].sort((a, b) => a.id.localeCompare(b.id))]));
  return createHash("sha256").update(JSON.stringify(canonical(sorted))).digest("hex");
}
export function previewCompanyMigration(state: State): CompanyMigrationPreview {
  validateState(state);
  assertSingleCompanyRuntime(state);
  const running = state.jobs.filter((j) => j.status === "running").length + state.outreachActions.filter((a) => a.status === "running").length;
  const blockers = [];
  if (state.companies.length) blockers.push("This workspace already has company ownership. Migration cannot run twice.");
  if (running) blockers.push("Wait for in-flight work to finish or recover it before migrating.");
  if (state.trainingExamples.some((e) => e.status === "generating")) blockers.push("Wait for AI generation to finish or recover it before migrating.");
  return {
    fingerprint: companyFingerprint(state), counts: Object.fromEntries(Object.entries(state).map(([k, rows]) => [k, rows.length])),
    members: state.members.map((m) => ({ memberId: m.id, name: m.name, from: m.role, to: legacyCompanyRole[m.role], status: m.status })),
    runningCampaigns: state.campaigns.filter((c) => c.status === "running").length,
    enabledMailboxes: state.mailboxes.filter((m) => m.sendingEnabled).length,
    uncertainActions: state.jobs.filter((j) => j.status === "uncertain").length + state.outreachActions.filter((a) => a.status === "uncertain").length,
    blockers,
  };
}
export function prepareCompanyMigration(state: State, input: {name: string; fingerprint: string; actorId: string; backupConfirmed: boolean}): State {
  const preview = previewCompanyMigration(state);
  if (!input.backupConfirmed) throw new Error("Confirm a restorable backup of Sheets and matching private infrastructure before migrating.");
  if (preview.fingerprint !== input.fingerprint) throw new Error("Workspace changed since preview. Review a fresh migration preview.");
  if (preview.blockers.length) throw new Error(preview.blockers.join(" "));
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Company name must contain 1–100 characters.");
  const next = structuredClone(state), companyId = randomUUID();
  next.companies = [{ id: companyId, name, status: "active", createdAt: new Date().toISOString() }];
  next.companyMigrations = [{ id: "company-foundation-v1", companyId, at: next.companies[0].createdAt,
    actorId: input.actorId, inputFingerprint: preview.fingerprint, recordCounts: preview.counts,
    memberRoles: preview.members.map(({ memberId, from, to }) => ({ memberId, from, to })) }];
  for (const key of ownedCollections) for (const row of next[key]) row.companyId = companyId;
  for (const e of next.trainingExamples) { e.input.campaign.companyId = companyId; e.input.lead.companyId = companyId; }
  syncLegacyMemberships(next);
  // Migration changes ownership only. Keep all exact-message approvals, sender
  // IDs and uncertainty; pause dispatch until an operator explicitly resumes.
  for (const c of next.campaigns) if (c.status === "running") c.status = "paused";
  for (const m of next.mailboxes) m.sendingEnabled = false;
  validateState(next); assertSingleCompanyRuntime(next);
  return next;
}

function syncLegacyMemberships(state: State) {
  const companyId = state.companies[0]?.id;
  if (!companyId) return;
  state.companyMemberships = state.members.map((m) => ({
    id: state.companyMemberships.find((v) => v.memberId === m.id)?.id || randomUUID(),
    companyId, memberId: m.id, role: legacyCompanyRole[m.role], status: m.status,
  }));
}

// Compatibility bridge for existing single-workspace writers. Only brand new
// rows may inherit ownership; deleting/changing it on old rows is an error.
// Remove this bridge when every writer takes explicit company scope in P1.2.
export function maintainSingleCompanyOwnership(before: State, next: State) {
  assertSingleCompanyRuntime(before);
  if (!before.companies.length) { assertSingleCompanyRuntime(next); return; }
  const companyId = before.companies[0].id;
  if (next.companies.length !== 1 || next.companies[0].id !== companyId || next.companyMigrations[0]?.companyId !== companyId)
    throw new Error("Company ownership cannot be changed by a workspace mutation.");
  if (JSON.stringify(before.companyMigrations) !== JSON.stringify(next.companyMigrations))
    throw new Error("The original company migration manifest is immutable.");
  for (const key of ownedCollections) for (const row of next[key]) {
    const old = before[key].find((r) => r.id === row.id);
    if (old && row.companyId !== old.companyId) throw new Error("Existing record company ownership is immutable.");
    if (!old && row.companyId === undefined) row.companyId = companyId;
  }
  for (const e of next.trainingExamples) if (!before.trainingExamples.some((v) => v.id === e.id)) {
    e.input.campaign.companyId ??= companyId; e.input.lead.companyId ??= companyId;
  }
  syncLegacyMemberships(next);
  assertSingleCompanyRuntime(next);
}
