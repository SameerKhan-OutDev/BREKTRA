import { test } from "node:test";
import assert from "node:assert/strict";
import { TeamAuth } from "../server/team.ts";
import { Store } from "../server/store.ts";
import { emptyState } from "../server/domain.ts";
import { validateState } from "../server/schema.ts";
import type { Secrets } from "../server/private-store.ts";

test("first owner requires loopback; registration cannot claim a role; deleted sessions stop authorizing", async () => {
  const values = new Map<string,unknown>();
  const secrets:Secrets = {get:async <T>(key:string)=>values.get(key) as T|undefined,set:async(key,value)=>{values.set(key,value);}};
  const store = new Store(emptyState()), auth = new TeamAuth(store,secrets,false,true);
  await auth.bootstrap("","");
  await assert.rejects(auth.register("Remote attacker","remote@example.invalid","Password-For-Testing",false),/first administrator/);
  assert.equal(store.state.members.length,0);
  assert.equal(await auth.register("Owner","owner@example.invalid","Password-For-Testing",true),true);
  assert.equal(await auth.register("Teammate","teammate@example.invalid","Password-For-Testing",false),false);
  assert.equal(store.state.members[1].status,"disabled");
  await assert.rejects(auth.login("teammate@example.invalid","Password-For-Testing","test"),/incorrect/);
  validateState(store.state);
  for(let i=0;i<8;i++) auth.limitRegistration("test");
  assert.throws(()=>auth.limitRegistration("test"),/Too many/);
});


test("local registrations, approvals, invitations and revocations survive restart; sessions do not", async () => {
  const { PrivateStore } = await import("../server/private-store.ts");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomBytes } = await import("node:crypto");
  const directory = await mkdtemp(join(tmpdir(), "brektra-identities-")), key = randomBytes(32).toString("base64");
  const start = async () => {
    const store = new Store(emptyState());
    const auth = new TeamAuth(store, new PrivateStore(directory, key), false, true);
    await auth.bootstrap("", "");
    return { store, auth };
  };
  try {
    let { store, auth } = await start();
    await auth.register("Owner", "owner@example.invalid", "Owner-Test-Password", true, "Owner.Name");
    const owner = store.state.members[0], actor = { id: owner.id, role: owner.role };
    await auth.register("Pending", "pending@example.invalid", "Pending-Test-Password", false);
    const pending = store.state.members[1];
    const invitation = await auth.invite("invite@example.invalid", "Invited", "operator", owner.id);
    const token = await auth.login(owner.email, "Owner-Test-Password", "local");
    ({ store, auth } = await start());
    assert.equal(store.state.members[0].id, owner.id);
    assert.equal(store.state.members[0].username, "owner.name");
    await auth.login(" OWNER.NAME ", "Owner-Test-Password", "username");
    assert.equal(auth.activeAuthorization(token, owner.id), false);
    await auth.login(owner.email, "Owner-Test-Password", "local");
    await assert.rejects(auth.register("Duplicate", owner.email, "Owner-Test-Password", true), /already registered/);
    await assert.rejects(auth.login(pending.email, "Pending-Test-Password", "local"), /incorrect/);
    await auth.update(pending.id, {role:"reviewer",status:"active"}, actor);
    await auth.accept(invitation, "Invited-Test-Password");
    ({ store, auth } = await start());
    await auth.login(pending.email, "Pending-Test-Password", "local");
    await auth.login("invite@example.invalid", "Invited-Test-Password", "local");
    assert.equal(store.state.members.find(m => m.id === pending.id)?.role, "reviewer");
    await auth.remove(pending.id, actor);
    ({ store, auth } = await start());
    await assert.rejects(auth.login(pending.email, "Pending-Test-Password", "local"), /incorrect/);
    assert.ok(store.state.members.find(m => m.id === pending.id)?.deletedAt);
    assert.equal(store.state.teamMessages.length, 0);
  } finally { await rm(directory, {recursive:true,force:true}); }
});

