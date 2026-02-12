import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  Crosshair,
  FileWarning,
  Landmark,
  LogOut,
  NotebookPen,
  Search,
  TriangleAlert
} from "lucide-react";
import { Toaster, toast } from "sonner";
import Dashboard from "./components/Dashboard.jsx";

const NAV_ITEMS = [
  { id: "active", label: "Active Workspace", icon: Crosshair },
  { id: "environments", label: "Environments", icon: Building2 }
];

const ENV_STATUS_OPTIONS = ["active", "foundations", "diagnostic", "prospect"];
const ENV_HEALTH_OPTIONS = ["nominal", "pending", "warning"];
const MEMORY_TYPES = ["note", "quirk", "decision", "deployment"];
const REMEMBER_USERNAME_KEY = "tv.remember.username";
const REMEMBER_ENABLED_KEY = "tv.remember.enabled";
const AGNOSTIC_REPO_URL = "https://github.com/97n8/AGNOSTIC";
const PUBLIC_LOGIC_REPO_URL = "https://github.com/97n8/Public_Logic";
const PL_CASE_WORKSPACE_REPO_URL = "https://github.com/97n8/pl-poli-case-workspace";
const PL_POC_TENANT_DOMAIN = "publiclogic978.sharepoint.com";
const VERCEL_DEPLOYMENTS_URL = "https://vercel.com/97n8s-projects/public-logic/deployments";
const PUBLIC_SITE_URL = "https://www.publiclogic.org/";
const OS_HOME_URL = "https://www.publiclogic.org/os/";
const DEFAULT_CONTEXT = {
  targetTenant: {
    type: "M365",
    domain: "",
    adminContact: "",
    notes: ""
  },
  selectedModules: [],
  overrides: [],
  checklist: {
    adminAccessVerified: false,
    charterReviewed: false,
    contactsConfirmed: false
  },
  graph: {
    sharePointSiteUrl: "",
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    authRef: ""
  },
  metadata: {
    updatedBy: "",
    updatedAt: ""
  }
};
const EMPTY_CONNECTION = {
  tenantDomain: "",
  authType: "entra",
  clientIdRef: "",
  tenantIdRef: "",
  keychainRef: "",
  graphEnabled: false,
  notes: ""
};

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function unionModules(existingModules, selectedModules) {
  return [...new Set([...(existingModules || []), ...(selectedModules || [])])];
}

function getLiveEnvironmentUrl(environment) {
  const directUrl = String(environment?.liveUrl || "").trim();
  if (directUrl) {
    return directUrl;
  }
  const routeUrl = String(environment?.links?.live || "").trim();
  if (routeUrl) {
    return routeUrl;
  }
  return "";
}

function normalizeTenantDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  return withoutProtocol.split("/")[0];
}

function normalizeAbsoluteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return `https://${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function toRemoteWebUrl(originRemote) {
  const raw = String(originRemote || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\.git$/i, "");
  }
  const sshMatch = raw.match(/^git@github\.com:(.+?)(?:\.git)?$/i);
  if (sshMatch?.[1]) {
    return `https://github.com/${sshMatch[1]}`;
  }
  return "";
}

function buildLaunchTargets(environment, context) {
  const configuredTenant = normalizeTenantDomain(context?.targetTenant?.domain);
  const profileTenant = normalizeTenantDomain(environment?.tenant?.domain);
  const tenantDomain = configuredTenant || profileTenant || PL_POC_TENANT_DOMAIN;

  const configuredSite = normalizeAbsoluteUrl(context?.graph?.sharePointSiteUrl);
  const siteUrl = configuredSite || `https://${tenantDomain}/sites/PL`;
  const tenantRootUrl = `https://${tenantDomain}`;
  const documentsUrl = `${siteUrl}/Shared%20Documents/Forms/AllItems.aspx`;
  const siteContentsUrl = `${siteUrl}/_layouts/15/viewlsts.aspx`;
  const tenantPrefix = tenantDomain.split(".")[0] || "";
  const adminCenterUrl = tenantPrefix ? `https://${tenantPrefix}-admin.sharepoint.com` : "";

  return {
    tenantDomain,
    siteUrl,
    tenantRootUrl,
    documentsUrl,
    siteContentsUrl,
    adminCenterUrl,
    usingFallback: !configuredTenant && !profileTenant
  };
}

function toHelpfulErrorMessage(error, fallback = "Request failed.") {
  if (!error) {
    return fallback;
  }
  const base = String(error.message || fallback).trim();
  const payload = error.payload && typeof error.payload === "object" ? error.payload : {};
  const firstFieldError = Array.isArray(payload.fieldErrors) ? payload.fieldErrors[0] : null;
  if (firstFieldError && typeof firstFieldError === "object") {
    const fix = String(firstFieldError.fix || "").trim();
    const field = String(firstFieldError.field || "").trim();
    if (fix && field) {
      return `${base} ${field}: ${fix}`;
    }
    if (fix) {
      return `${base} ${fix}`;
    }
  }
  const firstError = Array.isArray(payload.errors) ? payload.errors[0] : "";
  if (firstError) {
    return `${base} ${firstError}`;
  }
  return base || fallback;
}

function normalizeTownKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDisplayTown(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const stripped = raw.replace(/^town of\s+/i, "").trim();
  return stripped || raw;
}

function createDefaultProofDraft(town = "") {
  const seed = String(town || "environment")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "environment";
  const day = new Date().toISOString().slice(0, 10);
  return {
    folderName: `${seed}-proof-${day}`,
    documentName: `${seed}-proof-note-${day}.md`,
    content: ""
  };
}

function createDefaultRemoteActionDraft(town = "") {
  const seed = String(town || "environment")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "environment";
  const safeTown = String(town || "Municipality").trim() || "Municipality";
  return {
    libraryName: "Documents",
    folderPath: `${seed}/proof`,
    documentName: `${seed}-note.md`,
    documentContent: "",
    pageTitle: `${safeTown} Operations Update`,
    pageName: `${seed}-operations-update.aspx`,
    pageContent: ""
  };
}

function LoginScreen({ onSubmit, error, loading, initialUsername = "", initialRememberMe = false }) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(initialRememberMe);

  useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername]);

  useEffect(() => {
    setRememberMe(initialRememberMe);
  }, [initialRememberMe]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ username, password, rememberMe });
  }

  return (
    <main className="tv-login-shell">
      <section className="tv-login-card">
        <h1>PublicLogic Portal</h1>
        <p className="tv-subtle">Powered by Tenebrux Veritas</p>
        <p className="tv-subtle">Internal governance deployment system. Not client-facing.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="tv-checkbox tv-login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me on this device</span>
          </label>
          {error ? <p className="tv-error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="tv-stat-card">
      <p className="tv-stat-label">{label}</p>
      <p className="tv-stat-value">{value}</p>
      <p className="tv-subtle">{hint}</p>
    </article>
  );
}

