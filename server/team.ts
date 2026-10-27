import { randomBytes, createHash, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import type { Store } from "./store.ts";
import type { Secrets } from "./private-store.ts";
import type { AuthStatus, Member, Permission, TeamRole } from "../shared/outreach.ts";
import { permits } from "../shared/outreach.ts";
import { id, log, now } from "./domain.ts";
const scrypt = promisify(derive);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export function cookieValue(req: Request, name: string) {
  return (req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
interface PasswordRecord { salt: string; hash: string }
export async function passwordHash(password: string): Promise<PasswordRecord> {
  if (password.length < 12 || password.length > 200) throw new Error("Use a password between 12 and 200 characters.");
  const salt = randomBytes(16).toString("hex"), hash = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: hash.toString("hex") };
}
async function matches(password: string, record?: PasswordRecord) {
  if (!record || password.length > 200) { await scrypt(password.slice(0, 200), "unavailable-account", 64); return false; }
  const actual = await scrypt(password, record.salt, 64) as Buffer, expected = Buffer.from(record.hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class TeamAuth {
  private sessions = new Map<string, { memberId: string; expiresAt: number }>();
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private accepting = new Set<string>();
  constructor(private store: Store, private secrets: Secrets, readonly hosted: boolean, readonly required: boolean) {}
  async bootstrap(email: string, password: string, name = "Workspace owner", resetOwner = false) {
    if (!this.required) return;
    if (!this.store.state.members.length) {
      if (!email || !password) throw new Error("Hosted/team access requires BREKTRA_OWNER_EMAIL and BREKTRA_OWNER_PASSWORD for the initial owner.");
      const owner: Member = { id: id(), name, email: email.toLowerCase(), role: "owner", status: "active", createdAt: now() };
      const record = await passwordHash(password);
      await this.secrets.set(`team.password.${owner.id}`, record);
      await this.store.change((s) => { s.members.push(owner); });
    }
    if (!this.store.state.members.some((m) => m.role === "owner" && m.status === "active")) throw new Error("Workspace has no active owner; restore its member records before starting.");
    if (resetOwner) {
      const owner = this.store.state.members.find((m) => m.email === email.toLowerCase() && m.role === "owner" && m.status === "active");
      if (!owner || !password) throw new Error("Owner recovery requires the exact active owner email and a new password in the private server environment.");
      await this.secrets.set(`team.password.${owner.id}`, await passwordHash(password));
      await this.store.change((s) => { log(s, "Owner password recovered by server operator", owner.email, "team"); s.activity[0].actorId = owner.id; });
    }
  }
  status(req: Request): AuthStatus {
    if (!this.required) return { required: false, authenticated: true, hosted: this.hosted,
      user: { id: "local-owner", name: "Local owner", email: "", role: "owner" } };
    const key = digest(cookieValue(req, "brektra_session")), session = this.sessions.get(key);
    const member = session && session.expiresAt > Date.now() ? this.store.state.members.find((m) => m.id === session.memberId && m.status === "active") : undefined;
    return { required: true, authenticated: !!member, hosted: this.hosted,
      user: member ? { id: member.id, name: member.name, email: member.email, role: member.role } : null };
  }
  require(req: Request, permission?: Permission) {
    const status = this.status(req);
    if (!status.authenticated || !status.user) throw Object.assign(new Error("Sign in to this workspace."), { status: 401 });
    if (permission && !permits(status.user.role, permission)) throw Object.assign(new Error("Your workspace role does not allow this action."), { status: 403 });
    return status.user;
  }
  async login(email: string, password: string, remote: string) {
    const address = email.trim().toLowerCase(), key = `${remote}:${address}`;
    for (const [key, value] of this.attempts) if (value.resetAt < Date.now()) this.attempts.delete(key);
    const remoteKey = `${remote}:*`, remoteAttempt = this.attempts.get(remoteKey) || { count: 0, resetAt: Date.now() + 900000 };
    if (remoteAttempt.count >= 30) throw Object.assign(new Error("Too many sign-in attempts from this connection. Wait 15 minutes."), { status: 429 });
    remoteAttempt.count++; this.attempts.set(remoteKey, remoteAttempt);
    const attempt = this.attempts.get(key) || { count: 0, resetAt: Date.now() + 900000 };
    if (attempt.count >= 8) throw Object.assign(new Error("Too many sign-in attempts. Wait 15 minutes."), { status: 429 });
    attempt.count++; this.attempts.set(key, attempt);
    const member = this.store.state.members.find((m) => m.email.toLowerCase() === address && m.status === "active");
    const record = member ? await this.secrets.get<PasswordRecord>(`team.password.${member.id}`) : undefined;
    if (!await matches(password, record) || !member) throw Object.assign(new Error("Email or password is incorrect."), { status: 401 });
    this.attempts.delete(key);
    for (const [key, value] of this.sessions) if (value.expiresAt < Date.now()) this.sessions.delete(key);
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(digest(token), { memberId: member.id, expiresAt: Date.now() + 8 * 3600000 });
    return token;
  }
  setCookie(res: Response, token: string) {
    res.cookie("brektra_session", token, { httpOnly: true, sameSite: "strict", secure: this.hosted, maxAge: 8 * 3600000, path: "/" });
  }
  logout(req: Request, res: Response) { this.sessions.delete(digest(cookieValue(req, "brektra_session"))); res.clearCookie("brektra_session", { path: "/", secure: this.hosted, sameSite: "strict" }); }
  async invite(email: string, name: string, role: TeamRole, actorId: string) {
    if (!this.required) throw new Error("Enable authenticated hosted/team mode before inviting teammates.");
    if (role === "owner") throw new Error("Invite another role first; only an owner can promote an active member to owner.");
    const emailKey = email.toLowerCase();
    if (this.store.state.members.some((m) => m.email === emailKey)) throw new Error("This email already has a member record.");
    const memberId = id(), invitationId = id(), token = randomBytes(32).toString("base64url");
    await this.secrets.set(`team.invitation.${invitationId}`, digest(token));
    await this.store.change((state) => {
      state.members.push({ id: memberId, name, email: emailKey, role, status: "invited", createdAt: now() });
      state.invitations.push({ id: invitationId, memberId, expiresAt: new Date(Date.now() + 86400000).toISOString() });
      log(state, "Teammate invited", `${name} · ${role}`, "team"); state.activity[0].actorId = actorId;
    });
    return `${invitationId}.${token}`;
  }
  async accept(token: string, password: string) {
    const [invitationId, proof] = token.split(".");
    if (this.accepting.has(invitationId)) throw new Error("This invitation is already being accepted. Wait and sign in.");
    this.accepting.add(invitationId);
    try {
    const invitation = this.store.state.invitations.find((i) => i.id === invitationId && !i.acceptedAt && Date.parse(i.expiresAt) > Date.now());
    const expected = invitation && await this.secrets.get<string>(`team.invitation.${invitationId}`);
    if (!invitation || !proof || expected !== digest(proof)) throw new Error("Invitation is invalid, expired or already used.");
    const member = this.store.state.members.find((m) => m.id === invitation.memberId && m.status === "invited");
    if (!member) throw new Error("Invitation is no longer active.");
    await this.secrets.set(`team.password.${member.id}`, await passwordHash(password));
    await this.store.change((state) => {
      const current = state.invitations.find((i) => i.id === invitationId)!;
      if (current.acceptedAt || Date.parse(current.expiresAt) <= Date.now()) throw new Error("Invitation was already accepted or expired.");
      current.acceptedAt = now(); state.members.find((m) => m.id === member.id)!.status = "active";
      log(state, "Teammate joined", member.name, "team"); state.activity[0].actorId = member.id;
    });
    await this.secrets.set(`team.invitation.${invitationId}`, undefined);
    } finally { this.accepting.delete(invitationId); }
  }
  async changePassword(memberId: string, previous: string, next: string) {
    if (!await matches(previous, await this.secrets.get<PasswordRecord>(`team.password.${memberId}`))) throw new Error("Your current password is incorrect.");
    await this.secrets.set(`team.password.${memberId}`, await passwordHash(next));
    for (const [key, session] of this.sessions) if (session.memberId === memberId) this.sessions.delete(key);
  }
  async update(memberId: string, input: {role: TeamRole; status: "active" | "disabled"}, actor: {id:string; role:TeamRole}) {
    await this.store.change((state) => {
      const member = state.members.find((m) => m.id === memberId);
      if (!member || member.status === "invited") throw new Error("Only existing joined members can be updated.");
      if ((member.role === "owner" || input.role === "owner" || member.role === "admin" || input.role === "admin") && actor.role !== "owner") throw new Error("Only an owner can change owner/admin membership.");
      if (member.role === "owner" && (input.role !== "owner" || input.status !== "active") &&
          !state.members.some((m) => m.id !== member.id && m.role === "owner" && m.status === "active")) throw new Error("The last active owner cannot be removed.");
      Object.assign(member, input);
      log(state, "Member access updated", `${member.name} · ${member.role} · ${member.status}`, "team"); state.activity[0].actorId = actor.id;
    });
    for (const [key, session] of this.sessions) if (session.memberId === memberId) this.sessions.delete(key);
  }
}
