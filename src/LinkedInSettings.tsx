import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import type { Workspace } from "../shared/types";
import { featureApi as api, usePermission, type Action } from "./access";
import { LinkedInGuide, type LinkedInSetupConfig } from "./LinkedInGuide";

import { LinkedInSetupLink } from "./LinkedInSetupLink";

export function LinkedInSettings({ workspace: { state: s, health: h, auth }, action, busy }: { workspace: Workspace; action: Action; busy: boolean }) {
  const manage = usePermission("manage"), operate = usePermission("operate");
  const [config, setConfig] = useState<LinkedInSetupConfig | null>(null);
  const [error, setError] = useState(""), [clientId, setClientId] = useState(""), [clientSecret, setClientSecret] = useState("");
  const [target, setTarget] = useState("");
  const result = new URLSearchParams(location.search).get("linkedin");
  useEffect(() => { api("/linkedin/config").then(setConfig).catch((e) => setError(e.message)); }, []);
  const connect = (accountId?: string) => action(async () => {
    const { url } = await api("/linkedin/connect", "POST", accountId ? { accountId } : {});
    location.assign(url);
  });
  const persistent = h.sheets.connected;
  const accounts = s.accounts.filter((a) => a.linkedin);
  const ownConnected = accounts.some((a) => a.linkedin && a.linkedin.ownerId === auth?.user?.id && a.linkedin.status === "connected" && Date.parse(a.linkedin.expiresAt) > Date.now());
  const unused = s.accounts.filter((a) => a.status !== "demo" && !a.linkedin);
  const refreshConfig = async () => { try { setConfig(await api("/linkedin/config")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "LinkedIn setup status is unavailable."); throw e; } };
  return <section className="panel setup-card linkedin-settings">
    <div className="panel-header"><div><h2>LinkedIn accounts</h2><p>Connect your own account. BREKTRA remembers the account and handles connection checks.</p></div><span className="badge neutral">Account connection</span></div>
    <LinkedInGuide key={`${s.companies[0]?.id || "workspace"}:${auth?.user?.id || "local-owner"}`} workspace={{state:s,health:h,auth}} config={config} refreshConfig={refreshConfig} connect={() => connect(target || s.accounts.find((a) => a.linkedin?.ownerId === auth?.user?.id)?.id || undefined)} action={action} busy={busy}/>
    {result === "connected" && ownConnected && <p role="status" className="note">LinkedIn account connected. Campaigns stay paused until you restart them.</p>}
    {result === "failed" && <p role="alert" className="feature-error">LinkedIn connection was not completed. Retry from this page using the same account when reconnecting. Your administrator can check app permissions, callback URL and workspace access.</p>}
    {error && <div role="alert" className="feature-error"><p>{error}</p><button className="button" disabled={busy} onClick={() => void action(refreshConfig)}>Retry setup check</button></div>}
    <ol className="linkedin-checklist"><li>{persistent ? "✓ Workspace ready" : "Connect your Sheets workspace above"}</li><li>{ownConnected ? "✓ Your account connected" : "Connect your LinkedIn account"}</li><li>Choose leads and review your first draft in a campaign</li></ol>
    {!persistent && <p className="feature-help">Complete Real workspace setup first. Real accounts are kept out of the temporary demo workspace.</p>}
    {config && !config.configured && <p className="feature-help">Your administrator needs to complete the one-time LinkedIn setup below. Teammates then use Connect LinkedIn.</p>}
    {operate && <div className="feature-actions">
      {manage && unused.length > 0 && <label className="field"><span>Account to connect</span><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Add an account automatically</option>{unused.map((a) => <option key={a.id} value={a.id}>{a.name} (existing label)</option>)}</select></label>}
      <button className="button primary" disabled={busy || !persistent || !config?.configured} onClick={() => void connect(target || undefined)}>Connect LinkedIn <ExternalLink size={15}/></button>
    </div>}
    {accounts.map((a) => {
      const own = a.linkedin!.ownerId === auth?.user?.id, expired = Date.parse(a.linkedin!.expiresAt) <= Date.now();
      const connected = a.linkedin!.status === "connected" && !expired;
      return <div className="linkedin-account" key={a.id}><div><strong>{a.name}</strong><p>{own ? "Your account" : s.members.find((m) => m.id === a.linkedin!.ownerId)?.name || "Workspace member"} · {connected ? "Account connected" : a.linkedin!.status === "disconnected" ? "Disconnected" : "Reconnect needed"}</p><p className="feature-help">Last checked {new Date(a.linkedin!.checkedAt).toLocaleString()} · Invitations and messaging unavailable</p></div>
        {own && operate && <div className="feature-actions"><button className="button" disabled={busy || !persistent || !config?.configured} onClick={() => void connect(a.id)}>Reconnect</button><button className="button" disabled={busy || !persistent || a.linkedin!.status === "disconnected"} onClick={() => void action(async () => { const r = await api(`/linkedin/accounts/${a.id}/check`, "POST"); if (!r.connected) throw new Error("LinkedIn needs reconnection or another check. Campaigns have been paused."); }, "LinkedIn connection checked.")}><RefreshCw size={14}/>Check</button><button className="button" disabled={busy || !persistent || a.linkedin!.status === "disconnected"} onClick={() => void action(() => api(`/linkedin/accounts/${a.id}/disconnect`, "POST"), "LinkedIn disconnected locally. Campaigns paused; you can also remove BREKTRA in LinkedIn's permitted services.")}>Disconnect</button></div>}
      </div>;
    })}
    <div className="note"><ShieldCheck size={16}/><span>Connection confirms which LinkedIn account authorized BREKTRA. Live invitations, messages and reply sync require separate approved access. Drafts can be copied and opened in LinkedIn for manual sending.</span></div>
    {manage && <details className="oauth-setup"><summary>Administrator: one-time LinkedIn setup</summary><p className="feature-help">Create a LinkedIn developer app, enable “Sign In with LinkedIn using OpenID Connect”, and register this exact callback. Use the same app for every teammate.</p><LinkedInSetupLink/><p className="feature-help">Enable Sign In with LinkedIn using OpenID Connect in Products.</p><LinkedInSetupLink section="Products"/><p className="feature-help">In Auth, add this exact authorized redirect URL, then copy your Client ID and Client secret into the fields below.</p><LinkedInSetupLink section="Auth"/><code className="feature-code">{config?.redirectUri || "Loading callback…"}</code><form className="feature-fields" onSubmit={(e) => { e.preventDefault(); void action(async () => { await api("/linkedin/config", "PUT", { clientId, clientSecret }); setClientSecret(""); setClientId(""); setConfig(await api("/linkedin/config")); }, "LinkedIn application configured privately."); }}><label className="field"><span>Client ID</span><input required minLength={5} maxLength={300} autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)}/></label><label className="field"><span>Client secret</span><input type="password" required minLength={8} maxLength={500} autoComplete="new-password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}/></label><button className="button" disabled={busy}>Save private configuration</button></form></details>}
  </section>;
}
