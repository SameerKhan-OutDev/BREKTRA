import type { State } from "../shared/types.ts";
import { emptyState, leadId, now } from "./domain.ts";
import { defaultContextPrompt, defaultPitchStrategy, defaultPitchSamples } from "../shared/campaign.ts";
export function demoState(): State {
  const s = emptyState();
  s.accounts = [
    {
      id: "demo-account",
      name: "Alex Morgan",
      role: "Demo LinkedIn account",
      initials: "AM",
      dailyBudget: 20,
      status: "demo",
    },
  ];
  s.sources = [
    {
      id: "demo-source",
      name: "B2B founders · Sample leads",
      spreadsheetId: "",
      tab: "Founders",
      mapping: {},
      importedAt: now(),
      count: 8,
    },
  ];
  const people = [
    [
      "Sofia Chen",
      "Co-founder & CEO",
      "Northstar Labs",
      "connected",
      "Building workflow software for small operations teams.",
    ],
    [
      "James Wilson",
      "Founder",
      "Forma",
      "not_connected",
      "Runs a B2B product design agency.",
    ],
    [
      "Amara Okafor",
      "Head of Growth",
      "Orbit",
      "connected",
      "Leads growth at a B2B analytics company.",
    ],
    [
      "Daniel Park",
      "Co-founder",
      "Stackwise",
      "not_connected",
      "Building developer tools for distributed teams.",
    ],
    [
      "Olivia Martin",
      "CEO",
      "Fieldwork",
      "pending",
      "Operations software for service businesses.",
    ],
    [
      "Noah Patel",
      "Managing Director",
      "Brightside",
      "connected",
      "Consulting agency supporting early-stage SaaS companies.",
    ],
    [
      "Emma Rodriguez",
      "Founder",
      "Common Ground",
      "not_connected",
      "A community platform for independent professionals.",
    ],
    [
      "Liam Brooks",
      "VP of Sales",
      "Relay",
      "unknown",
      "B2B communications platform. Relationship needs verification.",
    ],
  ];
  s.leads = people.map(([name, title, company, relationship, notes]) => {
    const profileUrl = `https://www.linkedin.com/in/demo-${name.toLowerCase().replaceAll(" ", "-")}`;
    return {
      id: leadId("demo-account", profileUrl),
      sourceId: "demo-source",
      accountId: "demo-account",
      name,
      title,
      company,
      profileUrl,
      relationship: relationship as (typeof s.leads)[number]["relationship"],
      optedOut: false,
      notes,
    };
  });
  s.campaigns = [
    {
      id: "demo-campaign",
      name: "Meet the next wave of founders",
      description:
        "A sample campaign to explore your workspace. Demo working hours are open all day.",
      mode: "balanced",
      sourceId: "demo-source",
      accountId: "demo-account",
      status: "draft",
      dailyLimit: 10,
      icp: "Founders and growth leaders at B2B software companies.",
      company: "BREKTRA",
      selling: "We help small B2B teams simplify their outreach workflows.",
      pitchStyle: "conversational",
      contextPrompt: defaultContextPrompt,
      pitchStrategy: defaultPitchStrategy,
      pitchSamples: defaultPitchSamples,
      scheduleMode: "scheduled",
      startsAt: "",
      startHour: 0,
      endHour: 24,
      timezone: "Asia/Karachi",
      createdAt: now(),
    },
  ];
  s.drafts = [
    {
      id: "demo-draft",
      campaignId: "demo-campaign",
      leadId: s.leads[0].id,
      text: "Hi Sofia, I saw that Northstar Labs is building workflow software for small operations teams. We help B2B teams simplify their outreach workflows. Would it be useful to compare notes?",
      fit: "fit",
      evidence: [
        "Co-founder & CEO at Northstar Labs",
        "Sample notes describe workflow software for small operations teams.",
      ],
      status: "pending",
      generator: "Demo template · no AI inference",
      createdAt: now(),
    },
  ];
  s.activity = [
    {
      id: "welcome",
      kind: "system",
      title: "Your workspace is ready",
      detail:
        "Explore with sample data. Demo actions never contact LinkedIn and reset when the server restarts.",
      at: now(),
      simulated: false,
    },
  ];
  return s;
}
