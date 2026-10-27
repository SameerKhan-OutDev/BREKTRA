import { createHash } from "node:crypto";
import type { State, Campaign } from "../shared/types.ts";
import type { OutreachAction, Sequence, Mailbox, Conversation } from "../shared/outreach.ts";
import { permits } from "../shared/outreach.ts";
import { id, now, log, inWorkingHours, dayKey, outboundCount } from "./domain.ts";
import type { Store } from "./store.ts";
import { normalizeEmail, RejectedSend, type MailProvider, type MailMessage } from "./gmail.ts";

const attempted = new Set<OutreachAction["status"]>(["running", "accepted", "simulated", "uncertain"]);
export const stableMessageId = (actionId: string) => `<${createHash("sha256").update(actionId).digest("hex")}@brektra.invalid>`;
export function stopLead(state: State, leadId: string, detail: string, repliedAt?: string) {
  const lead = state.leads.find((l) => l.id === leadId);
  if (lead && repliedAt && (!lead.repliedAt || lead.repliedAt < repliedAt)) lead.repliedAt = repliedAt;
  for (const enrollment of state.enrollments)
    if (enrollment.leadId === leadId && enrollment.status === "active") {
      enrollment.status = repliedAt ? "replied" : "stopped"; enrollment.detail = detail;
    }
  for (const action of state.outreachActions)
    if (action.leadId === leadId && ["pending", "approved"].includes(action.status) && (action.purpose === "sequence" || lead?.optedOut)) {
      action.status = "cancelled"; action.detail = detail; action.updatedAt = now();
    }
  for (const job of state.jobs)
    if (job.leadId === leadId && job.status === "queued") { job.status = "cancelled"; job.detail = detail; job.updatedAt = now(); }
}
const render = (template: string, lead: State["leads"][number], campaign: Campaign) => {
  const values: Record<string, string> = { firstName: lead.name.split(" ")[0], name: lead.name,
    leadCompany: lead.company, title: lead.title, company: campaign.company, selling: campaign.selling };
  const result = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values) || !values[key]) throw new Error(`Missing supplied value for {{${key}}}. Edit this step or the lead facts.`);
    return values[key];
  });
  return result;
};
export function enroll(state: State, sequence: Sequence, leadIds: string[]) {
  const campaign = state.campaigns.find((c) => c.id === sequence.campaignId)!;
  if (!sequence.enabled) throw new Error("Enable the sequence before enrolling leads.");
  if (!leadIds.length || leadIds.length > 100) throw new Error("Select between 1 and 100 leads.");
  let count = 0;
  for (const leadId of new Set(leadIds)) {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || lead.sourceId !== campaign.sourceId || lead.accountId !== campaign.accountId || lead.optedOut || lead.repliedAt || lead.outreachApproval !== "approved")
      throw new Error("A selected lead needs outreach approval, is unavailable/opted out/replied, or belongs to another campaign source/account.");
    if (sequence.steps.some((step) => step.kind === "email") && !lead.email) throw new Error(`Add a supplied email address for ${lead.name} before enrolling.`);
    if (sequence.steps.some((step) => step.kind !== "email") && !lead.profileUrl) throw new Error(`Add a LinkedIn profile for ${lead.name} before enrolling LinkedIn steps.`);
    if (lead.email && state.leads.some((l) => l.id !== lead.id && normalizeEmail(l.email || "") === normalizeEmail(lead.email!)))
      throw new Error(`The email address for ${lead.name} matches another lead. Resolve the duplicate before outreach.`);
    if (state.enrollments.some((e) => e.leadId === lead.id && (e.status === "active" || (e.sequenceId === sequence.id && e.sequenceVersion === sequence.version)))) continue;
    if (state.outreachActions.some((a) => a.leadId === lead.id && ["pending", "approved", "running", "uncertain"].includes(a.status)))
      throw new Error(`${lead.name} already has a pending or unresolved message. Resolve it before enrolling.`);
    if (state.jobs.some((j) => j.leadId === lead.id && ["queued", "running", "uncertain"].includes(j.status)))
      throw new Error(`${lead.name} already has outstanding legacy work. Resolve it before sequence enrollment.`);
    const stamp = now();
    state.enrollments.push({ id: id(), sequenceId: sequence.id, campaignId: campaign.id, leadId,
      sequenceVersion: sequence.version, stepIndex: 0, status: "active", startedAt: stamp,
      nextAt: new Date(Date.parse(stamp) + sequence.steps[0].delayHours * 3600000).toISOString(), detail: "Waiting for the first step" });
    count++;
  }
  return count;
}
export function advanceSequences(state: State, date = new Date()): number {
  let changed = 0;
  for (const e of state.enrollments.filter((e) => e.status === "active")) {
    const sequence = state.sequences.find((q) => q.id === e.sequenceId)!;
    const campaign = state.campaigns.find((c) => c.id === e.campaignId)!;
    const lead = state.leads.find((l) => l.id === e.leadId)!;
    if (lead.optedOut || lead.repliedAt) { stopLead(state, lead.id, lead.optedOut ? "Lead opted out" : "Lead replied", lead.repliedAt); changed++; continue; }
    if (!sequence.enabled || sequence.version !== e.sequenceVersion) { e.status = "stopped"; e.detail = "Sequence changed or disabled; enrollments are never silently restarted"; changed++; continue; }
    if (campaign.status !== "running" || !inWorkingHours(campaign, date)) continue;
    let step = sequence.steps[e.stepIndex];
    if (!step) { e.status = "completed"; e.detail = "All steps completed"; changed++; continue; }
    const previous = state.outreachActions.find((a) => a.enrollmentId === e.id && a.stepId === step.id);
    if (previous) {
      if (["accepted", "simulated"].includes(previous.status)) {
        // A request must be accepted by the person before a later LinkedIn message.
        if (previous.kind === "linkedin_request" && lead.relationship !== "connected") continue;
        e.stepIndex++;
        step = sequence.steps[e.stepIndex];
        if (!step) { e.status = "completed"; e.detail = "All reviewed steps completed"; changed++; continue; }
        e.nextAt = new Date(Date.parse(previous.updatedAt) + step.delayHours * 3600000).toISOString();
        changed++;
      } else if (["rejected", "cancelled"].includes(previous.status)) {
        e.status = "stopped"; e.detail = previous.detail || "Step rejected/cancelled"; changed++;
      } else continue;
    }
    if (e.status !== "active" || Date.parse(e.nextAt) > date.getTime()) continue;
    if (state.outreachActions.some((a) => a.enrollmentId === e.id && a.stepId === step.id)) continue;
    if (step.kind === "linkedin_message" && lead.relationship !== "connected") continue;
    if (step.kind === "linkedin_request" && lead.relationship !== "not_connected") continue;
    const actionId = `step_${e.id}_${step.id}`, stamp = date.toISOString();
    try {
      const subject = render(step.subject, lead, campaign), body = render(step.body, lead, campaign);
      if (subject.length > 200 || body.length > 6000 || /[\r\n]/.test(subject)) throw new Error("Rendered message exceeds its field limits or contains an invalid subject.");
      state.outreachActions.push({ id: actionId, campaignId: campaign.id, leadId: lead.id,
        mailboxId: step.kind === "email" ? sequence.mailboxId : "", enrollmentId: e.id, stepId: step.id,
        kind: step.kind, purpose: "sequence", recipient: step.kind === "email" ? normalizeEmail(lead.email || "") : lead.profileUrl,
        subject, body, revision: 1, status: "pending", createdAt: stamp, updatedAt: stamp,
        messageId: stableMessageId(actionId), detail: "Review this exact recipient and message before sending" });
      e.detail = "Message ready for review";
      log(state, "Sequence message ready for review", `${lead.name} · ${step.kind.replaceAll("_", " ")}`, "draft", false, campaign.id, lead.id);
    } catch (error) { e.status = "stopped"; e.detail = error instanceof Error ? error.message : "Step needs corrected input"; }
    changed++;
  }
  return changed;
}
export function actionWaiting(state: State, action: OutreachAction, demo: boolean, date = new Date()): string | null {
  if (action.status !== "approved" || action.approvedRevision !== action.revision) return "Waiting for exact-version review";
  const lead = state.leads.find((l) => l.id === action.leadId), campaign = state.campaigns.find((c) => c.id === action.campaignId);
  if (!lead || !campaign || lead.optedOut || (lead.repliedAt && action.purpose === "sequence")) return "Lead unavailable, opted out, or replied";
  if (lead.outreachApproval !== "approved") return "Lead needs separate outreach approval";
  if (action.purpose === "reply") {
    const conversation = state.conversations.find((c) => c.id === action.conversationId);
    if (!conversation || action.conversationVersion !== (conversation.messageVersion || 1)) return "Conversation changed; read the latest message and review this reply again";
  }
  if (state.members.length && !state.members.some((m) => m.id === action.approvedBy && m.status === "active" && permits(m.role, "review"))) return "Approval author is no longer permitted to review";
  if (action.purpose === "sequence") {
    if (campaign.status !== "running" || !inWorkingHours(campaign, date)) return "Campaign paused or outside working hours";
    const enrollment = state.enrollments.find((e) => e.id === action.enrollmentId);
    const sequence = state.sequences.find((q) => q.id === enrollment?.sequenceId);
    if (!enrollment || enrollment.status !== "active" || !sequence?.enabled || sequence.version !== enrollment.sequenceVersion) return "Enrollment stopped or sequence changed";
  }
  if (!demo && action.kind !== "email") return "Live LinkedIn integration is not connected";
  if (action.kind === "email") {
    const mailbox = state.mailboxes.find((m) => m.id === action.mailboxId);
    if (!mailbox || mailbox.status !== "connected" || !mailbox.sendingEnabled) return "Enable a connected mailbox in Settings";
    if (mailbox.syncError) return "Mailbox sync needs attention; sync/reconnect in Settings";
    if ((!demo && mailbox.provider !== "gmail") || (demo && mailbox.provider !== "demo")) return "Mailbox provider does not match workspace mode";
    if (normalizeEmail(lead.email || "") !== normalizeEmail(action.recipient)) return "Lead email changed; edit and review this message again";
    const spent = state.outreachActions.filter((a) => a.mailboxId === mailbox.id && attempted.has(a.status) &&
      (a.status === "uncertain" || dayKey(a.intentAt || a.updatedAt, "Asia/Karachi") === dayKey(date.toISOString(), "Asia/Karachi"))).length;
    if (spent >= mailbox.dailyBudget) return "Shared mailbox daily budget reached";
  } else {
    if (lead.profileUrl !== action.recipient) return "Lead profile changed; review again";
    if (action.kind === "linkedin_request" && lead.relationship !== "not_connected") return "Relationship is no longer eligible for a request";
    if (action.kind === "linkedin_message" && lead.relationship !== "connected") return "Lead is not connected";
    const account = state.accounts.find((a) => a.id === campaign.accountId);
    if (outboundCount(state, { ...campaign, timezone: "Asia/Karachi" }, undefined, true, date) >= (account?.dailyBudget || 0)) return "Shared LinkedIn account budget reached";
  }
  if (outboundCount(state, campaign, undefined, false, date) >= campaign.dailyLimit) return "Campaign daily allocation reached";
  if (campaign.mode === "requests" && action.kind !== "linkedin_request") return "This campaign is request-only";
  if (campaign.mode === "pitching" && action.kind === "linkedin_request") return "This campaign is pitching-only";
  if (campaign.mode === "balanced") {
    const request = action.kind === "linkedin_request", cap = request ? Math.ceil(campaign.dailyLimit / 2) : Math.floor(campaign.dailyLimit / 2);
    if (outboundCount(state, campaign, request ? "request" : "pitch", false, date) >= cap) return "Reserved 50/50 allocation reached";
  }
  return null;
}
function conversationFor(state: State, mailbox: Mailbox, message: MailMessage): Conversation | undefined {
  const known = state.conversations.find((c) => c.mailboxId === mailbox.id && c.providerThreadId === message.threadId);
  if (known) return known;
  const action = state.outreachActions.find((a) => a.mailboxId === mailbox.id && a.providerThreadId === message.threadId);
  const matches = state.leads.filter((l) => normalizeEmail(l.email || "") === (message.sent ? message.to : message.from));
  const lead = action ? state.leads.find((l) => l.id === action.leadId) : matches.length === 1 ? matches[0] : undefined;
  const enrollment = state.enrollments.find((e) => e.leadId === lead?.id && e.status === "active");
  const campaignId = action?.campaignId || enrollment?.campaignId;
  if (!lead || !campaignId) return;
  const conversation: Conversation = { id: `${mailbox.id}:${message.threadId}`, mailboxId: mailbox.id, leadId: lead.id,
    campaignId, providerThreadId: message.threadId, subject: message.subject, updatedAt: message.at,
    unread: !message.sent, status: "open", assigneeId: "", simulated: mailbox.provider === "demo" };
  state.conversations.push(conversation);
  return conversation;
}
export function importMessages(state: State, mailbox: Mailbox, messages: MailMessage[]) {
  let imported = 0;
  for (const message of messages.sort((a, b) => a.at.localeCompare(b.at))) {
    const messageKey = `${mailbox.id}:${message.id}`;
    if (state.messages.some((m) => m.id === messageKey)) continue;
    const conversation = conversationFor(state, mailbox, message);
    if (!conversation) continue;
    // Ignore unrelated participants/forwarded content in a known thread, but stop
    // for a possible delivery notice rather than automatically following up.
    const lead = state.leads.find((l) => l.id === conversation.leadId)!;
    const outbound = message.sent && message.from === normalizeEmail(mailbox.email);
    const inbound = !message.sent && message.from === normalizeEmail(lead.email || "");
    if (!outbound && !inbound) {
      if (!message.sent) stopLead(state, lead.id, "Unexpected sender/delivery notice in tracked conversation; inspect Gmail");
      continue;
    }
    state.messages.push({ id: messageKey, conversationId: conversation.id, providerMessageId: message.id,
      direction: outbound ? "outbound" : "inbound", from: message.from, to: message.to,
      subject: message.subject, body: message.body, at: message.at, messageId: message.messageId,
      simulated: mailbox.provider === "demo" });
    conversation.messageVersion = (conversation.messageVersion || 0) + 1;
    conversation.updatedAt = conversation.updatedAt > message.at ? conversation.updatedAt : message.at;
    if (inbound) {
      conversation.unread = true; conversation.status = "open";
      const started = state.enrollments.filter((e) => e.leadId === lead.id).map((e) => e.startedAt).sort()[0];
      const sent = state.outreachActions.some((a) => a.leadId === lead.id && a.createdAt <= message.at);
      if ((started && message.at >= started) || sent) stopLead(state, lead.id, "Reply received; further sequence outreach stopped", message.at);
      log(state, "Email reply received", lead.name, "reply", mailbox.provider === "demo", conversation.campaignId, lead.id);
    }
    imported++;
  }
  return imported;
}
function recordAcceptance(state: State, action: OutreachAction, result: {id:string; threadId:string}, simulated: boolean) {
  action.status = simulated ? "simulated" : "accepted"; action.updatedAt = now();
  action.providerMessageId = result.id; action.providerThreadId = result.threadId;
  action.detail = simulated ? "Simulated only; no external action performed" : "Accepted by Gmail; recipient delivery is not confirmed";
  const lead = state.leads.find((l) => l.id === action.leadId)!;
  if (action.kind === "email") {
    const mailbox = state.mailboxes.find((m) => m.id === action.mailboxId)!;
    importMessages(state, mailbox, [{ id: result.id, threadId: result.threadId, from: mailbox.email, to: action.recipient,
      subject: action.subject, body: action.body, at: action.updatedAt, messageId: action.messageId, inReplyTo: "", sent: true }]);
    action.conversationId = state.conversations.find((c) => c.mailboxId === mailbox.id && c.providerThreadId === result.threadId)?.id;
  } else if (action.kind === "linkedin_request") lead.relationship = "pending";
  log(state, simulated ? "Sequence action simulated" : "Email accepted by Gmail", `${lead.name} · ${action.detail}`, "outreach", simulated, action.campaignId, action.leadId);
}
export class OutreachEngine {
  private busy = false;
  private syncing = new Map<string, Promise<number>>();
  constructor(private store: Store, private provider: MailProvider) {}
  async sync(mailboxId: string) {
    const current = this.syncing.get(mailboxId);
    if (current) return current;
    const operation = (async () => {
      const mailbox = this.store.state.mailboxes.find((m) => m.id === mailboxId);
      if (!mailbox) throw new Error("Mailbox no longer exists.");
      if (mailbox.provider === "demo") return 0;
      const state = this.store.state;
      const activeEnrollments = state.enrollments.filter((e) => e.status === "active" && state.sequences.some((q) => q.id === e.sequenceId && q.mailboxId === mailboxId));
      const tracked = new Set([...activeEnrollments.map((e) => e.leadId),
        ...state.conversations.filter((c) => c.mailboxId === mailboxId && c.status === "open").map((c) => c.leadId)]);
      const emails = state.leads.filter((l) => tracked.has(l.id) && l.email).map((l) => l.email!);
      const threadIds = [...new Set([...state.conversations.filter((c) => c.mailboxId === mailboxId && c.status === "open").map((c) => c.providerThreadId),
        ...state.outreachActions.filter((a) => a.mailboxId === mailboxId && a.providerThreadId &&
          (activeEnrollments.some((e) => e.id === a.enrollmentId) || ["pending", "approved", "running", "uncertain"].includes(a.status))).map((a) => a.providerThreadId!)])];
      try {
        const messages = await this.provider.messages(mailbox, emails, threadIds);
        return await this.store.change((s) => {
          const count = importMessages(s, mailbox, messages);
          const current = s.mailboxes.find((m) => m.id === mailboxId)!;
          current.syncedAt = now(); current.syncError = "";
          return count;
        });
      } catch (error) {
        if (!this.store.syncError) await this.store.change((s) => {
          s.mailboxes.find((m) => m.id === mailboxId)!.syncError = error instanceof Error ? error.message : "Sync failed; sending is paused";
        });
        throw error;
      }
    })();
    this.syncing.set(mailboxId, operation);
    try { return await operation; } finally { this.syncing.delete(mailboxId); }
  }
  async reconcile(actionId: string) {
    const action = this.store.state.outreachActions.find((a) => a.id === actionId);
    if (!action || action.status !== "uncertain" || action.kind !== "email") throw new Error("Only uncertain email sends can be reconciled with Gmail.");
    const mailbox = this.store.state.mailboxes.find((m) => m.id === action.mailboxId)!;
    const matches = (await this.provider.findSent(mailbox, action.messageId)).filter((m) =>
      m.to === action.recipient && m.from === mailbox.email && m.subject === action.subject && m.body.trim() === action.body.trim());
    if (matches.length !== 1) throw new Error("No single matching sent copy was verified. The action remains uncertain and will not be retried.");
    await this.store.change((state) => {
      const current = state.outreachActions.find((a) => a.id === actionId)!;
      if (current.status !== "uncertain") throw new Error("This attempt changed; refresh before resolving.");
      recordAcceptance(state, current, matches[0], false);
    });
  }
  async tick() {
    if (this.busy || this.store.syncError || this.store.changingWorkspace) return;
    this.busy = true;
    try {
      const candidate = structuredClone(this.store.state);
      if (advanceSequences(candidate)) await this.store.change((state) => { advanceSequences(state); });
      const demo = !this.store.sheets;
      const selected = this.store.state.outreachActions.find((a) => !actionWaiting(this.store.state, a, demo));
      if (!selected) return;
      if (!demo && selected.kind === "email") await this.sync(selected.mailboxId);
      const intent = await this.store.change((state) => {
        const current = state.outreachActions.find((a) => a.id === selected.id)!;
        if (actionWaiting(state, current, demo)) return null;
        current.status = "running"; current.intentAt = now(); current.updatedAt = current.intentAt;
        current.detail = "Intent saved before contacting the provider";
        return structuredClone(current);
      });
      if (!intent) return;
      try {
        const confirm = async () => {
          const allowed = await this.store.change((state) => {
            const current = state.outreachActions.find((a) => a.id === intent.id);
            if (!current || current.status !== "running" || current.revision !== intent.revision) return false;
            const withoutOwnReservation = { ...state, outreachActions: state.outreachActions.filter((a) => a.id !== intent.id) };
            return !actionWaiting(withoutOwnReservation, { ...current, status: "approved" }, demo);
          });
          if (!allowed) throw new RejectedSend("Dispatch cancelled before provider submission because the campaign, lead, mailbox, approval or budget changed. Review again before any new attempt.");
        };
        await confirm();
        const mailbox = this.store.state.mailboxes.find((m) => m.id === intent.mailboxId);
        const conversation = this.store.state.conversations.find((c) => c.id === intent.conversationId);
        const parent = this.store.state.messages.filter((m) => m.conversationId === conversation?.id && m.direction === "inbound").sort((a, b) => b.at.localeCompare(a.at))[0];
        const result = demo ? { id: `sim_${intent.id}`, threadId: conversation?.providerThreadId || `sim_${intent.enrollmentId || intent.id}` }
          : await this.provider.send(mailbox!, intent, parent?.messageId, confirm);
        await this.store.change((state) => {
          const current = state.outreachActions.find((a) => a.id === intent.id)!;
          // Always record a provider result, including when a user pauses or opts
          // out during transport. No subsequent step may use the stale intent.
          if (current.status !== "running") return;
          recordAcceptance(state, current, result, demo);
        });
      } catch (error) {
        if (!this.store.syncError) await this.store.change((state) => {
          const current = state.outreachActions.find((a) => a.id === intent.id)!;
          if (current.status !== "running") return;
          current.status = error instanceof RejectedSend ? "failed" : "uncertain";
          current.updatedAt = now(); current.detail = error instanceof Error ? error.message : "Outcome unknown; inspect before any retry";
          log(state, "Outreach needs attention", current.detail, "error", demo, current.campaignId, current.leadId);
        });
      }
    } catch (error) {
      if (this.store.syncError) console.error("Outreach paused: workspace saving is unavailable.");
      // Expected mailbox/sync failures are persisted on the mailbox. Never retry
      // a send from this catch; the next tick can select only approved intents.
    } finally { this.busy = false; }
  }
}