function Sidebar({ activeNav, onChange }) {
  return (
    <aside className="tv-sidebar">
      <header className="tv-sidebar-header">
        <p className="tv-brand">PublicLogic Portal</p>
        <p className="tv-subtle">Tenebrux Veritas</p>
      </header>

      <nav className="tv-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeNav;
          return (
            <button
              key={item.id}
              className={`tv-nav-item${active ? " tv-nav-item-active" : ""}`}
              onClick={() => onChange(item.id)}
              type="button"
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <footer className="tv-sidebar-footer">
        <p>Protocol v1.4.2</p>
        <p>© 2026 PublicLogic LLC</p>
      </footer>
    </aside>
  );
}

function DashboardView({ environments, onOpenEnvironment }) {
  const activeCount = environments.filter((item) => item.status === "active").length;
  const warningCount = environments.filter((item) => item.health === "warning").length;
  const foundationCount = environments.filter((item) => item.status === "foundations").length;

  return (
    <section className="tv-content">
      <header className="tv-section-header">
        <h2>Operational Snapshot</h2>
        <p className="tv-subtle">Internal deployment operations across municipal environments.</p>
      </header>

      <div className="tv-stat-grid">
        <StatCard label="Environments" value={environments.length} hint="Tracked municipalities" />
        <StatCard label="Active" value={activeCount} hint="Fully governed spaces" />
        <StatCard label="Foundations" value={foundationCount} hint="Base layer in progress" />
        <StatCard label="Warnings" value={warningCount} hint="Needs operator attention" />
      </div>

      <article className="tv-card">
        <h3>Environment Queue</h3>
        <div className="tv-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Town</th>
                <th>Status</th>
                <th>Health</th>
                <th>Modules</th>
                <th>Last Deploy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {environments.length === 0 ? (
                <tr>
                  <td colSpan={6}>No environments available.</td>
                </tr>
              ) : (
                environments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.town}</td>
                    <td>{item.status}</td>
                    <td>{item.health}</td>
                    <td>{(item.modules || []).join(", ") || "-"}</td>
                    <td>{formatDateTime(item.lastDeploy)}</td>
                    <td>
                      <button className="tv-ghost" type="button" onClick={() => onOpenEnvironment(item.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function CanonView({ canon }) {
  return (
    <section className="tv-content">
      <header className="tv-section-header">
        <h2>VAULT Canon</h2>
        <p className="tv-subtle">Read-only reference. Foundations are required before workspaces.</p>
      </header>

      <div className="tv-canon-grid">
        <article className="tv-card">
          <h3>Foundations</h3>
          {canon.foundations.map((module) => (
            <div key={module.name} className="tv-canon-module">
              <p className="tv-canon-title">{module.name}</p>
              <p className="tv-subtle">{module.description}</p>
              <ul>
                {(module.artifacts || []).map((artifact) => (
                  <li key={artifact}>{artifact}</li>
                ))}
              </ul>
            </div>
          ))}
        </article>

        <article className="tv-card">
          <h3>Workspaces</h3>
          {canon.workspaces.map((module) => (
            <div key={module.name} className="tv-canon-module">
              <p className="tv-canon-title">{module.name}</p>
              <p className="tv-subtle">{module.description}</p>
              <p className="tv-subtle">Depends on: {(module.dependsOn || []).join(", ")}</p>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function MemoryView({ entries, filters, onFilterChange, draft, onDraftChange, onCreate }) {
  return (
    <section className="tv-content">
      <header className="tv-section-header">
        <h2>Veritas Memory</h2>
        <p className="tv-subtle">Institutional knowledge by environment, operator, and decision type.</p>
      </header>

      <article className="tv-card">
        <h3>New Entry</h3>
        <div className="tv-form-grid">
          <label>
            Environment ID
            <input value={draft.envId} onChange={(event) => onDraftChange("envId", event.target.value)} />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(event) => onDraftChange("type", event.target.value)}>
              {MEMORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Content
          <textarea value={draft.content} onChange={(event) => onDraftChange("content", event.target.value)} />
        </label>
        <button type="button" onClick={onCreate}>
          Save Memory Entry
        </button>
      </article>

      <article className="tv-card">
        <h3>History</h3>
        <div className="tv-filter-row">
          <label>
            Env
            <input
              value={filters.envId}
              onChange={(event) => onFilterChange("envId", event.target.value)}
              placeholder="env-001"
            />
          </label>
          <label>
            Type
            <select value={filters.type} onChange={(event) => onFilterChange("type", event.target.value)}>
              <option value="">All</option>
              {MEMORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <div className="tv-search-input">
              <Search size={14} />
              <input
                value={filters.q}
                onChange={(event) => onFilterChange("q", event.target.value)}
                placeholder="text"
              />
            </div>
          </label>
        </div>

        <div className="tv-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Env</th>
                <th>Type</th>
                <th>Operator</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5}>No memory entries found.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.date)}</td>
                    <td>{entry.envId}</td>
                    <td>{entry.type}</td>
                    <td>{entry.operator}</td>
                    <td>{entry.content}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function AuditView({ entries, envFilter, onEnvFilterChange, actionTypeFilter, onActionTypeFilterChange }) {
  return (
    <section className="tv-content">
      <header className="tv-section-header">
        <h2>Audit Log</h2>
        <p className="tv-subtle">Every action is timestamped, operator-attributed, and SHA traceable.</p>
      </header>

      <article className="tv-card">
        <div className="tv-filter-row">
          <label>
            Environment ID
            <input value={envFilter} onChange={(event) => onEnvFilterChange(event.target.value)} />
          </label>
          <label>
            Action Type
            <input
              value={actionTypeFilter}
              onChange={(event) => onActionTypeFilterChange(event.target.value)}
              placeholder="deploy:foundations"
            />
          </label>
        </div>

        <div className="tv-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action</th>
                <th>Env</th>
                <th>SHA</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6}>No audit entries found.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id || `${entry.timestamp}-${entry.action_type}`}>
                    <td>{formatDateTime(entry.timestamp)}</td>
                    <td>{entry.operator || entry.user || "-"}</td>
                    <td>{entry.action_type || "-"}</td>
                    <td>{entry.environment_id || "-"}</td>
                    <td className="tv-mono">{entry.git_commit_sha || "-"}</td>
                    <td>{entry.result || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function EnvironmentList({
  environments,
  selectedEnvironmentId,
  onSelect,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  compact = false
}) {
  return (
    <article className="tv-card tv-env-list">
      <h3>Municipal Environments</h3>
      <p className="tv-subtle">
        Left column is the deployment control record. Select one row, then run all context, diff, and deploy actions for that municipality.
      </p>
      {compact ? null : (
        <div className="tv-filter-row tv-filter-stack">
          <label>
            Search
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Town or tenant" />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
              <option value="">All</option>
              {ENV_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="tv-env-list-items">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={`tv-env-item${!selectedEnvironmentId ? " tv-env-item-active" : ""}`}
        >
          <p>Homepage</p>
          <span className="tv-meta">No town selected</span>
        </button>
        {environments.map((environment) => (
          <button
            key={environment.id}
            type="button"
            onClick={() => onSelect(environment.id)}
            className={`tv-env-item${selectedEnvironmentId === environment.id ? " tv-env-item-active" : ""}`}
          >
            <p>{environment.town}</p>
            <span className="tv-meta">{environment.status} · {environment.health}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function EnvironmentDetail({
  environment,
  canon,
  context,
  connection,
  remoteStatus,
  onRefreshRemoteStatus,
  remoteEnvironmentStatus,
  remoteActionDraft,
  onRemoteActionDraftChange,
  onRemoteDeployGithub,
  onRemoteCreateSharePointFolder,
  onRemoteCreateSharePointDocument,
  onRemoteCreateSharePointPage,
  remoteActionLoading,
  remoteActionResult,
  proofEntries,
  proofRootPath,
  proofDraft,
  onProofDraftChange,
  onCreateProofFolder,
  onCreateProofDocument,
  proofLoading,
  onEnvironmentField,
  onSaveEnvironment,
  onContextField,
  onContextChecklist,
  onToggleModule,
  onSaveContext,
  onConnectionField,
  onSaveConnection,
  diff,
  diffLoading,
  onGenerateDiff,
  warningAcknowledgments,
  onWarningToggle,
  confirmPhrase,
  onConfirmPhraseChange,
  onDeploy,
  deployLoading,
  mode = "full"
}) {
  const remoteTarget = remoteStatus?.target || null;
  if (!environment) {
    const fallbackLaunchTargets = buildLaunchTargets({}, {});
    return (
      <section className="tv-content">
        <article className="tv-card">
          <h3>Homepage</h3>
          <p className="tv-subtle">
            No environment is selected. Start from PublicLogic homepage or choose an environment.
          </p>
          <div className="tv-link-grid">
            <a className="tv-primary-link" href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">
              Open PublicLogic.org
            </a>
            <a className="tv-primary-link" href={OS_HOME_URL} target="_blank" rel="noreferrer">
              Open OS Home
            </a>
            <a className="tv-primary-link" href={AGNOSTIC_REPO_URL} target="_blank" rel="noreferrer">
              Open AGNOSTIC
            </a>
            <a className="tv-primary-link" href={PUBLIC_LOGIC_REPO_URL} target="_blank" rel="noreferrer">
              Open Public_Logic
            </a>
            <a className="tv-primary-link" href={fallbackLaunchTargets.siteUrl} target="_blank" rel="noreferrer">
              Open Tenant Site
            </a>
            <a className="tv-primary-link" href={fallbackLaunchTargets.documentsUrl} target="_blank" rel="noreferrer">
              Open Documents
            </a>
          </div>
        </article>
        <article className="tv-card">
          <h3>Deploy Remote</h3>
          <p className="tv-subtle">Current git remote and target file used for deployment.</p>
          {remoteTarget ? (
            <div className="tv-active-target-grid">
              <p>
                <span className="tv-subtle">Repository</span>
                <strong>{remoteTarget.repoName || "-"}</strong>
              </p>
              <p>
                <span className="tv-subtle">Branch</span>
                <strong>{remoteTarget.branch || "-"}</strong>
              </p>
              <p>
                <span className="tv-subtle">Target File</span>
                <strong>{remoteTarget.relativeFilePath || "-"}</strong>
              </p>
            </div>
          ) : (
            <p className="tv-subtle">Deploy remote not loaded yet.</p>
          )}
          <p className="tv-mono tv-mono-wrap">{remoteTarget?.originRemote || "-"}</p>
          <button className="tv-ghost" type="button" onClick={onRefreshRemoteStatus}>
            Refresh Deploy Remote
          </button>
        </article>
        <article className="tv-card">
          <p className="tv-subtle">
            Open the <strong>Environments</strong> panel and pick a row when you want a town-scoped control surface.
          </p>
        </article>
      </section>
    );
  }

  const allModules = [...canon.foundations, ...canon.workspaces].map((module) => module.name);
  const selectedModules = context.selectedModules || [];
  const expectedPhrase = `deploy ${String(environment.town || "").trim().toLowerCase()}`;
  const liveEnvironmentUrl = getLiveEnvironmentUrl(environment);
  const launchTargets = buildLaunchTargets(environment, context);
  const remoteWebUrl = toRemoteWebUrl(remoteTarget?.originRemote);
  const githubRemoteReady = Boolean(remoteEnvironmentStatus?.github?.ready);
  const sharepointRemoteReady = Boolean(remoteEnvironmentStatus?.sharepoint?.ready);
  const sharepointMissing = Array.isArray(remoteEnvironmentStatus?.sharepoint?.missing)
    ? remoteEnvironmentStatus.sharepoint.missing
    : [];
  const blockers = diff?.blockers || [];
  const hasUnackedWarnings = (diff?.warnings || []).some((warning) => !warningAcknowledgments[warning]);
  const canDeploy = Boolean(
    diff &&
      blockers.length === 0 &&
      !hasUnackedWarnings &&
      confirmPhrase.trim().toLowerCase() === expectedPhrase
  );

  return (
    <section className="tv-content">
      <header className="tv-section-header">
        <h2>{environment.town}</h2>
        <p className="tv-meta">Environment ID: {environment.id}</p>
      </header>

      {mode === "full" ? (
        <article className="tv-card">
          <h3>Environment Profile</h3>
          <div className="tv-form-grid">
            <label>
              Status
              <select value={environment.status} onChange={(event) => onEnvironmentField("status", event.target.value)}>
                {ENV_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Health
              <select value={environment.health} onChange={(event) => onEnvironmentField("health", event.target.value)}>
                {ENV_HEALTH_OPTIONS.map((health) => (
                  <option key={health} value={health}>
                    {health}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tenant Domain
              <input
                value={environment.tenant?.domain || ""}
                onChange={(event) => onEnvironmentField("tenant.domain", event.target.value)}
              />
            </label>
            <label>
              Admin Contact
              <input
                value={environment.tenant?.adminContact || ""}
                onChange={(event) => onEnvironmentField("tenant.adminContact", event.target.value)}
              />
            </label>
            <label>
              Live Environment URL
              <input
                value={environment.liveUrl || ""}
                onChange={(event) => onEnvironmentField("liveUrl", event.target.value)}
                placeholder="https://www.publiclogic.org/os/#/town-name"
              />
            </label>
          </div>
          <button type="button" onClick={onSaveEnvironment}>
            Save Environment
          </button>
        </article>
      ) : (
        <article className="tv-card">
          <h3>Active Target</h3>
          <div className="tv-active-target-grid">
            <p>
              <span className="tv-subtle">Town</span>
              <strong>{environment.town}</strong>
            </p>
            <p>
              <span className="tv-subtle">Status</span>
              <strong>{environment.status}</strong>
            </p>
            <p>
              <span className="tv-subtle">Health</span>
              <strong>{environment.health}</strong>
            </p>
            <p>
              <span className="tv-subtle">Tenant</span>
              <strong>{environment.tenant?.domain || "-"}</strong>
            </p>
            <p>
              <span className="tv-subtle">Live URL</span>
              <strong>{environment.liveUrl || "-"}</strong>
            </p>
          </div>
          <p className="tv-subtle">
            This row is your control surface in Tenebrux Veritas. The live town environment runs separately and is opened below.
          </p>
        </article>
      )}

      {mode === "focused" ? (
        <article className="tv-card">
          <h3>Remote Command Center</h3>
          <p className="tv-subtle">
            Start here for this municipality. Publish to GitHub first, then create SharePoint folders, documents,
            and pages.
          </p>
          <div className="tv-help-callout">
            <p className="tv-meta">Start Here</p>
            <ol className="tv-steps">
              <li>
                <strong>Step 1:</strong> Confirm readiness below.
              </li>
              <li>
                <strong>Step 2:</strong> Click <em>Deploy Active Target to GitHub</em>.
              </li>
              <li>
                <strong>Step 3:</strong> Use <em>SharePoint Remote Actions</em> to create folders, documents, and pages.
              </li>
            </ol>
          </div>

          <div className="tv-validation-grid">
            <div className={`tv-validation${githubRemoteReady ? " ok" : " error"}`}>
              GitHub connection: {githubRemoteReady ? "ready" : "not ready"}
            </div>
            <div className={`tv-validation${sharepointRemoteReady ? " ok" : " error"}`}>
              SharePoint connection: {sharepointRemoteReady ? "ready" : "not ready"}
            </div>
          </div>

          {!sharepointRemoteReady && sharepointMissing.length > 0 ? (
            <p className="tv-subtle">
              SharePoint setup needed: {sharepointMissing.join(", ")}
            </p>
          ) : null}

          <p className="tv-meta">Primary Action</p>
          <div className="tv-inline-actions">
            <button
              type="button"
              onClick={onRemoteDeployGithub}
              disabled={remoteActionLoading === "github-deploy"}
            >
              {remoteActionLoading === "github-deploy" ? "Publishing..." : "Deploy Active Target to GitHub"}
            </button>
            {remoteTarget?.previewUrl ? (
              <a className="tv-primary-link" href={remoteTarget.previewUrl} target="_blank" rel="noreferrer">
                Open Preview
              </a>
            ) : null}
            {remoteWebUrl ? (
              <a className="tv-primary-link" href={remoteWebUrl} target="_blank" rel="noreferrer">
                Open Deploy Remote
              </a>
            ) : null}
            {liveEnvironmentUrl ? (
              <a className="tv-primary-link" href={liveEnvironmentUrl} target="_blank" rel="noreferrer">
                Open Live Environment
              </a>
            ) : null}
          </div>

          {remoteActionResult ? (
            <div className="tv-side-item">
              <p>Latest result: {remoteActionResult.action}</p>
              <p className="tv-subtle">{remoteActionResult.when}</p>
              <p className="tv-mono tv-mono-wrap">{remoteActionResult.summary}</p>
            </div>
          ) : null}
        </article>
      ) : null}

      {mode === "focused" ? (
        <article className="tv-card">
          <h3>Live Environment Monitor</h3>
          {liveEnvironmentUrl ? (
            <>
              <p className="tv-subtle">
                This is the live municipal experience. Open it to confirm what residents or staff currently see.
              </p>
              <a className="tv-primary-link" href={liveEnvironmentUrl} target="_blank" rel="noreferrer">
                Open {environment.town} Live Environment
              </a>
              <p className="tv-mono tv-mono-wrap">{liveEnvironmentUrl}</p>
            </>
          ) : (
            <p className="tv-subtle">
              No live environment URL is set for this town yet. Add `Live Environment URL` in Environment details, then save.
            </p>
          )}
        </article>
      ) : null}

      {mode === "focused" ? (
        <article className="tv-card">
          <h3>Reference Links</h3>
          <p className="tv-subtle">
            One-click links for repos, tenant filesystems, deployments, and site verification.
          </p>
          <p className="tv-meta">
            Tenant in use: {launchTargets.tenantDomain}
            {launchTargets.usingFallback ? " (default)" : ""}
          </p>
          <div className="tv-link-grid">
            <a className="tv-primary-link" href={AGNOSTIC_REPO_URL} target="_blank" rel="noreferrer">
              Open AGNOSTIC
            </a>
            <a className="tv-primary-link" href={PUBLIC_LOGIC_REPO_URL} target="_blank" rel="noreferrer">
              Open Public_Logic
            </a>
            <a className="tv-primary-link" href={PL_CASE_WORKSPACE_REPO_URL} target="_blank" rel="noreferrer">
              Open CASE Workspace
            </a>
            <a className="tv-primary-link" href={launchTargets.siteUrl} target="_blank" rel="noreferrer">
              Open Tenant Site
            </a>
            <a className="tv-primary-link" href={launchTargets.documentsUrl} target="_blank" rel="noreferrer">
              Open Documents
            </a>
            <a className="tv-primary-link" href={launchTargets.siteContentsUrl} target="_blank" rel="noreferrer">
              Open Site Contents
            </a>
            {launchTargets.adminCenterUrl ? (
              <a className="tv-primary-link" href={launchTargets.adminCenterUrl} target="_blank" rel="noreferrer">
                Open Tenant Admin
              </a>
            ) : null}
            <a className="tv-primary-link" href={VERCEL_DEPLOYMENTS_URL} target="_blank" rel="noreferrer">
              Open Vercel
            </a>
            <a className="tv-primary-link" href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">
              Open Public Site
            </a>
            <a className="tv-primary-link" href={OS_HOME_URL} target="_blank" rel="noreferrer">
              Open OS Home
            </a>
            {liveEnvironmentUrl ? (
              <a className="tv-primary-link" href={liveEnvironmentUrl} target="_blank" rel="noreferrer">
                Open Selected Live
              </a>
            ) : null}
          </div>
        </article>
      ) : null}

      {mode === "focused" ? (
        <article className="tv-card">
          <h3>Operator Sequence</h3>
          <ol className="tv-steps">
            <li>
              <strong>Select target row</strong>: choose the municipality in the left column.
            </li>
            <li>
              <strong>Monitor live state</strong>: open the live environment URL and confirm current behavior.
            </li>
            <li>
              <strong>Prepare changes</strong>: update deployment context and module selection in this console.
            </li>
            <li>
              <strong>Review safety</strong>: generate governance diff and acknowledge warnings.
            </li>
            <li>
              <strong>Execute</strong>: type the confirm phrase and run deployment.
            </li>
            <li>
              <strong>Verify</strong>: reopen live environment and validate result.
            </li>
          </ol>
        </article>
      ) : null}

      <article className="tv-card">
        <h3>Deployment Context</h3>
        <div className="tv-form-grid">
          <label>
            M365 Tenant Domain
            <input
              value={context.targetTenant?.domain || ""}
              onChange={(event) => onContextField("targetTenant.domain", event.target.value)}
            />
          </label>
          <label>
            SharePoint Site URL
            <input
              value={context.graph?.sharePointSiteUrl || ""}
              onChange={(event) => onContextField("graph.sharePointSiteUrl", event.target.value)}
            />
          </label>
          <label>
            Auth Reference
            <input
              value={context.graph?.authRef || ""}
              onChange={(event) => onContextField("graph.authRef", event.target.value)}
              placeholder="keychain://publiclogic/town"
            />
          </label>
          <label>
            Overrides
            <textarea
              value={(context.overrides || []).join("\n")}
              onChange={(event) =>
                onContextField(
                  "overrides",
                  event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                )
              }
            />
          </label>
        </div>

        <div className="tv-checklist-grid">
          <label className="tv-checkbox">
            <input
              type="checkbox"
              checked={Boolean(context.checklist?.adminAccessVerified)}
              onChange={(event) => onContextChecklist("adminAccessVerified", event.target.checked)}
            />
            <span>Admin access verified</span>
          </label>
          <label className="tv-checkbox">
            <input
              type="checkbox"
              checked={Boolean(context.checklist?.charterReviewed)}
              onChange={(event) => onContextChecklist("charterReviewed", event.target.checked)}
            />
            <span>Charter reviewed</span>
          </label>
          <label className="tv-checkbox">
            <input
              type="checkbox"
              checked={Boolean(context.checklist?.contactsConfirmed)}
              onChange={(event) => onContextChecklist("contactsConfirmed", event.target.checked)}
            />
            <span>Contacts confirmed</span>
          </label>
        </div>

        <h4>Module Selection</h4>
        <div className="tv-module-grid">
          {allModules.map((moduleName) => (
            <label key={moduleName} className="tv-checkbox">
              <input
                type="checkbox"
                checked={selectedModules.includes(moduleName)}
                onChange={() => onToggleModule(moduleName)}
              />
              <span>{moduleName}</span>
            </label>
          ))}
        </div>

        <button type="button" onClick={onSaveContext}>
          {mode === "full" ? "Save Deployment Context" : "Save Context"}
        </button>
      </article>

      {mode === "full" ? (
        <article className="tv-card">
          <h3>Connection Reference</h3>
          <div className="tv-form-grid">
            <label>
              Client ID Ref
              <input
                value={connection.clientIdRef || ""}
                onChange={(event) => onConnectionField("clientIdRef", event.target.value)}
                placeholder="env://TOWN_GRAPH_CLIENT_ID"
              />
            </label>
            <label>
              Tenant ID Ref
              <input
                value={connection.tenantIdRef || ""}
                onChange={(event) => onConnectionField("tenantIdRef", event.target.value)}
                placeholder="env://TOWN_TENANT_ID"
              />
            </label>
            <label>
              Keychain Ref
              <input
                value={connection.keychainRef || ""}
                onChange={(event) => onConnectionField("keychainRef", event.target.value)}
                placeholder="keychain://publiclogic/town"
              />
            </label>
            <label className="tv-checkbox tv-checkbox-inline">
              <input
                type="checkbox"
                checked={Boolean(connection.graphEnabled)}
                onChange={(event) => onConnectionField("graphEnabled", event.target.checked)}
              />
              <span>Graph execution enabled</span>
            </label>
          </div>
          <button type="button" onClick={onSaveConnection}>
            Save Connection Reference
          </button>
        </article>
      ) : null}

      <article className="tv-card">
        <h3>Active Deploy Remote (Read-only)</h3>
        <p className="tv-subtle">This is exactly where publish operations are sent.</p>
        {remoteTarget ? (
          <div className="tv-active-target-grid">
            <p>
              <span className="tv-subtle">Repository</span>
              <strong>{remoteTarget.repoName || "-"}</strong>
            </p>
            <p>
              <span className="tv-subtle">Branch</span>
              <strong>{remoteTarget.branch || "-"}</strong>
            </p>
            <p>
              <span className="tv-subtle">Target File</span>
              <strong>{remoteTarget.relativeFilePath || "-"}</strong>
            </p>
            <p>
              <span className="tv-subtle">Preview</span>
              <strong>{remoteTarget.previewUrl || "-"}</strong>
            </p>
          </div>
        ) : (
          <p className="tv-subtle">Deploy remote not loaded yet.</p>
        )}
          <p className="tv-mono tv-mono-wrap">{remoteTarget?.originRemote || "-"}</p>
          {remoteWebUrl ? (
            <a className="tv-primary-link" href={remoteWebUrl} target="_blank" rel="noreferrer">
              Open Deploy Remote
            </a>
          ) : null}
        <button className="tv-ghost" type="button" onClick={onRefreshRemoteStatus}>
          Refresh Deploy Remote
        </button>
      </article>

      {mode === "focused" ? (
        <article className="tv-card">
          <h3>SharePoint Remote Actions</h3>
          <p className="tv-subtle">
            Create folders, documents, and pages directly in SharePoint for this selected municipality.
          </p>

          {!sharepointRemoteReady && sharepointMissing.length > 0 ? (
            <p className="tv-subtle">
              SharePoint setup needed before actions can run: {sharepointMissing.join(", ")}
            </p>
          ) : null}

          <div className="tv-form-grid">
            <label>
              Step A · Library
              <input
                value={remoteActionDraft.libraryName}
                onChange={(event) => onRemoteActionDraftChange("libraryName", event.target.value)}
                placeholder="Documents or Site Pages (usually Documents)"
              />
            </label>
            <label>
              Step A · Folder Path
              <input
                value={remoteActionDraft.folderPath}
                onChange={(event) => onRemoteActionDraftChange("folderPath", event.target.value)}
                placeholder="governance/fy2025-2026"
              />
            </label>
            <label>
              Step B · Document Name
              <input
                value={remoteActionDraft.documentName}
                onChange={(event) => onRemoteActionDraftChange("documentName", event.target.value)}
                placeholder="deployment-note.md"
              />
            </label>
            <label>
              Step B · Document Content
              <textarea
                value={remoteActionDraft.documentContent}
                onChange={(event) => onRemoteActionDraftChange("documentContent", event.target.value)}
                placeholder="Deployment note content..."
              />
            </label>
            <label>
              Step C · Page Title
              <input
                value={remoteActionDraft.pageTitle}
                onChange={(event) => onRemoteActionDraftChange("pageTitle", event.target.value)}
                placeholder="Operations Update"
              />
            </label>
            <label>
              Step C · Page Name
              <input
                value={remoteActionDraft.pageName}
                onChange={(event) => onRemoteActionDraftChange("pageName", event.target.value)}
                placeholder="operations-update.aspx"
              />
            </label>
            <label>
              Step C · Page Content
              <textarea
                value={remoteActionDraft.pageContent}
                onChange={(event) => onRemoteActionDraftChange("pageContent", event.target.value)}
                placeholder="Optional page body text..."
              />
            </label>
          </div>

          <div className="tv-inline-actions">
            <button
              type="button"
              onClick={onRemoteCreateSharePointFolder}
              disabled={remoteActionLoading === "sp-folder"}
            >
              {remoteActionLoading === "sp-folder" ? "Creating..." : "Create SharePoint Folder"}
            </button>
            <button
              type="button"
              onClick={onRemoteCreateSharePointDocument}
              disabled={remoteActionLoading === "sp-document"}
            >
              {remoteActionLoading === "sp-document" ? "Creating..." : "Create SharePoint Document"}
            </button>
            <button
              type="button"
              onClick={onRemoteCreateSharePointPage}
              disabled={remoteActionLoading === "sp-page"}
            >
              {remoteActionLoading === "sp-page" ? "Creating..." : "Create SharePoint Page"}
            </button>
          </div>
        </article>
      ) : null}

      <article className="tv-card">
        <h3>Local Proof (Audit-safe)</h3>
        <p className="tv-subtle">
          Creates real local artifacts under `data/proof-system` and logs each action to audit.
        </p>
        <p className="tv-mono tv-mono-wrap">{proofRootPath || "proof-system/<env-id>"}</p>
        <div className="tv-form-grid">
          <label>
            Folder Name
            <input
              value={proofDraft.folderName}
              onChange={(event) => onProofDraftChange("folderName", event.target.value)}
              placeholder="town-proof-YYYY-MM-DD"
            />
          </label>
          <label>
            Document Name
            <input
              value={proofDraft.documentName}
              onChange={(event) => onProofDraftChange("documentName", event.target.value)}
              placeholder="proof-note.md"
            />
          </label>
          <label>
            Document Content
            <textarea
              value={proofDraft.content}
              onChange={(event) => onProofDraftChange("content", event.target.value)}
              placeholder="Optional note content..."
            />
          </label>
        </div>
        <div className="tv-inline-actions">
          <button type="button" onClick={onCreateProofFolder} disabled={proofLoading}>
            {proofLoading ? "Working..." : "Create Proof Folder"}
          </button>
          <button type="button" onClick={onCreateProofDocument} disabled={proofLoading}>
            {proofLoading ? "Working..." : "Create Proof Document"}
          </button>
        </div>
        {proofEntries.length > 0 ? (
          <div className="tv-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Path</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {proofEntries.slice(0, 8).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.type}</td>
                    <td className="tv-mono">{entry.relativePath || "-"}</td>
                    <td>{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tv-subtle">No proof artifacts yet for this environment.</p>
        )}
      </article>

      <article className="tv-card">
        <h3>Deployment Flow</h3>
        <ol className="tv-steps">
          <li>
            <strong>Select</strong>: choose modules and save deployment context.
          </li>
          <li>
            <strong>Review</strong>: generate governance diff and acknowledge warnings.
          </li>
          <li>
            <strong>Confirm</strong>: type <span className="tv-mono">{expectedPhrase}</span>.
          </li>
        </ol>

        <button type="button" onClick={onGenerateDiff} disabled={diffLoading}>
          {diffLoading ? "Generating Governance Diff..." : "Generate Governance Diff"}
        </button>

        {diff ? (
          <div className="tv-diff-wrap">
            <h4>Governance Diff</h4>
            <p className="tv-subtle">Generated: {formatDateTime(diff.generatedAt)}</p>

            <div className="tv-validation-grid">
              <div className={`tv-validation${diff.validations.allFoundationsPresent ? " ok" : " error"}`}>
                Foundations complete: {diff.validations.allFoundationsPresent ? "Yes" : "No"}
              </div>
              <div className={`tv-validation${diff.validations.dependenciesMet ? " ok" : " error"}`}>
                Dependencies met: {diff.validations.dependenciesMet ? "Yes" : "No"}
              </div>
              <div className={`tv-validation${diff.validations.canonCompliant ? " ok" : " error"}`}>
                Canon compliant: {diff.validations.canonCompliant ? "Yes" : "No"}
              </div>
            </div>

            {diff.blockers?.length > 0 ? (
              <div className="tv-alert tv-alert-error">
                <p>
                  <TriangleAlert size={14} />
                  Blockers
                </p>
                <ul>
                  {diff.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="tv-alert tv-alert-ok">
                <p>
                  <CheckCircle2 size={14} />
                  No blockers in this review.
                </p>
              </div>
            )}

            {diff.warnings?.length > 0 ? (
              <div className="tv-alert tv-alert-warn">
                <p>
                  <FileWarning size={14} />
                  Warnings (must acknowledge)
                </p>
                <ul>
                  {diff.warnings.map((warning) => (
                    <li key={warning}>
                      <label className="tv-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(warningAcknowledgments[warning])}
                          onChange={(event) => onWarningToggle(warning, event.target.checked)}
                        />
                        <span>{warning}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <label>
              Confirm
              <input
                value={confirmPhrase}
                onChange={(event) => onConfirmPhraseChange(event.target.value)}
                placeholder={expectedPhrase}
              />
            </label>

            <button type="button" onClick={onDeploy} disabled={!canDeploy || deployLoading}>
              {deployLoading ? "Deploying..." : "Deploy"}
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}

function SidePanel({ environment, canon, memoryEntries, auditEntries }) {
  return (
    <aside className="tv-side-panel">
      <article className="tv-card">
        <h3>Operator Focus</h3>
        {environment ? (
          <>
            <p>
              <strong>{environment.town}</strong>
            </p>
            <p className="tv-subtle">Status: {environment.status}</p>
            <p className="tv-subtle">Health: {environment.health}</p>
            <p className="tv-subtle">Last deploy: {formatDateTime(environment.lastDeploy)}</p>
          </>
        ) : (
          <p className="tv-subtle">Select an environment to view scoped continuity data.</p>
        )}
      </article>

      <article className="tv-card">
        <h3>Canon Dependencies</h3>
        {canon.workspaces.map((workspace) => (
          <div key={workspace.name} className="tv-side-item">
            <p>{workspace.name}</p>
            <p className="tv-subtle">{(workspace.dependsOn || []).join(", ")}</p>
          </div>
        ))}
      </article>

      <article className="tv-card">
        <h3>Recent Memory</h3>
        {memoryEntries.slice(0, 4).map((entry) => (
          <div key={entry.id} className="tv-side-item">
            <p>{entry.type}</p>
            <p className="tv-subtle">{entry.content}</p>
          </div>
        ))}
        {memoryEntries.length === 0 ? <p className="tv-subtle">No entries yet.</p> : null}
      </article>

      <article className="tv-card">
        <h3>Recent Audit</h3>
        {auditEntries.slice(0, 4).map((entry) => (
          <div key={entry.id || `${entry.timestamp}-${entry.action_type}`} className="tv-side-item">
            <p>{entry.action_type || entry.result || "event"}</p>
            <p className="tv-subtle">{formatDateTime(entry.timestamp)}</p>
          </div>
        ))}
        {auditEntries.length === 0 ? <p className="tv-subtle">No entries yet.</p> : null}
      </article>
    </aside>
  );
}

export default function App() {
  const [authState, setAuthState] = useState("checking");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [activeNav, setActiveNav] = useState("active");
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedDashboardEnvironment, setSelectedDashboardEnvironment] = useState(null);
  const [rememberedLogin, setRememberedLogin] = useState({
    username: "",
    rememberMe: false
  });
  const [environments, setEnvironments] = useState([]);
  const [canon, setCanon] = useState({ foundations: [], workspaces: [] });
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState(null);
  const [context, setContext] = useState(structuredClone(DEFAULT_CONTEXT));
  const [connection, setConnection] = useState({ ...EMPTY_CONNECTION });
  const [diff, setDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [warningAcknowledgments, setWarningAcknowledgments] = useState({});
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deployLoading, setDeployLoading] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState(null);
  const [remoteEnvironmentStatus, setRemoteEnvironmentStatus] = useState(null);
  const [remoteActionDraft, setRemoteActionDraft] = useState(createDefaultRemoteActionDraft(""));
  const [remoteActionLoading, setRemoteActionLoading] = useState("");
  const [remoteActionResult, setRemoteActionResult] = useState(null);
  const [proofEntries, setProofEntries] = useState([]);
  const [proofRootPath, setProofRootPath] = useState("");
  const [proofDraft, setProofDraft] = useState(createDefaultProofDraft(""));
  const [proofLoading, setProofLoading] = useState(false);

  const [memoryEntries, setMemoryEntries] = useState([]);
  const [memoryFilters, setMemoryFilters] = useState({ envId: "", type: "", q: "" });
  const [memoryDraft, setMemoryDraft] = useState({ envId: "", type: "note", content: "" });

  const [auditEntries, setAuditEntries] = useState([]);
  const [auditEnvFilter, setAuditEnvFilter] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");

  const [environmentQuery, setEnvironmentQuery] = useState("");
  const [environmentStatusFilter, setEnvironmentStatusFilter] = useState("");

  useEffect(() => {
    const rememberMe = window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
    const username = window.localStorage.getItem(REMEMBER_USERNAME_KEY) || "";
    setRememberedLogin({
      username: rememberMe ? username : "",
      rememberMe
    });
  }, []);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    if (response.status === 204) {
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error || "Request failed.";
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function bootstrap() {
    try {
      const [environmentPayload, canonPayload, statusPayload] = await Promise.all([
        api("/veritas/environments"),
        api("/veritas/canon"),
        api("/status")
      ]);
      const items = environmentPayload.environments || [];
      setEnvironments(items);
      setCanon(canonPayload || { foundations: [], workspaces: [] });
      setRemoteStatus(statusPayload || null);
      setAuthState("authenticated");
    } catch (error) {
      if (error.status === 401) {
        setAuthState("unauthenticated");
        return;
      }
      toast.error(toHelpfulErrorMessage(error));
      setAuthState("unauthenticated");
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedEnvironmentId || authState !== "authenticated") {
      return;
    }

    async function loadEnvironmentScope() {
      try {
        const [
          environmentPayload,
          contextPayload,
          memoryPayload,
          auditPayload,
          connectionPayload,
          proofPayload,
          remotePayload
        ] =
          await Promise.all([
            api(`/veritas/environments/${encodeURIComponent(selectedEnvironmentId)}`),
            api(`/veritas/environments/${encodeURIComponent(selectedEnvironmentId)}/context`),
            api(`/veritas/memory/${encodeURIComponent(selectedEnvironmentId)}`),
            api(`/veritas/audit/${encodeURIComponent(selectedEnvironmentId)}`),
            api(`/veritas/environments/${encodeURIComponent(selectedEnvironmentId)}/connection`),
            api(`/veritas/proof/${encodeURIComponent(selectedEnvironmentId)}`),
            api(`/veritas/remote/${encodeURIComponent(selectedEnvironmentId)}/status`)
          ]);

        setSelectedEnvironment(environmentPayload);
        setContext(contextPayload || structuredClone(DEFAULT_CONTEXT));
        setConnection(connectionPayload.connection || { ...EMPTY_CONNECTION });
        setProofEntries(proofPayload.entries || []);
        setProofRootPath(proofPayload.rootPath || "");
        setProofDraft(createDefaultProofDraft(environmentPayload?.town || ""));
        setRemoteEnvironmentStatus(remotePayload || null);
        setRemoteActionDraft(createDefaultRemoteActionDraft(environmentPayload?.town || ""));
        setRemoteActionResult(null);
        setMemoryEntries(memoryPayload.entries || []);
        setAuditEntries(auditPayload.entries || []);
        setMemoryDraft((previous) => ({ ...previous, envId: selectedEnvironmentId }));
        setMemoryFilters((previous) => ({ ...previous, envId: selectedEnvironmentId }));
      } catch (error) {
        toast.error(toHelpfulErrorMessage(error));
      }
    }

    void loadEnvironmentScope();
  }, [selectedEnvironmentId, authState]);

  useEffect(() => {
    if (selectedEnvironmentId) {
      return;
    }
    setSelectedEnvironment(null);
    setRemoteEnvironmentStatus(null);
    setRemoteActionResult(null);
  }, [selectedEnvironmentId]);

  const filteredEnvironments = useMemo(() => {
    const query = environmentQuery.trim().toLowerCase();
    return environments.filter((environment) => {
      if (environmentStatusFilter && environment.status !== environmentStatusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return JSON.stringify(environment).toLowerCase().includes(query);
    });
  }, [environments, environmentQuery, environmentStatusFilter]);

  async function handleLogin({ username, password, rememberMe }) {
    setLoginLoading(true);
    setLoginError("");
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
        window.localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
      } else {
        window.localStorage.removeItem(REMEMBER_ENABLED_KEY);
        window.localStorage.removeItem(REMEMBER_USERNAME_KEY);
      }
      setRememberedLogin({
        username: rememberMe ? username.trim() : "",
        rememberMe
      });
      await bootstrap();
      toast.success("Session established.");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await api("/logout", { method: "POST" });
      setAuthState("unauthenticated");
      setShowDashboard(true);
      setSelectedDashboardEnvironment(null);
      setSelectedEnvironmentId("");
      setSelectedEnvironment(null);
      toast.success("Session closed.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  async function refreshEnvironments() {
    try {
      const payload = await api("/veritas/environments");
      setEnvironments(payload.environments || []);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  async function refreshRemoteStatus() {
    try {
      const payload = await api("/status");
      setRemoteStatus(payload || null);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  async function refreshEnvironmentRemoteStatus(environmentId = selectedEnvironmentId) {
    if (!environmentId) {
      setRemoteEnvironmentStatus(null);
      return;
    }
    try {
      const payload = await api(`/veritas/remote/${encodeURIComponent(environmentId)}/status`);
      setRemoteEnvironmentStatus(payload || null);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  async function handleDashboardEnvironmentSelected(environment) {
    const selected = environment && typeof environment === "object" ? environment : null;
    if (!selected) {
      return;
    }

    const directMappedId = String(selected.consoleEnvironmentId || selected.environmentId || "").trim();
    const selectedTownKey = normalizeTownKey(selected.clientShortName || selected.clientName || "");
    const selectedTenantKey = normalizeTenantDomain(selected.tenantId || "");

    const fallbackMatch = environments.find((item) => {
      const envTownKey = normalizeTownKey(item.town || item.id || "");
      const envTenantKey = normalizeTenantDomain(item.tenant?.domain || "");
      if (selectedTownKey && envTownKey && selectedTownKey === envTownKey) {
        return true;
      }
      if (selectedTenantKey && envTenantKey && selectedTenantKey === envTenantKey) {
        return true;
      }
      return false;
    });

    let resolvedEnvironmentId = directMappedId || String(fallbackMatch?.id || "").trim();
    if (!resolvedEnvironmentId) {
      try {
        const stage = String(selected.stage || "production").toLowerCase();
        const statusMap = {
          production: "active",
          pilot: "foundations",
          test: "diagnostic",
          sandbox: "diagnostic"
        };
        const healthMap = {
          healthy: "nominal",
          warning: "warning",
          error: "warning"
        };
        const inferredStatus = statusMap[stage] || "prospect";
        const inferredHealth = healthMap[String(selected?.health?.overall || "").toLowerCase()] || "pending";

        const created = await api("/veritas/environments", {
          method: "POST",
          body: JSON.stringify({
            id: `env-${crypto.randomUUID().slice(0, 8)}`,
            town: toDisplayTown(selected.clientName || selected.clientShortName || "Municipality"),
            status: inferredStatus,
            health: inferredHealth,
            tenant: {
              type: "M365",
              domain: selected.tenantId || "",
              adminContact: selected.primaryContact?.name || "",
              notes: ""
            },
            modules: [],
            contacts: [],
            liveUrl: "",
            operator: "N. Boudreau"
          })
        });
        resolvedEnvironmentId = String(created?.id || "").trim();
        await refreshEnvironments();
        if (resolvedEnvironmentId) {
          toast.success("Environment mapped into active console.");
        }
      } catch (error) {
        toast.error(toHelpfulErrorMessage(error, "Unable to map this environment into the active console."));
      }
    }

    if (!resolvedEnvironmentId) {
      setShowDashboard(true);
      return;
    }

    setSelectedDashboardEnvironment(selected);
    setShowDashboard(false);
    setActiveNav("active");
    setSelectedEnvironmentId(resolvedEnvironmentId);

    const raw = selected._raw && typeof selected._raw === "object" ? selected._raw : {};
    const fallbackContext = {
      ...structuredClone(DEFAULT_CONTEXT),
      targetTenant: {
        ...structuredClone(DEFAULT_CONTEXT).targetTenant,
        domain: selected.tenantId || ""
      }
    };

    setContext((previous) => ({
      ...fallbackContext,
      ...previous,
      targetTenant: {
        ...fallbackContext.targetTenant,
        ...(previous.targetTenant || {}),
        domain: raw.microsoftTenantId || selected.tenantId || previous.targetTenant?.domain || ""
      },
      selectedModules: previous.selectedModules || [],
      overrides: Array.isArray(previous.overrides) ? previous.overrides : [],
      checklist: {
        ...structuredClone(DEFAULT_CONTEXT).checklist,
        ...(previous.checklist || {})
      },
      graph: {
        ...structuredClone(DEFAULT_CONTEXT).graph,
        ...(previous.graph || {})
      },
      metadata: {
        ...(previous.metadata || {}),
        updatedBy: previous.metadata?.updatedBy || "",
        updatedAt: previous.metadata?.updatedAt || ""
      }
    }));
  }

  function handleRemoteActionDraftChange(field, value) {
    setRemoteActionDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function handleRemoteDeployGithub() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setRemoteActionLoading("github-deploy");
    try {
      const payload = await api("/veritas/remote/github/deploy", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          reason: `Remote publish from ${selectedEnvironment?.town || selectedEnvironmentId}`
        })
      });
      setRemoteActionResult({
        action: "GitHub deploy",
        when: formatDateTime(new Date().toISOString()),
        summary: payload?.commitSha
          ? `Commit: ${payload.commitSha}`
          : String(payload?.output || "Deploy completed.")
      });
      toast.success("GitHub remote deploy completed.");
      await refreshRemoteStatus();
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setRemoteActionLoading("");
    }
  }

  async function handleRemoteCreateSharePointFolder() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setRemoteActionLoading("sp-folder");
    try {
      const payload = await api("/veritas/remote/sharepoint/folder", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          libraryName: remoteActionDraft.libraryName,
          folderPath: remoteActionDraft.folderPath
        })
      });
      setRemoteActionResult({
        action: "SharePoint folder",
        when: formatDateTime(new Date().toISOString()),
        summary: payload?.webUrl || payload?.folderPath || "Folder created."
      });
      toast.success("SharePoint folder created.");
      await refreshEnvironmentRemoteStatus(selectedEnvironmentId);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setRemoteActionLoading("");
    }
  }

  async function handleRemoteCreateSharePointDocument() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setRemoteActionLoading("sp-document");
    try {
      const payload = await api("/veritas/remote/sharepoint/document", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          libraryName: remoteActionDraft.libraryName,
          folderPath: remoteActionDraft.folderPath,
          documentName: remoteActionDraft.documentName,
          content: remoteActionDraft.documentContent
        })
      });
      setRemoteActionResult({
        action: "SharePoint document",
        when: formatDateTime(new Date().toISOString()),
        summary: payload?.webUrl || payload?.documentPath || "Document created."
      });
      toast.success("SharePoint document created.");
      await refreshEnvironmentRemoteStatus(selectedEnvironmentId);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setRemoteActionLoading("");
    }
  }

  async function handleRemoteCreateSharePointPage() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setRemoteActionLoading("sp-page");
    try {
      const payload = await api("/veritas/remote/sharepoint/page", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          pageTitle: remoteActionDraft.pageTitle,
          pageName: remoteActionDraft.pageName,
          content: remoteActionDraft.pageContent
        })
      });
      setRemoteActionResult({
        action: `SharePoint page (${payload?.mode || "created"})`,
        when: formatDateTime(new Date().toISOString()),
        summary: payload?.webUrl || payload?.pageName || "Page created."
      });
      toast.success("SharePoint page created.");
      await refreshEnvironmentRemoteStatus(selectedEnvironmentId);
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setRemoteActionLoading("");
    }
  }

  function updateNestedState(setter, pathExpression, value) {
    setter((previous) => {
      const next = structuredClone(previous);
      const parts = pathExpression.split(".");
      let cursor = next;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];
        cursor[key] = cursor[key] || {};
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function handleEnvironmentField(pathExpression, value) {
    updateNestedState(setSelectedEnvironment, pathExpression, value);
  }

  async function handleSaveEnvironment() {
    if (!selectedEnvironment) {
      return;
    }
    try {
      const payload = await api(`/veritas/environments/${encodeURIComponent(selectedEnvironment.id)}`, {
        method: "PUT",
        body: JSON.stringify(selectedEnvironment)
      });
      setSelectedEnvironment(payload);
      await refreshEnvironments();
      toast.success("Environment saved.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  function handleContextField(pathExpression, value) {
    if (pathExpression === "overrides") {
      setContext((previous) => ({ ...previous, overrides: value }));
      return;
    }
    updateNestedState(setContext, pathExpression, value);
  }

  function handleContextChecklist(field, value) {
    setContext((previous) => ({
      ...previous,
      checklist: {
        ...(previous.checklist || {}),
        [field]: value
      }
    }));
  }

  function handleToggleModule(moduleName) {
    setContext((previous) => {
      const selected = new Set(previous.selectedModules || []);
      if (selected.has(moduleName)) {
        selected.delete(moduleName);
      } else {
        selected.add(moduleName);
      }
      return {
        ...previous,
        selectedModules: [...selected]
      };
    });
  }

  async function handleSaveContext() {
    if (!selectedEnvironmentId) {
      return;
    }
    try {
      const payload = await api(`/veritas/environments/${encodeURIComponent(selectedEnvironmentId)}/context`, {
        method: "PUT",
        body: JSON.stringify(context)
      });
      setContext(payload);
      toast.success("Deployment context saved.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  function handleConnectionField(field, value) {
    setConnection((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSaveConnection() {
    if (!selectedEnvironmentId) {
      return;
    }
    try {
      const payload = await api(`/veritas/environments/${encodeURIComponent(selectedEnvironmentId)}/connection`, {
        method: "PUT",
        body: JSON.stringify(connection)
      });
      setConnection(payload.connection || connection);
      toast.success("Connection reference saved.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  function handleProofDraftChange(field, value) {
    setProofDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function refreshProofEntries(envId) {
    if (!envId) {
      setProofEntries([]);
      setProofRootPath("");
      return;
    }
    const payload = await api(`/veritas/proof/${encodeURIComponent(envId)}`);
    setProofEntries(payload.entries || []);
    setProofRootPath(payload.rootPath || "");
  }

  async function handleCreateProofFolder() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setProofLoading(true);
    try {
      await api("/veritas/proof/folder", {
        method: "POST",
        body: JSON.stringify({
          envId: selectedEnvironmentId,
          folderName: proofDraft.folderName
        })
      });
      await refreshProofEntries(selectedEnvironmentId);
      toast.success("Proof folder created.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setProofLoading(false);
    }
  }

  async function handleCreateProofDocument() {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment first.");
      return;
    }
    setProofLoading(true);
    try {
      await api("/veritas/proof/document", {
        method: "POST",
        body: JSON.stringify({
          envId: selectedEnvironmentId,
          folderName: proofDraft.folderName,
          documentName: proofDraft.documentName,
          content: proofDraft.content
        })
      });
      await refreshProofEntries(selectedEnvironmentId);
      setProofDraft((previous) => ({ ...previous, content: "" }));
      toast.success("Proof document created.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setProofLoading(false);
    }
  }

  async function handleGenerateDiff() {
    if (!selectedEnvironmentId) {
      return;
    }
    setDiffLoading(true);
    setDiff(null);
    setConfirmPhrase("");
    setWarningAcknowledgments({});
    try {
      const payload = await api("/veritas/governance-diff", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          modules: context.selectedModules
        })
      });
      setDiff(payload);
      toast.success("Governance diff generated.");
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    } finally {
      setDiffLoading(false);
    }
  }

  function handleWarningToggle(warning, checked) {
    setWarningAcknowledgments((previous) => ({ ...previous, [warning]: checked }));
  }

  async function handleDeploy() {
    if (!selectedEnvironmentId || !diff) {
      return;
    }
    setDeployLoading(true);
    try {
      const acknowledgedWarnings = Object.entries(warningAcknowledgments)
        .filter(([, checked]) => checked)
        .map(([warning]) => warning);

      const payload = await api("/veritas/deploy", {
        method: "POST",
        body: JSON.stringify({
          environmentId: selectedEnvironmentId,
          modules: context.selectedModules,
          diffId: diff.diffId,
          diffApproved: true,
          confirmPhrase,
          acknowledgedWarnings
        })
      });

      toast.success(`Deployment ${payload.deploymentId} completed.`);
      setDiff(null);
      setWarningAcknowledgments({});
      setConfirmPhrase("");
      await refreshEnvironments();

      const [memoryPayload, auditPayload] = await Promise.all([
        api(`/veritas/memory/${encodeURIComponent(selectedEnvironmentId)}`),
        api(`/veritas/audit/${encodeURIComponent(selectedEnvironmentId)}`)
      ]);
      setMemoryEntries(memoryPayload.entries || []);
      setAuditEntries(auditPayload.entries || []);
      setSelectedEnvironment((previous) =>
        previous
          ? {
              ...previous,
              modules: unionModules(previous.modules, context.selectedModules),
              lastDeploy: payload.summary?.timestamp || new Date().toISOString(),
              status: "active",
              health: "nominal"
            }
          : previous
      );
    } catch (error) {
      const blockers = error?.payload?.blockers;
      if (Array.isArray(blockers) && blockers.length > 0) {
        toast.error(blockers[0]);
      } else {
        toast.error(toHelpfulErrorMessage(error));
      }
    } finally {
      setDeployLoading(false);
    }
  }

  function handleMemoryDraftChange(field, value) {
    setMemoryDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function handleCreateMemoryEntry() {
    try {
      await api("/veritas/memory", {
        method: "POST",
        body: JSON.stringify(memoryDraft)
      });
      toast.success("Memory entry saved.");
      const payload = await api(`/veritas/memory/${encodeURIComponent(memoryDraft.envId || selectedEnvironmentId)}`);
      setMemoryEntries(payload.entries || []);
      setMemoryDraft((previous) => ({ ...previous, content: "" }));
    } catch (error) {
      toast.error(toHelpfulErrorMessage(error));
    }
  }

  function handleMemoryFilterChange(field, value) {
    setMemoryFilters((previous) => ({ ...previous, [field]: value }));
  }

  const filteredMemoryEntries = useMemo(() => {
    return memoryEntries.filter((entry) => {
      if (memoryFilters.envId && entry.envId !== memoryFilters.envId) {
        return false;
      }
      if (memoryFilters.type && entry.type !== memoryFilters.type) {
        return false;
      }
      if (!memoryFilters.q) {
        return true;
      }
      return JSON.stringify(entry).toLowerCase().includes(memoryFilters.q.toLowerCase());
    });
  }, [memoryEntries, memoryFilters]);

  const filteredAuditEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      if (auditEnvFilter && String(entry.environment_id || "") !== auditEnvFilter) {
        return false;
      }
      if (auditActionFilter && String(entry.action_type || "").toLowerCase() !== auditActionFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [auditEntries, auditEnvFilter, auditActionFilter]);

  if (authState === "checking") {
    return <main className="tv-loading">Loading PublicLogic Portal...</main>;
  }

  if (authState !== "authenticated") {
    return (
      <LoginScreen
        onSubmit={handleLogin}
        error={loginError}
        loading={loginLoading}
        initialUsername={rememberedLogin.username}
        initialRememberMe={rememberedLogin.rememberMe}
      />
    );
  }

  return (
    <div className="tv-shell tv-shell-focus">
      <Sidebar activeNav={activeNav} onChange={setActiveNav} />

      <main className="tv-main">
        <header className="tv-main-header">
          <div>
            <h1>PublicLogic Portal</h1>
            <p className="tv-subtle">Powered by Tenebrux Veritas</p>
            <p className="tv-active-target-pill">
              Active target:{" "}
              {selectedEnvironment
                ? `${selectedEnvironment.town} (${selectedEnvironment.id})`
                : selectedDashboardEnvironment?.clientName || "none"}
            </p>
          </div>
          <div className="tv-inline-actions">
            {!showDashboard ? (
              <button className="back-to-dashboard-btn" type="button" onClick={() => setShowDashboard(true)}>
                ← Back to Dashboard
              </button>
            ) : null}
            <p className="tv-meta">{new Date().toLocaleString()}</p>
            <button className="tv-ghost" type="button" onClick={handleLogout}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </header>

        {showDashboard ? (
          <Dashboard onEnvironmentSelected={handleDashboardEnvironmentSelected} />
        ) : null}

        {!showDashboard && activeNav === "dashboard" ? (
          <DashboardView
            environments={environments}
            onOpenEnvironment={(id) => {
              setActiveNav("active");
              setSelectedEnvironmentId(id);
            }}
          />
        ) : null}

        {!showDashboard && activeNav === "active" ? (
          <section className="tv-environments-layout">
            <EnvironmentList
              environments={environments}
              selectedEnvironmentId={selectedEnvironmentId}
              onSelect={setSelectedEnvironmentId}
              query=""
              onQueryChange={() => {}}
              statusFilter=""
              onStatusFilterChange={() => {}}
              compact
            />

            <EnvironmentDetail
              environment={selectedEnvironment}
              canon={canon}
              context={context}
              connection={connection}
              remoteStatus={remoteStatus}
              onRefreshRemoteStatus={refreshRemoteStatus}
              remoteEnvironmentStatus={remoteEnvironmentStatus}
              remoteActionDraft={remoteActionDraft}
              onRemoteActionDraftChange={handleRemoteActionDraftChange}
              onRemoteDeployGithub={handleRemoteDeployGithub}
              onRemoteCreateSharePointFolder={handleRemoteCreateSharePointFolder}
              onRemoteCreateSharePointDocument={handleRemoteCreateSharePointDocument}
              onRemoteCreateSharePointPage={handleRemoteCreateSharePointPage}
              remoteActionLoading={remoteActionLoading}
              remoteActionResult={remoteActionResult}
              proofEntries={proofEntries}
              proofRootPath={proofRootPath}
              proofDraft={proofDraft}
              onProofDraftChange={handleProofDraftChange}
              onCreateProofFolder={handleCreateProofFolder}
              onCreateProofDocument={handleCreateProofDocument}
              proofLoading={proofLoading}
              onEnvironmentField={handleEnvironmentField}
              onSaveEnvironment={handleSaveEnvironment}
              onContextField={handleContextField}
              onContextChecklist={handleContextChecklist}
              onToggleModule={handleToggleModule}
              onSaveContext={handleSaveContext}
              onConnectionField={handleConnectionField}
              onSaveConnection={handleSaveConnection}
              diff={diff}
              diffLoading={diffLoading}
              onGenerateDiff={handleGenerateDiff}
              warningAcknowledgments={warningAcknowledgments}
              onWarningToggle={handleWarningToggle}
              confirmPhrase={confirmPhrase}
              onConfirmPhraseChange={setConfirmPhrase}
              onDeploy={handleDeploy}
              deployLoading={deployLoading}
              mode="focused"
            />
          </section>
        ) : null}

        {!showDashboard && activeNav === "environments" ? (
          <section className="tv-environments-layout">
            <EnvironmentList
              environments={filteredEnvironments}
              selectedEnvironmentId={selectedEnvironmentId}
              onSelect={setSelectedEnvironmentId}
              query={environmentQuery}
              onQueryChange={setEnvironmentQuery}
              statusFilter={environmentStatusFilter}
              onStatusFilterChange={setEnvironmentStatusFilter}
            />

            <EnvironmentDetail
              environment={selectedEnvironment}
              canon={canon}
              context={context}
              connection={connection}
              remoteStatus={remoteStatus}
              onRefreshRemoteStatus={refreshRemoteStatus}
              remoteEnvironmentStatus={remoteEnvironmentStatus}
              remoteActionDraft={remoteActionDraft}
              onRemoteActionDraftChange={handleRemoteActionDraftChange}
              onRemoteDeployGithub={handleRemoteDeployGithub}
              onRemoteCreateSharePointFolder={handleRemoteCreateSharePointFolder}
              onRemoteCreateSharePointDocument={handleRemoteCreateSharePointDocument}
              onRemoteCreateSharePointPage={handleRemoteCreateSharePointPage}
              remoteActionLoading={remoteActionLoading}
              remoteActionResult={remoteActionResult}
              proofEntries={proofEntries}
              proofRootPath={proofRootPath}
              proofDraft={proofDraft}
              onProofDraftChange={handleProofDraftChange}
              onCreateProofFolder={handleCreateProofFolder}
              onCreateProofDocument={handleCreateProofDocument}
              proofLoading={proofLoading}
              onEnvironmentField={handleEnvironmentField}
              onSaveEnvironment={handleSaveEnvironment}
              onContextField={handleContextField}
              onContextChecklist={handleContextChecklist}
              onToggleModule={handleToggleModule}
              onSaveContext={handleSaveContext}
              onConnectionField={handleConnectionField}
              onSaveConnection={handleSaveConnection}
              diff={diff}
              diffLoading={diffLoading}
              onGenerateDiff={handleGenerateDiff}
              warningAcknowledgments={warningAcknowledgments}
              onWarningToggle={handleWarningToggle}
              confirmPhrase={confirmPhrase}
              onConfirmPhraseChange={setConfirmPhrase}
              onDeploy={handleDeploy}
              deployLoading={deployLoading}
            />
          </section>
        ) : null}

      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
