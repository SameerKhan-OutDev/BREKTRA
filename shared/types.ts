import type { Mailbox, Sequence, Enrollment, OutreachAction, Conversation, ConversationMessage, Enrichment, Member, Invitation, AuthStatus, OutreachReview } from "./outreach.ts";
import type { Company, CompanyMembership, CompanyMigration, CompanyOwned } from "./company.ts";
export type Mode = "requests" | "pitching" | "balanced";
export type CampaignStatus = "draft" | "running" | "paused";
export type Relationship =
  | "not_connected"
  | "pending"
  | "connected"
  | "unknown";
export interface Account extends CompanyOwned {
  id: string;
  name: string;
  role: string;
  initials: string;
  dailyBudget: number;
  status: "demo" | "not_connected";
}
export interface Source extends CompanyOwned {
  id: string;
  name: string;
  spreadsheetId: string;
  tab: string;
  mapping: Record<string, string>;
  importedAt: string;
  count: number;
}
export interface Lead extends CompanyOwned {
  id: string;
  sourceId: string;
  accountId: string;
  name: string;
  title: string;
  company: string;
  profileUrl: string;
  relationship: Relationship;
  optedOut: boolean;
  notes: string;
  email?: string;
  website?: string;
  repliedAt?: string;
  outreachApproval?: "pending" | "approved" | "rejected";
  outreachReviewedAt?: string;
  outreachReviewedBy?: string;
}
export interface Campaign extends CompanyOwned {
  id: string;
  name: string;
  description: string;
  mode: Mode;
  sourceId: string;
  accountId: string;
  status: CampaignStatus;
  dailyLimit: number;
  icp: string;
  company: string;
  selling: string;
  pitchStyle: "conversational" | "direct" | "indirect";
  contextPrompt: string;
  pitchStrategy: string;
  pitchSamples: string;
  scheduleMode: "scheduled" | "continuous";
  startsAt: string;
  startHour: number;
  endHour: number;
  timezone: string;
  createdAt: string;
}
export interface Job extends CompanyOwned {
  id: string;
  campaignId: string;
  leadId: string;
  accountId: string;
  kind: "request" | "draft" | "pitch";
  status:
    | "queued"
    | "running"
    | "simulated"
    | "completed"
    | "failed"
    | "cancelled"
    | "uncertain";
  createdAt: string;
  updatedAt: string;
  detail: string;
  intentAt?: string;
}
export interface Draft extends CompanyOwned {
  id: string;
  campaignId: string;
  leadId: string;
  text: string;
  fit: "fit" | "not_fit" | "needs_review";
  evidence: string[];
  status: "pending" | "approved" | "rejected";
  generator: string;
  createdAt: string;
  revision?: number;
}
export interface Activity extends CompanyOwned {
  id: string;
  campaignId?: string;
  leadId?: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
  simulated: boolean;
  eventType?: "pitch_review_required" | "review_decision" | "essential_error";
  actorId?: string;
}
// Desktop preferences belong to this computer, not to the shared workspace.
export interface DesktopNotificationPreferences {
  enabled: boolean;
  categories: Record<string, boolean>;
  privacy: "generic" | "preview";
  sound: boolean;
  quietHours: { enabled: boolean; timezone: string; startHour: number; endHour: number };
}
export interface WorkspaceSettings extends CompanyOwned {
  id: "workspace";
  trainingCollection: boolean;
}
export interface TrainingExample extends CompanyOwned {
  id: string;
  jobId: string;
  draftId?: string;
  capturedAt: string;
  simulated: boolean;
  status: "generating" | "completed" | "failed" | "interrupted" | "discarded";
  input: { campaign: Campaign; lead: Lead; generation: { model: string; promptVersion: string; temperature: number; numCtx: number } };
  original?: { text: string; fit: Draft["fit"]; evidence: string[]; generator: string };
}
export interface TrainingFeedback extends CompanyOwned {
  id: string;
  exampleId: string;
  draftId: string;
  at: string;
  text: string;
  decision: Draft["status"];
  reason: string;
}
export interface State {
  companies: Company[];
  companyMemberships: CompanyMembership[];
  companyMigrations: CompanyMigration[];
  accounts: Account[];
  sources: Source[];
  leads: Lead[];
  campaigns: Campaign[];
  jobs: Job[];
  drafts: Draft[];
  activity: Activity[];
  settings: WorkspaceSettings[];
  trainingExamples: TrainingExample[];
  trainingFeedback: TrainingFeedback[];
  mailboxes: Mailbox[];
  sequences: Sequence[];
  enrollments: Enrollment[];
  outreachActions: OutreachAction[];
  outreachReviews: OutreachReview[];
  conversations: Conversation[];
  messages: ConversationMessage[];
  enrichments: Enrichment[];
  members: Member[];
  invitations: Invitation[];
}
export interface Health {
  mode: "demo" | "sheets";
  sheets: { connected: boolean; detail: string };
  ollama: {
    connected: boolean;
    models: string[];
    model: string;
    detail: string;
  };
  linkedin: { connected: false; detail: string };
  timezone: string;
  startedAt: string;
  hosted?: boolean;
}
export interface Workspace {
  state: State;
  health: Health;
  auth?: AuthStatus;
}
