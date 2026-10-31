import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, HelpCircle, KeyRound, Link2, MousePointer2, Play, ShieldCheck, X } from "lucide-react";
import type { Workspace } from "../shared/types";
import { featureApi as api, usePermission, type Action } from "./access";

import { LinkedInSetupLink } from "./LinkedInSetupLink";

export interface LinkedInSetupConfig { configured: boolean; redirectUri: string }
type Step = "workspace" | "app" | "product" | "callback" | "credentials" | "authorize" | "finish";
type Progress = { status: "active" | "skipped" | "completed"; step: Step; admin?: boolean };
const adminSteps: Step[] = ["workspace", "app", "product", "callback", "credentials", "authorize", "finish"];
const memberSteps: Step[] = ["workspace", "authorize", "finish"];
const titles: Record<Step, string> = { workspace: "A quick readiness check", app: "Open or create your LinkedIn app", product: "Enable account sign-in", callback: "Tell LinkedIn where to return", credentials: "Save your app connection", authorize: "Connect your own account", finish: "Your account is connected" };
function readProgress(key: string): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "null");
    return p && ["active", "skipped", "completed"].includes(p.status) && adminSteps.includes(p.step) && (p.admin === undefined || typeof p.admin === "boolean") ? p : null;
  } catch { return null; }
}

function Illustration({ step }: { step: Step }) {
  const tab = step === "app" ? "My apps" : step === "product" ? "Products" : step === "callback" || step === "credentials" ? "Auth" : "BREKTRA";
  return <div className={`li-guide-illustration li-guide-${step}`} aria-hidden="true">
    <div className="li-guide-browser"><div className="li-guide-browser-bar"><i/><i/><i/><span>{tab === "BREKTRA" ? "Your workspace" : "LinkedIn developer portal · illustration"}</span></div>
      <div className="li-guide-tabs"><span className={tab === "My apps" ? "active" : ""}>My apps</span><span className={tab === "Products" ? "active" : ""}>Products</span><span className={tab === "Auth" ? "active" : ""}>Auth</span></div>
      <div className="li-guide-demo" key={step}>
        {step === "workspace" && <><ShieldCheck size={30}/><strong>Workspace → LinkedIn → Ready</strong><span>We’ll check what is already done.</span></>}
        {step === "app" && <><div className="li-guide-demo-action">Create app <MousePointer2 size={18}/></div><span>One application for your workspace.</span></>}
        {step === "product" && <><strong>Sign In with LinkedIn</strong><span>using OpenID Connect</span><div className="li-guide-demo-action">Request access <MousePointer2 size={18}/></div></>}
        {step === "callback" && <><Link2 size={26}/><span>Authorized redirect URL</span><div className="li-guide-demo-field">Paste BREKTRA’s return address <MousePointer2 size={18}/></div></>}
        {step === "credentials" && <><KeyRound size={26}/><div className="li-guide-demo-field">Client ID</div><div className="li-guide-demo-field">Client secret · ••••••••••</div></>}
        {step === "authorize" && <><div className="li-guide-demo-action">Connect LinkedIn <MousePointer2 size={18}/></div><span>Sign in on LinkedIn, then return here.</span></>}
        {step === "finish" && <><span className="li-guide-success"><Check size={30}/></span><strong>Account connected</strong><span>You’re ready to prepare your first draft.</span></>}
      </div>
    </div>
  </div>;
}

