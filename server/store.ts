import type { State } from "../shared/types.ts";
import type { Sheets } from "./sheets.ts";
import { migrateState, validateState } from "./schema.ts";
export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  syncError = "";
  constructor(
    public state: State,
    readonly sheets?: Sheets,
  ) {}
  async recover() {
    const operation = this.tail.then(async () => {
      if (!this.sheets) return;
      try {
        const remote = migrateState(await this.sheets.initialize());
        for (const job of remote.jobs)
          if (job.status === "running") {
            job.status = job.kind === "draft" ? "failed" : "uncertain";
            job.detail = job.kind === "draft"
              ? "Interrupted draft generation. Restart the campaign explicitly to prepare a new draft."
              : "Interrupted job. Verify its outcome before taking any further action.";
          }
        for (const example of remote.trainingExamples)
          if (example.status === "generating") example.status = "interrupted";
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
    const operation = this.tail.then(async () => {
      if (this.sheets && this.syncError)
        throw new Error(
          `Sheets dispatch paused: ${this.syncError}. Reconnect before making further changes.`,
        );
      const candidate = structuredClone(this.state);
      const result = await fn(candidate);
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
}
