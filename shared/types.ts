export type Mode = "requests" | "pitching" | "balanced";
export type CampaignStatus = "draft" | "running" | "paused";
export type Relationship =
  | "not_connected"
  | "pending"
  | "connected"
  | "unknown";
export interface Account {
  id: string;
  name: string;
  role: string;
  initials: string;
  dailyBudget: number;
  status: "demo" | "not_connected";
}
export interface Source {
  id: string;
  name: string;
  spreadsheetId: string;
  tab: string;
  mapping: Record<string, string>;
  importedAt: string;
  count: number;
}
export interface Lead {
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
}
export interface Campaign {
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
export interface Job {
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
export interface Draft {
  id: string;
  campaignId: string;
  leadId: string;
  text: string;
  fit: "fit" | "not_fit" | "needs_review";
  evidence: string[];
  status: "pending" | "approved" | "rejected";
  generator: string;
  createdAt: string;
}
export interface Activity {
  id: string;
  campaignId?: string;
  leadId?: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
  simulated: boolean;
  eventType?: "pitch_review_required" | "review_decision" | "essential_error";
}
// Desktop preferences belong to this computer, not to the shared workspace.
export interface DesktopNotificationPreferences {
  enabled: boolean;
  categories: Record<string, boolean>;
  privacy: "generic" | "preview";
  sound: boolean;
  quietHours: { enabled: boolean; timezone: string; startHour: number; endHour: number };
}
export interface WorkspaceSettings {
  id: "workspace";
  trainingCollection: boolean;
}
export interface TrainingExample {
  id: string;
  jobId: string;
  draftId?: string;
  capturedAt: string;
  simulated: boolean;
  status: "generating" | "completed" | "failed" | "interrupted" | "discarded";
  input: { campaign: Campaign; lead: Lead; generation: { model: string; promptVersion: string; temperature: number; numCtx: number } };
  original?: { text: string; fit: Draft["fit"]; evidence: string[]; generator: string };
}
export interface TrainingFeedback {
  id: string;
  exampleId: string;
  draftId: string;
  at: string;
  text: string;
  decision: Draft["status"];
  reason: string;
}
export interface State {
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
}
export interface Workspace {
  state: State;
  health: Health;
}
