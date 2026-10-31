import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import express from "express";
import { LinkedInAuth } from "../server/linkedin-auth.ts";
import { linkedInApi, linkedInCallback, checkLinkedInAccount } from "../server/linkedin-api.ts";
import { TeamAuth, passwordHash } from "../server/team.ts";
import { Store } from "../server/store.ts";
import { demoState } from "../server/seed.ts";
import { validateState } from "../server/schema.ts";
import type { Secrets } from "../server/private-store.ts";
import type { Sheets } from "../server/sheets.ts";

class MemorySecrets implements Secrets {
  values = new Map<string, unknown>();
  async get<T>(key: string) { return structuredClone(this.values.get(key)) as T | undefined; }
  async set(key: string, value: unknown) { if (value === undefined) this.values.delete(key); else this.values.set(key, structuredClone(value)); }
}
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig" };
function harness(secrets = new MemorySecrets()) {
  let nonce = "", subject = "member-one", mode = "ok";
  const http = (async (url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith("/jwks")) return Response.json({ keys: [jwk] });
    if (path.endsWith("/userinfo")) return Response.json({ sub: mode === "profile-mismatch" ? "other" : subject, name: "Test Teammate" });
    assert.equal(path, "https://www.linkedin.com/oauth/v2/accessToken");
    const claims = { iss: "https://www.linkedin.com", aud: mode === "audience" ? "wrong" : "client-test", sub: subject,
      nonce: mode === "nonce" ? "wrong" : nonce, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + (mode === "expired" ? -60 : 600) };
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url"), body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const content = `${header}.${body}`, signature = sign("RSA-SHA256", Buffer.from(content), keys.privateKey).toString("base64url");
    return Response.json({ access_token: "PRIVATE_TOKEN", expires_in: 3600, id_token: `${content}.${mode === "signature" ? "wrong" : signature}` });
  }) as typeof fetch;
  const provider = new LinkedInAuth(secrets, "http://127.0.0.1:4310", http);
  return { secrets, provider, flow(url: string) { nonce = new URL(url).searchParams.get("nonce")!; }, mode(value: string) { mode = value; }, subject(value: string) { subject = value; } };
}

test("LinkedIn validates signatures, audience, nonce, expiry and matching userinfo; one-time state never replays", async () => {
  const h = harness(); await h.provider.configure("client-test", "secret-test");
  for (const mode of ["nonce", "audience", "expired", "signature", "profile-mismatch", "ok"]) {
    h.mode(mode); const flow = await h.provider.authorize({ actorId: "actor", grant: "grant", epoch: 0 }); h.flow(flow.url);
    assert.equal(new URL(flow.url).searchParams.get("scope"), "openid profile");
    if (mode === "ok") assert.equal((await h.provider.finish("code", flow.state, flow.state)).name, "Test Teammate");
    else await assert.rejects(h.provider.finish("code", flow.state, flow.state));
    await assert.rejects(h.provider.finish("code", flow.state, flow.state), /expired/);
  }
  const flow = await h.provider.authorize({ actorId: "actor", grant: "grant", epoch: 0 });
  await assert.rejects(h.provider.finish("code", flow.state, "wrong-cookie"), /expired/);
  const canceled = await h.provider.authorize({ actorId: "actor", grant: "grant", epoch: 0 });
  await assert.rejects(h.provider.finish("", canceled.state, canceled.state), /canceled/);
  const stale = await h.provider.authorize({ actorId: "actor", grant: "grant", epoch: 0 });
  await h.provider.configure("client-test", "replacement-secret");
  await assert.rejects(h.provider.finish("code", stale.state, stale.state), /expired/);
});