test("local identity writes fail before publishing registration; corrupt storage fails closed; Sheets wins", async () => {
  const values = new Map<string, unknown>();
  let fail = false;
  const secrets: Secrets = {get:async <T>(key:string)=>structuredClone(values.get(key)) as T|undefined,
    set:async(key,value)=>{if(fail && key === "team.local-identities") throw new Error("disk unavailable"); values.set(key,structuredClone(value));}};
  const store = new Store(emptyState()), auth = new TeamAuth(store,secrets,false,true);
  await auth.bootstrap("", ""); fail = true;
  await assert.rejects(auth.register("Owner", "owner@example.invalid", "Owner-Test-Password", true), /disk unavailable/);
  assert.equal(store.state.members.length, 0);
  fail = false;
  values.set("team.local-identities", {version:99});
  await assert.rejects(new TeamAuth(new Store(emptyState()), secrets,false,true).bootstrap("", ""));
  const real = new Store(emptyState());
  real.state.members = [{id:"real-owner", name:"Real", email:"real@example.invalid", role:"owner", status:"active", createdAt:new Date().toISOString()}];
  real.sheets = {} as any;
  await new TeamAuth(real,secrets,false,true).bootstrap("", "");
  assert.equal(real.state.members[0].id, "real-owner");
});


test("usernames validate, remain unique and reserved, and respect approval and password checks", async () => {
  const values = new Map<string, unknown>();
  const secrets: Secrets = {get:async <T>(key:string)=>structuredClone(values.get(key)) as T|undefined,
    set:async(key,value)=>{values.set(key,structuredClone(value));}};
  const store = new Store(emptyState()), auth = new TeamAuth(store, secrets, false, true);
  await auth.bootstrap("", "");
  for (const invalid of ["ab", "@owner", "has space", "a@b.com", "_owner", "a".repeat(31)])
    await assert.rejects(auth.register("Owner", "owner@example.invalid", "Owner-Test-Password", true, invalid));
  await auth.register("Owner", "owner@example.invalid", "Owner-Test-Password", true, " Owner.Name ");
  const owner = store.state.members[0], actor = {id:owner.id, role:owner.role};
  await auth.login("OWNER.NAME", "Owner-Test-Password", "local");
  await auth.login(" OWNER@EXAMPLE.INVALID ", "Owner-Test-Password", "local");
  await assert.rejects(auth.register("Collision", "collision@example.invalid", "Owner-Test-Password", true, "OWNER.NAME"), /already taken/);
  await auth.register("Pending", "pending@example.invalid", "Pending-Test-Password", false, "pending_user");
  const pending = store.state.members[1];
  await assert.rejects(auth.login("pending_user", "Pending-Test-Password", "local"), /incorrect/);
  await assert.rejects(auth.changeUsername(owner.id, "new-owner", "wrong"), /current password/);
  await assert.rejects(auth.changeUsername(owner.id, "pending_user", "Owner-Test-Password"), /already taken/);
  await auth.changeUsername(owner.id, "new-owner", "Owner-Test-Password");
  await assert.rejects(auth.login("owner.name", "Owner-Test-Password", "local"), /incorrect/);
  await auth.login("new-owner", "Owner-Test-Password", "local");
  await auth.login(owner.email, "Owner-Test-Password", "local");
  const invite = await auth.invite("invited@example.invalid", "Invited", "viewer", owner.id);
  await assert.rejects(auth.accept(invite, "Invited-Test-Password", "NEW-OWNER"), /already taken/);
  await auth.accept(invite, "Invited-Test-Password", "invited.user");
  await auth.login("invited.user", "Invited-Test-Password", "local");
  await auth.update(pending.id, {role:"viewer",status:"active"}, actor);
  await auth.login("pending_user", "Pending-Test-Password", "local");
  await auth.remove(pending.id, actor);
  await assert.rejects(auth.login("pending_user", "Pending-Test-Password", "local"), /incorrect/);
  await assert.rejects(auth.changeUsername(owner.id, "pending_user", "Owner-Test-Password"), /already taken/);
  // Alternating email and username cannot double the per-account guessing budget.
  for (let i = 0; i < 8; i++) await assert.rejects(auth.login(i % 2 ? "new-owner" : owner.email, "wrong", "limited"), /incorrect/);
  await assert.rejects(auth.login("new-owner", "Owner-Test-Password", "limited"), /Too many/);
  validateState(store.state);
  const corrupt = structuredClone(store.state); corrupt.members[1].username = "NEW-OWNER";
  assert.throws(() => validateState(corrupt), /duplicate team usernames/);
});
