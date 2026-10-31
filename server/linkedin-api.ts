import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { LinkedInAuth, type LinkedInConfig } from "./linkedin-auth.ts";
import { cookieValue, type TeamAuth } from "./team.ts";
import type { Store } from "./store.ts";
import type { Account, State } from "../shared/types.ts";
import { id, log, now } from "./domain.ts";
import { permits } from "../shared/outreach.ts";

function ready(store: Store) {
  if (!store.sheets || store.syncError || store.changingWorkspace) throw new Error("Connect a healthy Sheets workspace before connecting LinkedIn.");
}
function owned(s: State, accountId: string, actorId: string) {
  const account = s.accounts.find((a) => a.id === accountId);
  if (!account || account.linkedin?.ownerId !== actorId) throw new Error("Only the account owner can manage this LinkedIn connection.");
  return account;
}
function pause(s: State, account: Account) {
  for (const c of s.campaigns.filter((c) => c.accountId === account.id)) c.status = "paused";
  for (const j of s.jobs.filter((j) => j.accountId === account.id && j.status === "queued")) { j.status = "cancelled"; j.detail = "Account disconnected; restart explicitly after reconnecting."; j.updatedAt = now(); }
}
export async function checkLinkedInAccount(store: Store, provider: LinkedInAuth, accountId: string) {
  ready(store);
  const account = store.state.accounts.find((a) => a.id === accountId), connection = account?.linkedin;
  if (!account || !connection || connection.status === "disconnected") throw new Error("Reconnect this account first.");
  let valid = false;
  try {
    const token = await provider.secrets.get<{accessToken:string; expiresAt:string}>(`linkedin.tokens.${connection.connectionId}`);
    const activeOwner = connection.ownerId === "local-owner" || store.state.members.some((m) => m.id === connection.ownerId && m.status === "active" && permits(m.role, "operate"));
    if (activeOwner && token && Date.parse(token.expiresAt) > Date.now()) {
      const config = await provider.secrets.get<LinkedInConfig>("linkedin.config"), profile = await provider.profile(token.accessToken);
      valid = !!config && createHash("sha256").update(`${config.clientId}:${profile.sub}`).digest("hex") === connection.subject;
    }
  } catch { /* A failed check cannot claim an active connection. */ }
  await store.change((s) => {
    const current = s.accounts.find((a) => a.id === accountId);
    if (!current?.linkedin || current.linkedin.connectionId !== connection.connectionId || current.linkedin.status === "disconnected") return;
    current.linkedin.status = valid ? "connected" : "needs_login"; current.linkedin.checkedAt = now();
    if (!valid) {
      pause(s, current);
      if (connection.status !== "needs_login") log(s, "LinkedIn needs attention", `${current.name} · Reconnect or check the connection in Settings. Campaigns paused.`, "account");
    }
  });
  return valid;
}
export function linkedInApi(store: Store, provider: LinkedInAuth, auth: TeamAuth) {
  const router = Router();
  router.post("/linkedin/handoff", (req, res) => {
    const actor = auth.require(req, "operate"); ready(store);
    const input = z.object({ kind: z.enum(["draft", "outreach"]), recordId: z.string().min(1), revision: z.number().int().positive() }).strict().parse(req.body);
    const record = input.kind === "draft" ? store.state.drafts.find((d) => d.id === input.recordId) : store.state.outreachActions.find((a) => a.id === input.recordId && a.kind !== "email");
    const lead = store.state.leads.find((l) => l.id === record?.leadId), account = store.state.accounts.find((a) => a.id === lead?.accountId);
    if (!record || record.status !== "approved" || (record.revision || 1) !== input.revision || !lead || lead.optedOut || lead.repliedAt || lead.outreachApproval !== "approved" || !/^https:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?$/i.test(lead.profileUrl) || !account?.linkedin || account.linkedin.ownerId !== actor.id) throw new Error("Handoff needs your own linked account, an approved lead and the current approved message. Replied or opted-out leads cannot continue here.");
    res.json({ text: "text" in record ? record.text : record.body, profileUrl: lead.profileUrl });
  });
  router.get("/linkedin/config", async (_req, res) => res.json({ configured: await provider.configured(), redirectUri: provider.redirectUri, capabilities: { identity: true, invitations: false, messages: false, replies: false } }));
  router.put("/linkedin/config", async (req, res) => {
    auth.require(req, "manage");
    const input = z.object({ clientId: z.string().trim().min(5).max(300), clientSecret: z.string().trim().min(8).max(500) }).strict().parse(req.body);
    // Changing application IDs would invalidate stored subject identifiers.
    const previous = await provider.secrets.get<LinkedInConfig>("linkedin.config");
    if (previous && previous.clientId !== input.clientId && store.state.accounts.some((a) => a.linkedin)) throw new Error("Changing LinkedIn application IDs requires an operator-managed migration. Keep the existing client ID.");
    await provider.configure(input.clientId, input.clientSecret); res.json({ ok: true });
  });
  router.post("/linkedin/connect", async (req, res) => {
    const actor = auth.require(req, "operate"); ready(store);
    const { accountId } = z.object({ accountId: z.string().min(1).optional() }).strict().parse(req.body);
    const account = accountId ? store.state.accounts.find((a) => a.id === accountId) : undefined;
    if (accountId && (!account || account.status === "demo" || (account.linkedin ? account.linkedin.ownerId !== actor.id : !permits(actor.role, "manage")))) throw new Error("Choose your own connected account, or ask an administrator to connect an unused account label.");
    const result = await provider.authorize({ actorId: actor.id, grant: auth.authorizationGrant(req), epoch: store.workspaceEpoch, companyId: store.state.companies[0]?.id, accountId, expectedConnection: account?.linkedin?.connectionId });
    res.cookie("brektra_linkedin_state", result.state, { httpOnly: true, secure: auth.hosted, sameSite: "lax", maxAge: 600000, path: "/api/linkedin/callback" });
    res.json({ url: result.url });
  });
  router.post("/linkedin/accounts/:id/disconnect", async (req, res) => {
    const actor = auth.require(req, "operate"); ready(store);
    const accountId = String(req.params.id), account = owned(store.state, accountId, actor.id), connectionId = account.linkedin!.connectionId;
    // Forget the token first: failure to persist metadata cannot leave usable credentials.
    await provider.secrets.set(`linkedin.tokens.${connectionId}`, undefined);
    await store.change((s) => { const current = owned(s, accountId, actor.id); if (current.linkedin!.connectionId !== connectionId) throw new Error("Connection changed. Refresh Settings."); current.linkedin!.status = "disconnected"; pause(s, current); log(s, "LinkedIn disconnected", `${current.name} · Campaigns paused`, "account"); s.activity[0].actorId = actor.id; });
    res.json({ ok: true });
  });
  router.post("/linkedin/accounts/:id/check", async (req, res) => {
    const actor = auth.require(req, "operate"); ready(store);
    const accountId = String(req.params.id); owned(store.state, accountId, actor.id);
    res.json({ connected: await checkLinkedInAccount(store, provider, accountId) });
  });
  return router;
}

