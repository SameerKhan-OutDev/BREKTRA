import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, KeyRound, LockKeyhole, Mail, MessageSquare, Plus, Search, Send, ShieldCheck, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import type { Workspace } from "../shared/types";
import type { Member, TeamRole } from "../shared/outreach";
import { featureApi as api, usePermission, type Action } from "./access";
import { usernameHelp, usernamePattern } from "../shared/username";
import { initials } from "./identity";

const roleLabels: Record<TeamRole, string> = { owner: "Owner", admin: "Administrator", operator: "Operator", reviewer: "Reviewer", viewer: "Viewer" };
const roleDetails: Record<TeamRole, string> = {
  owner: "Full workspace access, including administrator management.",
  admin: "Manage the team, connections and workspace settings.",
  operator: "Run campaigns, prepare outreach and review drafts.",
  reviewer: "Review and approve leads and outreach drafts.",
  viewer: "View workspace activity and message teammates.",
};
const statusLabel = (member: Member) => member.pendingApproval ? "Awaiting approval" : member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Access disabled";
const joined = (at: string) => new Date(at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export function Team({ workspace, action, busy }: { workspace: Workspace; action: Action; busy: boolean }) {
  const { state: s, auth } = workspace, manage = usePermission("manage"), me = auth?.user;
  const members = s.members.filter(m => !m.deletedAt && (manage || m.status === "active"));
  const [selected, setSelected] = useState(""), [body, setBody] = useState("");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [showInvite, setShowInvite] = useState(false), [name, setName] = useState(""), [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer"), [roleDraft, setRoleDraft] = useState<TeamRole>("viewer");
  const [inviteUrls, setInviteUrls] = useState<string[]>([]), [inviteScope, setInviteScope] = useState("");
  const [invite, setInvite] = useState(""), [copyStatus, setCopyStatus] = useState("");
  const [oldPassword, setOldPassword] = useState(""), [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState(me?.username || ""), [usernamePassword, setUsernamePassword] = useState("");
  useEffect(() => { setUsername(me?.username || ""); }, [me?.username]);
  const [deleting, setDeleting] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null), inviteRef = useRef<HTMLInputElement>(null);
  const directoryRef = useRef<HTMLElement>(null), conversationRef = useRef<HTMLElement>(null);
  const member = members.find(m => m.id === selected);
  const messages = s.teamMessages.filter(m => (m.senderId === selected && m.recipientId === me?.id) || (m.senderId === me?.id && m.recipientId === selected));
  const roles: TeamRole[] = me?.role === "owner" ? ["owner", "admin", "operator", "reviewer", "viewer"] : ["operator", "reviewer", "viewer"];
  const canManage = manage && !!member && roles.includes(member.role);
  const active = members.filter(m => m.status === "active").length;
  const awaiting = members.filter(m => m.pendingApproval).length;
  const visibleMembers = members.filter(m => `${m.name} ${m.username || ""} ${m.email} ${roleLabels[m.role]}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (filter === "all" || (filter === "active" ? m.status === "active" : m.pendingApproval)));

  useEffect(() => { setRoleDraft(member?.role || "viewer"); setDeleting(false); }, [member?.id, member?.role]);
  useEffect(() => { const list = messagesRef.current; if (list) list.scrollTop = list.scrollHeight; }, [selected, messages.length]);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 900px)").matches) {
      conversationRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [selected]);
  useEffect(() => { if (showInvite) inviteRef.current?.focus(); }, [showInvite]);
  const selectMember = (id: string) => { setSelected(id); setBody(""); };
  const copyInvitation = async () => {
    try { await navigator.clipboard.writeText(invite); setCopyStatus("Link copied"); }
    catch { setCopyStatus("Select the link and copy it manually."); }
  };

  return <div className="team-page">
    <section className="team-overview" aria-label="Team overview">
      <div className="team-overview-symbol"><Users size={24} /></div>
      <div className="team-overview-copy"><strong>A shared workspace. A connected team.</strong><p>Find your people, start a conversation, and keep work moving.</p></div>
      <div className="team-totals"><span><i className="team-status-dot" /><strong>{active}</strong> active</span>{manage && <span className={awaiting ? "team-awaiting" : ""}><UserCheck size={15} /><strong>{awaiting}</strong> awaiting approval</span>}</div>
      {manage && <button className="button primary" aria-expanded={showInvite} aria-controls="team-invitation" onClick={() => setShowInvite(!showInvite)}>{showInvite ? <X size={16} /> : <UserPlus size={17} />}{showInvite ? "Close invitation" : "Invite teammate"}</button>}
    </section>

    {manage && showInvite && <section className="panel team-invitation" id="team-invitation" aria-labelledby="team-invite-title">
      <div className="team-card-heading"><span className="team-section-icon"><UserPlus size={21} /></span><div><h2 id="team-invite-title">Make room for someone new</h2><p>A personal invitation, with the right level of access.</p></div></div>
      <form onSubmit={e => { e.preventDefault(); void action(async () => {
        const result = await api("/team/invitations", "POST", { name, email, role });
        setInvite(result.url); setInviteUrls(result.urls || [result.url]); setInviteScope(result.scope || "local"); setName(""); setEmail(""); setCopyStatus("");
      }, "Invitation created. Share the link with your teammate."); }}>
        <div className="team-invite-fields"><label className="field"><span>Full name</span><input ref={inviteRef} placeholder="e.g. Alex Morgan" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label className="field"><span>Email address</span><input type="email" placeholder="alex@company.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label></div>
        <fieldset className="team-role-options" disabled={busy}><legend>Choose their role</legend>{roles.filter(r => r !== "owner").map(r => <label className={`team-role-option ${role === r ? "selected" : ""}`} key={r}><input type="radio" name="invitation-role" value={r} checked={role === r} onChange={() => setRole(r)} /><span><strong>{roleLabels[r]}</strong><small>{roleDetails[r]}</small></span><Check size={16} aria-hidden="true" /></label>)}</fieldset>
        <div className="team-invite-footer"><span><LockKeyhole size={14} /> One use. Expires in 24 hours.</span><button className="button primary" disabled={busy}><Plus size={16} />Create invitation link</button></div>
      </form>
      {invite && <div className="team-invite-result"><div><span className="team-section-icon"><Check size={19} /></span><div><strong>Your invitation is ready</strong><p>Share this link privately. No email has been sent.</p></div></div>{inviteUrls.length > 1 && <label className="field"><span>Choose the network used by your teammate</span><select value={invite} onChange={e => {setInvite(e.target.value); setCopyStatus("");}}>{inviteUrls.map(url => <option key={url} value={url}>{new URL(url).origin}</option>)}</select></label>}<div className="team-copy-row"><input aria-label="Invitation link" readOnly value={invite} onFocus={e => e.target.select()} /><button type="button" className="button" onClick={() => void copyInvitation()}><Copy size={15} />Copy link</button></div><p className="team-link-hint">{inviteScope === "lan" ? "This link uses this PC’s LAN address. Teammates must be on the same network; keep this PC awake and BREKTRA running." : inviteScope === "hosted" ? "Share this workspace link with your teammate." : "This link works only on this PC. Enable LAN sharing and create a new invitation to invite another device."}</p>{copyStatus && <p role="status">{copyStatus}</p>}</div>}
    </section>}

    <div className="team-workspace">
      <section ref={directoryRef} className="panel team-directory" aria-labelledby="team-directory-title">
        <div className="team-directory-heading"><div><h2 id="team-directory-title">Your people <span>{members.length}</span></h2><p>One team, a little closer.</p></div><Users size={19} /></div>
        <div className="team-directory-tools"><label className="team-search"><Search size={16} /><input aria-label="Search teammates" placeholder="Search name, username, email or role" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear team search" onClick={() => setQuery("")}><X size={14} /></button>}</label><div className="team-filters" aria-label="Filter teammates">{[{ id: "all", label: "Everyone" }, { id: "active", label: "Active" }, ...(manage ? [{ id: "pending", label: `Pending${awaiting ? ` · ${awaiting}` : ""}` }] : [])].map(f => <button key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? "selected" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div></div>
        <div className="team-member-list">{visibleMembers.length ? visibleMembers.map(m => <button className={`team-person ${selected === m.id ? "selected" : ""}`} key={m.id} onClick={() => selectMember(m.id)} aria-pressed={selected === m.id}>
          <span className={`team-avatar ${m.role === "owner" || m.role === "admin" ? "admin" : ""}`}>{initials(m.name)}<i className={`team-presence ${m.status === "active" ? "active" : m.pendingApproval ? "pending" : "inactive"}`} /></span>
          <span className="team-person-copy"><strong>{m.name}{m.id === me?.id && <small>You</small>}</strong><span>{m.username ? `@${m.username} · ` : ""}{m.email}</span><span className="team-person-meta">{roleLabels[m.role]}<i />{statusLabel(m)}</span></span><ChevronRight size={16} className="team-person-arrow" />
        </button>) : <div className="team-list-empty"><Search size={22} /><strong>No teammates found</strong><p>Try another name or change the filter.</p><button className="text-button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div>}</div>
        <details className="team-role-guide"><summary><ShieldCheck size={15} /><span>Who can do what?</span><ChevronDown size={15} /></summary><dl>{Object.entries(roleLabels).map(([r, label]) => <div key={r}><dt>{label}</dt><dd>{roleDetails[r as TeamRole]}</dd></div>)}</dl><p>All active members can message each other.</p></details>
      </section>

      <section ref={conversationRef} className="panel team-conversation" aria-label="Private team messages">
        {member ? <>
          <button className="team-back" onClick={() => directoryRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}><ArrowLeft size={15}/>Back to your people</button>
          <header className="team-profile"><span className={`team-avatar large ${member.role === "owner" || member.role === "admin" ? "admin" : ""}`}>{initials(member.name)}</span><div className="team-profile-copy"><h2>{member.name}{member.id === me?.id && <span>You</span>}</h2><p>{roleLabels[member.role]}</p></div><span className={`team-state ${member.pendingApproval ? "pending" : member.status === "active" ? "active" : "inactive"}`}><i />{statusLabel(member)}</span></header>
          <div className="team-profile-facts"><span><Mail size={13} />{member.email}</span>{member.username && <span>@{member.username}</span>}<span>Joined {joined(member.createdAt)}</span></div>
          {canManage && <details className="team-access" key={member.id}><summary><ShieldCheck size={15} /><span>Manage access</span>{member.pendingApproval && <span className="team-access-attention">Approval needed</span>}<ChevronDown size={15} /></summary><div className="team-access-body"><p>{member.pendingApproval ? "Review this registration, choose a role, then approve access." : "Role changes sign this teammate out so their next session uses the new permissions."}</p><div className="team-access-controls"><label className="field"><span>Workspace role</span><select aria-label={`Role for ${member.name}`} value={roleDraft} disabled={busy || member.status === "invited"} onChange={e => setRoleDraft(e.target.value as TeamRole)}>{roles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><button className="button" disabled={busy || member.status === "invited" || roleDraft === member.role} onClick={() => void action(() => api(`/team/members/${member.id}`, "PATCH", { role: roleDraft, status: member.status }), "Role updated. Member must sign in again.")}><Check size={15} />Save role</button>{member.status !== "invited" && member.id !== me?.id && <button className={`button ${member.status === "active" ? "" : "primary"}`} disabled={busy} onClick={() => void action(() => api(`/team/members/${member.id}`, "PATCH", { role: roleDraft, status: member.status === "active" ? "disabled" : "active" }), "Member access updated.")}><UserCheck size={15} />{member.pendingApproval ? "Approve member" : member.status === "active" ? "Disable access" : "Enable access"}</button>}</div>
            {member.id !== me?.id && <div className="team-remove"><button className="text-button danger-text" disabled={busy} onClick={() => setDeleting(!deleting)}><Trash2 size={14} />Remove from team</button>{deleting && <div className="team-delete-confirm" role="group" aria-label={`Confirm removal of ${member.name}`}><strong>Remove {member.name}?</strong><p>They will lose access immediately. Historical records are retained.</p><div><button className="button" disabled={busy} onClick={() => setDeleting(false)}>Keep member</button><button className="button danger-text" disabled={busy} onClick={() => void action(async () => { await api(`/team/members/${member.id}`, "DELETE"); setDeleting(false); setSelected(""); }, "Member removed.")}><Trash2 size={15} />Confirm removal</button></div></div>}</div>}
          </div></details>}
          {member.id === me?.id ? <div className="team-chat-empty"><span className="team-empty-symbol"><Users size={30} /></span><h3>This is your place in the team.</h3><p>Select someone from the directory to start a private conversation.</p></div> : <>
            <div className="team-conversation-label"><MessageSquare size={14} /><strong>Conversation</strong><span><LockKeyhole size={12} />Only you and {member.name.split(" ")[0]}</span></div>
            <div className="team-messages" ref={messagesRef} role="log" aria-label={`Conversation with ${member.name}`} aria-live="polite" aria-relevant="additions">
              {messages.length ? messages.map(m => <article key={m.id} className={`team-message ${m.senderId === me?.id ? "mine" : ""}`}><div className="team-message-meta"><strong>{m.senderId === me?.id ? "You" : member.name.split(" ")[0]}</strong><time dateTime={m.at} title={new Date(m.at).toLocaleString()}>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{m.body}</p></article>) : <div className="team-chat-empty small"><span className="team-empty-symbol"><MessageSquare size={25} /></span><h3>A simple hello goes a long way.</h3><p>Start your conversation with {member.name.split(" ")[0]}.</p></div>}
            </div>
            <form className="team-compose" onSubmit={e => { e.preventDefault(); const text = body, recipientId = member.id; void action(async () => { await api("/team/messages", "POST", { recipientId, body: text }); setBody(current => current === text ? "" : current); }, "Message sent."); }}>
              <label className="field"><span className="sr-only">Message {member.name}</span><textarea placeholder={member.status === "active" ? `Write a message to ${member.name.split(" ")[0]}…` : "Messaging is available once this member is active."} required maxLength={4000} rows={3} value={body} disabled={busy || member.status !== "active"} onChange={e => setBody(e.target.value)} /></label><div className="team-compose-footer"><span>{body.length ? `${body.length.toLocaleString()} / 4,000` : "A little conversation. A lot of possibility."}</span><button className="button primary" disabled={busy || !body.trim() || member.status !== "active"}>Send message<Send size={16} /></button></div>
            </form>
          </>}
        </> : <div className="team-welcome"><div className="team-welcome-art" aria-hidden="true"><span>{me ? initials(me.name) : <Users size={20}/>}</span><span><MessageSquare size={32} /></span><span>{members.find(m => m.id !== me?.id) ? initials(members.find(m => m.id !== me?.id)!.name) : <UserPlus size={20}/>}</span></div><span className="team-eyebrow">BETTER, TOGETHER</span><h2>Good work starts<br />with a conversation.</h2><p>Choose a teammate to see their profile,<br />share an update, or just say hello.</p><div><LockKeyhole size={14} />Your conversations stay between the two of you.</div></div>}
      </section>
    </div>

    <section className="panel team-security"><div className="team-security-body"><div><h3>Your username</h3><p>Sign in with your username or email. {usernameHelp}</p><p>Current: {me?.username ? `@${me.username}` : "Email sign-in only — choose a username below."}</p></div><form onSubmit={e => { e.preventDefault(); void action(async () => { await api("/team/username", "PATCH", {username, current: usernamePassword}); setUsernamePassword(""); }, "Username updated."); }}><label className="field"><span>Username</span><input required minLength={3} maxLength={30} pattern={usernamePattern.source} title={usernameHelp} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} /></label><label className="field"><span>Current password</span><input required type="password" autoComplete="current-password" maxLength={200} value={usernamePassword} onChange={e => setUsernamePassword(e.target.value)} /></label><button className="button" disabled={busy || username.trim().toLowerCase() === me?.username}>Save username</button></form></div></section>
    <details className="panel team-security"><summary><span className="team-section-icon"><KeyRound size={20} /></span><span><strong>Your account security</strong><small>Keep your password up to date.</small></span><ChevronDown size={17} /></summary><div className="team-security-body"><div><h3>A fresh password, a safer workspace.</h3><p>Use at least 12 characters. Updating your password signs you out on every device.</p></div><form onSubmit={e => { e.preventDefault(); void action(async () => { await api("/team/password", "POST", { current: oldPassword, next: newPassword }); window.dispatchEvent(new Event("brektra-signin")); }); }}><label className="field"><span>Current password</span><input type="password" autoComplete="current-password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} /></label><label className="field"><span>New password</span><input type="password" placeholder="At least 12 characters" autoComplete="new-password" required minLength={12} maxLength={200} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button className="button" disabled={busy}><KeyRound size={15} />Update password & sign out</button></form></div></details>
  </div>;
}
