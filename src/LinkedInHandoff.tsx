import { ExternalLink } from "lucide-react";
import { featureApi as api, usePermission, type Action } from "./access";
export function LinkedInHandoff({ kind, recordId, revision, enabled, action, busy }: { kind: "draft" | "outreach"; recordId: string; revision: number; enabled: boolean; action: Action; busy: boolean }) {
  const operate = usePermission("operate");
  const get = () => api("/linkedin/handoff", "POST", { kind, recordId, revision });
  return <div className="linkedin-handoff"><p className="feature-help">Manual LinkedIn handoff: copy the approved message, then open the profile and send it yourself. Copying/opening never marks it sent or advances a sequence.</p><div className="feature-actions"><button className="button" disabled={busy || !operate || !enabled} onClick={() => void action(async () => { const data = await get(); await navigator.clipboard.writeText(data.text); }, "Approved text copied. Check the correct LinkedIn account before sending.")}>Copy approved message</button><button className="button" disabled={busy || !operate || !enabled} onClick={() => {
    const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null;
    void action(async () => { try { const data = await get(); if (tab) tab.location.replace(data.profileUrl); else throw new Error("Allow popups to open LinkedIn, then try again."); } catch (e) { tab?.close(); throw e; } });
  }}>Open in LinkedIn <ExternalLink size={14}/></button></div></div>;
}
