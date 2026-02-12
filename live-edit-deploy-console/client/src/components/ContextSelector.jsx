import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  Link2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  ChevronRight,
  X
} from "lucide-react";

export function EnvironmentBadge({ environment }) {
  const normalized = String(environment || "").toLowerCase();
  const variants = {
    test: { className: "env-badge-test", label: "TEST" },
    pilot: { className: "env-badge-pilot", label: "PILOT" },
    production: { className: "env-badge-production", label: "PROD" }
  };

  const variant = variants[normalized] || variants.test;

  return <span className={`env-badge ${variant.className}`}>{variant.label}</span>;
}

export default function ContextSelector({ onContextSelected, disabled }) {
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContext, setSelectedContext] = useState(null);

  useEffect(() => {
    void loadContexts();
  }, []);

  async function loadContexts() {
    try {
      setLoading(true);
      const response = await fetch("/contexts", {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to load contexts");
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error("Context API returned non-JSON response. Check backend route/proxy.");
      }

      const data = await response.json();
      setContexts(Array.isArray(data.contexts) ? data.contexts : []);
      setError(null);
    } catch (loadError) {
      console.error("Veritas: Error loading contexts", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load contexts");
    } finally {
      setLoading(false);
    }
  }

  const filteredContexts = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) {
      return contexts;
    }

    return contexts.filter((context) => {
      return (
        String(context.clientName || "").toLowerCase().includes(query) ||
        String(context.clientShortName || "").toLowerCase().includes(query) ||
        String(context.deploymentEnvironment || "").toLowerCase().includes(query) ||
        String(context.tenantId || "").toLowerCase().includes(query)
      );
    });
  }, [contexts, searchQuery]);

  if (loading) {
    return (
      <section className="context-selector">
        <p className="notice">Loading deployment contexts...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="context-selector">
        <p className="error">Error loading contexts: {error}</p>
        <button type="button" onClick={() => void loadContexts()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="context-selector">
      <div className="context-selector-header">
        <div>
          <h2>Select Deployment Context</h2>
          <p className="subtle">
            All subsequent actions will be scoped to the selected municipality and environment.
          </p>
        </div>
      </div>

      <div className="context-search">
        <Search size={20} className="context-search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by client name, environment, or tenant ID..."
          className="context-search-input"
        />
      </div>

      <div className="context-grid">
        {filteredContexts.length === 0 ? (
          <div className="no-contexts">
            <p>No contexts found matching "{searchQuery}"</p>
          </div>
        ) : (
          filteredContexts.map((context) => (
            <ContextCard
              key={context.contextId}
              context={context}
              isSelected={selectedContext?.contextId === context.contextId}
              onClick={() => setSelectedContext(context)}
              disabled={disabled}
            />
          ))
        )}
      </div>

      {selectedContext ? (
        <ContextDetailsPanel
          context={selectedContext}
          onProceed={() => onContextSelected(selectedContext)}
          onCancel={() => setSelectedContext(null)}
          disabled={disabled}
        />
      ) : null}
    </section>
  );
}

function ContextCard({ context, isSelected, onClick, disabled }) {
  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <article
      className={`context-card ${isSelected ? "context-card-selected" : ""}`}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
    >
      <div className="context-card-header">
        <div>
          <h3 className="context-card-title">{context.clientName}</h3>
          <p className="context-card-subtitle">{context.sharePointRootUrl || context.tenantId}</p>
        </div>
        <EnvironmentBadge environment={context.deploymentEnvironment} />
      </div>

      <div className="context-stats">
        <StatBadge
          icon={<Users size={16} />}
          label="Authorities"
          value={Array.isArray(context.authorityMapping) ? context.authorityMapping.length : 0}
        />
        <StatBadge
          icon={<Link2 size={16} />}
          label="Connectors"
          value={getHealthyConnectorCount(context.activeConnectors)}
          total={Array.isArray(context.activeConnectors) ? context.activeConnectors.length : 0}
        />
      </div>

      <div className="context-health">
        <ConnectorHealthIndicators connectors={context.activeConnectors || []} />
      </div>

      <p className="context-card-footer">
        Last used {formatTimeAgo(context.lastModified || context.createdAt)}
      </p>
    </article>
  );
}

