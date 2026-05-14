import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

const envVars = [
  { key: "ANTHROPIC_API_KEY",   status: "missing",  desc: "Required for Puddles AI assistant" },
  { key: "DATABASE_PATH",       status: "default",  desc: "SQLite database file path (default: ./data/pj.db)" },
  { key: "SESSION_SECRET",      status: "required", desc: "Session signing secret — set before going to production" },
  { key: "TENANT_ID",           status: "default",  desc: "Active tenant identifier (default: dev-tenant)" },
  { key: "PORT",                status: "default",  desc: "API server port (default: 3001)" },
  { key: "NODE_ENV",            status: "default",  desc: "Runtime environment (development | production)" },
];

const statusStyle: Record<string, string> = {
  missing:  "text-[var(--pj-error)]",
  required: "text-[var(--pj-warning)]",
  default:  "text-[var(--pj-success)]",
};

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// SETTINGS</p>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Tenant configuration · Environment · Modules</p>
      </div>

      {/* Environment Variables */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Environment Variables</h2>
        <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
          <div className="grid grid-cols-[1fr_80px_1fr] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/20">
            <span>VARIABLE</span>
            <span>STATUS</span>
            <span>DESCRIPTION</span>
          </div>
          {envVars.map((v, i) => (
            <div
              key={v.key}
              className={`grid grid-cols-[1fr_80px_1fr] px-4 py-3 items-start text-sm ${i < envVars.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
            >
              <code className="font-mono text-xs">{v.key}</code>
              <span className={`font-mono text-xs ${statusStyle[v.status]}`}>{v.status}</span>
              <span className="text-xs text-[var(--text-muted)]">{v.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tenant Info */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Tenant</h2>
        <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)] grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Tenant ID", value: "dev-tenant" },
            { label: "Database", value: "SQLite WAL" },
            { label: "Audit Mode", value: "append-only (trigger-enforced)" },
            { label: "API", value: ":3001" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{item.label}</p>
              <code className="font-mono text-xs">{item.value}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
        <h2 className="text-sm font-semibold mb-3">Version</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { label: "Runtime", value: "v0.1.0-pre" },
            { label: "Node", value: ">=20" },
            { label: "SQLite", value: "WAL mode" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{item.label}</p>
              <code className="font-mono text-xs">{item.value}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
