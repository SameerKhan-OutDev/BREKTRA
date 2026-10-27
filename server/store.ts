import type { State } from "../shared/types.ts";
import type { Sheets } from "./sheets.ts";
import { migrateState, validateState } from "./schema.ts";
import { assertSingleCompanyRuntime } from "./company-schema.ts";
import { companyFingerprint, maintainSingleCompanyOwnership } from "./company.ts";
import { requestContext } from "./context.ts";

function recoverInterrupted(remote: State) {
  for (const job of remote.jobs) if (job.status === "running") {
    job.status = job.kind === "draft" ? "failed" : "uncertain";
    job.detail = job.kind === "draft" ? "Interrupted draft generation. Restart the campaign explicitly to prepare a new draft."
      : "Interrupted job. Verify its outcome before taking any further action.";
  }
  for (const example of remote.trainingExamples) if (example.status === "generating") example.status = "interrupted";
  for (const action of remote.outreachActions) if (action.status === "running") {
    action.status = "uncertain";
    action.detail = "Interrupted send intent. Inspect/reconcile the provider result; never automatically repeat.";
  }
}
export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  syncError = "";
  changingWorkspace = false;
  workspaceEpoch = 0;
  constructor(
    public state: State,
    public sheets?: Sheets,
  ) { assertSingleCompanyRuntime(state); }
  async recover() {
    if (this.changingWorkspace) throw new Error("Workspace setup is in progress. Wait for it to finish.");
    const operation = this.tail.then(async () => {
      if (!this.sheets) return;
      try {
        const remote = migrateState(await this.sheets.initialize());
        assertSingleCompanyRuntime(remote);
        recoverInterrupted(remote);
        await this.sheets.save(remote);
        this.state = remote;
        this.syncError = "";
      } catch (e) {
        this.syncError =
          e instanceof Error ? e.message : "Sheets reconciliation failed";
        throw e;
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async change<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
    if (this.changingWorkspace) throw new Error("Workspace setup is in progress. Refresh after it finishes.");
    const requestEpoch = requestContext.getStore()?.workspaceEpoch;
    const operation = this.tail.then(async () => {
      if (this.changingWorkspace || (requestEpoch !== undefined && requestEpoch !== this.workspaceEpoch))
        throw new Error("Workspace changed or setup is in progress. Refresh before making changes.");
      if (this.sheets && this.syncError)
        throw new Error(
          `Sheets dispatch paused: ${this.syncError}. Reconnect before making further changes.`,
        );
      const candidate = structuredClone(this.state);
      const result = await fn(candidate);
      maintainSingleCompanyOwnership(this.state, candidate);
      for (const lead of candidate.leads) {
        const old = this.state.leads.find((l) => l.id === lead.id);
        if (lead.optedOut || lead.repliedAt || lead.outreachApproval === "rejected") {
          for (const enrollment of candidate.enrollments.filter((e) => e.leadId === lead.id && e.status === "active")) {
            enrollment.status = lead.repliedAt ? "replied" : "stopped"; enrollment.detail = "Lead opted out, replied, or was rejected";
          }
          for (const action of candidate.outreachActions.filter((a) => a.leadId === lead.id && ["pending", "approved"].includes(a.status) &&
            (lead.optedOut || lead.outreachApproval === "rejected" || a.purpose === "sequence"))) {
            action.status = "cancelled"; action.detail = "Lead opted out, replied, or was rejected"; action.updatedAt = new Date().toISOString();
          }
        }
        if (old && (old.email !== lead.email || old.profileUrl !== lead.profileUrl))
          for (const action of candidate.outreachActions.filter((a) => a.leadId === lead.id && ["pending", "approved"].includes(a.status))) {
            action.status = "pending"; action.revision++;
            action.approvedRevision = undefined; action.approvedBy = undefined; action.approvedAt = undefined;
            action.detail = "Contact changed; review the recipient and exact text again";
          }
      }
      for (const action of candidate.outreachActions.filter((a) => a.purpose === "reply" && ["pending", "approved"].includes(a.status))) {
        const conversation = candidate.conversations.find((c) => c.id === action.conversationId);
        if (conversation && action.conversationVersion !== (conversation.messageVersion || 1)) {
          action.status = "pending"; action.revision++; action.conversationVersion = conversation.messageVersion || 1;
          action.approvedRevision = undefined; action.approvedBy = undefined; action.approvedAt = undefined;
          action.detail = "Conversation changed. Read the latest incoming message and review this reply again.";
        }
      }
      // Invalidate immediately, so pausing and quickly resuming (or reversing an
      // opt-out) cannot revive an older generation that is still in flight.
      for (const job of candidate.jobs) {
        if (job.kind !== "draft" || job.status !== "running" ||
            !this.state.jobs.some((j) => j.id === job.id && j.status === "running")) continue;
        const oldCampaign = this.state.campaigns.find((c) => c.id === job.campaignId);
        const campaign = candidate.campaigns.find((c) => c.id === job.campaignId);
        const oldLead = this.state.leads.find((l) => l.id === job.leadId);
        const lead = candidate.leads.find((l) => l.id === job.leadId);
        if (JSON.stringify(oldCampaign) !== JSON.stringify(campaign) || JSON.stringify(oldLead) !== JSON.stringify(lead)) {
          job.status = "cancelled";
          job.detail = "Generation cancelled after a campaign or lead change. Restart explicitly to generate again.";
          job.updatedAt = new Date().toISOString();
          const example = candidate.trainingExamples.find((e) => e.jobId === job.id);
          if (example) example.status = "discarded";
        }
      }
      if (this.sheets) validateState(candidate);
      if (this.sheets) {
        try {
          await this.sheets.save(candidate);
          this.syncError = "";
        } catch (e) {
          this.syncError =
            e instanceof Error ? e.message : "Sheets sync failed";
          throw e;
        }
      }
      this.state = candidate;
      return result;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async connectSheets(adapter: Sheets, sourceFingerprint: string, targetFingerprint: string, persist: () => Promise<void>) {
    if (this.changingWorkspace || this.sheets) throw new Error("A Sheets workspace is already connected or setup is in progress.");
    this.changingWorkspace = true;
    const operation = this.tail.then(async () => {
      if (companyFingerprint(this.state) !== sourceFingerprint) throw new Error("Your workspace changed. Run the connection check again.");
      if (this.state.campaigns.some((c) => c.status === "running") || this.state.mailboxes.some((m) => m.sendingEnabled) ||
          this.state.jobs.some((j) => j.status === "running") || this.state.outreachActions.some((a) => a.status === "running"))
        throw new Error("Pause demo campaigns and mailbox sending, then wait for current work to finish before connecting.");
      const remote = migrateState(await adapter.initialize());
      assertSingleCompanyRuntime(remote);
      if (companyFingerprint(remote) !== targetFingerprint) throw new Error("The spreadsheet changed since the check. Check it again before connecting.");
      recoverInterrupted(remote);
      for (const c of remote.campaigns) if (c.status === "running") c.status = "paused";
      for (const m of remote.mailboxes) m.sendingEnabled = false;
      await adapter.save(remote);
      await persist(); // No demo records or credentials are written to Sheets.
      this.state = remote;
      this.sheets = adapter;
      this.workspaceEpoch++;
      this.syncError = "";
    });
    this.tail = operation.catch(() => {});
    try { await operation; } finally { this.changingWorkspace = false; }
  }
}