// One-time Lax cookie binds the cross-site callback; active membership and the
// captured workspace/company are rechecked before committing any account.
export async function linkedInCallback(store: Store, provider: LinkedInAuth, auth: TeamAuth, req: Request, res: Response) {
  let newConnection = "", oldConnection = "", committed = false;
  try {
    ready(store);
    const state = z.string().min(1).max(200).parse(req.query.state);
    const code = req.query.error ? "" : z.string().min(1).max(4000).parse(req.query.code);
    const result = await provider.finish(code, state, cookieValue(req, "brektra_linkedin_state"));
    newConnection = id();
    await provider.secrets.set(`linkedin.tokens.${newConnection}`, { accessToken: result.accessToken, expiresAt: result.expiresAt });
    await store.change((s) => {
      const p = result.pending;
      if (!auth.activeAuthorization(p.grant, p.actorId)) throw new Error("Initiating session ended. Sign in and reconnect.");
      if (store.workspaceEpoch !== p.epoch || s.companies[0]?.id !== p.companyId) throw new Error("Workspace changed during connection.");
      const member = s.members.find((m) => m.id === p.actorId && m.status === "active");
      if (auth.required && (!member || !permits(member.role, "operate"))) throw new Error("The account owner no longer has workspace access.");
      let account = p.accountId ? s.accounts.find((a) => a.id === p.accountId) : s.accounts.find((a) => a.linkedin?.subject === result.subject);
      if (p.accountId && (!account || account.status === "demo" || account.linkedin?.connectionId !== p.expectedConnection || (account.linkedin && (account.linkedin.ownerId !== p.actorId || account.linkedin.subject !== result.subject)))) throw new Error("Reconnect must use the same LinkedIn account and owner.");
      if (p.accountId && !account?.linkedin && auth.required && !permits(member!.role, "manage")) throw new Error("Only an administrator can attach an unused account label.");
      if (s.accounts.some((a) => a.id !== account?.id && a.linkedin?.subject === result.subject) || (account?.linkedin && account.linkedin.ownerId !== p.actorId)) throw new Error("This LinkedIn account already belongs to another member/account.");
      if (!account) { account = { id: id(), name: result.name, role: "LinkedIn account", initials: "", dailyBudget: 20, status: "not_connected" }; s.accounts.push(account); }
      oldConnection = account.linkedin?.connectionId || "";
      account.name = result.name; account.initials = result.name.split(/\s+/).slice(0, 2).map((v) => v[0]).join("").toUpperCase();
      account.linkedin = { ownerId: p.actorId, subject: result.subject, connectionId: newConnection, status: "connected", connectedAt: now(), checkedAt: now(), expiresAt: result.expiresAt };
      pause(s, account);
      log(s, "LinkedIn account connected", `${result.name} · Account identity only; live outreach unavailable`, "account"); s.activity[0].actorId = p.actorId;
    });
    committed = true;
    if (oldConnection) await provider.secrets.set(`linkedin.tokens.${oldConnection}`, undefined).catch(() => {});
  } catch {
    // Never put provider payloads, codes or tokens into URLs, logs or HTML.
  } finally {
    if (newConnection && !committed) await provider.secrets.set(`linkedin.tokens.${newConnection}`, undefined).catch(() => {});
    res.clearCookie("brektra_linkedin_state", { path: "/api/linkedin/callback", secure: auth.hosted, sameSite: "lax" });
    res.redirect(`${provider.origin}/?linkedin=${committed ? "connected" : "failed"}#settings`);
  }
}
