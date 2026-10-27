import { Router } from "express";
import { z } from "zod";
import type { Store } from "./store.ts";
import { Gmail, type GmailConfig } from "./gmail.ts";
import type { Secrets } from "./private-store.ts";
import { TeamAuth, cookieValue } from "./team.ts";
import { OutreachEngine, enroll, actionWaiting, stableMessageId, stopLead } from "./outreach.ts";
import { enrichCompany } from "./enrichment.ts";
import { stepSchema, roleSchema } from "./outreach-schema.ts";
import { id, log, now } from "./domain.ts";
import type { Sequence } from "../shared/outreach.ts";

export function outreachApi(store: Store, gmail: Gmail, secrets: Secrets, engine: OutreachEngine, auth: TeamAuth) {
  const router = Router();
  const ready = () => { if (store.syncError) throw new Error("Workspace saving is unavailable. Reconnect Sheets before changing outreach."); };
  const existing = <T extends {id:string}>(items: T[], key: string): T => {
    const item = items.find((i) => i.id === key);
    if (!item) throw new Error("This item no longer exists. Refresh the workspace.");
    return item;
  };
  router.get("/outreach/status", (_req, res) => res.json(store.state.outreachActions.map((a) => ({ id: a.id,
    waiting: ["pending", "approved"].includes(a.status) ? actionWaiting(store.state, a, !store.sheets) : a.detail }))));
  router.get("/gmail/config", async (req, res) => {
    auth.require(req, "manage");
    res.json({ configured: await gmail.configured(), redirectUri: gmail.redirectUri });
  });
  router.put("/gmail/config", async (req, res) => {
    auth.require(req, "manage");
    const input = z.object({ clientId: z.string().trim().min(10).max(300), clientSecret: z.string().trim().min(10).max(500) }).parse(req.body);
    await secrets.set("gmail.config", input satisfies GmailConfig);
    res.json({ ok: true });
  });
  router.post("/gmail/connect", async (req, res) => {
    const actor = auth.require(req, "manage"); ready();
    if (!store.sheets) throw new Error("Connect a persistent Sheets workspace before connecting real Gmail. Demo mail never sends.");
    const result = await gmail.authorize(actor.id);
    res.cookie("brektra_gmail_state", result.state, { httpOnly: true, secure: auth.hosted, sameSite: "lax", maxAge: 600000, path: "/api/gmail/callback" });
    res.json({ url: result.url });
  });
  router.patch("/mailboxes/:id", async (req, res) => {
    const actor = auth.require(req, "manage"); ready();
    const input = z.object({ sendingEnabled: z.boolean(), dailyBudget: z.number().int().min(1).max(100) }).parse(req.body);
    await store.change((s) => {
      const mailbox = existing(s.mailboxes, String(req.params.id));
      if (input.sendingEnabled && mailbox.status !== "connected") throw new Error("Reconnect Gmail before enabling sends.");
      Object.assign(mailbox, input);
      log(s, "Mailbox sending settings updated", `${mailbox.email} · ${input.sendingEnabled ? "enabled" : "paused"}`, "mailbox", mailbox.provider === "demo");
      s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.post("/mailboxes/:id/sync", async (req, res) => { auth.require(req, "operate"); ready(); res.json({ imported: await engine.sync(String(req.params.id)) }); });
  router.post("/mailboxes/:id/disconnect", async (req, res) => {
    auth.require(req, "manage"); ready();
    const mailboxId = String(req.params.id);
    await store.change((s) => { const m = existing(s.mailboxes, mailboxId); m.status = "needs_login"; m.sendingEnabled = false; });
    await secrets.set(`gmail.tokens.${mailboxId}`, undefined);
    res.json({ ok: true });
  });
  router.put("/campaigns/:id/sequence", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const { expectedVersion, ...input } = z.object({ expectedVersion: z.number().int().nonnegative().default(0), enabled: z.boolean(), mailboxId: z.string().default(""), steps: z.array(stepSchema).min(1).max(8) }).parse(req.body);
    if (new Set(input.steps.map((s) => s.id)).size !== input.steps.length) throw new Error("Sequence step IDs must be unique.");
    for (const step of input.steps) {
      if (step.kind !== "linkedin_request" && step.body.trim().length < 10) throw new Error("Every message needs at least 10 characters.");
      if (step.kind === "email" && (!step.subject.trim() || /[\r\n]/.test(step.subject))) throw new Error("Email steps need a single-line subject.");
      for (const match of `${step.subject} ${step.body}`.matchAll(/\{\{(.*?)\}\}/g))
        if (!["firstName", "name", "leadCompany", "title", "company", "selling"].includes(match[1])) throw new Error(`Unsupported placeholder {{${match[1]}}}. Use the placeholders shown in the editor.`);
    }
    const result = await store.change((s) => {
      const campaign = existing(s.campaigns, String(req.params.id));
      if (campaign.status === "running") throw new Error("Pause this campaign before changing its sequence.");
      if (input.steps.some((step) => campaign.mode === "requests" ? step.kind !== "linkedin_request" : campaign.mode === "pitching" && step.kind === "linkedin_request"))
        throw new Error("Sequence steps must match this campaign's request/pitching mode.");
      if (input.steps.some((step) => step.kind === "email")) existing(s.mailboxes, input.mailboxId);
      let sequence = s.sequences.find((q) => q.campaignId === campaign.id);
      if (expectedVersion !== (sequence?.version || 0)) throw new Error("A teammate changed this sequence. Close and reopen it before saving your changes.");
      if (sequence && sequence.enabled === input.enabled && sequence.mailboxId === input.mailboxId && JSON.stringify(sequence.steps) === JSON.stringify(input.steps)) return sequence;
      if (s.jobs.some((j) => j.campaignId === campaign.id && ["queued", "running", "uncertain"].includes(j.status)))
        throw new Error("This campaign has legacy queued/running/uncertain jobs. Finish or cancel its queued work before enabling a sequence.");
      for (const e of s.enrollments.filter((e) => e.campaignId === campaign.id && e.status === "active")) { e.status = "stopped"; e.detail = "Sequence definition changed"; }
      for (const a of s.outreachActions.filter((a) => a.campaignId === campaign.id && a.purpose === "sequence" && ["pending", "approved"].includes(a.status))) { a.status = "cancelled"; a.detail = "Sequence definition changed"; a.updatedAt = now(); }
      if (sequence) Object.assign(sequence, input, { version: sequence.version + 1, updatedAt: now() });
      else { sequence = { ...input, id: id(), campaignId: campaign.id, version: 1, updatedAt: now() }; s.sequences.push(sequence); }
      log(s, "Campaign sequence saved", `${campaign.name} · ${sequence.steps.length} steps`, "campaign", !store.sheets, campaign.id); s.activity[0].actorId = actor.id;
      return sequence;
    });
    res.json(result);
  });
  router.post("/campaigns/:id/cancel-queued", async (req, res) => {
    auth.require(req, "operate"); ready();
    await store.change((s) => {
      const c = existing(s.campaigns, String(req.params.id));
      if (c.status === "running") throw new Error("Pause the campaign before cancelling queued work.");
      for (const j of s.jobs.filter((j) => j.campaignId === c.id && j.status === "queued")) { j.status = "cancelled"; j.detail = "Queued work cancelled explicitly"; j.updatedAt = now(); }
    });
    res.json({ ok: true });
  });
  router.post("/campaigns/:id/enrollments", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const count = await store.change((s) => {
      const sequence = s.sequences.find((q) => q.campaignId === req.params.id);
      if (!sequence) throw new Error("Save and enable a sequence first.");
      for (const leadId of leadIds) if (s.outreachActions.some((a) => a.leadId === leadId && ["running", "uncertain"].includes(a.status))) throw new Error("Resolve the lead's outstanding send before enrolling again.");
      const count = enroll(s, sequence, leadIds);
      log(s, "Leads enrolled", `${count} new enrollments; messages still require review`, "campaign", !store.sheets, sequence.campaignId); s.activity[0].actorId = actor.id;
      return count;
    });
    res.json({ enrolled: count });
  });
  router.put("/outreach/:id", async (req, res) => {
    const actor = auth.require(req, "review"); ready();
    const input = z.object({ expectedRevision: z.number().int().positive(), subject: z.string().max(200).refine((v) => !/[\r\n]/.test(v)),
      expectedConversationVersion: z.number().int().positive().optional(),
      body: z.string().trim().max(6000), status: z.enum(["pending", "approved", "rejected"]) }).parse(req.body);
    await store.change((s) => {
      const action = existing(s.outreachActions, String(req.params.id)), lead = existing(s.leads, action.leadId);
      if (!["pending", "approved", "failed"].includes(action.status)) throw new Error("This send is final, cancelled, or uncertain. Resolve its outcome before making another attempt.");
      if (action.revision !== input.expectedRevision) throw new Error("Someone changed this draft. Refresh and review the latest version.");
      const conversation = s.conversations.find((c) => c.id === action.conversationId);
      if (action.purpose === "reply" && (!conversation ||
        (auth.required && input.expectedConversationVersion === undefined) ||
        (input.expectedConversationVersion !== undefined && input.expectedConversationVersion !== (conversation.messageVersion || 1))))
        throw new Error("The conversation changed. Read its latest message before reviewing a reply.");
      if (action.kind !== "linkedin_request" && input.body.length < 10) throw new Error("The message needs at least 10 characters.");
      if (action.kind === "email" && !input.subject.trim()) throw new Error("An email subject is required.");
      const recipient = action.kind === "email" ? (lead.email || "").toLowerCase() : lead.profileUrl;
      if (input.status === "approved" && (lead.optedOut || lead.outreachApproval !== "approved" || (lead.repliedAt && action.purpose === "sequence") || !recipient)) throw new Error("This lead needs outreach approval or is no longer eligible.");
      if (action.status === "failed" || action.body !== input.body || action.subject !== input.subject || action.recipient !== recipient) action.revision++;
      action.subject = input.subject; action.body = input.body; action.recipient = recipient;
      action.status = input.status; action.updatedAt = now();
      if (conversation) action.conversationVersion = conversation.messageVersion || 1;
      action.approvedRevision = input.status === "approved" ? action.revision : undefined;
      action.approvedAt = input.status === "approved" ? now() : undefined;
      action.approvedBy = input.status === "approved" ? actor.id : undefined;
      action.detail = input.status === "approved" ? "Exact version approved; waiting for schedule, account and budget checks" : input.status === "rejected" ? "Rejected by a reviewer" : "Saved; a new approval is required";
      const reviewId = `${action.id}:${action.revision}:${input.status}`;
      if (!s.outreachReviews.some((r) => r.id === reviewId)) s.outreachReviews.push({ id: reviewId, actionId: action.id,
        revision: action.revision, subject: action.subject, body: action.body, recipient: action.recipient, decision: input.status, actorId: actor.id, at: now() });
      if (input.status === "rejected") { const e = s.enrollments.find((e) => e.id === action.enrollmentId); if (e) { e.status = "stopped"; e.detail = "Step rejected"; } }
      log(s, `Outreach ${input.status}`, `${lead.name} · revision ${action.revision}`, "review", !store.sheets, action.campaignId, lead.id); s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.post("/enrollments/:id/resume", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const { reason } = z.object({ reason: z.string().trim().min(5).max(1000) }).parse(req.body);
    await store.change((s) => {
      const enrollment = existing(s.enrollments, String(req.params.id)), sequence = existing(s.sequences, enrollment.sequenceId), lead = existing(s.leads, enrollment.leadId);
      if (!["replied", "stopped"].includes(enrollment.status) || !sequence.enabled || sequence.version !== enrollment.sequenceVersion)
        throw new Error("Only stopped/replied enrollments in the current enabled sequence version can resume.");
      if (lead.optedOut || lead.outreachApproval !== "approved") throw new Error("Restore/approve this lead before explicitly resuming.");
      if (s.enrollments.some((e) => e.id !== enrollment.id && e.leadId === lead.id && e.status === "active") ||
          s.outreachActions.some((a) => a.leadId === lead.id && ["approved", "running", "uncertain"].includes(a.status)))
        throw new Error("Resolve this lead's other active or uncertain work first.");
      const step = sequence.steps[enrollment.stepIndex], action = s.outreachActions.find((a) => a.enrollmentId === enrollment.id && a.stepId === step?.id);
      if (action && ["cancelled", "rejected", "failed"].includes(action.status)) {
        action.status = "pending"; action.revision++; action.approvedRevision = undefined; action.approvedBy = undefined; action.approvedAt = undefined;
        action.detail = "Explicitly resumed; a new exact-text approval is required"; action.updatedAt = now();
      }
      lead.repliedAt = undefined; enrollment.status = "active"; enrollment.detail = `Resumed explicitly: ${reason}`;
      log(s, "Sequence explicitly resumed", `${lead.name} · ${reason}`, "campaign", !store.sheets, enrollment.campaignId, lead.id); s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.post("/outreach/:id/reconcile", async (req, res) => { auth.require(req, "operate"); ready(); await engine.reconcile(String(req.params.id)); res.json({ ok: true }); });
  router.post("/outreach/:id/resolve-not-sent", async (req, res) => {
    const actor = auth.require(req, "manage"); ready();
    const input = z.object({ verifiedNotSent: z.literal(true), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
    await store.change((s) => {
      const action = existing(s.outreachActions, String(req.params.id));
      if (action.status !== "uncertain" || action.kind !== "email") throw new Error("Only an uncertain Gmail action can receive this manual resolution.");
      action.status = "failed"; action.updatedAt = now(); action.detail = `Admin reports verified not sent: ${input.reason}. A new review is required; no resend queued.`;
      log(s, "Uncertain email manually resolved as not sent", `${action.id} · ${input.reason}`, "review", !store.sheets, action.campaignId, action.leadId); s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.patch("/conversations/:id", async (req, res) => {
    auth.require(req, "operate"); ready();
    const input = z.object({ unread: z.boolean().optional(), status: z.enum(["open", "done"]).optional(), assigneeId: z.string().optional() }).parse(req.body);
    await store.change((s) => {
      const conversation = existing(s.conversations, String(req.params.id));
      if (input.assigneeId && !s.members.some((m) => m.id === input.assigneeId && m.status === "active")) throw new Error("Choose an active workspace member.");
      Object.assign(conversation, input);
    });
    res.json({ ok: true });
  });
  router.post("/conversations/:id/reply", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const input = z.object({ body: z.string().trim().min(10).max(6000), expectedUpdatedAt: z.iso.datetime(), expectedMessageVersion: z.number().int().positive().optional() }).parse(req.body);
    const action = await store.change((s) => {
      const conversation = existing(s.conversations, String(req.params.id)), lead = existing(s.leads, conversation.leadId);
      if (conversation.updatedAt !== input.expectedUpdatedAt) throw new Error("This conversation changed. Read the latest messages before replying.");
      if ((auth.required && input.expectedMessageVersion === undefined) ||
          (input.expectedMessageVersion !== undefined && input.expectedMessageVersion !== (conversation.messageVersion || 1))) throw new Error("A new conversation message arrived. Read it before preparing a reply.");
      if (lead.optedOut || !lead.email) throw new Error("This contact is opted out or has no supplied email.");
      if (s.outreachActions.some((a) => a.conversationId === conversation.id && ["pending", "approved", "running", "uncertain"].includes(a.status))) throw new Error("This conversation already has a pending or unresolved reply.");
      const actionId = id(), stamp = now();
      stopLead(s, lead.id, "A manual inbox reply was prepared; automated follow-ups stopped");
      const action = { id: actionId, campaignId: conversation.campaignId, leadId: lead.id, mailboxId: conversation.mailboxId,
        conversationId: conversation.id, kind: "email" as const, purpose: "reply" as const,
        conversationVersion: conversation.messageVersion || 1,
        recipient: lead.email.toLowerCase(), subject: /^re:/i.test(conversation.subject) ? conversation.subject : `Re: ${conversation.subject}`.slice(0, 200),
        body: input.body, revision: 1, status: "pending" as const, createdAt: stamp, updatedAt: stamp,
        messageId: stableMessageId(actionId), providerThreadId: conversation.providerThreadId, detail: "Reply prepared; exact-text review required" };
      s.outreachActions.push(action);
      log(s, "Inbox reply ready for review", lead.name, "draft", conversation.simulated, conversation.campaignId, lead.id); s.activity[0].actorId = actor.id;
      return action;
    });
    res.status(201).json(action);
  });
  router.post("/leads/:id/enrich", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const { website } = z.object({ website: z.url().max(2000) }).parse(req.body);
    const lead = existing(store.state.leads, String(req.params.id));
    const result = await enrichCompany(lead.id, website, lead.email);
    await store.change((s) => { existing(s.leads, lead.id); s.enrichments.push(result); log(s, "Company evidence checked", result.sourceUrl, "enrichment", false, undefined, lead.id); s.activity[0].actorId = actor.id; });
    res.json(result);
  });
  router.patch("/leads/:id/approval", async (req, res) => {
    const actor = auth.require(req, "review"); ready();
    const input = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(req.body);
    await store.change((s) => {
      const lead = existing(s.leads, String(req.params.id));
      if (input.decision === "approved" && lead.optedOut) throw new Error("An opted-out lead cannot be approved for outreach.");
      lead.outreachApproval = input.decision; lead.outreachReviewedAt = now(); lead.outreachReviewedBy = actor.id;
      log(s, `Lead outreach ${input.decision}`, lead.name, "lead", !store.sheets, undefined, lead.id);
    });
    res.json({ ok: true });
  });
  router.post("/leads/:id/resume", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const { reason } = z.object({ reason: z.string().trim().min(5).max(1000) }).parse(req.body);
    await store.change((s) => {
      const lead = existing(s.leads, String(req.params.id));
      if (lead.optedOut || lead.outreachApproval !== "approved") throw new Error("An opted-out or unapproved lead cannot resume outreach.");
      if (s.outreachActions.some((a) => a.leadId === lead.id && ["approved", "running", "uncertain"].includes(a.status))) throw new Error("Resolve outstanding approved/running/uncertain work first.");
      lead.repliedAt = undefined;
      log(s, "Lead reply stop explicitly cleared", `${lead.name} · ${reason}. No enrollment restarted.`, "lead", !store.sheets, undefined, lead.id); s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.patch("/enrichments/:id", async (req, res) => {
    const actor = auth.require(req, "operate"); ready();
    const input = z.object({ status: z.enum(["accepted", "rejected"]) }).parse(req.body);
    await store.change((s) => {
      const evidence = existing(s.enrichments, String(req.params.id));
      if (evidence.status !== "pending") throw new Error("This evidence has already been reviewed.");
      evidence.status = input.status;
      if (input.status === "accepted") {
        const lead = existing(s.leads, evidence.leadId);
        lead.website = evidence.sourceUrl;
        const note = `[Company page checked ${evidence.checkedAt}] ${evidence.sourceUrl}\n${evidence.title}\n${evidence.summary}`;
        if (lead.notes.length + note.length > 8000) throw new Error("Lead notes are too long to append this evidence safely. Shorten them before accepting.");
        lead.notes = `${lead.notes}\n\n${note}`.trim();
      }
      log(s, `Enrichment ${input.status}`, evidence.sourceUrl, "enrichment", false, undefined, evidence.leadId); s.activity[0].actorId = actor.id;
    });
    res.json({ ok: true });
  });
  router.post("/team/invitations", async (req, res) => {
    const actor = auth.require(req, "manage"); ready();
    const input = z.object({ email: z.email().transform((v) => v.toLowerCase()), name: z.string().trim().min(2).max(100), role: roleSchema }).parse(req.body);
    if (input.role === "admin" && actor.role !== "owner") throw new Error("Only an owner can invite another admin.");
    const token = await auth.invite(input.email, input.name, input.role, actor.id);
    res.status(201).json({ url: `${gmail.origin}/#join=${token}`, expiresInHours: 24 });
  });
  router.post("/team/password", async (req, res) => {
    const actor = auth.require(req);
    const input = z.object({ current: z.string().max(200), next: z.string().min(12).max(200) }).parse(req.body);
    await auth.changePassword(actor.id, input.current, input.next);
    auth.logout(req, res); res.json({ ok: true });
  });
  router.patch("/team/members/:id", async (req, res) => {
    const actor = auth.require(req, "manage"); ready();
    const input = z.object({ role: roleSchema, status: z.enum(["active", "disabled"]) }).parse(req.body);
    await auth.update(String(req.params.id), input, actor);
    res.json({ ok: true });
  });
  return router;
}

// Google returns from another origin, so this endpoint precedes the session
// guard. A separate HttpOnly, same-site-lax one-time state cookie binds the flow.
export async function gmailCallback(store: Store, gmail: Gmail, req: import("express").Request, res: import("express").Response) {
  const code = z.string().min(1).max(3000).parse(req.query.code), state = z.string().min(1).max(200).parse(req.query.state);
  const result = await gmail.finish(code, state, cookieValue(req, "brektra_gmail_state"));
  await store.change((s) => {
    if (s.members.length && !s.members.some((m) => m.id === result.actorId && m.status === "active" && ["owner", "admin"].includes(m.role))) throw new Error("The initiating admin no longer has access. Reconnect from an active admin account.");
    const current = s.mailboxes.find((m) => m.id === result.mailboxId);
    if (current) { current.status = "connected"; current.sendingEnabled = false; current.syncError = ""; }
    else s.mailboxes.push({ id: result.mailboxId, email: result.email, name: result.email, provider: "gmail", status: "connected", sendingEnabled: false, dailyBudget: 20, syncError: "" });
    log(s, "Gmail connected", `${result.email} · Sending stays off until enabled`, "mailbox"); s.activity[0].actorId = result.actorId;
  });
  res.clearCookie("brektra_gmail_state", { path: "/api/gmail/callback" });
  res.redirect(`${gmail.origin}/#settings`);
}
