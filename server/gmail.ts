import { createHash, randomBytes } from "node:crypto";
import type { Mailbox, OutreachAction } from "../shared/outreach.ts";
import type { Secrets } from "./private-store.ts";

export interface GmailConfig { clientId: string; clientSecret: string }
interface Tokens { refreshToken: string; accessToken: string; expiresAt: number }
export interface MailMessage {
  id: string; threadId: string; from: string; to: string; subject: string;
  body: string; at: string; messageId: string; inReplyTo: string; sent: boolean;
}
export interface MailProvider {
  send(mailbox: Mailbox, action: OutreachAction, replyTo?: string, confirm?: () => Promise<void>): Promise<{ id: string; threadId: string }>;
  messages(mailbox: Mailbox, emails: string[], threadIds: string[]): Promise<MailMessage[]>;
  findSent(mailbox: Mailbox, messageId: string): Promise<MailMessage[]>;
}
export class RejectedSend extends Error {}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const headerAddress = (value: string) => normalizeEmail(value.match(/<([^<>]+)>/)?.[1] || value);
const scopes = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];
export function rawMessage(mailbox: Mailbox, action: OutreachAction, replyTo?: string) {
  for (const header of [mailbox.email, action.recipient, action.subject, action.messageId, replyTo || ""])
    if (/[\r\n]/.test(header)) throw new RejectedSend("Email headers contain an invalid line break.");
  const headers = [`From: ${mailbox.email}`, `To: ${action.recipient}`,
    `Subject: =?UTF-8?B?${Buffer.from(action.subject).toString("base64")}?=`,
    `Message-ID: ${action.messageId}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64"];
  if (replyTo) headers.push(`In-Reply-To: ${replyTo}`, `References: ${replyTo}`);
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${Buffer.from(action.body).toString("base64").match(/.{1,76}/g)?.join("\r\n") || ""}\r\n`).toString("base64url");
}
function messageText(payload: any): string {
  if (payload?.filename) return ""; // Do not ingest attachment bodies as conversation text.
  if (payload?.mimeType === "text/plain" && payload.body?.data) return Buffer.from(payload.body.data, "base64url").toString("utf8");
  return (payload?.parts || []).map(messageText).filter(Boolean).join("\n");
}
export function decodeHeader(value: string): string {
  return value.replace(/\?=\s+(?==\?)/g, "?=").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_all, charset: string, encoding: string, content: string) => {
    try {
      const bytes = encoding.toLowerCase() === "b" ? Buffer.from(content, "base64")
        : Buffer.from(content.replace(/_/g, " ").replace(/=([a-f0-9]{2})/gi, (_:string, hex:string) => String.fromCharCode(parseInt(hex,16))), "latin1");
      return new TextDecoder(charset).decode(bytes);
    } catch { return "[Unsupported header encoding]"; }
  });
}
export function decodeMessage(message: any): MailMessage {
  const headers = message.payload?.headers || [];
  const get = (name: string) => decodeHeader(String(headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""));
  return { id: String(message.id), threadId: String(message.threadId), from: headerAddress(get("from")),
    to: headerAddress(get("to")), subject: get("subject").replace(/[\r\n]/g, " ").slice(0, 200),
    body: (messageText(message.payload) || "[Plain-text content unavailable; open Gmail to view this message.]").slice(0, 16000),
    at: new Date(Number(message.internalDate)).toISOString(), messageId: get("message-id"),
    inReplyTo: get("in-reply-to"), sent: (message.labelIds || []).includes("SENT") };
}
export class Gmail implements MailProvider {
  private refreshing = new Map<string, Promise<string>>();
  readonly pending = new Map<string, { verifier: string; actorId: string; expires: number }>();
  constructor(private secrets: Secrets, readonly origin: string, private http: typeof fetch = fetch) {}
  get redirectUri() { return `${this.origin}/api/gmail/callback`; }
  async configured() { return !!(await this.secrets.get<GmailConfig>("gmail.config")); }
  async authorize(actorId: string) {
    const config = await this.secrets.get<GmailConfig>("gmail.config");
    if (!config) throw new Error("Configure the Google OAuth client in Settings first.");
    for (const [key, value] of this.pending) if (value.expires < Date.now()) this.pending.delete(key);
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
    this.pending.set(state, { verifier, actorId, expires: Date.now() + 600000 });
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: this.redirectUri,
      response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent", state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, state };
  }
  async finish(code: string, state: string, cookieState: string) {
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending || pending.expires < Date.now() || cookieState !== state) throw new Error("Google sign-in expired or its state did not match. Start again from Settings.");
    const config = await this.secrets.get<GmailConfig>("gmail.config");
    if (!config) throw new Error("Google OAuth configuration is missing.");
    const token = await this.tokenRequest({ client_id: config.clientId, client_secret: config.clientSecret,
      code, code_verifier: pending.verifier, redirect_uri: this.redirectUri, grant_type: "authorization_code" });
    if (!token.refresh_token || !scopes.every((scope) => String(token.scope || "").split(" ").includes(scope)))
      throw new Error("Google did not grant both reading/sending access and offline refresh. Reconnect and allow the requested scopes.");
    const response = await this.http("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Unable to confirm the signed-in Gmail address.");
    const profile = await response.json() as { emailAddress?: string };
    if (!profile.emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.emailAddress)) throw new Error("Google returned no valid mailbox identity.");
    const email = normalizeEmail(profile.emailAddress), mailboxId = `gmail_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
    await this.secrets.set(`gmail.tokens.${mailboxId}`, { refreshToken: token.refresh_token,
      accessToken: token.access_token, expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000 });
    return { mailboxId, email, actorId: pending.actorId };
  }
  private async tokenRequest(body: Record<string, string>): Promise<any> {
    const response = await this.http("https://oauth2.googleapis.com/token", { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Google authorization expired or was rejected. Reconnect Gmail in Settings.");
    const data = await response.json() as any;
    if (!data.access_token) throw new Error("Google returned no access token. Reconnect Gmail.");
    return data;
  }
  private async accessToken(mailbox: Mailbox): Promise<string> {
    const current = this.refreshing.get(mailbox.id);
    if (current) return current;
    const operation = (async () => {
      const tokens = await this.secrets.get<Tokens>(`gmail.tokens.${mailbox.id}`);
      if (!tokens) throw new Error("Gmail needs sign-in. Reconnect in Settings.");
      if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
      const config = await this.secrets.get<GmailConfig>("gmail.config");
      if (!config) throw new Error("Google OAuth configuration is missing.");
      const next = await this.tokenRequest({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: tokens.refreshToken, grant_type: "refresh_token" });
      await this.secrets.set(`gmail.tokens.${mailbox.id}`, { ...tokens, accessToken: next.access_token,
        refreshToken: next.refresh_token || tokens.refreshToken, expiresAt: Date.now() + Number(next.expires_in || 3600) * 1000 });
      return String(next.access_token);
    })();
    this.refreshing.set(mailbox.id, operation);
    try { return await operation; } finally { this.refreshing.delete(mailbox.id); }
  }
  private async request(mailbox: Mailbox, path: string, body?: object, confirm?: () => Promise<void>): Promise<any> {
    let token: string;
    try { token = await this.accessToken(mailbox); }
    catch (error) {
      if (body) throw new RejectedSend("Gmail was not contacted for this send because authorization/private storage failed. Reconnect Gmail, then review this message again.");
      throw error;
    }
    if (confirm) await confirm();
    const response = await this.http(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if (body && response.status >= 400 && response.status < 500 && response.status !== 408)
        throw new RejectedSend(`Gmail rejected this send (${response.status}); nothing is automatically retried. Check the connection and review again.`);
      throw new Error(`Gmail could not confirm the operation (${response.status}). Reconnect/check Gmail; sending is paused.`);
    }
    return response.json();
  }
  async send(mailbox: Mailbox, action: OutreachAction, replyTo?: string, confirm?: () => Promise<void>) {
    const result = await this.request(mailbox, "messages/send", { raw: rawMessage(mailbox, action, replyTo),
      ...(action.providerThreadId ? { threadId: action.providerThreadId } : {}) }, confirm);
    if (!result.id || !result.threadId) throw new Error("Gmail returned no message/thread confirmation. Inspect Gmail before resolving this attempt.");
    return { id: String(result.id), threadId: String(result.threadId) };
  }
  async messages(mailbox: Mailbox, emails: string[], threadIds: string[]): Promise<MailMessage[]> {
    const ids = new Set(threadIds);
    // Search the full matching inbox (bounded); no history cursor can skip an old reply.
    // Only explicitly known contacts/tracked threads are ever fetched or stored.
    const unique = [...new Set(emails.map(normalizeEmail))];
    if (unique.length > 100) throw new Error("The initial Gmail adapter supports 100 tracked contacts per mailbox. Narrow this workspace before sending.");
    for (let i = 0; i < unique.length; i += 25) {
      const query = `-in:spam -in:trash {${unique.slice(i, i + 25).map((email) => `from:${email}`).join(" ")}}`;
      let page = "", pages = 0;
      do {
        const list = await this.request(mailbox, `messages?${new URLSearchParams({ q: query, maxResults: "100", ...(page ? { pageToken: page } : {}) })}`);
        for (const message of list.messages || []) ids.add(String(message.threadId));
        page = list.nextPageToken || "";
        if (++pages >= 5 && page) throw new Error("Mailbox sync exceeds the current 500-message batch limit. Narrow the workspace contacts before sending follow-ups.");
      } while (page);
    }
    if (ids.size > 100) throw new Error("This mailbox has more than 100 tracked conversations. Sending waits for a complete sync; archive or split the workspace.");
    const result: MailMessage[] = [];
    for (const threadId of ids) {
      const thread = await this.request(mailbox, `threads/${encodeURIComponent(threadId)}?format=full`);
      for (const message of thread.messages || []) result.push(decodeMessage(message));
    }
    return result;
  }
  async findSent(mailbox: Mailbox, messageId: string): Promise<MailMessage[]> {
    const result = await this.request(mailbox, `messages?${new URLSearchParams({ q: `in:sent rfc822msgid:${messageId.replace(/[<>]/g, "")}`, maxResults: "10" })}`);
    const messages: MailMessage[] = [];
    for (const row of result.messages || []) messages.push(decodeMessage(await this.request(mailbox, `messages/${encodeURIComponent(row.id)}?format=full`)));
    return messages.filter((message) => message.sent && message.messageId === messageId);
  }
}
