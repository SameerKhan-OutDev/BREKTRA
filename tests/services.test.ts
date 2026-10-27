import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PrivateStore, type Secrets } from "../server/private-store.ts";
import { Gmail, rawMessage, decodeMessage, decodeHeader, RejectedSend } from "../server/gmail.ts";
import { extractEvidence, enrichCompany, publicIPv4, checkedUrl } from "../server/enrichment.ts";
import { demoState } from "../server/seed.ts";
import { stableMessageId } from "../server/outreach.ts";
import type { OutreachAction } from "../shared/outreach.ts";

class MemorySecrets implements Secrets {
  records = new Map<string, unknown>();
  async get<T>(key:string) {return structuredClone(this.records.get(key)) as T|undefined;}
  async set(key:string,value:unknown) {if(value === undefined)this.records.delete(key);else this.records.set(key,structuredClone(value));}
}
function emailAction(): OutreachAction {
  return { id:"action",campaignId:"demo-campaign",leadId:"lead",mailboxId:"mailbox",kind:"email",purpose:"sequence",
    recipient:"recipient@example.invalid",subject:"A question — café",body:"Hi, would a short conversation be useful?",revision:1,
    status:"running",approvedRevision:1,approvedBy:"owner",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    messageId:stableMessageId("action"),detail:"Intent saved" };
}
test("Gmail OAuth binds one-time state and PKCE, checks granted scopes, and keeps tokens private", async () => {
  const secrets=new MemorySecrets();await secrets.set("gmail.config",{clientId:"test-client-id",clientSecret:"test-client-secret"});
  let calls=0,grant="https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";
  const provider=new Gmail(secrets,"http://127.0.0.1:4310",async(input,init)=>{
    calls++;
    if(String(input).includes("oauth2.googleapis.com")) {
      const body=new URLSearchParams(String(init?.body));assert.equal(body.get("redirect_uri"),"http://127.0.0.1:4310/api/gmail/callback");
      assert.ok(body.get("code_verifier"));
      return Response.json({access_token:"test-access",refresh_token:"test-refresh",expires_in:3600,scope:grant});
    }
    return Response.json({emailAddress:"Sender@example.invalid"});
  });
  const first=await provider.authorize("owner");const url=new URL(first.url);
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");assert.equal(url.searchParams.get("access_type"),"offline");
  await assert.rejects(provider.finish("code",first.state,"wrong-cookie"),/state did not match/);assert.equal(calls,0);
  await assert.rejects(provider.finish("code",first.state,first.state),/expired/);
  const second=await provider.authorize("owner");const result=await provider.finish("code",second.state,second.state);
  assert.equal(result.email,"sender@example.invalid");assert.equal(result.actorId,"owner");
  assert.ok(!("accessToken" in result));assert.ok(!("refreshToken" in result));
  assert.equal((await secrets.get<any>(`gmail.tokens.${result.mailboxId}`)).refreshToken,"test-refresh");
  grant="https://www.googleapis.com/auth/gmail.send";
  const third=await provider.authorize("owner");await assert.rejects(provider.finish("code",third.state,third.state),/both reading\/sending/);
});
test("Gmail sends exact MIME text with stable IDs, correct reply headers and last-minute cancellation", async () => {
  const secrets=new MemorySecrets();await secrets.set("gmail.tokens.mailbox",{accessToken:"fake-access",refreshToken:"fake-refresh",expiresAt:Date.now()+3600000});
  let sends=0,raw="";
  const provider=new Gmail(secrets,"http://127.0.0.1:4310",async(_input,init)=>{
    sends++;const body=JSON.parse(String(init?.body));raw=Buffer.from(body.raw,"base64url").toString();assert.equal(body.threadId,"thread");return Response.json({id:"provider-id",threadId:"thread"});
  });
  const action=emailAction(),mailbox={...demoState().mailboxes[0],id:"mailbox",provider:"gmail" as const};action.providerThreadId="thread";
  let confirmations=0;
  await provider.send(mailbox,action,"<parent@example.invalid>",async()=>{confirmations++;});
  assert.equal(sends,1);assert.equal(confirmations,1);assert.match(raw,/In-Reply-To: <parent@example.invalid>/);
  assert.ok(raw.includes(action.messageId));assert.equal(Buffer.from(raw.split("\r\n\r\n")[1].replace(/\s/g,""),"base64").toString(),action.body);
  await assert.rejects(provider.send(mailbox,action,undefined,async()=>{throw new RejectedSend("paused before HTTP send");}),/paused/);assert.equal(sends,1);
  action.subject="subject\r\nBcc: victim@example.invalid";assert.throws(()=>rawMessage(mailbox,action),/invalid line break/);
});
test("Gmail distinguishes rejected submission from an unknown transport result", async () => {
  const secrets=new MemorySecrets();await secrets.set("gmail.tokens.mailbox",{accessToken:"fake",refreshToken:"fake",expiresAt:Date.now()+3600000});
  const mailbox={...demoState().mailboxes[0],id:"mailbox",provider:"gmail" as const};
  await assert.rejects(new Gmail(secrets,"http://localhost",async()=>Response.json({}, {status:403})).send(mailbox,emailAction()),RejectedSend);
  const responseError=await new Gmail(secrets,"http://localhost",async()=>Response.json({}, {status:500})).send(mailbox,emailAction()).catch((e)=>e);
  assert.ok(responseError instanceof Error);assert.ok(!(responseError instanceof RejectedSend));
  let contacted=0;
  const disconnected=new Gmail(new MemorySecrets(),"http://localhost",async()=>{contacted++;return Response.json({});});
  await assert.rejects(disconnected.send(mailbox,emailAction()),RejectedSend);assert.equal(contacted,0);
});
test("Gmail text decoding handles MIME subjects and excludes attached text/HTML", () => {
  const subject="A question — café";assert.equal(decodeHeader(`=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`),subject);
  assert.equal(decodeHeader("=?UTF-8?Q?Hello_world?="),"Hello world");
  const message=decodeMessage({id:"id",threadId:"thread",internalDate:String(Date.now()),labelIds:["SENT"],payload:{mimeType:"multipart/mixed",headers:[{name:"Subject",value:`=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`},{name:"From",value:'Sender <sender@example.invalid>'},{name:"To",value:"recipient@example.invalid"}],parts:[{mimeType:"text/plain",body:{data:Buffer.from("Visible message").toString("base64url")}},{mimeType:"text/plain",filename:"private.txt",body:{data:Buffer.from("Attachment secret").toString("base64url")}},{mimeType:"text/html",body:{data:Buffer.from('<img src="https://tracker.invalid">').toString("base64url")}}]}});
  assert.equal(message.subject,subject);assert.equal(message.body,"Visible message");assert.equal(message.from,"sender@example.invalid");
});
test("Gmail sync follows pages and fails closed instead of treating a partial mailbox as complete", async () => {
  const secrets=new MemorySecrets();await secrets.set("gmail.tokens.mailbox",{accessToken:"fake",refreshToken:"fake",expiresAt:Date.now()+3600000});
  let pages=0;const provider=new Gmail(secrets,"http://localhost",async()=>{pages++;return Response.json({messages:[],nextPageToken:"more"});});
  const mailbox={...demoState().mailboxes[0],id:"mailbox",provider:"gmail" as const};
  await assert.rejects(provider.messages(mailbox,["recipient@example.invalid"],[]),/batch limit/);assert.equal(pages,5);
});
test("enrichment preserves public-source evidence without guessing personal identity or deliverability", async () => {
  const html='<html><head><title>Example &amp; Co</title><meta name="description" content="Workflow software for teams"></head><body><a href="mailto:info@example.invalid">Contact</a><script>let x = \'href="mailto:invented@example.invalid"\'</script></body></html>';
  assert.deepEqual(extractEvidence(html),{title:"Example & Co",summary:"Workflow software for teams",listedEmails:["info@example.invalid"]});
  const record=await enrichCompany("lead","https://example.com","person@example.invalid",async()=>({url:"https://example.com/",html}),async()=>[{priority:10,exchange:"mx.example.invalid"}]);
  assert.equal(record.status,"pending");assert.equal(record.emailDomainStatus,"has_mx");assert.ok(record.checkedAt);assert.equal(record.sourceUrl,"https://example.com/");
  for(const ip of ["127.0.0.1","10.1.2.3","169.254.169.254","172.16.0.2","192.168.1.1","100.64.0.1","::1","::ffff:127.0.0.1"])assert.equal(publicIPv4(ip),false);
  assert.equal(publicIPv4("93.184.216.34"),true);
  for(const url of ["http://example.com","https://user:pass@example.com","https://example.com:8443","https://www.linkedin.com/in/person"])assert.throws(()=>checkedUrl(url));
  await assert.rejects(enrichCompany("lead","https://127.0.0.1"),/Private, reserved/);
});
test("private infrastructure encrypts tokens at rest and rejects the wrong key without overwriting", async () => {
  const directory=await mkdtemp(join(tmpdir(),"brektra-private-test-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
  try {
    const key=randomBytes(32).toString("base64"),store=new PrivateStore(directory,key);
    await store.set("gmail.tokens",{refreshToken:"test-only-sensitive-value"});
    const content=await readFile(join(directory,"private.enc"),"utf8");assert.ok(!content.includes("test-only-sensitive-value"));
    const reloaded=new PrivateStore(directory,key);assert.equal((await reloaded.get<any>("gmail.tokens")).refreshToken,"test-only-sensitive-value");
    await assert.rejects(new PrivateStore(directory,randomBytes(32).toString("base64")).get("gmail.tokens"),/cannot be decrypted/);
    assert.equal(await readFile(join(directory,"private.enc"),"utf8"),content);
  } finally {await rm(directory,{recursive:true,force:true});}
});