export function LinkedInGuide({ workspace, config, refreshConfig, connect, action, busy }: { workspace: Workspace; config: LinkedInSetupConfig | null; refreshConfig: () => Promise<void>; connect: () => Promise<boolean>; action: Action; busy: boolean }) {
  const manage = usePermission("manage"), operate = usePermission("operate");
  const ownerId = workspace.auth?.user?.id || "local-owner";
  const key = `brektra.linkedin-guide.v1:${workspace.state.companies[0]?.id || "workspace"}:${ownerId}`;
  const [progress, setProgress] = useState<Progress | null>(() => readProgress(key));
  const [open, setOpen] = useState(() => readProgress(key)?.status === "active");
  const [step, setStep] = useState<Step>(() => readProgress(key)?.step || "workspace");
  const [checked, setChecked] = useState(false), [error, setError] = useState("");
  const [clientId, setClientId] = useState(""), [secret, setSecret] = useState(""), [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const persist = (value: Progress) => { const saved = { ...value, admin: value.admin ?? adminRoute }; setProgress(saved); try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* The walkthrough remains usable when browser storage is blocked. */ } };
  const account = workspace.state.accounts.find((a) => a.linkedin?.ownerId === ownerId && a.linkedin.status === "connected" && Date.parse(a.linkedin.expiresAt) > Date.now());
  // Keep the chosen administrator route stable while credentials are saved.
  const [adminRoute, setAdminRoute] = useState(() => manage && (readProgress(key)?.admin ?? !config?.configured));
  const steps = adminRoute ? adminSteps : memberSteps;
  const current = steps.includes(step) ? step : "workspace", index = steps.indexOf(current);
  const leave = () => { setOpen(false); setSecret(""); setClientId(""); persist({ status: "skipped", step: current }); };
  const closeRef = useRef(leave); closeRef.current = leave;
  const go = (next: Step, route = adminRoute) => { setStep(next); setChecked(false); setError(""); setCopied(false); persist({ status: "active", step: next, admin: route }); };
  const start = () => {
    const route = manage && !config?.configured;
    setAdminRoute(route);
    const saved = progress?.status !== "completed" ? progress?.step : undefined;
    const next = account ? "finish" : !config?.configured && (saved === "authorize" || saved === "finish") ? "workspace" : saved === "finish" ? "authorize" : saved && (route || memberSteps.includes(saved)) ? saved : "workspace";
    go(next, route); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") {
        const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary') || [])].filter((el) => el.getClientRects().length);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); returnFocus.current?.focus(); };
  }, [open]);
  useEffect(() => { if (open) { dialog.current?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); } }, [open, current]);
  useEffect(() => {
    if (open && current === "authorize" && account) { setStep("finish"); persist({ status: "active", step: "finish" }); }
  }, [open, current, account?.id]);
  useEffect(() => {
    if (open && config && !config.configured && current === "authorize") {
      setAdminRoute(manage); setStep("workspace"); persist({ status: "active", step: "workspace", admin: manage });
    }
  }, [open, current, config?.configured, manage]);
  if (!operate) return null;
  const waitingAdmin = !manage && !config?.configured;
  const readiness = !!config && workspace.health.sheets.connected && !waitingAdmin;
  const nextAllowed = current === "workspace" ? readiness : ["app", "product", "callback"].includes(current) ? checked : current === "credentials" ? !!config?.configured : false;
  return <>
    <div className="li-guide-invitation">
      <span className="li-guide-invitation-icon"><HelpCircle size={23}/></span>
      <div><strong>{progress ? "LinkedIn setup, at your pace" : "First time connecting LinkedIn?"}</strong><p>{progress?.status === "completed" ? "Revisit the walkthrough whenever you need it." : "Want a step-by-step walkthrough? See one task at a time, with an animated example."}</p></div>
      <div className="feature-actions"><button className="button" disabled={busy || !config} onClick={start}><Play size={14}/>{progress?.status === "skipped" || progress?.status === "active" ? "Resume walkthrough" : progress?.status === "completed" ? "Open walkthrough" : "Start walkthrough"}</button>{!progress && <button className="button li-guide-skip" onClick={() => persist({ status: "skipped", step: "workspace" })}>Skip for now</button>}</div>
    </div>
    {open && <div className="modal-backdrop li-guide-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="li-guide-title" aria-describedby="li-guide-description" className="li-guide-dialog">
      <header className="li-guide-header"><span>LINKEDIN SETUP WALKTHROUGH</span><button className="icon-button" aria-label="Close walkthrough and save progress" onClick={leave}><X size={20}/></button></header>
      <div className="li-guide-progress"><span>Step {index + 1} of {steps.length}</span><div role="progressbar" aria-label="Walkthrough progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}><i style={{ width: `${(index + 1) / steps.length * 100}%` }}/></div><span>{adminRoute ? "Administrator setup" : "Your account"}</span></div>
      <div className="li-guide-layout"><Illustration step={current}/><div className="li-guide-content" key={current}>
        <h2 id="li-guide-title" ref={heading} tabIndex={-1}>{titles[current]}</h2>
        <p id="li-guide-description">{current === "workspace" ? "We’ll use what is already configured. You can pause at any step and come back later." : current === "finish" ? "BREKTRA has a saved, current account connection for you." : "Follow the task below, then continue here. LinkedIn’s page layout may look different from the illustration."}</p>
        {!config && <div className="feature-help"><p>LinkedIn setup status is not available yet. Retry the check, or pause and resume when the server is reachable.</p><button className="button" disabled={busy} onClick={() => void action(async () => { try { await refreshConfig(); setError(""); } catch { setError("Could not read LinkedIn setup. Check the server connection and retry."); throw new Error("Could not read LinkedIn setup."); } })}>Retry setup check</button></div>}
        {current === "workspace" && <><div className="li-guide-check"><Check size={17}/><div><strong>{workspace.health.sheets.connected ? "Sheets workspace ready" : "A Sheets workspace is needed"}</strong><p>{workspace.health.sheets.connected ? "Your account details can be saved safely." : "Close this walkthrough and complete Real workspace setup above, then resume here."}</p></div></div><div className="li-guide-check"><ShieldCheck size={17}/><div><strong>{config?.configured ? "Team application already configured" : manage ? "You’ll configure the team application once" : "Your administrator needs to configure the app"}</strong><p>{config?.configured ? "You can go straight to authorizing your own account." : manage ? "Have your organization’s LinkedIn Page and application details available. Teammates won’t repeat this setup." : "You do not need to create a separate developer app. Ask your BREKTRA administrator to complete the one-time setup."}</p></div></div>{!config?.configured && manage && <p className="feature-help">LinkedIn may require Page approval or product access review. You can save your place while you wait.</p>}{waitingAdmin && <button className="button" disabled={busy} onClick={() => void action(refreshConfig, "LinkedIn setup status refreshed.")}>Check whether the app is ready</button>}</>}
        {current === "app" && <><ol><li>Open LinkedIn’s developer portal and sign in there.</li><li>Open your existing team application, or choose <strong>Create app</strong>.</li><li>Complete LinkedIn’s required fields using your organization’s details. It may ask for a LinkedIn Page, logo and privacy information.</li><li>If Page verification is requested, ask that Page’s administrator to complete it.</li></ol><LinkedInSetupLink/><p className="feature-help">Keep BREKTRA open in this tab. Application creation and any terms acceptance happen on LinkedIn.</p></>}
        {current === "product" && <><ol><li>Inside your LinkedIn application, open <strong>Products</strong>.</li><li>Find <strong>Sign In with LinkedIn using OpenID Connect</strong> and request access.</li><li>Complete any LinkedIn prompts. Wait until this product’s access is available before continuing.</li></ol><LinkedInSetupLink section="Products"/><details><summary>What if access is pending or I can’t find it?</summary><p>Pause the walkthrough and check your application’s verification status. Your LinkedIn Page administrator or LinkedIn support may need to help. BREKTRA cannot approve product access.</p></details><p className="feature-help">This enables account sign-in. It does not grant invitations or messaging.</p></>}
        {current === "callback" && <><ol><li>Open the application’s <strong>Auth</strong> tab.</li><li>Find the authorized redirect URLs and add the exact address below.</li><li>Save the URL in LinkedIn, then return here.</li></ol><LinkedInSetupLink section="Auth"/><code className="feature-code li-guide-callback">{config?.redirectUri}</code><button className="button" onClick={async () => { try { await navigator.clipboard.writeText(config!.redirectUri); setCopied(true); setError(""); } catch { setError("Copy was blocked. Select and copy the address shown above."); } }}><Copy size={14}/>{copied ? "Copied" : "Copy return address"}</button><details><summary>LinkedIn won’t accept this address?</summary><p>Check that you copied it exactly. The portable app uses this computer’s current port; a changed port needs an updated URL. If LinkedIn requires HTTPS, your administrator must configure BREKTRA’s hosted HTTPS address. Do not invent a different callback or bypass browser warnings.</p></details></>}
        {current === "credentials" && <><p>In LinkedIn’s <strong>Auth</strong> tab, find the Client ID and Client Secret. Paste them here; only your administrator does this.</p><LinkedInSetupLink section="Auth"/><form className="feature-fields" onSubmit={(event) => { event.preventDefault(); setError(""); void (async () => { const ok = await action(async () => { try { await api("/linkedin/config", "PUT", { clientId, clientSecret: secret }); setSecret(""); setClientId(""); await refreshConfig(); } catch (e) { setError(e instanceof Error ? e.message : "Configuration could not be saved."); throw e; } }, "LinkedIn application settings saved privately."); if (ok) go("authorize"); })(); }}><label className="field"><span>Client ID</span><input required minLength={5} maxLength={300} autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)}/></label><label className="field"><span>Client Secret</span><input type="password" required minLength={8} maxLength={500} autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)}/></label><p className="feature-help">Stored encrypted on your BREKTRA server. Your LinkedIn password belongs only on LinkedIn. Walkthrough progress never contains these credentials.</p><button className="button primary" disabled={busy || !manage}>Save and continue <ArrowRight size={14}/></button></form>{config?.configured && <p className="feature-help">App settings are already saved. You can continue without entering them again.</p>}</>}
        {current === "authorize" && <><ol><li>Choose <strong>Continue to LinkedIn</strong> below.</li><li>On LinkedIn, check that you are signing into your own intended account. Complete any security checks yourself.</li><li>Review the account sign-in permissions and authorize if you agree. LinkedIn sends you back to BREKTRA.</li></ol><p className="feature-help">BREKTRA will check the returned account before showing success. Keep the app running while you authorize.</p>{new URLSearchParams(location.search).get("linkedin") === "failed" && <p className="feature-error" role="alert">The last authorization did not complete. Check product access and the exact return address, then try again. Reconnect with the same account when restoring a connection.</p>}<button className="button primary" disabled={busy || !config?.configured || !workspace.health.sheets.connected} onClick={() => { persist({ status: "active", step: "authorize" }); void (async () => { const ok = await connect(); if (!ok) setError("Authorization could not start. Check the workspace connection and app settings, then retry."); })(); }}>Continue to LinkedIn <ExternalLink size={14}/></button><p className="feature-help">Saving app credentials alone does not prove LinkedIn access works; this authorization is the real check.</p></>}
        {current === "finish" && (account ? <><div className="li-guide-check"><Check size={18}/><div><strong>{account.name}</strong><p>Account connection confirmed · live invitations and messaging unavailable.</p></div></div><p>Next, choose this account in a campaign, select your leads and prepare a draft for review. Campaigns stay paused until you restart them.</p><button className="button primary" onClick={() => { persist({ status: "completed", step: "finish" }); setOpen(false); }}>Finish walkthrough <Check size={15}/></button></> : <><p>No current account connection was found. Let’s complete authorization before finishing.</p><button className="button" onClick={() => go("authorize")}>Back to account authorization</button></>)}
        {["app", "product", "callback"].includes(current) && <label className="li-guide-confirm"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}/><span>{current === "app" ? "I have opened my application and completed any required Page verification." : current === "product" ? "The OpenID Connect product is available for my application." : "I saved this exact return address in LinkedIn."}</span></label>}
        {error && <p className="feature-error" role="alert">{error}</p>}
      </div></div>
      <footer className="li-guide-footer"><button className="button li-guide-skip" onClick={leave}>{current === "finish" && account ? "Close" : "Skip for now · save my place"}</button><div className="feature-actions">{index > 0 && current !== "finish" && <button className="button" disabled={busy} onClick={() => go(steps[index - 1])}>Back</button>}{index < steps.length - 1 && !["authorize", "finish"].includes(current) && <button className="button primary" disabled={busy || !nextAllowed} onClick={() => go(steps[index + 1])}>{current === "workspace" && config?.configured ? "Go to account authorization" : "Continue"}<ArrowRight size={14}/></button>}</div></footer>
    </div></div>}
  </>;
}
