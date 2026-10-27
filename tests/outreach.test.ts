import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../server/seed.ts";
import { Store } from "../server/store.ts";
import type { Sheets } from "../server/sheets.ts";
import type { State } from "../shared/types.ts";
import type { OutreachAction } from "../shared/outreach.ts";
import { OutreachEngine, enroll, advanceSequences, actionWaiting, importMessages, stableMessageId } from "../server/outreach.ts";
import { type MailProvider, type MailMessage, RejectedSend } from "../server/gmail.ts";
import { now, queueCampaign, outboundCount, emailLeadId } from "../server/domain.ts";
import { validateState } from "../server/schema.ts";

function fixture() {
  const s = demoState(), campaign = s.campaigns[0], lead = s.leads[2];
  Object.assign(campaign, { mode: "pitching", status: "running", scheduleMode: "continuous", startsAt: "2020-01-01T00:00:00Z", dailyLimit: 100 });
  s.mailboxes[0].provider = "gmail"; s.mailboxes[0].sendingEnabled = true;
  s.sequences.push({ id: "sequence", campaignId: campaign.id, enabled: true, mailboxId: s.mailboxes[0].id, version: 1,
    updatedAt: now(), steps: [{ id: "first", kind: "email", delayHours: 0, subject: "Question for {{leadCompany}}", body: "Hi {{firstName}}, would a conversation about {{selling}} be useful?" },
      { id: "followup", kind: "email", delayHours: 48, subject: "Following up", body: "Hi {{firstName}}, is this something worth discussing?" }] });
  enroll(s, s.sequences[0], [lead.id]);
  let saved = structuredClone(s);
  const sheets = { initialize: async () => structuredClone(saved), save: async (candidate: State) => { saved = structuredClone(candidate); } } as unknown as Sheets;
  const store = new Store(s, sheets);
  let sends = 0, reads = 0;
  let inbound: MailMessage[] = [];
  const sent: MailMessage[] = [];
  const provider: MailProvider = {
    messages: async () => { reads++; return structuredClone(inbound); },
    send: async (mailbox, action) => { sends++; const result = { id: `sent-${sends}`, threadId: "thread" };
      sent.push({ ...result, from: mailbox.email, to: action.recipient, subject: action.subject, body: action.body,
        at: now(), messageId: action.messageId, inReplyTo: "", sent: true }); return result; },
    findSent: async () => structuredClone(sent),
  };
  return { store, sheets, provider, campaign, lead, sent, sends: () => sends, reads: () => reads,
    incoming: (messages: MailMessage[]) => { inbound = messages; }, engine: new OutreachEngine(store, provider) };
}
async function approve(store: Store, actionId?: string) {
  await store.change((s) => { const action = actionId ? s.outreachActions.find((a) => a.id === actionId)! : s.outreachActions[0];
    action.status = "approved"; action.approvedRevision = action.revision; action.approvedBy = "local-owner"; action.approvedAt = now(); });
}
function incoming(recipient: string, threadId = "thread"): MailMessage {
  return { id: "reply", threadId, from: recipient, to: "alex@example.invalid", subject: "Re: Question", body: "Thank you, let's talk.", at: new Date(Date.now()+1000).toISOString(), messageId: "<reply@example.invalid>", inReplyTo: "", sent: false };
}

