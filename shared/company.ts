// Company ownership is distinct from a lead's employer or campaign copy.
export interface CompanyOwned { companyId?: string }
export type CompanyRole = "admin" | "sdr" | "reviewer" | "closer" | "viewer";
export type CompanyPermission = "read" | "prepare" | "approve" | "campaign" | "assign" | "integrations" | "members" | "export" | "payroll";
export const companyPermissions: Record<CompanyRole, readonly CompanyPermission[]> = {
  admin: ["read", "prepare", "approve", "campaign", "assign", "integrations", "members", "export", "payroll"],
  sdr: ["read", "prepare"],
  reviewer: ["read", "prepare", "approve"],
  closer: ["read", "prepare", "assign"],
  viewer: ["read"],
};
export interface Company {
  id: string; name: string; status: "active" | "archived"; createdAt: string;
}
export interface CompanyMembership {
  id: string; companyId: string; memberId: string; role: CompanyRole;
  status: "active" | "invited" | "disabled";
}
export interface CompanyMigration {
  id: "company-foundation-v1"; companyId: string; at: string; actorId: string;
  inputFingerprint: string;
  recordCounts: Record<string, number>;
  memberRoles: { memberId: string; from: string; to: CompanyRole }[];
}
export interface CompanyMigrationPreview {
  fingerprint: string;
  counts: Record<string, number>;
  members: { memberId: string; name: string; from: string; to: CompanyRole; status: string }[];
  runningCampaigns: number; enabledMailboxes: number; uncertainActions: number;
  blockers: string[];
}
// This matrix is the next API isolation contract. Legacy workspace permissions
// remain in effect in the single-company runtime until P1.2 is implemented.
export function companyPermits(membership: CompanyMembership | undefined, companyId: string, permission: CompanyPermission) {
  return !!membership && membership.companyId === companyId && membership.status === "active" &&
    companyPermissions[membership.role].includes(permission);
}
