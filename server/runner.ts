import type { Store } from "./store.ts";
import { canDispatch, id, log, now, queueCampaign } from "./domain.ts";
import { generateDraft, generationConfig } from "./ai.ts";
export class Runner {
  private busy = false;
  private lastCampaign = "";
  constructor(private store: Store, private generate = generateDraft) {}
  async tick() {
    if (this.busy || this.store.syncError || this.store.changingWorkspace) return;
    this.busy = true;
    let selected = "";
    try {
      // Pick up newly imported leads and newly confirmed connections while active.
      // Failed jobs require an explicit restart rather than an automatic retry loop.
      const candidate = structuredClone(this.store.state);
      let added = 0;
      for (const campaign of candidate.campaigns.filter((c) => c.status === "running"))
        added += queueCampaign(candidate, campaign, false);
      if (added) await this.store.change((state) => {
        for (const campaign of state.campaigns.filter((c) => c.status === "running"))
          queueCampaign(state, campaign, false);
      });
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
        job.intentAt = job.updatedAt;
        job.detail = "Intent recorded; processing locally";
        const lead = state.leads.find((l) => l.id === job.leadId)!;
        if (job.kind === "draft" && state.settings[0].trainingCollection)
          state.trainingExamples.push({
            id: `generation:${job.id}`, jobId: job.id, capturedAt: now(),
            simulated: !this.store.sheets, status: "generating",
            input: { campaign: structuredClone(campaign), lead: structuredClone(lead),
              generation: generationConfig(!this.store.sheets) },
          });
        return {
          job: structuredClone(job),
          campaign: structuredClone(campaign),
          lead: structuredClone(lead),
        };
      });
      if (!intent) return;
      const { job, campaign, lead } = intent;
      const generated =
        job.kind === "draft"
          ? await this.generate(lead, campaign, !this.store.sheets)
          : null;
      await this.store.change((state) => {
        const current = state.jobs.find((j) => j.id === job.id)!;
        if (current.status !== "running") return; // Reconnect invalidates the old runner.
        current.updatedAt = now();
        const currentLead = state.leads.find((l) => l.id === lead.id)!;
        const currentCampaign = state.campaigns.find((c) => c.id === campaign.id)!;
        const example = state.trainingExamples.find((e) => e.jobId === job.id);
        if (currentLead.optedOut || currentLead.repliedAt || currentCampaign.status !== "running" ||
            JSON.stringify(currentLead) !== JSON.stringify(lead) ||
            JSON.stringify(currentCampaign) !== JSON.stringify(campaign)) {
          current.status = "cancelled";
          current.detail = "Campaign or lead changed during processing. Review before starting again.";
          if (example) example.status = "discarded";
          return;
        }
        if (generated) {
          const draftId = id();
          state.drafts.push({
            id: draftId,
            campaignId: campaign.id,
            leadId: lead.id,
            ...generated,
            status: "pending",
            createdAt: now(),
          });
          if (example) {
            if (state.settings[0].trainingCollection) {
              example.status = "completed";
              example.draftId = draftId;
              example.original = structuredClone(generated);
            } else example.status = "discarded";
          }
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
              job.status = job.kind === "draft" ? "failed" : "uncertain";
              job.updatedAt = now();
              job.detail = e instanceof Error ? e.message : "Job failed";
              const example = state.trainingExamples.find((e) => e.jobId === job.id);
              if (example) example.status = "failed";
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
