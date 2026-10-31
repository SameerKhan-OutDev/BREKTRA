import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { AuthStatus, TeamRole, Permission } from "../shared/outreach";
import { usernameHelp, usernamePattern } from "../shared/username";
import { AccessAppearance } from "./Personalization";
import "./access.css";
import { permits } from "../shared/outreach";
export type Action = (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
export const RoleContext = createContext<TeamRole>("owner");
export const usePermission = (permission: Permission) => permits(useContext(RoleContext), permission);
export async function featureApi<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (response.status === 401) window.dispatchEvent(new Event("brektra-signin"));
  if (!response.ok) throw new Error(result.error || "The operation failed.");
  return result;
}
export function AccessGate({ children }: { children: (auth: AuthStatus) => ReactNode }) {
  const [auth, setAuth] = useState<AuthStatus | null>(null), [error, setError] = useState("");
  const [register, setRegister] = useState<boolean | null>(null), [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [invitation, setInvitation] = useState(() => location.hash.startsWith("#join=") ? location.hash.slice(6) : "");
  const refresh = () => featureApi<AuthStatus>("/auth/status").then(setAuth).catch((e) => setError(e.message));
  useEffect(() => { void refresh(); const handler = () => { setAuth(null); void refresh(); }; window.addEventListener("brektra-signin", handler); return () => window.removeEventListener("brektra-signin", handler); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!invitation && (register ?? auth?.setupRequired)) {
        if (password !== confirm) throw new Error("The passwords do not match.");
        const result = await featureApi<{pending:boolean}>("/auth/register", "POST", {name,email,username,password});
        setRegister(false); setPassword(""); setConfirm(""); await refresh();
        setError(result.pending ? "Registration received. An administrator must approve your account before you can sign in." : "Administrator created. Sign in to continue.");
      } else if (invitation) {
        if (password !== confirm) throw new Error("The passwords do not match.");
        await featureApi("/auth/accept", "POST", { token: invitation, password, username });
        setInvitation(""); setPassword(""); setConfirm(""); history.replaceState(null, "", location.pathname);
        setError("Invitation accepted. Sign in using your username or the email address that was invited.");
      } else { await featureApi("/auth/login", "POST", { identifier: email, password }); setPassword(""); await refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); }
    finally { setBusy(false); }
  };
  const switchMode = (value: boolean) => { setRegister(value); setError(""); setPassword(""); setConfirm(""); };
  if (auth?.authenticated && !invitation) return <RoleContext.Provider value={auth.user!.role}>{children(auth)}</RoleContext.Provider>;
  const creating = !invitation && (register ?? auth?.setupRequired);
  return <main className="access-screen"><form className="panel access-card" onSubmit={(e) => void submit(e)}>
    <AccessAppearance />
    <div className="brand-symbol">b<span>↗</span></div><h1>{invitation ? "Join your workspace" : creating ? auth?.setupRequired ? "Create your administrator account" : "Register for BREKTRA" : "Sign in to BREKTRA"}</h1>
    <p>{auth?.hosted ? "Your team's shared workspace. One coordinated runner." : "Access your workspace securely."}</p>
    {auth?.demo && <p className="feature-help">Your registration is remembered on this installation. Demo messages and CRM changes reset on restart; connect Sheets for a lasting workspace.</p>}
    {auth?.setupRequired && !auth.canSetup && <p role="status">Ask the host to create the first administrator account on the computer running BREKTRA.</p>}
    {creating && !auth?.setupRequired && <p>New accounts start with no access. Your administrator approves your account and assigns your role.</p>}
    {error && <p className="feature-error" role="alert">{error}</p>}
    {auth && !invitation && <div className={`access-modes ${creating ? "is-register" : ""}`} aria-label="Account access">
      <span aria-hidden="true"/><button type="button" aria-pressed={!creating} disabled={busy} onClick={() => switchMode(false)}>Sign in</button>
      <button type="button" aria-pressed={!!creating} disabled={busy} onClick={() => switchMode(true)}>Register</button>
    </div>}
    {!auth ? <Loader2 className="spin" aria-label="Checking workspace access" /> : <div className="access-fields" key={invitation ? "invite" : creating ? "register" : "login"}>
      {creating && <label className="field"><span>Name</span><input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)}/></label>}
      {(creating || invitation) && <label className="field"><span>Username</span><input required minLength={3} maxLength={30} pattern={usernamePattern.source} title={usernameHelp} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} /><small>{usernameHelp}</small></label>}
      {!invitation && <label className="field"><span>{creating ? "Email" : "Username or email"}</span><input type={creating ? "email" : "text"} autoCapitalize="none" spellCheck={false} autoComplete={creating ? "email" : "username"} required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      <label className="field"><span>{(invitation || creating) ? "Choose a password (12+ characters)" : "Password"}</span><input type="password" autoComplete={(invitation || creating) ? "new-password" : "current-password"} required minLength={(invitation || creating) ? 12 : 1} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {(invitation || creating) && <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>}
      <button className="button primary" disabled={busy || (!!creating && !!auth?.setupRequired && !auth.canSetup)}>{busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}{invitation ? "Accept invitation" : creating ? "Create account" : "Sign in"}</button>
      {!invitation && <button type="button" className="text-button" disabled={busy} onClick={() => switchMode(!creating)}>{creating ? "Already registered? Sign in" : "New here? Register"}</button>}
    </div>}
  </form></main>;
}
