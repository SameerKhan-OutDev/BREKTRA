import { createHash, randomUUID } from "node:crypto";
import type { Activity, Campaign, Job, Lead, State } from "../shared/types.ts";
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function emptyState(): State {
  return {
    accounts: [],
    sources: [],
    leads: [],
    campaigns: [],
    jobs: [],
    drafts: [],
    activity: [],
    settings: [{ id: "workspace", trainingCollection: false }],
    trainingExamples: [],
    trainingFeedback: [],
  };
}
export function profileUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Use a full LinkedIn profile URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !["linkedin.com", "www.linkedin.com"].includes(
      url.hostname.toLowerCase(),
    ) ||
    !/^\/in\/[^/]+\/?$/.test(url.pathname)
  )
    throw new Error("Expected a linkedin.com/in/ profile URL.");
  return `https://www.linkedin.com${url.pathname.replace(/\/$/, "").toLowerCase()}`;
}
export const leadId = (accountId: string, url: string) =>
  createHash("sha256")
    .update(`${accountId}:${profileUrl(url)}`)
    .digest("hex")
    .slice(0, 24);
export function log(
  state: State,
  title: string,
  detail: string,
  kind = "system",
  simulated = false,
  campaignId?: string,
  leadId?: string,
) {
  const event: Activity = {
    id: id(),
    title,
    detail,
    kind,
    at: now(),
    simulated,
    campaignId,
    leadId,
    eventType: title === "Pitch ready for review" ? "pitch_review_required"
      : kind === "review" && title !== "Draft saved" ? "review_decision"
      : kind === "error" ? "essential_error" : undefined,
  };
  state.activity.unshift(event);
}
export function inWorkingHours(campaign: Campaign, date = new Date()): boolean {
  if (campaign.startsAt && date.getTime() < Date.parse(campaign.startsAt))
    return false;
  if (campaign.scheduleMode === "continuous") return true;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: campaign.timezone,
    }).format(date),
  );
  return hour >= campaign.startHour && hour < campaign.endHour;
}
export function dayKey(at: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}
export function eligible(
  state: State,
  campaign: Campaign,
  lead: Lead,
  kind: Job["kind"],
): boolean {
  if (
    lead.optedOut ||
    lead.accountId !== campaign.accountId ||
    lead.sourceId !== campaign.sourceId
  )
    return false;
  if (kind === "request" && lead.relationship !== "not_connected") return false;
  if (kind !== "request" && lead.relationship !== "connected") return false;
  const same = state.jobs.filter(
    (j) =>
      j.accountId === campaign.accountId &&
      j.leadId === lead.id &&
      j.kind === kind,
  );
  if (same.some((j) => !["failed", "cancelled"].includes(j.status)))
    return false;
  if (kind === "draft" && state.drafts.some((d) => d.leadId === lead.id))
    return false;
  return true;
}
export function queueCampaign(state: State, campaign: Campaign, retryFailed = true) {
  const demo =
    state.accounts.find((a) => a.id === campaign.accountId)?.status === "demo";
  let added = 0;
  for (const lead of state.leads.filter(
    (l) => l.sourceId === campaign.sourceId,
  )) {
    const kind = lead.relationship === "connected" ? "draft" : "request";
    if (!retryFailed && state.jobs.some((j) =>
      j.accountId === campaign.accountId && j.leadId === lead.id && j.kind === kind))
      continue;
    if (!demo && kind === "request") continue;
    if (
      (campaign.mode === "requests" && kind !== "request") ||
      (campaign.mode === "pitching" && kind !== "draft") ||
      !eligible(state, campaign, lead, kind)
    )
      continue;
    state.jobs.push({
      id: id(),
      campaignId: campaign.id,
      leadId: lead.id,
      accountId: campaign.accountId,
      kind,
      status: "queued",
      createdAt: now(),
      updatedAt: now(),
      detail: "Waiting for the local runner",
    });
    added++;
  }
  return added;
}
export function outboundCount(
  state: State,
  campaign: Campaign,
  kind?: "request" | "pitch",
  accountWide = false,
  date = new Date(),
) {
  return state.jobs.filter(
    (j) =>
      (accountWide
        ? j.accountId === campaign.accountId
        : j.campaignId === campaign.id) &&
      j.kind !== "draft" &&
      (!kind || j.kind === kind) &&
      ["running", "simulated", "completed", "uncertain"].includes(j.status) &&
      (j.status === "uncertain" || dayKey(j.intentAt ?? j.updatedAt, campaign.timezone) ===
        dayKey(date.toISOString(), campaign.timezone)),
  ).length;
}
export function canDispatch(
  state: State,
  campaign: Campaign,
  job: Job,
  date = new Date(),
) {
  if (campaign.status !== "running" || !inWorkingHours(campaign, date))
    return "Outside campaign working hours";
  const lead = state.leads.find((l) => l.id === job.leadId);
  if (!lead || lead.optedOut) return "Lead is unavailable or opted out";
  if (job.kind === "request" && lead.relationship !== "not_connected")
    return "Lead is no longer eligible for a request";
  if (job.kind !== "request" && lead.relationship !== "connected")
    return "Lead is no longer a confirmed connection";
  if (job.kind === "draft") return null;
  // Account budgets always use the workspace timezone, even across campaign timezones.
  const accountCampaign = { ...campaign, timezone: "Asia/Karachi" };
  if (
    outboundCount(state, accountCampaign, undefined, true, date) >=
    (state.accounts.find((a) => a.id === campaign.accountId)?.dailyBudget ?? 0)
  )
    return "Shared account budget reached";
  if (
    outboundCount(state, campaign, undefined, false, date) >=
    campaign.dailyLimit
  )
    return "Campaign daily allocation reached";
  if (campaign.mode === "balanced") {
    const cap =
      job.kind === "request"
        ? Math.ceil(campaign.dailyLimit / 2)
        : Math.floor(campaign.dailyLimit / 2);
    if (outboundCount(state, campaign, job.kind, false, date) >= cap)
      return "Reserved 50/50 allocation reached";
  }
  return null;
}
