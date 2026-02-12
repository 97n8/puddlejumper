import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";

function formatTimeAgo(value) {
  if (!value) {
    return "never";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "unknown";
  }

  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hr ago`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EnvironmentBadge({ stage }) {
  const normalized = String(stage || "").toLowerCase();
  const variants = {
    sandbox: { className: "env-badge-test", label: "SANDBOX" },
    test: { className: "env-badge-test", label: "TEST" },
    pilot: { className: "env-badge-pilot", label: "PILOT" },
    production: { className: "env-badge-production", label: "PROD" }
  };

  const selected = variants[normalized] || variants.production;
  return <span className={`env-badge ${selected.className}`}>{selected.label}</span>;
}

function HealthSummaryStrip({ summary }) {
  const allHealthy =
    Number(summary.healthyContexts || 0) === Number(summary.totalContexts || 0) &&
    Number(summary.criticalAlerts || 0) === 0;

  return (
    <section className={`health-strip ${allHealthy ? "healthy" : "attention"}`}>
      <div className="health-stat">
        <CheckCircle2 size={20} />
        <span>
          <strong>{summary.healthyContexts || 0}</strong> of <strong>{summary.totalContexts || 0}</strong> healthy
        </span>
      </div>
      {Number(summary.criticalAlerts || 0) > 0 ? (
        <div className="health-stat alert">
          <AlertTriangle size={20} />
          <span>
            <strong>{summary.criticalAlerts}</strong> alert{summary.criticalAlerts === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}
      <div className="health-stat">
        <TrendingUp size={20} />
        <span>
          <strong>{summary.deploymentsToday || 0}</strong> deployment{summary.deploymentsToday === 1 ? "" : "s"} today
        </span>
      </div>
    </section>
  );
}

function EnvironmentCard({ environment, onOpen }) {
  const overall = String(environment?.health?.overall || "warning").toLowerCase();
  const config = {
    healthy: { className: "status-healthy", label: "Healthy", Icon: CheckCircle2 },
    warning: { className: "status-warning", label: "Warning", Icon: AlertTriangle },
    error: { className: "status-error", label: "Error", Icon: AlertTriangle }
  }[overall] || { className: "status-warning", label: "Warning", Icon: AlertTriangle };

  const lastDeployment = environment?.lastDeployment || null;
  const warningText = Array.isArray(environment?.health?.warnings) ? environment.health.warnings[0] : "";

  return (
    <article className="environment-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}>
      <div className="environment-card-header">
        <div>
          <h3>{environment.clientName || "Unknown"}</h3>
          <p className="environment-card-meta">{environment.tenantId || "No tenant configured"}</p>
        </div>
        <EnvironmentBadge stage={environment.stage} />
      </div>

      <div className="environment-card-status">
        <config.Icon size={20} className={config.className} />
        <div>
          <p className="status-label">{config.label}</p>
          {warningText ? <p className="status-detail">{warningText}</p> : null}
        </div>
      </div>

      <div className="environment-card-footer">
        <Clock size={14} />
        <span>Last deployed {formatTimeAgo(lastDeployment?.timestamp || environment.updatedAt)}</span>
      </div>
    </article>
  );
}

export default function Dashboard({ onEnvironmentSelected }) {
  const [loading, setLoading] = useState(true);
  const [environments, setEnvironments] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [envResponse, healthResponse, deadlineResponse] = await Promise.all([
          fetch("/environments", { credentials: "include" }),
          fetch("/health-summary", { credentials: "include" }),
          fetch("/upcoming-deadlines", { credentials: "include" })
        ]);

        if (!envResponse.ok || !healthResponse.ok || !deadlineResponse.ok) {
          throw new Error("Dashboard data request failed.");
        }

        const envPayload = await envResponse.json();
        const healthPayload = await healthResponse.json();
        const deadlinePayload = await deadlineResponse.json();

        setEnvironments(Array.isArray(envPayload?.environments) ? envPayload.environments : []);
        setHealthSummary(healthPayload || null);
        setDeadlines(Array.isArray(deadlinePayload?.deadlines) ? deadlinePayload.deadlines : []);
      } catch (error) {
        console.error("Tenebrux Veritas: failed to load dashboard", error);
        setEnvironments([]);
        setHealthSummary({
          totalContexts: 0,
          healthyContexts: 0,
          warningContexts: 0,
          errorContexts: 0,
          criticalAlerts: 0,
          deploymentsToday: 0
        });
        setDeadlines([]);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, []);

  if (loading) {
    return (
      <section className="dashboard-loading">
        <p>Loading environments...</p>
      </section>
    );
  }

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Veritas Portal</h1>
          <p className="dashboard-subtitle">Municipal Governance Deployments</p>
        </div>
      </header>

      {healthSummary ? <HealthSummaryStrip summary={healthSummary} /> : null}

      <section className="dashboard-section">
        <h2>Active Environments</h2>
        {environments.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} className="empty-icon" />
            <h3>No environments configured</h3>
            <p>Environment configurations will appear here when created.</p>
          </div>
        ) : (
          <div className="environment-grid">
            {environments.map((environment) => (
              <EnvironmentCard
                key={environment.targetId}
                environment={environment}
                onOpen={() => onEnvironmentSelected(environment)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Upcoming Deadlines</h2>
        {deadlines.length === 0 ? (
          <p className="dashboard-subtitle">No upcoming deadlines detected in Veritas Memory.</p>
        ) : (
          <div className="deadline-list">
            {deadlines.map((deadline) => (
              <article key={deadline.id} className="deadline-item">
                <div>
                  <p className="status-label">{deadline.clientName || "Unknown"}</p>
                  <p className="status-detail">{deadline.title || "Deadline"}</p>
                </div>
                <p className="dashboard-subtitle">
                  {new Date(deadline.date).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
