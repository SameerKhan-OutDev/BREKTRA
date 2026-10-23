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
  offer: string;
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
}
export interface State {
  accounts: Account[];
  sources: Source[];
  leads: Lead[];
  campaigns: Campaign[];
  jobs: Job[];
  drafts: Draft[];
  activity: Activity[];
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
