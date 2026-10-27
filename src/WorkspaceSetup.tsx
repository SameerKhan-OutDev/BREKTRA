import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Loader2, Play, RefreshCw } from "lucide-react";
import type { Workspace } from "../shared/types";
import { downloadableModels, type SetupStatus, type SheetsSetupCheck } from "../shared/setup";
import { featureApi as api, usePermission, type Action } from "./access";

export function WorkspaceSetup({ workspace, action, busy }: { workspace: Workspace; action: Action; busy: boolean }) {
  const manage = usePermission("manage");
  const [status, setStatus] = useState<SetupStatus>();
  const [error, setError] = useState("");
  const [spreadsheet, setSpreadsheet] = useState("");
  const [fileName, setFileName] = useState("");
  const [serviceEmail, setServiceEmail] = useState("");
  const credential = useRef("");
  const fileRead = useRef(0);
  const [checked, setChecked] = useState<SheetsSetupCheck>();
  const [confirmed, setConfirmed] = useState(false);
  const [selectedModel, setSelectedModel] = useState(workspace.health.ollama.model);
  const refresh = async () => { const next = await api<SetupStatus>("/setup"); setStatus(next); return next; };
  useEffect(() => {
    if (!manage) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const next = await api<SetupStatus>("/setup"); if (active) setStatus(next); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "Setup status is unavailable."); }
      if (active) timer = setTimeout(() => void poll(), 3000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); credential.current = ""; };
  }, [manage]);
  if (!manage) return null;
  const run = (fn: () => Promise<unknown>, message?: string) => action(async () => {
    setError("");
    try { const result = await fn(); await refresh(); return result; }
    catch (e) { setError(e instanceof Error ? e.message : "Setup failed. Try again."); throw e; }
  }, message);
  const ai = status?.ai || workspace.health.ollama;
  const downloading = status?.download?.status === "downloading";
  const models = [...new Set([...downloadableModels, ...ai.models, selectedModel])];
  const local = status?.local;
  return <section className="panel workspace-setup" aria-labelledby="workspace-setup-title">
    <div className="panel-header"><div><h2 id="workspace-setup-title">Real workspace setup</h2><p>Connect your spreadsheet and local AI without terminal commands.</p></div>
      <span className={`badge ${status?.connected ? "green" : "neutral"}`}>{status?.connected ? "Sheets connected" : "Setup"}</span>
    </div>
    {error && <p className="feature-error" role="alert">{error}</p>}
    {!status ? <p><Loader2 className="spin" size={16} /> Checking setup…</p> : !local ?
      <p>This workspace uses operator-managed connection settings. Your administrator configures Google access and Ollama on the server using the hosted setup guide. Service health is shown below.</p> : <div className="workspace-setup-steps">
      <section className="setup-step">
        <h3><span className="setup-step-number">1</span> Connect Google Sheets {status.connected && <Check size={17} />}</h3>
        {status.connected ? <>
          <p>Your real workspace is active. Credentials are kept on this machine. {status.serviceEmail && <>Google service account: <strong>{status.serviceEmail}</strong>.</>}</p>
          <div className="setup-buttons">
            <a className="button" target="_blank" rel="noreferrer" href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(status.spreadsheetId)}/edit`}>Open workspace sheet <ExternalLink size={14} /></a>
            <button className="button" disabled={busy} onClick={() => void run(() => api("/integrations/reconnect", "POST"), "Workspace connection checked.")}><RefreshCw size={14} /> Reconnect & sync</button>
          </div>
        </> : <>
          <p>Choose your Google service-account key, then paste the URL of a dedicated spreadsheet. BREKTRA checks access and prepares its tabs when you connect.</p>
          <details className="setup-help"><summary>First time connecting Google?</summary>
            <p>Google requires you to authorize access once. Enable the Sheets API, create a service account and download its JSON key. Your Google administrator may need to do this.</p>
            <div className="setup-buttons">
              <a className="button" href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noreferrer">Enable Sheets API <ExternalLink size={14} /></a>
              <a className="button" href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer">Google service accounts <ExternalLink size={14} /></a>
            </div>
          </details>
          <label className="field"><span>Google service-account JSON key</span><input type="file" accept=".json,application/json" disabled={busy} onChange={async (e) => {
            const read = ++fileRead.current;
            setChecked(undefined); setConfirmed(false); setServiceEmail(""); credential.current = ""; setFileName(""); setError("");
            const file = e.target.files?.[0]; if (!file) return;
            try {
              if (file.size > 32000) throw new Error("Choose the service-account JSON key file (up to 32 KB).");
              const text = await file.text(), json = JSON.parse(text);
              if (read !== fileRead.current) return;
              if (json.type !== "service_account" || typeof json.client_email !== "string" || typeof json.private_key !== "string") throw new Error();
              credential.current = text; setServiceEmail(json.client_email); setFileName(file.name);
            } catch { setError("Choose a valid Google service-account JSON key file (up to 32 KB)."); }
          }} /><small>The key is stored encrypted on this machine after a successful connection. It is excluded from shared app packages.</small></label>
          {serviceEmail && <div className="setup-share"><p>In Google Sheets, click <strong>Share</strong> and give this account <strong>Editor</strong> access:</p>
            <code>{serviceEmail}</code><button className="button" disabled={busy} onClick={() => { void navigator.clipboard.writeText(serviceEmail).catch(() => setError("Select and copy the service-account email shown above.")); }}><Copy size={14} /> Copy email</button>
          </div>}
          <label className="field"><span>Control spreadsheet URL or ID</span><input value={spreadsheet} disabled={busy} placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(e) => { setSpreadsheet(e.target.value); setChecked(undefined); setConfirmed(false); }} /></label>
          <div className="setup-buttons">
            <a className="button" href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noreferrer">Create a blank spreadsheet <ExternalLink size={14} /></a>
            <button className="button" disabled={busy || !fileName || !spreadsheet.trim()} onClick={() => void run(async () => {
              setChecked(undefined); setConfirmed(false);
              setChecked(await api<SheetsSetupCheck>("/setup/sheets/check", "POST", { spreadsheet, credentialFile: credential.current }));
            })}><RefreshCw size={14} /> Check spreadsheet</button>
          </div>
          {checked && <div className="setup-checked" role="status">
            <p><Check size={16} /> Read check passed: {checked.counts.leads} saved leads, {checked.counts.campaigns} campaigns and {checked.counts.conversations} conversations. {checked.missingTabs ? `${checked.missingTabs} BREKTRA tabs will be created.` : "BREKTRA tabs are already present."}</p>
            <p>Connecting replaces the temporary demo with this sheet's workspace. Demo records are not copied. Existing campaigns and mailbox sending will be paused.</p>
            <label className="setup-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} /> Use this dedicated spreadsheet and prepare the BREKTRA workspace.</label>
            <button className="button primary" disabled={busy || !confirmed} onClick={() => void run(async () => {
              try { await api("/setup/sheets/connect", "POST", { checkId: checked.checkId, confirmed: true }); credential.current = ""; setFileName(""); }
              finally { setChecked(undefined); setConfirmed(false); }
            }, "Google Sheets connected. Your real workspace is ready; sending remains paused.")}>Connect workspace</button>
          </div>}
        </>}
      </section>
      <section className="setup-step">
        <h3><span className="setup-step-number">2</span> Prepare local AI {ai.connected && ai.models.includes(ai.model) && <Check size={17} />}</h3>
        <p>{ai.detail}</p>
        <div className="setup-buttons">
          <a className="button" href="https://ollama.com/download/windows" target="_blank" rel="noreferrer">Install Ollama <ExternalLink size={14} /></a>
          <button className="button" disabled={busy || ai.connected} onClick={() => void run(() => api("/setup/ollama/start", "POST"), "Ollama is running.")}><Play size={14} /> Start Ollama</button>
          <button className="button" disabled={busy} onClick={() => void run(() => api("/integrations/check", "POST"), "Local AI connection checked.")}><RefreshCw size={14} /> Check connection</button>
        </div>
        <label className="field"><span>AI model</span><select value={selectedModel} disabled={busy || downloading} onChange={(e) => setSelectedModel(e.target.value)}>{models.map((model) => <option key={model} value={model}>{model}{ai.models.includes(model) ? " · installed" : model === "qwen3:4b" ? " · standard" : model === "qwen3:1.7b" ? " · smaller download" : ""}</option>)}</select></label>
        <div className="setup-buttons">
          <button className="button" disabled={busy || !ai.connected || downloading || !downloadableModels.some((m) => m === selectedModel)} onClick={() => void run(() => api("/setup/ollama/pull", "POST", { model: selectedModel }))}><Download size={14} /> Download model</button>
          <button className="button primary" disabled={busy || downloading || !ai.models.includes(selectedModel)} onClick={() => void run(() => api("/setup/ollama/model", "POST", { model: selectedModel }), "AI model selected. No restart needed.")}>Use this model</button>
        </div>
        <p className="muted">Model downloads can use gigabytes of disk space and internet data. The selected model is saved automatically after a successful download.</p>
        {status.download && <div className="setup-download" role="status" aria-live="polite">
          <p>{status.download.model}: {status.download.detail}</p>
          {downloading && <>
            {status.download.total > 0 ? <progress aria-label="Model download progress" value={Math.min(status.download.completed, status.download.total)} max={status.download.total} /> : <progress aria-label="Model download in progress" />}
            <button className="button" disabled={busy} onClick={() => void run(() => api("/setup/ollama/cancel", "POST"))}>Cancel download</button>
          </>}
        </div>}
      </section>
      <p className="setup-finish-note">Your choices are saved privately and restored next time BREKTRA starts. You do not need to edit environment files or restart after connecting. Lead import and Gmail authorization remain separate steps; no message is sent during setup.</p>
    </div>}
  </section>;
}
