import { useState } from "react";
import type { Workspace } from "../shared/types";
import type { CompanyMigrationPreview } from "../shared/company";
import { featureApi as api, usePermission, type Action } from "./access";

export function CompanyFoundation({ workspace, action, busy }: { workspace: Workspace; action: Action; busy: boolean }) {
  const manage = usePermission("manage");
  const [preview, setPreview] = useState<CompanyMigrationPreview>();
  const [name, setName] = useState("");
  const [backup, setBackup] = useState(false);
  const company = workspace.state.companies[0];
  if (!manage) return null;
  return <details className="panel company-foundation">
    <summary>Company setup <span className="badge neutral">{company ? "Single company" : "Preparation"}</span></summary>
    <div className="company-foundation-content">
      {company ? <>
        <h3>{company.name}</h3>
        <p>Your existing records belong to this company. Team members still share this workspace under their existing permissions. Additional companies will be available after company access isolation is completed.</p>
      </> : <>
        <p>Prepare your existing workspace for company ownership. This assigns all existing records to one company and pauses campaigns and mailbox sending. Team access stays the same. Additional companies are not available yet.</p>
        <p>{workspace.health.mode === "demo" ? "This is a demo rehearsal. Changes reset when BREKTRA stops." : "Before applying, stop other copies and back up the control spreadsheet and matching private configuration. Keep backups outside the shared app folder. Older app versions cannot open migrated records."}</p>
        <button className="button" disabled={busy} onClick={() => void action(async () => {
          setPreview(undefined); setBackup(false);
          setPreview(await api<CompanyMigrationPreview>("/settings/company-migration"));
        })}>Review preparation</button>
        {preview && <div className="company-migration-preview">
          <p>{preview.counts.leads} leads · {preview.counts.campaigns} campaigns · {preview.counts.conversations} conversations · {preview.uncertainActions} unresolved sends. History and reviewed message versions are retained.</p>
          <p>{preview.runningCampaigns} running campaigns and {preview.enabledMailboxes} enabled mailboxes will be paused.</p>
          {preview.members.length > 0 && <>
            <p>Prepared company roles are listed below. Existing workspace permissions remain in effect until company access isolation is completed.</p>
            <ul>{preview.members.map((m) => <li key={m.memberId}>{m.name}: {m.from} → {m.to} ({m.status})</li>)}</ul>
          </>}
          {preview.blockers.map((blocker) => <p role="alert" key={blocker}>{blocker}</p>)}
          <label className="field"><span>Company name</span><input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} disabled={busy} autoComplete="organization" /></label>
          <label className="company-backup-choice"><input type="checkbox" checked={backup} disabled={busy} onChange={(e) => setBackup(e.target.checked)} />
            {workspace.health.mode === "demo" ? "I understand this only changes the temporary demo." : "I have a restorable backup of the control spreadsheet and matching private configuration."}
          </label>
          <button className="button primary" disabled={busy || !backup || !name.trim() || preview.blockers.length > 0} onClick={() => void action(async () => {
            try { await api("/settings/company-migration", "POST", { name: name.trim(), fingerprint: preview.fingerprint, backupConfirmed: backup }); }
            finally { setPreview(undefined); setBackup(false); }
          }, "Company preparation saved. Campaigns and mailbox sending are paused.")}>Apply company preparation</button>
        </div>}
      </>}
    </div>
  </details>;
}
