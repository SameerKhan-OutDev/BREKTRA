import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wifi,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  Account,
  Campaign,
  Draft,
  Job,
  Mode,
  State,
  Workspace,
} from "../shared/types";

type Page =
  | "Dashboard"
  | "Campaigns"
  | "Leads"
  | "Review queue"
  | "Activity"
  | "Settings";
const nav: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Campaigns", icon: Layers3 },
  { name: "Leads", icon: Users },
  { name: "Review queue", icon: ListChecks },
  { name: "Activity", icon: ActivityIcon },
  { name: "Settings", icon: Settings2 },
];
const modeLabel: Record<Mode, string> = {
  requests: "Connection requests",
  pitching: "Pitching",
  balanced: "Requests + pitching",
};
const relationshipLabel = {
  connected: "Connected",
  not_connected: "Not connected",
  pending: "Request pending",
  unknown: "Needs verification",
};
const number = (n: number) => new Intl.NumberFormat().format(n);
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Karachi",
  });
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
const localDay = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
async function api<T = any>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed.");
  return json;
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = Layers3,
  title,
  detail,
  action,
}: {
  icon?: typeof Layers3;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [page, setPage] = useState<Page>("Dashboard");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<
    "campaign" | "import" | "account" | "guide" | null
  >(null);
  const [editing, setEditing] = useState<Campaign | undefined>();
  const [range, setRange] = useState("7");
  const [from, setFrom] = useState(
    localDay(new Date(Date.now() - 6 * 86400000).toISOString()),
  );
  const [to, setTo] = useState(localDay(new Date().toISOString()));
  const refresh = async () => {
    try {
      const data = await api<Workspace>("/workspace");
      setWorkspace(data);
      setOffline(false);
    } catch (e) {
      setOffline(true);
      throw e;
    }
  };
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const action = async (fn: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      if (message) setToast(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: Page) => {
    setPage(next);
    setSidebar(false);
    setError("");
  };
  const create = () => {
    setEditing(undefined);
    setModal("campaign");
  };
  if (!workspace)
    return (
      <main className="loading-screen">
        <div className="brand-symbol">
          b<span>↗</span>
        </div>
        <h2>Opening your workspace</h2>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => void refresh().catch((e) => setError(e.message))}
            >
              Try again
            </button>
          </>
        ) : (
          <Loader2 className="spin" size={23} />
        )}
      </main>
    );
  const { state: s, health: h } = workspace;
  const pending = s.drafts.filter((d) => d.status === "pending").length;
  const goCampaign = (campaign: Campaign) => {
    setEditing(campaign);
    setModal("campaign");
  };
  const close = () => setModal(null);
  const filteredActivity = s.activity.filter((a) => {
    const day = localDay(a.at);
    const today = localDay(new Date().toISOString());
    if (range === "custom") return day >= from && day <= to;
    if (range === "month") return day.slice(0, 7) === today.slice(0, 7);
    if (range === "year") return day.slice(0, 4) === today.slice(0, 4);
    return (
      day >= localDay(new Date(Date.now() - 6 * 86400000).toISOString()) &&
      day <= today
    );
  });
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigate("Dashboard");
          }}
        >
          <div className="brand-symbol">
            b<span>↗</span>
          </div>
          <span>
            BREKTRA<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">B</span>
          <div>
            <strong>My workspace</strong>
            <span>Personal workspace</span>
          </div>
          <Badge tone="neutral">LOCAL</Badge>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              aria-current={page === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Review queue" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <div className="local-card-heading">
              <span className={`status-dot ${offline ? "red" : ""}`} />
              <strong>
                {offline ? "Server disconnected" : "Running on your machine"}
              </strong>
            </div>
            <p>Your workspace, your control.</p>
            <span>
              <ShieldCheck size={13} /> Sessions stay local
            </span>
          </div>
          <button
            className="nav-item help-link"
            onClick={() => setModal("guide")}
          >
            <CircleHelp size={19} />
            <span>Getting started</span>
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-profile">
            <div className="avatar navy">B</div>
            <div>
              <strong>BREKTRA workspace</strong>
              <span>Foundation · v0.1</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <span className="status-dot" /> Local workspace
            </span>
            <button
              className="icon-button notification-button"
              aria-label={`${pending} drafts awaiting review`}
              onClick={() => navigate("Review queue")}
            >
              <Bell size={19} />
              {pending > 0 && <span />}
            </button>
            <div className="avatar navy small">B</div>
          </div>
        </header>
        <main className="main-content">
          <div className={`mode-banner ${h.mode === "sheets" ? "live" : ""}`}>
            <span>
              <ShieldCheck size={15} />
              <strong>
                {h.mode === "demo" ? "Demo workspace" : "Sheets workspace"}
              </strong>
              <span className="banner-detail">
                {h.mode === "demo"
                  ? "Sample data · actions are simulated · resets on restart"
                  : "Data persists in Google Sheets · LinkedIn sending is unavailable"}
              </span>
            </span>
            <button onClick={() => navigate("Settings")}>
              {h.mode === "demo"
                ? "Connect your tools"
                : "Integration settings"}
              <ArrowRight size={14} />
            </button>
          </div>
          {offline && (
            <div className="error-box" role="alert">
              The local server is disconnected. Showing the last loaded data.
            </div>
          )}
          {error && !modal && (
            <div className="error-box" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR OUTREACH, IN FOCUS</div>
              <h1>
                {page === "Dashboard"
                  ? "A little connection. A lot of possibility."
                  : page}
              </h1>
              <p>
                {
                  {
                    Dashboard:
                      "Your campaigns, conversations, and next opportunities. All in one place.",
                    Campaigns:
                      "Turn the right audience into meaningful conversations.",
                    Leads:
                      "Get to know the people behind your next opportunity.",
                    "Review queue": "A human touch before every conversation.",
                    Activity:
                      "A clear record of what happened, and what needs attention.",
                    Settings: "Connect your tools. Keep your workspace local.",
                  }[page]
                }
              </p>
            </div>
            {page === "Dashboard" || page === "Campaigns" ? (
              <button className="button primary" onClick={create}>
                <Plus size={17} /> New campaign
              </button>
            ) : page === "Leads" ? (
              <button
                className="button primary"
                onClick={() => setModal("import")}
              >
                <Plus size={17} /> Import from Sheets
              </button>
            ) : page === "Settings" ? (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => api("/integrations/check", "POST"),
                    "Integration status refreshed.",
                  )
                }
              >
                <RefreshCw size={16} className={busy ? "spin" : ""} /> Check
                connections
              </button>
            ) : null}
          </div>
          {page === "Dashboard" && (
            <>
              <div className="section-toolbar">
                <div className="section-caption">
                  <span className="status-dot" /> Workspace overview
                </div>
                <div className="range-controls">
                  {range === "custom" && (
                    <>
                      <input
                        aria-label="Start date"
                        type="date"
                        value={from}
                        max={to}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <span>to</span>
                      <input
                        aria-label="End date"
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </>
                  )}
                  <Clock3 size={15} />
                  <select
                    aria-label="Dashboard date range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="month">This month</option>
                    <option value="year">This year</option>
                    <option value="custom">Custom dates</option>
                  </select>
                </div>
              </div>
              <Dashboard
                s={s}
                events={filteredActivity}
                demo={h.mode === "demo"}
                create={create}
                navigate={navigate}
                edit={goCampaign}
              />
            </>
          )}
          {page === "Campaigns" && (
            <Campaigns
              s={s}
              busy={busy}
              action={action}
              create={create}
              edit={goCampaign}
            />
          )}
          {page === "Leads" && (
            <Leads
              s={s}
              busy={busy}
              action={action}
              importLeads={() => setModal("import")}
            />
          )}
          {page === "Review queue" && (
            <Review
              s={s}
              busy={busy}
              action={action}
              demo={h.mode === "demo"}
            />
          )}
          {page === "Activity" && <ActivityPage s={s} />}
          {page === "Settings" && (
            <Settings
              workspace={workspace}
              busy={busy}
              action={action}
              addAccount={() => setModal("account")}
            />
          )}
          <footer>
            <span>
              <div className="tiny-brand">b↗</div> Built for meaningful
              connections.
            </span>
            <span>
              Local workspace <span className="footer-dot">·</span> Asia/Karachi
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
        </div>
      )}
      {modal && error && (
        <div className="toast error-toast" role="alert">
          <XCircle size={18} />
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss form error"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal === "campaign" && (
        <CampaignForm
          s={s}
          campaign={editing}
          close={close}
          busy={busy}
          action={action}
        />
      )}
      {modal === "import" && (
        <ImportForm
          workspace={workspace}
          close={close}
          busy={busy}
          action={action}
          settings={() => {
            close();
            navigate("Settings");
          }}
        />
      )}
      {modal === "account" && (
        <AccountForm close={close} busy={busy} action={action} />
      )}
      {modal === "guide" && (
        <Modal
          title="Your first campaign starts here"
          subtitle="A few small steps to a working outreach flow."
          close={close}
        >
          <div className="guide-steps">
            {[
              [
                "Explore the sample workspace",
                "The demo account, leads, and pitch let you try the workflow without contacting anyone.",
              ],
              [
                "Create or edit a campaign",
                "Choose your audience, account, targeting, and working hours. Start the demo campaign to process eligible leads.",
              ],
              [
                "Review a pitch",
                "Edit a draft, approve it, or reject it. Demo approvals queue a simulated delivery.",
              ],
              [
                "Connect your real tools",
                "Use Settings to configure Google Sheets persistence and Ollama. Browser integration is a later milestone.",
              ],
            ].map(([title, detail], i) => (
              <div key={title}>
                <span>{i + 1}</span>
                <section>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </section>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={close}>
              Got it <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Dashboard({
  s,
  events,
  demo,
  create,
  navigate,
  edit,
}: {
  s: State;
  events: State["activity"];
  demo: boolean;
  create: () => void;
  navigate: (p: Page) => void;
  edit: (c: Campaign) => void;
}) {
  const requests = events.filter((a) => a.kind === "request").length;
  const pitches = events.filter((a) => a.kind === "pitch").length;
  const drafts = events.filter((a) => a.kind === "draft").length;
  const pending = s.drafts.filter((d) => d.status === "pending").length;
  const stats = [
    {
      label: demo ? "Requests simulated" : "Requests sent",
      value: requests,
      icon: Send,
      color: "blue",
      detail: demo ? "Demo actions only" : "No live sending connected",
    },
    {
      label: "Acceptances detected",
      value: events.filter((a) => a.kind === "acceptance").length,
      icon: Users,
      color: "green",
      detail: "Detection not connected yet",
    },
    {
      label: demo ? "Pitches simulated" : "Pitches sent",
      value: pitches,
      icon: MessageSquare,
      color: "purple",
      detail: `${drafts} drafts prepared in this period`,
    },
    {
      label: "Waiting for your review",
      value: pending,
      icon: ListChecks,
      color: "orange",
      detail: pending
        ? "Your next conversation starts here"
        : "You’re all caught up",
    },
  ];
  const bars = Array.from({ length: 7 }, (_, i) => {
    const at = new Date(Date.now() - (6 - i) * 86400000);
    const day = localDay(at.toISOString());
    return {
      label: at.toLocaleDateString("en", {
        weekday: "short",
        timeZone: "Asia/Karachi",
      }),
      requests: events.filter(
        (a) => a.kind === "request" && localDay(a.at) === day,
      ).length,
      pitches: events.filter(
        (a) => a.kind === "pitch" && localDay(a.at) === day,
      ).length,
    };
  });
  const max = Math.max(4, ...bars.map((b) => b.requests + b.pitches));
  return (
    <>
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, color, detail }) => (
          <section className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={17} />
              </span>
            </div>
            <strong>{number(value)}</strong>
            <div className="stat-detail">
              {value > 0 ? (
                <span className={`mini-dot ${color}`} />
              ) : (
                <span className="mini-dot" />
              )}
              {detail}
            </div>
          </section>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Outreach activity</h2>
              <p>
                {demo
                  ? "Simulated requests and pitches over the last 7 days"
                  : "Confirmed requests and pitches over the last 7 days"}
              </p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-blue" /> Requests
              </span>
              <span>
                <i className="legend-orange" /> Pitches
              </span>
            </div>
          </div>
          <div className="chart">
            <div className="y-labels">
              {[
                max,
                Math.round(max * 0.75),
                Math.round(max * 0.5),
                Math.round(max * 0.25),
                0,
              ].map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
            <div className="chart-body">
              <div className="chart-grid">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} />
                ))}
              </div>
              <div className="chart-bars">
                {bars.map((b, i) => (
                  <div className="chart-day" key={i}>
                    <div
                      className="bar-track"
                      aria-label={`${b.label}: ${b.requests} requests, ${b.pitches} pitches`}
                    >
                      <div
                        className="bar requests"
                        style={{ height: `${(b.requests / max) * 100}%` }}
                      />
                      <div
                        className="bar pitches"
                        style={{ height: `${(b.pitches / max) * 100}%` }}
                      />
                    </div>
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
              {requests + pitches === 0 && (
                <div className="chart-empty">
                  <ActivityIcon size={21} />
                  <strong>Every conversation starts somewhere.</strong>
                  <span>Activity will appear as campaigns run.</span>
                </div>
              )}
            </div>
          </div>
          <div className="chart-foot">
            <span>
              <span className="status-dot" /> Updates automatically
            </span>
            <span>Asia/Karachi</span>
          </div>
        </section>
        <section className="opportunity-card">
          <span className="opportunity-icon">
            <Sparkles size={23} />
          </span>
          <div className="opportunity-art">
            <div />
            <div />
            <div />
            <Send size={34} />
          </div>
          <div className="eyebrow">MAKE THE FIRST MOVE</div>
          <h2>
            Good connections.
            <br />
            Great possibilities.
          </h2>
          <p>
            Choose your audience. Add your voice. Let your next campaign bring
            the right people closer.
          </p>
          <button className="button dark" onClick={create}>
            Create a campaign <ArrowRight size={16} />
          </button>
          <span className="opportunity-note">
            <ShieldCheck size={13} /> Review before you reach out
          </span>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Your campaigns{" "}
                <span className="count-label">{s.campaigns.length}</span>
              </h2>
              <p>A little progress, every day.</p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("Campaigns")}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          {s.campaigns.length ? (
            <div className="compact-campaigns">
              {s.campaigns.slice(0, 3).map((c) => (
                <button
                  key={c.id}
                  className="compact-campaign"
                  onClick={() => edit(c)}
                >
                  <span className={`campaign-icon ${c.mode}`}>
                    <Target size={19} />
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <span>
                      {modeLabel[c.mode]} <span className="text-dot">·</span>{" "}
                      {
                        s.leads.filter(
                          (l) =>
                            l.sourceId === c.sourceId &&
                            l.accountId === c.accountId,
                        ).length
                      }{" "}
                      leads
                    </span>
                  </div>
                  <Badge tone={c.status === "running" ? "green" : "neutral"}>
                    <span className="badge-dot" />
                    {c.status}
                  </Badge>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh start"
              detail="Create your first campaign to get things moving."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>The latest from your workspace.</p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("Activity")}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="recent-activity">
            {events.length ? (
              events.slice(0, 3).map((a) => (
                <div className="recent-event" key={a.id}>
                  <span
                    className={`event-icon ${a.kind === "error" ? "orange" : "blue"}`}
                  >
                    {a.kind === "draft" ? (
                      <MessageSquare size={15} />
                    ) : (
                      <ActivityIcon size={15} />
                    )}
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </div>
                  <time>{timeLabel(a.at)}</time>
                </div>
              ))
            ) : (
              <Empty
                icon={ActivityIcon}
                title="Nothing in this period"
                detail="Choose another date range or start a campaign."
              />
            )}
          </div>
        </section>
      </div>
      <div className="review-nudge">
        <span className="nudge-icon">
          <ListChecks size={20} />
        </span>
        <div>
          <strong>
            {pending
              ? `${pending} pitch${pending === 1 ? "" : "es"} could use your personal touch`
              : "Your voice makes the difference"}
          </strong>
          <span>
            {pending
              ? "Review the details, make it yours, and approve when you’re ready."
              : "Every generated pitch is held for review before it moves forward."}
          </span>
        </div>
        <button className="button" onClick={() => navigate("Review queue")}>
          Open review queue <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}

type Action = (
  fn: () => Promise<unknown>,
  message?: string,
) => Promise<boolean>;
function Campaigns({
  s,
  busy,
  action,
  create,
  edit,
}: {
  s: State;
  busy: boolean;
  action: Action;
  create: () => void;
  edit: (c: Campaign) => void;
}) {
  const [filter, setFilter] = useState("all");
  const filtered = s.campaigns.filter(
    (c) => filter === "all" || c.status === filter,
  );
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          {["all", "running", "paused", "draft"].map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All campaigns" : f}
              <span>
                {
                  s.campaigns.filter((c) => f === "all" || c.status === f)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <span className="muted">Shared budgets per account</span>
      </div>
      {filtered.length ? (
        <div className="campaign-grid">
          {filtered.map((c) => {
            const account = s.accounts.find((a) => a.id === c.accountId);
            const jobs = s.jobs.filter((j) => j.campaignId === c.id);
            const finished = jobs.filter((j) =>
              ["completed", "simulated"].includes(j.status),
            ).length;
            return (
              <section className="panel campaign-card" key={c.id}>
                <div className="campaign-card-top">
                  <span className={`campaign-icon ${c.mode}`}>
                    <Target size={23} />
                  </span>
                  <Badge tone={c.status === "running" ? "green" : "neutral"}>
                    <span className="badge-dot" />
                    {c.status}
                  </Badge>
                </div>
                <h2>{c.name}</h2>
                <p className="campaign-description">{c.description || c.icp}</p>
                <div className="campaign-meta">
                  <span>
                    <Layers3 size={15} />
                    {modeLabel[c.mode]}
                  </span>
                  <span>
                    <FileSpreadsheet size={15} />
                    {s.sources.find((source) => source.id === c.sourceId)?.name}
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {String(c.startHour).padStart(2, "0")}:00–
                    {String(c.endHour).padStart(2, "0")}:00 · {c.timezone}
                  </span>
                </div>
                <div className="campaign-progress">
                  <div>
                    <span>Jobs processed</span>
                    <strong>
                      {finished} / {jobs.length}
                    </strong>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${jobs.length ? (finished / jobs.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="campaign-account">
                  <div className="avatar small">{account?.initials}</div>
                  <span>{account?.name}</span>
                  <span className="muted">{c.dailyLimit} actions/day</span>
                </div>
                <div className="campaign-actions">
                  <button className="button" onClick={() => edit(c)}>
                    View / edit
                  </button>
                  <button
                    className={`button ${c.status === "running" ? "" : "primary"}`}
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () =>
                          api(`/campaigns/${c.id}/status`, "POST", {
                            status:
                              c.status === "running" ? "paused" : "running",
                          }),
                        c.status === "running"
                          ? "Campaign paused."
                          : "Campaign started. Eligible jobs are queued.",
                      )
                    }
                  >
                    {c.status === "running" ? (
                      <Pause size={15} />
                    ) : (
                      <Play size={15} />
                    )}
                    {c.status === "running"
                      ? "Pause"
                      : account?.status === "demo"
                        ? "Start demo"
                        : "Prepare drafts"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="Room for your next campaign"
            detail="Choose a lead sheet and an account, then make it your own."
            action={
              <button className="button primary" onClick={create}>
                <Plus size={16} /> Create campaign
              </button>
            }
          />
        </section>
      )}
    </>
  );
}

function Leads({
  s,
  busy,
  action,
  importLeads,
}: {
  s: State;
  busy: boolean;
  action: Action;
  importLeads: () => void;
}) {
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [source, setSource] = useState("all");
  const leads = s.leads.filter(
    (l) =>
      `${l.name} ${l.company} ${l.title}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (relationship === "all" ||
        (relationship === "opted_out"
          ? l.optedOut
          : l.relationship === relationship && !l.optedOut)) &&
      (source === "all" || l.sourceId === source),
  );
  return (
    <section className="panel">
      <div className="table-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search leads"
            placeholder="Search people or companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="table-filters">
          <select
            aria-label="Filter by source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources</option>
            {s.sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="all">All relationships</option>
            {Object.entries(relationshipLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="opted_out">Opted out</option>
          </select>
        </div>
      </div>
      {leads.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PERSON</th>
                <th>COMPANY / ROLE</th>
                <th>RELATIONSHIP</th>
                <th>ACCOUNT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="person-cell">
                      <div className={`avatar ${l.optedOut ? "gray" : ""}`}>
                        {l.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <a href={l.profileUrl} target="_blank" rel="noreferrer">
                          {l.name}
                          <ExternalLink size={12} />
                        </a>
                        <span>
                          {l.optedOut
                            ? "Opted out"
                            : s.sources.find((src) => src.id === l.sourceId)
                                ?.tab}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong className="table-company">
                      {l.company || "—"}
                    </strong>
                    <span className="table-secondary">
                      {l.title || "No role supplied"}
                    </span>
                  </td>
                  <td>
                    <select
                      className={`relationship-select ${l.relationship}`}
                      aria-label={`Relationship for ${l.name}`}
                      value={l.relationship}
                      disabled={busy || l.optedOut}
                      onChange={(e) =>
                        void action(
                          () =>
                            api(`/leads/${l.id}`, "PATCH", {
                              relationship: e.target.value,
                            }),
                          "Relationship saved in the workspace.",
                        )
                      }
                    >
                      {Object.entries(relationshipLabel).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted">
                    {s.accounts.find((a) => a.id === l.accountId)?.name}
                  </td>
                  <td>
                    <div className="row-actions">
                      {!l.optedOut && l.relationship === "connected" && (
                        <button
                          className="icon-button"
                          title={`Prepare a draft for ${l.name}`}
                          aria-label={`Prepare a draft for ${l.name}`}
                          disabled={
                            busy ||
                            s.drafts.some(
                              (d) =>
                                d.leadId === l.id && d.status !== "rejected",
                            )
                          }
                          onClick={() => {
                            const c = s.campaigns.find(
                              (c) =>
                                c.sourceId === l.sourceId &&
                                c.accountId === l.accountId &&
                                c.mode !== "requests",
                            );
                            if (c)
                              void action(
                                () =>
                                  api(`/leads/${l.id}/draft`, "POST", {
                                    campaignId: c.id,
                                  }),
                                "Draft queued. Start the campaign to process it.",
                              );
                            else
                              void action(() =>
                                Promise.reject(
                                  new Error(
                                    "Create a pitching campaign for this source and account first.",
                                  ),
                                ),
                              );
                          }}
                        >
                          <Sparkles size={16} />
                        </button>
                      )}
                      <button
                        className={`text-button ${l.optedOut ? "" : "danger-text"}`}
                        disabled={busy}
                        onClick={() =>
                          void action(
                            () =>
                              api(`/leads/${l.id}`, "PATCH", {
                                optedOut: !l.optedOut,
                              }),
                            l.optedOut
                              ? "Lead restored."
                              : "Lead opted out. Queued jobs cancelled.",
                          )
                        }
                      >
                        {l.optedOut ? "Restore" : "Opt out"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={Users}
          title={
            s.leads.length
              ? "No people match these filters"
              : "Your next connections belong here"
          }
          detail={
            s.leads.length
              ? "Try another search or relationship filter."
              : "Import a lead sheet to get started."
          }
          action={
            !s.leads.length && (
              <button className="button primary" onClick={importLeads}>
                Import leads
              </button>
            )
          }
        />
      )}
      <div className="table-footer">
        <span>
          {leads.length} of {s.leads.length} leads
        </span>
        <span>
          Relationships are account-specific · source tabs are read-only in this
          version
        </span>
      </div>
    </section>
  );
}

function Review({
  s,
  busy,
  action,
  demo,
}: {
  s: State;
  busy: boolean;
  action: Action;
  demo: boolean;
}) {
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const drafts = s.drafts.filter(
    (d) => filter === "all" || d.status === filter,
  );
  const draft = drafts.find((d) => d.id === selected) || drafts[0];
  useEffect(() => {
    setText(draft?.text || "");
  }, [draft?.id]);
  const lead = s.leads.find((l) => l.id === draft?.leadId);
  const campaign = s.campaigns.find((c) => c.id === draft?.campaignId);
  const save = async (status: Draft["status"]) => {
    if (!draft) return;
    const ok = await action(
      () => api(`/drafts/${draft.id}`, "PUT", { text, status }),
      status === "pending"
        ? "Draft saved."
        : status === "approved"
          ? demo
            ? "Approved. Simulated delivery is queued."
            : "Approved and saved. No message was sent."
          : "Draft rejected.",
    );
    if (ok && status !== "pending") setSelected("");
  };
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "pending" ? "Needs review" : f}
              <span>
                {s.drafts.filter((d) => f === "all" || d.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <span className="muted">
          <ShieldCheck size={14} /> You have the final say
        </span>
      </div>
      {draft && lead ? (
        <div className="review-layout">
          <section className="panel draft-list">
            {drafts.map((d) => {
              const l = s.leads.find((l) => l.id === d.leadId);
              return (
                <button
                  key={d.id}
                  className={`draft-list-item ${draft.id === d.id ? "active" : ""}`}
                  onClick={() => setSelected(d.id)}
                >
                  <div className="draft-list-top">
                    <div className="avatar">
                      {l?.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <strong>{l?.name}</strong>
                      <span>{l?.company}</span>
                    </div>
                    <ChevronRight size={15} />
                  </div>
                  <p>{d.text}</p>
                  <Badge tone={d.status === "pending" ? "orange" : "neutral"}>
                    {d.status === "pending" ? "Needs review" : d.status}
                  </Badge>
                </button>
              );
            })}
          </section>
          <section className="panel draft-editor">
            <div className="panel-header">
              <div>
                <h2>A conversation with {lead.name.split(" ")[0]}</h2>
                <p>
                  {lead.title} at {lead.company}
                </p>
              </div>
              <a
                className="icon-button"
                aria-label="Open LinkedIn profile"
                href={lead.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={18} />
              </a>
            </div>
            <div className="draft-body">
              <div className="draft-context">
                <span>
                  <Layers3 size={15} />
                  {campaign?.name}
                </span>
                <Badge tone={draft.fit === "fit" ? "green" : "orange"}>
                  {draft.fit === "fit"
                    ? "ICP match"
                    : draft.fit === "not_fit"
                      ? "Outside ICP"
                      : "Fit needs review"}
                </Badge>
              </div>
              <div className="evidence-box">
                <div>
                  <Sparkles size={15} />
                  <strong>What this draft is based on</strong>
                </div>
                <ul>
                  {draft.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
              <label className="field">
                <span>Your message</span>
                <textarea
                  className="pitch-textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  readOnly={draft.status !== "pending"}
                  minLength={10}
                  maxLength={1500}
                  rows={8}
                />
                <span className="textarea-meta">
                  <span>{draft.generator}</span>
                  <span>{text.length}/1,500</span>
                </span>
              </label>
              <div className="note">
                <ShieldCheck size={16} />
                <span>
                  {demo
                    ? "Approving queues a simulated delivery. No message goes to LinkedIn."
                    : "Approving saves this draft. Live sending is not connected."}
                </span>
              </div>
            </div>
            {draft.status === "pending" ? (
              <div className="draft-actions">
                <button
                  className="button danger-text"
                  disabled={busy}
                  onClick={() => void save("rejected")}
                >
                  <X size={16} />
                  Reject
                </button>
                <div>
                  <button
                    className="button"
                    disabled={busy || text.trim().length < 10}
                    onClick={() => void save("pending")}
                  >
                    Save changes
                  </button>
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      text.trim().length < 10 ||
                      draft.fit === "not_fit" ||
                      lead.optedOut ||
                      lead.relationship !== "connected"
                    }
                    onClick={() => void save("approved")}
                  >
                    <Check size={16} />
                    Approve draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="draft-actions">
                <Badge tone="neutral">{draft.status}</Badge>
                <span className="muted">Reviewed drafts are read-only.</span>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={CheckCheck}
            title={
              filter === "pending"
                ? "You’re all caught up"
                : "No drafts here yet"
            }
            detail="Drafts appear here when a pitching campaign processes eligible connections."
          />
        </section>
      )}
    </>
  );
}

function ActivityPage({ s }: { s: State }) {
  const [tab, setTab] = useState("events");
  const [filter, setFilter] = useState("all");
  const [jobs, setJobs] = useState<(Job & { waiting: string })[]>([]);
  useEffect(() => {
    const load = () =>
      void api<(Job & { waiting: string })[]>("/jobs")
        .then(setJobs)
        .catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);
  const events = s.activity.filter(
    (a) =>
      filter === "all" ||
      (filter === "simulated" ? a.simulated : a.kind === filter),
  );
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          <button
            className={tab === "events" ? "selected" : ""}
            onClick={() => setTab("events")}
          >
            Activity log <span>{s.activity.length}</span>
          </button>
          <button
            className={tab === "jobs" ? "selected" : ""}
            onClick={() => setTab("jobs")}
          >
            Job queue <span>{s.jobs.length}</span>
          </button>
        </div>
        {tab === "events" && (
          <select
            aria-label="Activity filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All activity</option>
            <option value="simulated">Simulated actions</option>
            <option value="draft">Drafts</option>
            <option value="error">Errors</option>
            <option value="campaign">Campaign changes</option>
          </select>
        )}
      </div>
      <section className="panel">
        {tab === "events" ? (
          events.length ? (
            <div className="activity-timeline">
              {events.map((a) => (
                <div className="timeline-event" key={a.id}>
                  <span
                    className={`event-icon ${a.kind === "error" ? "orange" : "blue"}`}
                  >
                    <ActivityIcon size={17} />
                  </span>
                  <div>
                    <strong>
                      {a.title}
                      {a.simulated && <Badge tone="neutral">demo</Badge>}
                    </strong>
                    <p>{a.detail}</p>
                  </div>
                  <time>
                    {dateLabel(a.at)}
                    <span>{timeLabel(a.at)}</span>
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={ActivityIcon}
              title="No activity to show"
              detail="Events appear here as you use your workspace."
            />
          )
        ) : jobs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>LEAD / CAMPAIGN</th>
                  <th>JOB</th>
                  <th>STATUS</th>
                  <th>DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {[...jobs].reverse().map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong className="table-company">
                        {s.leads.find((l) => l.id === j.leadId)?.name}
                      </strong>
                      <span className="table-secondary">
                        {s.campaigns.find((c) => c.id === j.campaignId)?.name}
                      </span>
                    </td>
                    <td>
                      {j.kind === "draft"
                        ? "Prepare draft"
                        : j.kind === "pitch"
                          ? "Pitch simulation"
                          : "Request simulation"}
                    </td>
                    <td>
                      <Badge
                        tone={
                          j.status === "failed" || j.status === "uncertain"
                            ? "orange"
                            : j.status === "completed" ||
                                j.status === "simulated"
                              ? "green"
                              : "neutral"
                        }
                      >
                        {j.status}
                      </Badge>
                    </td>
                    <td className="job-detail">{j.waiting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Layers3}
            title="A clear queue"
            detail="Start a campaign to queue eligible work. Waiting reasons will appear here."
          />
        )}
      </section>
    </>
  );
}

function Settings({
  workspace: { state: s, health: h },
  busy,
  action,
  addAccount,
}: {
  workspace: Workspace;
  busy: boolean;
  action: Action;
  addAccount: () => void;
}) {
  return (
    <>
      <div className="settings-grid">
        <section className="panel integration-card">
          <div className="integration-top">
            <span className="integration-icon green">
              <FileSpreadsheet size={25} />
            </span>
            <Badge tone={h.sheets.connected ? "green" : "neutral"}>
              {h.sheets.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <h2>Google Sheets</h2>
          <p>Your CRM and the source of truth for workspace data.</p>
          <div className="integration-detail">{h.sheets.detail}</div>
          <button
            className="button"
            disabled={busy || h.mode === "demo"}
            onClick={() =>
              void action(
                () => api("/integrations/reconnect", "POST"),
                "Control spreadsheet reloaded. Interrupted jobs require review.",
              )
            }
          >
            <RefreshCw size={15} />
            Reconnect & sync
          </button>
        </section>
        <section className="panel integration-card">
          <div className="integration-top">
            <span className="integration-icon purple">
              <Sparkles size={25} />
            </span>
            <Badge tone={h.ollama.connected ? "green" : "neutral"}>
              {h.ollama.connected ? "Running locally" : "Not detected"}
            </Badge>
          </div>
          <h2>Local AI · Ollama</h2>
          <p>Assess lead fit and draft pitches on your own machine.</p>
          <div className="integration-detail">
            {h.ollama.detail}
            <span className="model-label">Model: {h.ollama.model}</span>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void action(
                () => api("/integrations/check", "POST"),
                "Local AI status refreshed.",
              )
            }
          >
            <RefreshCw size={15} />
            Check local model
          </button>
        </section>
        <section className="panel integration-card">
          <div className="integration-top">
            <span className="integration-icon blue">
              <span className="linkedin-mark">in</span>
            </span>
            <Badge tone="orange">Next milestone</Badge>
          </div>
          <h2>LinkedIn</h2>
          <p>Account sessions and verified browser actions.</p>
          <div className="integration-detail">{h.linkedin.detail}</div>
          <div className="integration-footnote">
            <ShieldCheck size={15} />
            No live requests or messages are sent.
          </div>
        </section>
      </div>
      <div className="settings-bottom">
        <section className="panel setup-card">
          <div className="panel-header">
            <div>
              <h2>Connect your real workspace</h2>
              <p>Configuration stays on your machine.</p>
            </div>
            <BookOpen size={20} />
          </div>
          <ol className="setup-list">
            <li>
              <strong>Create a dedicated control spreadsheet</strong>
              <p>
                The app creates Accounts, Sources, Campaigns, Relationships,
                Jobs, Drafts, and Activity tabs. Keep this separate from your
                existing lead sheets.
              </p>
            </li>
            <li>
              <strong>Configure Google access</strong>
              <p>
                Enable the Sheets API for a Google service account. Share the
                control spreadsheet and lead sheets with its email. Keep its
                credentials outside this repository.
              </p>
            </li>
            <li>
              <strong>Set your local environment</strong>
              <p>
                Copy <code>.env.example</code> to <code>.env</code>, set{" "}
                <code>STORAGE_MODE=sheets</code>, the credentials file path, and{" "}
                <code>CONTROL_SPREADSHEET_ID</code>. Restart the server.
              </p>
            </li>
            <li>
              <strong>Start your local model</strong>
              <p>
                Run <code>ollama pull {h.ollama.model}</code>. Real Sheets
                campaigns can prepare drafts from supplied facts. Profile
                extraction and sending come later.
              </p>
            </li>
          </ol>
          <div className="note">
            <Clock3 size={16} />
            <span>
              Keep the computer awake and the server running to process queued
              work. Use one server process per control spreadsheet.
            </span>
          </div>
        </section>
        <section className="panel account-panel">
          <div className="panel-header">
            <div>
              <h2>Accounts</h2>
              <p>Independent relationships. Shared budgets.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Register account"
              onClick={addAccount}
            >
              <Plus size={19} />
            </button>
          </div>
          {s.accounts.length ? (
            s.accounts.map((a) => (
              <div className="account-row" key={a.id}>
                <div className="avatar">{a.initials}</div>
                <div>
                  <strong>{a.name}</strong>
                  <span>{a.dailyBudget} outbound actions/day</span>
                  <Badge tone={a.status === "demo" ? "neutral" : "orange"}>
                    {a.status === "demo"
                      ? "Demo account"
                      : "Session not connected"}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <Empty
              icon={Users}
              title="Add your first account"
              detail="Register a name to organize leads and drafts. Browser connection comes later."
            />
          )}
          <div className="account-panel-footer">
            <button className="button" onClick={addAccount}>
              <Plus size={16} />
              Register account
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function CampaignForm({
  s,
  campaign,
  close,
  busy,
  action,
}: {
  s: State;
  campaign?: Campaign;
  close: () => void;
  busy: boolean;
  action: Action;
}) {
  const [data, setData] = useState({
    name: campaign?.name || "",
    description: campaign?.description || "",
    mode: campaign?.mode || ("balanced" as Mode),
    accountId: campaign?.accountId || s.accounts[0]?.id || "",
    sourceId: campaign?.sourceId || s.sources[0]?.id || "",
    dailyLimit: campaign?.dailyLimit || 10,
    icp: campaign?.icp || "",
    offer: campaign?.offer || "",
    startHour: campaign?.startHour ?? 9,
    endHour: campaign?.endHour ?? 18,
    timezone: campaign?.timezone || "Asia/Karachi",
  });
  const update = (key: keyof typeof data, value: string | number) =>
    setData((d) => ({ ...d, [key]: value }));
  const readonly = campaign?.status === "running";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await action(
      () =>
        api(
          campaign ? `/campaigns/${campaign.id}` : "/campaigns",
          campaign ? "PUT" : "POST",
          data,
        ),
      campaign
        ? "Campaign updated."
        : "Campaign created. You can start it from Campaigns.",
    );
    if (ok) close();
  };
  return (
    <Modal
      title={campaign ? "Campaign details" : "Make your next connection"}
      subtitle="Choose the people, the purpose, and the pace."
      close={close}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          {readonly && (
            <div className="note">
              <Pause size={16} />
              Pause this campaign before editing its settings.
            </div>
          )}
          <fieldset disabled={readonly || busy}>
            <label className="field">
              <span>Campaign name</span>
              <input
                required
                minLength={3}
                maxLength={100}
                placeholder="e.g. Conversations with SaaS founders"
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Description <small>optional</small>
              </span>
              <input
                maxLength={400}
                placeholder="What’s the goal of this campaign?"
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
            <span className="field-label">Campaign mode</span>
            <div className="mode-options">
              {(["requests", "pitching", "balanced"] as Mode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={data.mode === m}
                  className={data.mode === m ? "selected" : ""}
                  onClick={() => update("mode", m)}
                >
                  {m === "requests" ? (
                    <Users size={20} />
                  ) : m === "pitching" ? (
                    <MessageSquare size={20} />
                  ) : (
                    <Layers3 size={20} />
                  )}
                  <strong>
                    {m === "balanced"
                      ? "Both · 50/50"
                      : m === "requests"
                        ? "Requests"
                        : "Pitching"}
                  </strong>
                  <span>
                    {m === "requests"
                      ? "Meet new people"
                      : m === "pitching"
                        ? "Existing connections"
                        : "Two independent queues"}
                  </span>
                </button>
              ))}
            </div>
            <div className="form-row">
              <label className="field">
                <span>Lead source</span>
                <select
                  required
                  disabled={!!campaign}
                  value={data.sourceId}
                  onChange={(e) => update("sourceId", e.target.value)}
                >
                  <option value="" disabled>
                    Select a source
                  </option>
                  {s.sources.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>LinkedIn account</span>
                <select
                  required
                  disabled={!!campaign}
                  value={data.accountId}
                  onChange={(e) => update("accountId", e.target.value)}
                >
                  <option value="" disabled>
                    Select an account
                  </option>
                  {s.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Ideal customer profile</span>
              <textarea
                required
                minLength={5}
                maxLength={2000}
                rows={2}
                placeholder="Who do you want to reach? Roles, industry, company stage…"
                value={data.icp}
                onChange={(e) => update("icp", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Your offer</span>
              <textarea
                required
                minLength={5}
                maxLength={2000}
                rows={2}
                placeholder="What do you help these people achieve?"
                value={data.offer}
                onChange={(e) => update("offer", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label className="field">
                <span>Daily outbound allocation</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={data.dailyLimit}
                  onChange={(e) => update("dailyLimit", Number(e.target.value))}
                />
                <small>Shares the account’s total budget.</small>
              </label>
              <label className="field">
                <span>Timezone</span>
                <input
                  required
                  value={data.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Start hour · 24h</span>
                <input
                  type="number"
                  required
                  min={0}
                  max={23}
                  value={data.startHour}
                  onChange={(e) => update("startHour", Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>End hour · 24h</span>
                <input
                  type="number"
                  required
                  min={data.startHour + 1}
                  max={24}
                  value={data.endHour}
                  onChange={(e) => update("endHour", Number(e.target.value))}
                />
              </label>
            </div>
          </fieldset>
          <div className="note">
            <ShieldCheck size={16} />
            <span>
              {data.mode === "balanced"
                ? "50/50 reserves outbound counts for requests and pitches. An odd extra action goes to requests. No spillover. "
                : ""}
              Drafts always require review. Live LinkedIn sending is
              unavailable.
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={close}>
            {readonly ? "Close" : "Cancel"}
          </button>
          {!readonly && (
            <button
              className="button primary"
              type="submit"
              disabled={busy || !s.sources.length || !s.accounts.length}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              {campaign ? "Save changes" : "Create campaign"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function AccountForm({
  close,
  busy,
  action,
}: {
  close: () => void;
  busy: boolean;
  action: Action;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(20);
  return (
    <Modal
      title="Register a local account"
      subtitle="Organize relationships and campaign budgets by account."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await action(
            () => api("/accounts", "POST", { name, dailyBudget: budget }),
            "Account registered. Browser session is not connected.",
          );
          if (ok) close();
        }}
      >
        <div className="form-body">
          <label className="field">
            <span>Account display name</span>
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your LinkedIn account name"
            />
          </label>
          <label className="field">
            <span>Shared daily outbound budget</span>
            <input
              type="number"
              min={1}
              max={100}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              required
            />
          </label>
          <div className="note">
            <ShieldCheck size={16} />
            This registers a label only. No LinkedIn login or browser session is
            created.
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Register account
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportForm({
  workspace: { state: s, health: h },
  close,
  busy,
  action,
  settings,
}: {
  workspace: Workspace;
  close: () => void;
  busy: boolean;
  action: Action;
  settings: () => void;
}) {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [tab, setTab] = useState("");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(s.accounts[0]?.id || "");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    tabs: string[];
    tab: string;
    headers: string[];
    rows: string[][];
    total: number;
  } | null>(null);
  const load = async (selectedTab?: string) => {
    await action(async () => {
      const data = await api<NonNullable<typeof preview>>(
        "/sheets/preview",
        "POST",
        { spreadsheetId, tab: selectedTab || undefined },
      );
      setPreview(data);
      setTab(data.tab);
      setMapping({});
      if (!name) setName(data.tab);
    });
  };
  return (
    <Modal
      title="Bring your leads into focus"
      subtitle="Preview a Google Sheet, then map its columns."
      close={close}
    >
      {h.mode === "demo" ? (
        <>
          <div className="form-body">
            <Empty
              icon={FileSpreadsheet}
              title="Connect Google Sheets first"
              detail="Demo mode uses sample leads. Configure your control spreadsheet to import and persist real lead data."
            />
            <div className="note">
              <ShieldCheck size={16} />
              Existing lead tabs remain read-only in this version. Imported
              records and changes are stored in the control spreadsheet.
            </div>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={close}>
              Keep exploring
            </button>
            <button className="button primary" onClick={settings}>
              Open settings <ArrowRight size={16} />
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await action(async () => {
              const result = await api("/sheets/import", "POST", {
                spreadsheetId,
                tab,
                name,
                accountId,
                mapping,
              });
              if (!result.imported)
                throw new Error(
                  `No new leads imported: ${result.skipped} duplicates, ${result.invalid} invalid rows.`,
                );
            }, "Lead import completed. See Activity for imported, duplicate, and invalid row counts.");
            if (ok) close();
          }}
        >
          <div className="form-body">
            <label className="field">
              <span>Spreadsheet ID</span>
              <input
                required
                value={spreadsheetId}
                placeholder="The ID between /d/ and /edit in your sheet URL"
                onChange={(e) => {
                  setSpreadsheetId(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={busy || !spreadsheetId}
              onClick={() => void load()}
            >
              <Search size={16} />
              Preview spreadsheet
            </button>
            {preview && (
              <>
                <div className="form-row import-fields">
                  <label className="field">
                    <span>Tab</span>
                    <select
                      value={tab}
                      disabled={busy}
                      onChange={(e) => {
                        setPreview(null);
                        void load(e.target.value);
                      }}
                    >
                      {preview.tabs.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Account</span>
                    <select
                      required
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      <option value="" disabled>
                        Select account
                      </option>
                      {s.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Source name</span>
                  <input
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="mapping-grid">
                  {[
                    ["name", "Full name *"],
                    ["profileUrl", "LinkedIn URL *"],
                    ["title", "Job title"],
                    ["company", "Company"],
                    ["notes", "Profile facts / notes"],
                    ["relationship", "Relationship"],
                    ["optedOut", "Opted out"],
                  ].map(([field, label]) => (
                    <label className="field" key={field}>
                      <span>{label}</span>
                      <select
                        required={["name", "profileUrl"].includes(field)}
                        value={mapping[field] || ""}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [field]: e.target.value }))
                        }
                      >
                        <option value="">
                          {["name", "profileUrl"].includes(field)
                            ? "Select column"
                            : "Not mapped"}
                        </option>
                        {preview.headers.map((header) => (
                          <option key={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <span className="muted">
                  {preview.total} rows found · up to 5,000 rows per import
                </span>
                <div className="preview-table table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {preview.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i}>
                          {preview.headers.map((_, j) => (
                            <td key={j}>{row[j] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="note">
                  <CircleHelp size={16} />
                  Unknown relationship values require verification. Recognized
                  values: connected, not_connected, pending, unknown.
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="button" onClick={close}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                !preview ||
                !mapping.name ||
                !mapping.profileUrl ||
                !accountId
              }
            >
              <Download size={16} />
              Import leads
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
