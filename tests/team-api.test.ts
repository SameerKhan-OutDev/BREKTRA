import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

test("authenticated workspace protects API data and enforces team roles/invitations across browser sessions",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"brektra-team-api-"));assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
  const port=14319;
  const child=spawn(process.execPath,["--import",import.meta.resolve("tsx"),resolve("server/index.ts"),"--production"],{
    cwd:directory,windowsHide:true,stdio:"pipe",env:{...process.env,PORT:String(port),STORAGE_MODE:"demo",BREKTRA_HOSTED:"0",BREKTRA_AUTH:"1",BREKTRA_SECRET_KEY:randomBytes(32).toString("base64"),BREKTRA_OWNER_EMAIL:"owner@example.invalid",BREKTRA_OWNER_PASSWORD:"Owner-Test-Password-Only",OLLAMA_URL:"http://127.0.0.1:1"}});
  let output="";child.stdout.on("data",(b)=>{output+=b;});child.stderr.on("data",(b)=>{output+=b;});
  const request=async(path:string,method="GET",body?:unknown,cookie="")=>{
    const response=await fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,body:await response.json() as any,cookie:response.headers.getSetCookie().map((v)=>v.split(";")[0]).join("; ")};
  };
  try {
    let ready=false;for(let i=0;i<150;i++){try{if((await request("/health")).status===200){ready=true;break;}}catch{}if(child.exitCode!==null)break;await delay(100);}
    assert.ok(ready,output||"Team API did not start");
    assert.equal((await request("/workspace")).status,401);assert.equal((await request("/jobs")).status,401);
    assert.equal((await request("/auth/login","POST",{email:"owner@example.invalid",password:"wrong"})).status,401);
    const owner=await request("/auth/login","POST",{email:"owner@example.invalid",password:"Owner-Test-Password-Only"});assert.equal(owner.status,200);assert.ok(owner.cookie);
    const workspace=await request("/workspace","GET",undefined,owner.cookie);assert.equal(workspace.status,200);assert.equal(workspace.body.auth.user.role,"owner");
    assert.ok(!JSON.stringify(workspace.body).includes("Owner-Test-Password-Only"));
    const ownerId=workspace.body.auth.user.id;
    assert.equal((await request(`/team/members/${ownerId}`,"PATCH",{role:"viewer",status:"active"},owner.cookie)).status,400);
    const invite=await request("/team/invitations","POST",{name:"Viewer",email:"viewer@example.invalid",role:"viewer"},owner.cookie);assert.equal(invite.status,201);
    const token=new URL(invite.body.url).hash.slice(6);
    assert.equal((await request("/auth/accept","POST",{token,password:"Viewer-Test-Password"})).status,200);
    assert.equal((await request("/auth/accept","POST",{token,password:"Other-Test-Password"})).status,400);
    const viewer=await request("/auth/login","POST",{email:"viewer@example.invalid",password:"Viewer-Test-Password"});assert.equal(viewer.status,200);
    const viewed=await request("/workspace","GET",undefined,viewer.cookie);assert.equal(viewed.status,200);
    assert.equal((await request("/setup","GET",undefined,viewer.cookie)).status,403);
    assert.equal((await request("/setup/ollama/start","POST",{},viewer.cookie)).status,403);
    const ownerSetup=await request("/setup","GET",undefined,owner.cookie);assert.equal(ownerSetup.status,200);assert.equal(ownerSetup.body.local,false);
    assert.equal((await request("/accounts","POST",{name:"Forbidden",dailyBudget:10},viewer.cookie)).status,403);
    assert.equal((await request("/gmail/config","GET",undefined,viewer.cookie)).status,403);
    assert.equal((await request("/leads/anything/enrich","POST",{website:"https://example.com"},viewer.cookie)).status,403);
    assert.equal((await request("/drafts/demo-draft","PUT",{text:"Cannot approve this text",status:"approved"},viewer.cookie)).status,403);
    assert.equal((await request("/team/invitations","POST",{name:"Other",email:"other@example.invalid",role:"admin"},viewer.cookie)).status,403);
    const viewerId=viewed.body.auth.user.id;
    assert.equal((await request(`/team/members/${viewerId}`,"PATCH",{role:"operator",status:"active"},owner.cookie)).status,200);
    assert.equal((await request("/workspace","GET",undefined,viewer.cookie)).status,401); // Existing sessions are revoked.
    const operator=await request("/auth/login","POST",{email:"viewer@example.invalid",password:"Viewer-Test-Password"});assert.equal(operator.status,200);
    assert.equal((await request("/accounts","POST",{name:"Still forbidden",dailyBudget:10},operator.cookie)).status,403);
    const leadId=workspace.body.state.leads[0].id;
    assert.equal((await request(`/leads/${leadId}`,"PATCH",{email:"updated@example.invalid"},operator.cookie)).status,200);
    assert.equal((await request("/team/password","POST",{current:"Viewer-Test-Password",next:"Updated-Viewer-Password"},operator.cookie)).status,200);
    assert.equal((await request("/workspace","GET",undefined,operator.cookie)).status,401);
    assert.equal((await request("/auth/login","POST",{email:"viewer@example.invalid",password:"Viewer-Test-Password"})).status,401);
    assert.equal((await request("/auth/login","POST",{email:"viewer@example.invalid",password:"Updated-Viewer-Password"})).status,200);
    const after=await request("/workspace","GET",undefined,owner.cookie);assert.ok(after.body.state.activity.some((a:any)=>a.actorId===viewerId));
    const reviewerInvite=await request("/team/invitations","POST",{name:"Reviewer",email:"reviewer@example.invalid",role:"reviewer"},owner.cookie);
    assert.equal(reviewerInvite.status,201);
    const reviewerToken=new URL(reviewerInvite.body.url).hash.slice(6);
    await request("/auth/accept","POST",{token:reviewerToken,password:"Reviewer-Test-Password"});
    const reviewer=await request("/auth/login","POST",{email:"reviewer@example.invalid",password:"Reviewer-Test-Password"});assert.equal(reviewer.status,200);
    assert.equal((await request(`/leads/${leadId}/approval`,"PATCH",{decision:"approved"},reviewer.cookie)).status,200);
    assert.equal((await request(`/leads/${leadId}`,"PATCH",{email:"not-permitted@example.invalid"},reviewer.cookie)).status,403);
    assert.equal((await request("/drafts/demo-draft","PUT",{text:"A revised draft for the team to review.",status:"pending",expectedRevision:1},reviewer.cookie)).status,200);
    assert.equal((await request("/drafts/demo-draft","PUT",{text:"A stale version cannot overwrite the latest.",status:"approved",expectedRevision:1},reviewer.cookie)).status,400);
    // Company preparation is an explicit admin operation; it does not grant
    // company isolation or change the existing workspace-role policy.
    assert.equal((await request("/settings/company-migration","GET",undefined,reviewer.cookie)).status,403);
    assert.equal((await request("/settings/company-migration","POST",{name:"Forbidden",fingerprint:"0".repeat(64),backupConfirmed:true},reviewer.cookie)).status,403);
    const preview=await request("/settings/company-migration","GET",undefined,owner.cookie);
    assert.equal(preview.status,200); assert.equal(preview.body.blockers.length,0);
    assert.equal((await request("/settings/company-migration","POST",{name:"Original company",fingerprint:preview.body.fingerprint,backupConfirmed:false},owner.cookie)).status,400);
    assert.equal((await request(`/leads/${leadId}`,"PATCH",{notes:"A change after migration preview"},owner.cookie)).status,200);
    assert.equal((await request("/settings/company-migration","POST",{name:"Original company",fingerprint:preview.body.fingerprint,backupConfirmed:true},owner.cookie)).status,400);
    const fresh=await request("/settings/company-migration","GET",undefined,owner.cookie);
    assert.equal((await request("/settings/company-migration","POST",{name:"Original company",fingerprint:fresh.body.fingerprint,backupConfirmed:true},owner.cookie)).status,200);
    const migrated=(await request("/workspace","GET",undefined,owner.cookie)).body;
    assert.equal(migrated.state.companies.length,1); assert.equal(migrated.state.companies[0].name,"Original company");
    assert.ok(migrated.state.leads.every((l:any)=>l.companyId===migrated.state.companies[0].id));
    assert.ok(migrated.state.mailboxes.every((m:any)=>!m.sendingEnabled));
    assert.ok(migrated.state.campaigns.every((c:any)=>c.status!=="running"));
    assert.ok(migrated.state.activity.some((e:any)=>e.kind==="company"&&e.actorId===ownerId&&e.companyId===migrated.state.companies[0].id));
    assert.equal((await request("/settings/company-migration","POST",{name:"Second company",fingerprint:fresh.body.fingerprint,backupConfirmed:true},owner.cookie)).status,400);
    const postMigrationInvite=await request("/team/invitations","POST",{name:"New teammate",email:"new@example.invalid",role:"reviewer"},owner.cookie);
    assert.equal(postMigrationInvite.status,201);
    const invited=(await request("/workspace","GET",undefined,owner.cookie)).body;
    const member=invited.state.members.find((m:any)=>m.email==="new@example.invalid");
    assert.ok(invited.state.companyMemberships.some((m:any)=>m.memberId===member.id&&m.role==="reviewer"&&m.status==="invited"));
  } finally {
    child.kill();await new Promise<void>((r)=>{if(child.exitCode!==null)r();else child.once("exit",()=>r());});
    await rm(directory,{recursive:true,force:true});
  }
});