test("sequences preserve the legacy path until enabled and never dispatch unreviewed text", async () => {
  const f = fixture();
  assert.equal(queueCampaign(f.store.state, f.store.state.campaigns[0]), 0);
  await f.engine.tick();
  assert.equal(f.sends(), 0); assert.equal(f.store.state.outreachActions[0].status, "pending");
  assert.match(f.store.state.outreachActions[0].body, /Hi Amara/);
  await approve(f.store); await f.engine.tick();
  assert.equal(f.sends(), 1); assert.equal(f.store.state.outreachActions[0].status, "accepted");
  assert.match(f.store.state.outreachActions[0].detail, /delivery is not confirmed/);
  validateState(f.store.state);
  await f.engine.tick(); await f.engine.tick();
  assert.equal(f.sends(), 1); assert.equal(f.store.state.outreachActions.length, 1);
  assert.equal(f.store.state.enrollments[0].stepIndex, 1);
  const later = structuredClone(f.store.state);
  assert.equal(advanceSequences(later, new Date(Date.now()+49*3600000)), 1);
  assert.equal(later.outreachActions.length, 2); assert.equal(later.outreachActions[1].status, "pending");
});
test("reply synchronization stops all future steps and message retries deduplicate", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store); await f.engine.tick();
  f.incoming([incoming(f.lead.email!)]);
  await f.engine.sync(f.store.state.mailboxes[0].id); await f.engine.sync(f.store.state.mailboxes[0].id);
  assert.equal(f.store.state.messages.filter((m) => m.providerMessageId === "reply").length, 1);
  assert.equal(f.store.state.enrollments[0].status, "replied");
  assert.ok(f.store.state.leads.find((l) => l.id === f.lead.id)!.repliedAt);
  await f.engine.tick(); assert.equal(f.sends(), 1);
  assert.equal(advanceSequences(f.store.state, new Date(Date.now()+5*86400000)), 0);
});
test("a reply arriving before the first send cancels an approved action", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  f.incoming([incoming(f.lead.email!, "new-thread")]);
  await f.engine.tick();
  assert.equal(f.sends(), 0); assert.equal(f.store.state.outreachActions[0].status, "cancelled");
});
test("failed/incomplete inbox synchronization prevents sends until an explicit recovery sync", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  f.provider.messages = async () => { throw new Error("incomplete provider page"); };
  await f.engine.tick(); await f.engine.tick();
  assert.equal(f.sends(), 0); assert.match(f.store.state.mailboxes[0].syncError, /incomplete/);
  f.provider.messages = async () => [];
  await f.engine.sync(f.store.state.mailboxes[0].id); await f.engine.tick(); assert.equal(f.sends(), 1);
});
test("recipient edits invalidate approval and a removed reviewer cannot authorize a send", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  await f.store.change((s) => { s.leads.find((l) => l.id === f.lead.id)!.email = "changed@example.invalid"; });
  assert.equal(f.store.state.outreachActions[0].status, "pending");
  assert.equal(f.store.state.outreachActions[0].revision, 2);
  await f.engine.tick(); assert.equal(f.sends(), 0);
  const state = f.store.state, action = state.outreachActions[0];
  action.recipient = "changed@example.invalid"; action.status = "approved"; action.approvedRevision = action.revision; action.approvedBy = "reviewer";
  state.members.push({id:"owner",name:"Owner",email:"owner@example.invalid",role:"owner",status:"active",createdAt:now()},
    {id:"reviewer",name:"Reviewer",email:"reviewer@example.invalid",role:"reviewer",status:"disabled",createdAt:now()});
  assert.match(actionWaiting(state, action, false)!, /no longer permitted/);
});
test("mailbox and campaign limits include competing sequence actions and uncertain reservations", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  const s = f.store.state, a = s.outreachActions[0];
  s.mailboxes[0].dailyBudget = 1;
  s.outreachActions.push({...a,id:"uncertain-other",status:"uncertain",intentAt:"2026-01-01T00:00:00Z"});
  assert.match(actionWaiting(s,a,false)!, /mailbox daily budget/);
  assert.equal(outboundCount(s,s.campaigns[0]),1);
  assert.equal(outboundCount(s,s.campaigns[0],undefined,true),0); // Gmail doesn't consume LinkedIn's account allocation.
  s.mailboxes[0].dailyBudget = 100; s.campaigns[0].dailyLimit = 1;
  assert.match(actionWaiting(s,a,false)!, /Campaign daily allocation/);
});
test("failed intent writes prevent provider calls", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  f.sheets.save = async (s) => { if (s.outreachActions.some((a) => a.status === "running")) throw new Error("intent not committed"); };
  await f.engine.tick(); assert.equal(f.sends(),0); assert.ok(f.store.syncError);
});
test("lost send confirmation stays uncertain and is never automatically retried", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  f.provider.send = async () => {throw new Error("response lost after possible acceptance");};
  await f.engine.tick(); assert.equal(f.store.state.outreachActions[0].status,"uncertain");
  let repeats=0; f.provider.send=async()=>{repeats++;return{id:"repeat",threadId:"thread"};};
  await f.engine.tick(); await f.store.recover(); await f.engine.tick(); assert.equal(repeats,0);
});
test("known Gmail rejection requires new human review; it does not retry on another tick", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  let calls=0;f.provider.send=async()=>{calls++;throw new RejectedSend("provider rejected");};
  await f.engine.tick(); await f.engine.tick(); assert.equal(calls,1);assert.equal(f.store.state.outreachActions[0].status,"failed");
});
test("restart after a result-save failure reconciles exactly one sent copy without resending", async () => {
  const f = fixture(); await f.engine.tick(); await approve(f.store);
  const save=f.sheets.save.bind(f.sheets);
  f.sheets.save=async(s)=>{if(s.outreachActions.some((a)=>a.status==="accepted"))throw new Error("result save failed");await save(s);};
  await f.engine.tick(); assert.equal(f.sends(),1);assert.ok(f.store.syncError);
  f.sheets.save=save;await f.store.recover();assert.equal(f.store.state.outreachActions[0].status,"uncertain");
  await f.engine.reconcile(f.store.state.outreachActions[0].id);assert.equal(f.store.state.outreachActions[0].status,"accepted");
  await f.engine.tick();assert.equal(f.sends(),1);
});
test("opt-outs during transport preserve the actual result while stopping remaining work", async () => {
  const f=fixture();await f.engine.tick();await approve(f.store);
  let finish!:(r:{id:string;threadId:string})=>void,enter!:()=>void;
  const started=new Promise<void>((r)=>{enter=r;});
  f.provider.send=()=>{enter();return new Promise((r)=>{finish=r;});};
  const tick=f.engine.tick();await started;
  await f.store.change((s)=>{s.leads.find((l)=>l.id===f.lead.id)!.optedOut=true;});
  finish({id:"accepted-before-stop",threadId:"thread"});await tick;
  assert.equal(f.store.state.outreachActions[0].status,"accepted");assert.equal(f.store.state.enrollments[0].status,"stopped");
});
test("unapproved leads, missing template facts and duplicate recipient enrollments fail safely", () => {
  const f=fixture(),s=f.store.state;
  s.enrollments=[];s.leads[2].outreachApproval="pending";
  assert.throws(()=>enroll(s,s.sequences[0],[s.leads[2].id]),/approval/);
  s.leads[2].outreachApproval="approved";s.leads[3].email=s.leads[2].email;
  assert.throws(()=>enroll(s,s.sequences[0],[s.leads[2].id]),/duplicate/i);
  s.leads[3].email="different@example.invalid";enroll(s,s.sequences[0],[s.leads[2].id]);
  s.sequences[0].steps[0].body="Missing {{unknownFact}}";
  advanceSequences(s);assert.equal(s.outreachActions.length,0);assert.equal(s.enrollments[0].status,"stopped");
});
test("live LinkedIn actions remain blocked and legacy work cannot bypass sequence ownership", () => {
  const f=fixture(),s=f.store.state;
  advanceSequences(s);const a=s.outreachActions[0];a.kind="linkedin_message";a.recipient=f.lead.profileUrl;a.status="approved";a.approvedBy="local-owner";a.approvedRevision=1;
  assert.match(actionWaiting(s,a,false)!,/LinkedIn integration/);
  assert.equal(queueCampaign(s,s.campaigns[0]),0);
});
test("sync limits tracking to the selected mailbox and omits finished, closed threads", async () => {
  const f=fixture();await f.engine.tick();await approve(f.store);await f.engine.tick();
  await f.engine.tick(); // First step accepted, but delayed follow-up is still active.
  const conversation=f.store.state.conversations.find((c)=>c.providerThreadId==="thread")!;
  await f.store.change((s)=>{s.conversations.find((c)=>c.id===conversation.id)!.status="done";s.enrollments[0].status="completed";});
  let trackedThreads:string[]=[];
  f.provider.messages=async(_mailbox,_emails,threads)=>{trackedThreads=threads;return[];};
  await f.engine.sync(f.store.state.mailboxes[0].id);
  assert.ok(!trackedThreads.includes("thread"));
});
test("a new incoming message invalidates an approved inbox reply before transport", async () => {
  const f=fixture();await f.engine.tick();await approve(f.store);await f.engine.tick();
  const conversation=f.store.state.conversations.find((c)=>c.providerThreadId==="thread")!;
  await f.store.change((s)=>{
    s.enrollments[0].status="stopped";
    const original=s.outreachActions[0];
    s.outreachActions.push({...original,id:"manual-reply",enrollmentId:undefined,stepId:undefined,purpose:"reply",conversationId:conversation.id,
      conversationVersion:conversation.messageVersion||1,messageId:stableMessageId("manual-reply"),providerMessageId:undefined,status:"approved",
      body:"Thanks, here is a reply to your earlier question.",revision:1,approvedRevision:1});
  });
  f.incoming([incoming(f.lead.email!)]);await f.engine.tick();
  const reply=f.store.state.outreachActions.find((a)=>a.id==="manual-reply")!;
  assert.equal(f.sends(),1);assert.equal(reply.status,"pending");assert.equal(reply.revision,2);assert.match(reply.detail,/Conversation changed/);
});
test("email-only leads do not need LinkedIn profiles and cannot enter LinkedIn jobs", () => {
  const f=fixture(),s=f.store.state,lead=s.leads.find((l)=>l.id===f.lead.id)!;
  lead.profileUrl="";validateState(s);
  assert.equal(emailLeadId("account"," PERSON@example.invalid "),emailLeadId("account","person@example.invalid"));
  advanceSequences(s);assert.equal(s.outreachActions[0].kind,"email");assert.equal(s.outreachActions[0].recipient,lead.email);
  s.sequences[0].enabled=false;queueCampaign(s,s.campaigns[0]);assert.ok(!s.jobs.some((j)=>j.leadId===lead.id));
  s.sequences[0].enabled=true;s.sequences[0].steps[0].kind="linkedin_message";
  assert.throws(()=>enroll(s,s.sequences[0],[lead.id]),/LinkedIn profile/);
});