function StatBadge({ icon, label, value, total }) {
  return (
    <div className="stat-badge">
      <span className="stat-icon">{icon}</span>
      <div className="stat-content">
        <span className="stat-value">
          {value}
          {total ? `/${total}` : ""}
        </span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function ConnectorHealthIndicators({ connectors }) {
  if (!Array.isArray(connectors) || connectors.length === 0) {
    return <span className="subtle">No connectors configured</span>;
  }

  const healthy = connectors.filter((connector) => connector.status === "healthy").length;
  const degraded = connectors.filter((connector) => connector.status === "degraded").length;
  const failed = connectors.filter((connector) => connector.status === "failed").length;

  return (
    <div className="connector-indicators">
      {healthy > 0 ? (
        <span className="connector-indicator connector-healthy">
          <CheckCircle2 size={14} />
          {healthy} healthy
        </span>
      ) : null}
      {degraded > 0 ? (
        <span className="connector-indicator connector-degraded">
          <AlertCircle size={14} />
          {degraded} degraded
        </span>
      ) : null}
      {failed > 0 ? (
        <span className="connector-indicator connector-failed">
          <XCircle size={14} />
          {failed} failed
        </span>
      ) : null}
    </div>
  );
}

function ContextDetailsPanel({ context, onProceed, onCancel, disabled }) {
  async function handleCopy(value) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
    } catch {
      // clipboard access best-effort
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <article className="context-details-panel" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="context-details-header">
        <div>
          <h3>{context.clientName}</h3>
          <p className="subtle">Confirm deployment context before proceeding</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="icon-button"
          aria-label="Close details"
          disabled={disabled}
        >
          <X size={20} />
        </button>
      </div>

      <section className="context-details-section">
        <h4>
          <Building2 size={16} />
          Tenant Information
        </h4>
        <dl className="detail-list">
          <div className="detail-row">
            <dt>Microsoft 365 Tenant</dt>
            <dd>
              <code>{context.tenantId}</code>
              <button
                type="button"
                onClick={() => void handleCopy(context.tenantId)}
                className="copy-button"
                title="Copy tenant ID"
              >
                Copy
              </button>
            </dd>
          </div>
          <div className="detail-row">
            <dt>SharePoint Root</dt>
            <dd>{context.sharePointRootUrl || "Not configured"}</dd>
          </div>
          <div className="detail-row">
            <dt>Canonical Repository</dt>
            <dd>{context.canonicalRepoUrl || "Not configured"}</dd>
          </div>
          <div className="detail-row">
            <dt>Environment</dt>
            <dd>
              <EnvironmentBadge environment={context.deploymentEnvironment} />
            </dd>
          </div>
        </dl>
      </section>

      {Array.isArray(context.authorityMapping) && context.authorityMapping.length > 0 ? (
        <section className="context-details-section">
          <h4>
            <Users size={16} />
            Authority Mapping ({context.authorityMapping.length})
          </h4>
          <div className="authority-list">
            {context.authorityMapping.slice(0, 5).map((authority, index) => (
              <div key={`${authority.email || authority.userName || "authority"}-${index}`} className="authority-item">
                <span className="authority-name">{authority.userName || authority.email}</span>
                <span className="authority-role">{authority.role}</span>
              </div>
            ))}
            {context.authorityMapping.length > 5 ? (
              <p className="subtle">+{context.authorityMapping.length - 5} more...</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {Array.isArray(context.activeConnectors) && context.activeConnectors.length > 0 ? (
        <section className="context-details-section">
          <h4>
            <Link2 size={16} />
            External Connectors ({context.activeConnectors.length})
          </h4>
          <div className="connector-list">
            {context.activeConnectors.map((connector, index) => (
              <div key={`${connector.type || "connector"}-${index}`} className="connector-item">
                <span>{connector.type}</span>
                <ConnectorStatusBadge status={connector.status} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="governance-notice">
        <AlertCircle size={20} />
        <div>
          <p className="governance-notice-title">Governance Scope</p>
          <p className="subtle">
            All subsequent actions will be executed against <strong>{context.clientName}</strong> in
            the <strong> {context.deploymentEnvironment}</strong> environment. This selection will be
            logged in the audit trail.
          </p>
        </div>
      </div>

      <div className="context-details-actions">
        <button type="button" onClick={onCancel} className="secondary" disabled={disabled}>
          Cancel
        </button>
        <button type="button" onClick={onProceed} disabled={disabled}>
          Continue with {context.clientShortName}
          <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}

function ConnectorStatusBadge({ status }) {
  const normalized = String(status || "not_configured").toLowerCase();
  const icons = {
    healthy: <CheckCircle2 size={14} />,
    degraded: <AlertCircle size={14} />,
    failed: <XCircle size={14} />,
    not_configured: <AlertCircle size={14} />
  };

  return (
    <span className={`connector-status connector-status-${normalized}`}>
      {icons[normalized] || icons.not_configured}
      {normalized}
    </span>
  );
}

function getHealthyConnectorCount(connectors) {
  if (!Array.isArray(connectors)) {
    return 0;
  }
  return connectors.filter((connector) => connector.status === "healthy").length;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) {
    return "never";
  }

  const seconds = Math.floor((Date.now() - Date.parse(timestamp)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return new Date(timestamp).toLocaleDateString();
  }

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;

  return new Date(timestamp).toLocaleDateString();
}
