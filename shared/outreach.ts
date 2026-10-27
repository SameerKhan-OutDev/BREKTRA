import type { CompanyOwned } from "./company.ts";
export type TeamRole = "owner" | "admin" | "operator" | "reviewer" | "viewer";
export type Permission = "manage" | "operate" | "review";
export const permits = (role: TeamRole, permission: Permission) =>
  role === "owner" || role === "admin" ||
  (permission === "operate" && role === "operator") ||
  (permission === "review" && (role === "operator" || role === "reviewer"));
export interface Member {
  id: string; name: string; email: string; role: TeamRole;
  status: "active" | "invited" | "disabled"; createdAt: string;
}
export interface Invitation extends CompanyOwned {
  id: string; memberId: string; expiresAt: string; acceptedAt?: string;
}
export interface Mailbox extends CompanyOwned {
  id: string; email: string; name: string; provider: "gmail" | "demo";
  status: "connected" | "needs_login"; sendingEnabled: boolean; dailyBudget: number;
  syncedAt?: string; syncError: string;
}
export type StepKind = "email" | "linkedin_request" | "linkedin_message";
export interface SequenceStep {
  id: string; kind: StepKind; delayHours: number; subject: string; body: string;
}
export interface Sequence extends CompanyOwned {
  id: string; campaignId: string; enabled: boolean; mailboxId: string;
  version: number; steps: SequenceStep[]; updatedAt: string;
}
export interface Enrollment extends CompanyOwned {
  id: string; sequenceId: string; campaignId: string; leadId: string;
  sequenceVersion: number; stepIndex: number;
  status: "active" | "completed" | "replied" | "stopped";
  startedAt: string; nextAt: string; detail: string;
}
export interface OutreachAction extends CompanyOwned {
  id: string; campaignId: string; leadId: string; mailboxId: string;
  enrollmentId?: string; stepId?: string; conversationId?: string;
  conversationVersion?: number;
  kind: StepKind; purpose: "sequence" | "reply";
  recipient: string; subject: string; body: string; revision: number;
  status: "pending" | "approved" | "running" | "accepted" | "simulated" | "failed" | "uncertain" | "cancelled" | "rejected";
  approvedRevision?: number; approvedBy?: string; approvedAt?: string;
  createdAt: string; updatedAt: string; intentAt?: string;
  messageId: string; providerMessageId?: string; providerThreadId?: string;
  detail: string;
}
export interface Conversation extends CompanyOwned {
  id: string; mailboxId: string; leadId: string; campaignId: string;
  providerThreadId: string; subject: string; updatedAt: string;
  unread: boolean; status: "open" | "done"; assigneeId: string;
  simulated: boolean;
  messageVersion?: number;
}
export interface OutreachReview extends CompanyOwned {
  id: string; actionId: string; revision: number; subject: string; body: string;
  recipient: string; decision: "pending" | "approved" | "rejected"; actorId: string; at: string;
}
export interface ConversationMessage extends CompanyOwned {
  id: string; conversationId: string; providerMessageId: string;
  direction: "inbound" | "outbound"; from: string; to: string;
  subject: string; body: string; at: string; messageId: string; simulated: boolean;
}
export interface Enrichment extends CompanyOwned {
  id: string; leadId: string; sourceUrl: string; checkedAt: string;
  title: string; summary: string; listedEmails: string[];
  emailDomainStatus: "has_mx" | "no_mx" | "not_checked";
  status: "pending" | "accepted" | "rejected";
}
export interface AuthStatus {
  required: boolean; authenticated: boolean; hosted: boolean;
  user: { id: string; name: string; email: string; role: TeamRole } | null;
}
