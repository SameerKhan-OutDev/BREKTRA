import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { AuthStatus, TeamRole, Permission } from "../shared/outreach";
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
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [invitation, setInvitation] = useState(() => location.hash.startsWith("#join=") ? location.hash.slice(6) : "");
  const refresh = () => featureApi<AuthStatus>("/auth/status").then(setAuth).catch((e) => setError(e.message));
  useEffect(() => { void refresh(); const handler = () => { setAuth(null); void refresh(); }; window.addEventListener("brektra-signin", handler); return () => window.removeEventListener("brektra-signin", handler); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (invitation) {
        if (password !== confirm) throw new Error("The passwords do not match.");
        await featureApi("/auth/accept", "POST", { token: invitation, password });
        setInvitation(""); setPassword(""); setConfirm(""); history.replaceState(null, "", location.pathname);
        setError("Invitation accepted. Sign in using the email address that was invited.");
      } else { await featureApi("/auth/login", "POST", { email, password }); setPassword(""); await refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); }
    finally { setBusy(false); }
  };
  if (auth?.authenticated && !invitation) return <RoleContext.Provider value={auth.user!.role}>{children(auth)}</RoleContext.Provider>;
  return <main className="access-screen"><form className="panel access-card" onSubmit={(e) => void submit(e)}>
    <div className="brand-symbol">b<span>↗</span></div><h1>{invitation ? "Join your workspace" : "Sign in to BREKTRA"}</h1>
    <p>{auth?.hosted ? "Your team's shared workspace. One coordinated runner." : "Access your workspace securely."}</p>
    {error && <p className="feature-error" role="alert">{error}</p>}
    {!auth ? <Loader2 className="spin" aria-label="Checking workspace access" /> : <>
      {!invitation && <label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      <label className="field"><span>{invitation ? "Choose a password (12+ characters)" : "Password"}</span><input type="password" autoComplete={invitation ? "new-password" : "current-password"} required minLength={invitation ? 12 : 1} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {invitation && <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>}
      <button className="button primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}{invitation ? "Accept invitation" : "Sign in"}</button>
    </>}
  </form></main>;
}
