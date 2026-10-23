import type { Store } from "./store.ts";
import { canDispatch, id, log, now } from "./domain.ts";
import { generateDraft } from "./ai.ts";
export class Runner {
  private busy = false;
  private lastCampaign = "";
  constructor(private store: Store) {}
  async tick() {
    if (this.busy || this.store.syncError) return;
    this.busy = true;
    let selected = "";
    try {
      const s = this.store.state;
      const campaigns = s.campaigns.filter((c) => c.status === "running");
      const lastIndex = campaigns.findIndex((c) => c.id === this.lastCampaign);
      const rotated = [
        ...campaigns.slice(lastIndex + 1),
        ...campaigns.slice(0, lastIndex + 1),
      ];
      let jobId = "";
      for (const campaign of rotated) {
        const job = s.jobs.find(
          (j) =>
            j.campaignId === campaign.id &&
            j.status === "queued" &&
            !canDispatch(s, campaign, j),
        );
        if (job) {
          jobId = job.id;
          this.lastCampaign = campaign.id;
          break;
        }
      }
      if (!jobId) return;
      selected = jobId;
      // Persist intent before doing any work. Store serializes this with user actions.
      const intent = await this.store.change((state) => {
        const job = state.jobs.find((j) => j.id === jobId)!;
        const campaign = state.campaigns.find((c) => c.id === job.campaignId)!;
        if (job.status !== "queued" || canDispatch(state, campaign, job))
          return null;
        const account = state.accounts.find((a) => a.id === job.accountId);
        if (job.kind !== "draft" && account?.status !== "demo")
          throw new Error("Live LinkedIn sending is unavailable.");
        job.status = "running";
        job.updatedAt = now();
        job.detail = "Intent recorded; processing locally";
        return {
          job: structuredClone(job),
          campaign: structuredClone(campaign),
          lead: structuredClone(state.leads.find((l) => l.id === job.leadId)!),
        };
      });
      if (!intent) return;
      const { job, campaign, lead } = intent;
      const generated =
        job.kind === "draft"
          ? await generateDraft(lead, campaign, !this.store.sheets)
          : null;
      await this.store.change((state) => {
        const current = state.jobs.find((j) => j.id === job.id)!;
        current.updatedAt = now();
        const currentLead = state.leads.find((l) => l.id === lead.id)!;
        if (currentLead.optedOut) {
          current.status = "cancelled";
          current.detail = "Cancelled because the lead opted out.";
          return;
        }
        if (generated) {
          state.drafts.push({
            id: id(),
            campaignId: campaign.id,
            leadId: lead.id,
            ...generated,
            status: "pending",
            createdAt: now(),
          });
          current.status = "completed";
          current.detail = "Draft prepared for human review";
          log(
            state,
            "Pitch ready for review",
            `${lead.name} · ${generated.generator}`,
            "draft",
            !this.store.sheets,
            campaign.id,
            lead.id,
          );
        } else {
          current.status = "simulated";
          current.detail = "Simulated only. No LinkedIn action was performed.";
          if (job.kind === "request") currentLead.relationship = "pending";
          log(
            state,
            job.kind === "request"
              ? "Connection request simulated"
              : "Pitch delivery simulated",
            `${lead.name} · No message or request was sent.`,
            job.kind,
            true,
            campaign.id,
            lead.id,
          );
        }
      });
    } catch (e) {
      if (selected && !this.store.syncError)
        await this.store
          .change((state) => {
            const job = state.jobs.find((j) => j.id === selected);
            if (job?.status === "running") {
              job.status = "failed";
              job.updatedAt = now();
              job.detail = e instanceof Error ? e.message : "Job failed";
              log(
                state,
                "Job needs attention",
                job.detail,
                "error",
                false,
                job.campaignId,
                job.leadId,
              );
            }
          })
          .catch(() => {});
      if (this.store.syncError)
        console.error("Dispatch paused:", this.store.syncError);
    } finally {
      this.busy = false;
    }
  }
}
