import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { Secrets } from "./private-store.ts";

export interface LinkedInConfig { clientId: string; clientSecret: string; revision: string }
export interface LinkedInPending { actorId: string; grant: string; epoch: number; companyId?: string; accountId?: string; expectedConnection?: string; nonce: string; revision: string; expires: number }
export class LinkedInAuth {
  private pending = new Map<string, LinkedInPending>();
  constructor(readonly secrets: Secrets, readonly origin: string, private http: typeof fetch = fetch) {}
  get redirectUri() { return `${this.origin}/api/linkedin/callback`; }
  async configured() { return !!await this.secrets.get<LinkedInConfig>("linkedin.config"); }
  async configure(clientId: string, clientSecret: string) {
    await this.secrets.set("linkedin.config", { clientId, clientSecret, revision: randomBytes(16).toString("hex") });
    this.pending.clear();
  }
  async authorize(input: Omit<LinkedInPending, "nonce" | "revision" | "expires">) {
    const config = await this.secrets.get<LinkedInConfig>("linkedin.config");
    if (!config) throw new Error("Ask your administrator to configure LinkedIn in Settings.");
    for (const [key, value] of this.pending) if (value.expires < Date.now()) this.pending.delete(key);
    if (this.pending.size >= 100) throw new Error("Too many pending connections. Wait ten minutes and retry.");
    const state = randomBytes(32).toString("base64url"), nonce = randomBytes(32).toString("base64url");
    this.pending.set(state, { ...input, nonce, revision: config.revision, expires: Date.now() + 600000 });
    return { state, url: `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: this.redirectUri, scope: "openid profile", state, nonce })}` };
  }
  async finish(code: string, state: string, cookie: string) {
    const pending = this.pending.get(state); this.pending.delete(state);
    if (!pending || cookie !== state || pending.expires <= Date.now()) throw new Error("LinkedIn sign-in expired. Start again from Settings.");
    if (!code) throw new Error("LinkedIn authorization was canceled.");
    const config = await this.secrets.get<LinkedInConfig>("linkedin.config");
    if (!config || config.revision !== pending.revision) throw new Error("LinkedIn setup changed. Connect again.");
    const token = await this.json("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri, client_id: config.clientId, client_secret: config.clientSecret }) });
    if (typeof token.access_token !== "string" || typeof token.id_token !== "string" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("LinkedIn did not return a complete sign-in response.");
    const parts = token.id_token.split(".");
    if (parts.length !== 3) throw new Error("Invalid LinkedIn identity token.");
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString()), claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid LinkedIn token signature algorithm.");
    const jwks = await this.json("https://www.linkedin.com/oauth/openid/jwks");
    const key = jwks.keys?.find((k: any) => k.kid === header.kid && k.kty === "RSA" && (!k.use || k.use === "sig"));
    if (!key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"))) throw new Error("LinkedIn token signature could not be verified.");
    const seconds = Date.now() / 1000;
    if (claims.iss !== "https://www.linkedin.com" || claims.aud !== config.clientId || claims.nonce !== pending.nonce || typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number" || claims.exp <= seconds || typeof claims.iat !== "number" || claims.iat > seconds + 60) throw new Error("LinkedIn identity claims did not match this sign-in.");
    const profile = await this.profile(token.access_token);
    if (profile.sub !== claims.sub) throw new Error("LinkedIn profile did not match its identity token.");
    return { pending, subject: createHash("sha256").update(`${config.clientId}:${claims.sub}`).digest("hex"), name: profile.name, accessToken: token.access_token as string, expiresAt: new Date(Date.now() + Math.min(token.expires_in, 31536000) * 1000).toISOString() };
  }
  async profile(token: string) {
    const p = await this.json("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } });
    if (typeof p.sub !== "string" || typeof p.name !== "string" || !p.name.trim()) throw new Error("LinkedIn returned no account name.");
    return { sub: p.sub as string, name: (p.name as string).trim().slice(0, 100) };
  }
  private async json(url: string, init: RequestInit = {}): Promise<any> {
    const response = await this.http(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("LinkedIn could not complete this check. Reconnect from Settings or ask your administrator to check app access.");
    return response.json();
  }
}
