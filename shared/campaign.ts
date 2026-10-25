import type { Campaign } from "./types.ts";

export const defaultContextPrompt = `Write a personalized LinkedIn message using this campaign context:
Company: {{company}}
Ideal customer profile: {{icp}}
What we're selling: {{selling}}
Pitch style: {{pitchStyle}}

Follow the pitch strategy and use the samples as guidance, adapting them to the lead's supplied facts. Keep it under 100 words with one clear next step. Avoid invented claims or familiarity.`;

export const pitchStyles = {
  conversational: "Conversational",
  direct: "Direct selling",
  indirect: "Indirect selling",
} as const;

export const defaultPitchStrategy = "Open with a relevant supplied fact, connect it to a useful outcome, and close with one low-pressure question.";
export const defaultPitchSamples = `Conversational: Hi {{firstName}}, I noticed your role at {{leadCompany}}. How are you approaching {{relevantChallenge}}? Happy to compare notes.

Direct selling: Hi {{firstName}}, at {{company}} we help teams with {{selling}}. Would a short conversation about whether this fits {{leadCompany}} be useful?

Indirect selling: Hi {{firstName}}, curious how your team at {{leadCompany}} handles {{relevantChallenge}}. Happy to exchange ideas if helpful.`;

// Upgrade persisted campaigns without losing their existing messaging or schedule.
export function normalizeCampaign(campaign: Campaign & { offer?: string }): Campaign {
  const { offer, ...rest } = campaign;
  return {
    ...rest,
    company: campaign.company ?? "",
    selling: campaign.selling ?? offer ?? "",
    pitchStyle: campaign.pitchStyle ?? "conversational",
    contextPrompt: campaign.contextPrompt ?? defaultContextPrompt,
    pitchStrategy: campaign.pitchStrategy ?? defaultPitchStrategy,
    pitchSamples: campaign.pitchSamples ?? defaultPitchSamples,
    scheduleMode: campaign.scheduleMode ?? "scheduled",
    startsAt: campaign.startsAt ?? "",
  };
}

export function renderContext(campaign: Campaign) {
  const values: Record<string, string> = {
    company: campaign.company,
    icp: campaign.icp,
    selling: campaign.selling,
    pitchStyle: pitchStyles[campaign.pitchStyle],
  };
  return campaign.contextPrompt.replace(/\{\{(company|icp|selling|pitchStyle)\}\}/g,
    (_, key: string) => values[key]);
}