async function fixture() {
  const h = harness(), state = demoState(); state.accounts[0].status = "not_connected";
  const store = new Store(state, { save: async (s) => { validateState(s); } } as Sheets);
  const auth = new TeamAuth(store, h.secrets, false, true);
  await auth.bootstrap("owner@test.invalid", "test-password-123");
  for (const [id, role] of [["operator", "operator"], ["other", "operator"], ["viewer", "viewer"]] as const) {
    await store.change((s) => { s.members.push({ id, name: id, email: `${id}@test.invalid`, role, status: "active", createdAt: new Date().toISOString() }); });
    await h.secrets.set(`team.password.${id}`, await passwordHash("test-password-123"));
  }
  await h.provider.configure("client-test", "secret-test");
  const app = express(); app.use(express.json());
  app.get("/api/linkedin/callback", (req, res) => linkedInCallback(store, h.provider, auth, req, res));
  app.use("/api", (req, _res, next) => { try { auth.require(req); next(); } catch(e) { next(e); } });
  app.use("/api", linkedInApi(store, h.provider, auth));
  app.use((e: any, _req: any, res: any, _next: any) => res.status(e.status || 400).json({ error: e.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const tokens: Record<string, string> = {};
  for (const who of ["owner", "operator", "other", "viewer"]) tokens[who] = await auth.login(`${who}@test.invalid`, "test-password-123", "test");
  const request = (path: string, who = "operator", body?: object, method = body ? "POST" : "GET") => fetch(base + path, { method, headers: { "Content-Type": "application/json", Cookie: `brektra_session=${tokens[who]}` }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const begin = async (who = "operator", accountId?: string) => {
    const response = await request("/linkedin/connect", who, accountId ? { accountId } : {}); assert.equal(response.status, 200);
    const data = await response.json(); h.flow(data.url);
    return { state: new URL(data.url).searchParams.get("state")!, cookie: response.headers.get("set-cookie")!.split(";")[0] };
  };
  const finish = (flow: {state:string; cookie:string}) => fetch(`${base}/linkedin/callback?code=code&state=${flow.state}`, { headers: { Cookie: flow.cookie }, redirect: "manual" });
  return { ...h, store, auth, tokens, request, begin, finish, close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections(); }) };
}

test("LinkedIn routes isolate owners, preserve account references and never grant outreach; disconnect forgets token and pauses", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/linkedin/connect", "viewer", {})).status, 403);
    assert.equal((await f.request("/linkedin/config", "operator", { clientId: "client-test", clientSecret: "secret-test" }, "PUT")).status, 403);
    assert.equal((await f.request("/linkedin/config")).status, 200);
    const flow = await f.begin(); assert.match((await f.finish(flow)).headers.get("location")!, /linkedin=connected/);
    const account = f.store.state.accounts.find((a) => a.linkedin)!; assert.equal(account.linkedin!.ownerId, "operator");
    assert.equal(account.status, "not_connected"); assert.ok(!JSON.stringify(f.store.state).includes("PRIVATE_TOKEN"));
    assert.match((await f.finish(flow)).headers.get("location")!, /linkedin=failed/);
    const duplicate = await f.begin("other"); assert.match((await f.finish(duplicate)).headers.get("location")!, /linkedin=failed/);
    assert.equal((await f.request(`/linkedin/accounts/${account.id}/disconnect`, "other", {})).status, 400);
    const oldConnection = account.linkedin!.connectionId;
    f.subject("wrong-account"); const wrong = await f.begin("operator", account.id); assert.match((await f.finish(wrong)).headers.get("location")!, /linkedin=failed/);
    assert.equal(f.store.state.accounts.find((a) => a.id === account.id)!.linkedin!.connectionId, oldConnection);
    f.subject("member-one"); const reconnect = await f.begin("operator", account.id); assert.match((await f.finish(reconnect)).headers.get("location")!, /linkedin=connected/);
    assert.equal(await f.secrets.get(`linkedin.tokens.${oldConnection}`), undefined);
    assert.equal((await f.request(`/linkedin/accounts/${account.id}/check`, "operator", {})).status, 200);
    const active = f.store.state.accounts.find((a) => a.id === account.id)!;
    await f.request(`/linkedin/accounts/${account.id}/disconnect`, "operator", {});
    assert.equal(f.store.state.accounts.find((a) => a.id === account.id)!.linkedin!.status, "disconnected");
    assert.equal(await f.secrets.get(`linkedin.tokens.${active.linkedin!.connectionId}`), undefined);
    assert.equal(f.store.state.accounts.filter((a) => a.linkedin).length, 1);
  } finally { await f.close(); }
});

test("LinkedIn callbacks reject workspace/session/membership changes, storage failure and demo connection", async () => {
  const f = await fixture();
  try {
    let flow = await f.begin(); f.store.workspaceEpoch++; assert.match((await f.finish(flow)).headers.get("location")!, /failed/);
    flow = await f.begin(); f.store.state.members.find((m) => m.id === "operator")!.status = "disabled"; assert.match((await f.finish(flow)).headers.get("location")!, /failed/);
    f.store.state.members.find((m) => m.id === "operator")!.status = "active";
    flow = await f.begin(); await f.auth.changePassword("operator", "test-password-123", "replacement-password"); assert.match((await f.finish(flow)).headers.get("location")!, /failed/);
    flow = await f.begin("owner"); f.store.syncError = "save unavailable"; assert.match((await f.finish(flow)).headers.get("location")!, /failed/); f.store.syncError = "";
    assert.equal(f.store.state.accounts.filter((a) => a.linkedin).length, 0);
    assert.equal([...f.secrets.values.keys()].filter((k) => k.startsWith("linkedin.tokens")).length, 0);
    f.store.sheets = undefined; assert.equal((await f.request("/linkedin/connect", "owner", {})).status, 400);
  } finally { await f.close(); }
});

test("manual LinkedIn handoff requires current approval, lead eligibility and account owner; never changes send state", async () => {
  const f = await fixture();
  try {
    const flow = await f.begin("owner", f.store.state.accounts[0].id); await f.finish(flow);
    const draft = f.store.state.drafts[0], lead = f.store.state.leads.find((l) => l.id === draft.leadId)!;
    draft.status = "approved"; lead.outreachApproval = "approved";
    const input = { kind: "draft", recordId: draft.id, revision: draft.revision || 1 };
    const before = JSON.stringify(f.store.state);
    const response = await f.request("/linkedin/handoff", "owner", input); assert.equal(response.status, 200); assert.equal((await response.json()).text, draft.text);
    assert.equal(JSON.stringify(f.store.state), before);
    assert.equal((await f.request("/linkedin/handoff", "other", input)).status, 400);
    assert.equal((await f.request("/linkedin/handoff", "owner", { ...input, revision: 999 })).status, 400);
    lead.optedOut = true; assert.equal((await f.request("/linkedin/handoff", "owner", input)).status, 400);
    lead.optedOut = false; lead.repliedAt = new Date().toISOString(); assert.equal((await f.request("/linkedin/handoff", "owner", input)).status, 400);
  } finally { await f.close(); }
});

test("expired or missing LinkedIn credentials pause campaigns after restart without retrying outreach", async () => {
  const f = await fixture();
  try {
    const flow = await f.begin("owner", f.store.state.accounts[0].id); await f.finish(flow);
    const account = f.store.state.accounts[0];
    // A fresh provider retains encrypted-infrastructure references, not pending flows.
    const restarted = harness(f.secrets).provider;
    f.store.state.campaigns[0].status = "running";
    await f.secrets.set(`linkedin.tokens.${account.linkedin!.connectionId}`, { accessToken: "PRIVATE_TOKEN", expiresAt: new Date(0).toISOString() });
    assert.equal(await checkLinkedInAccount(f.store, restarted, account.id), false);
    assert.equal(f.store.state.accounts[0].linkedin!.status, "needs_login");
    assert.equal(f.store.state.campaigns[0].status, "paused");
    const activities = f.store.state.activity.length;
    assert.equal(await checkLinkedInAccount(f.store, restarted, account.id), false);
    assert.equal(f.store.state.activity.length, activities);
    assert.equal(f.store.state.jobs.filter((j) => j.status === "completed" && j.kind !== "draft").length, 0);
  } finally { await f.close(); }
});

test("failed LinkedIn account persistence removes new tokens and leaves existing account references unchanged", async () => {
  const f = await fixture();
  try {
    const flow = await f.begin("owner", f.store.state.accounts[0].id), before = JSON.stringify(f.store.state);
    f.store.sheets!.save = async () => { throw new Error("Sheets unavailable"); };
    assert.match((await f.finish(flow)).headers.get("location")!, /failed/);
    assert.equal(JSON.stringify(f.store.state), before);
    assert.equal([...f.secrets.values.keys()].filter((k) => k.startsWith("linkedin.tokens")).length, 0);
    assert.ok(f.store.syncError);
  } finally { await f.close(); }
});
