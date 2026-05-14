import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const tiles = [
  { label: "Active Flows", value: "—", sub: "0 pending approval", color: "var(--pj-navy)" },
  { label: "Audit Events", value: "—", sub: "last 24 hours", color: "var(--pj-steel)" },
  { label: "VAULT Evaluations", value: "—", sub: "all conditions met", color: "var(--pj-success)" },
  { label: "SYNCHRON8 Jobs", value: "—", sub: "0 failed", color: "var(--pj-slate)" },
];

const modules = [
  { name: "VAULT", status: "active", desc: "Governance evaluations running" },
  { name: "CAL", status: "active", desc: "Civic automation layer ready" },
  { name: "ARCHIEVE", status: "active", desc: "Retention enforcement active" },
  { name: "SYNCHRON8", status: "active", desc: "Job engine running" },
  { name: "Org Manager", status: "active", desc: "Routing map loaded" },
  { name: "Puddles", status: "pending", desc: "ANTHROPIC_API_KEY not set" },
];

const recentActivity = [
  { msg: "PuddleJumper API active on :3001", time: "now", type: "system" },
  { msg: "SQLite WAL mode enabled — audit_events append-only", time: "now", type: "system" },
  { msg: "Tenant: dev-tenant loaded", time: "now", type: "system" },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// LOGICOS</p>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">dev-tenant · PuddleJumper v0.1.0-pre</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {tiles.map((t) => (
          <div key={t.label} className="border border-[var(--pj-steel)]/20 rounded-lg p-4 bg-[var(--surface-elevated)]">
            <p className="text-xs font-mono text-[var(--text-muted)] mb-1">{t.label}</p>
            <p className="text-2xl font-semibold mb-1">{t.value}</p>
            <p className="text-xs text-[var(--text-muted)]">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Module status */}
        <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
          <div className="px-4 py-3 border-b border-[var(--pj-steel)]/20">
            <h2 className="text-sm font-semibold">Module Status</h2>
          </div>
          <div className="divide-y divide-[var(--pj-steel)]/10">
            {modules.map((m) => (
              <div key={m.name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{m.desc}</p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-mono ${
                  m.status === "active" ? "text-[var(--pj-success)]" : "text-[var(--pj-warning)]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    m.status === "active" ? "bg-[var(--pj-success)]" : "bg-[var(--pj-warning)]"
                  }`} />
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
          <div className="px-4 py-3 border-b border-[var(--pj-steel)]/20">
            <h2 className="text-sm font-semibold">Audit Stream</h2>
          </div>
          <div className="divide-y divide-[var(--pj-steel)]/10">
            {recentActivity.map((a, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pj-success)] mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-mono text-[var(--text-muted)]">{a.msg}</p>
                  <p className="text-xs text-[var(--text-muted)] opacity-50">{a.time}</p>
                </div>
              </div>
            ))}
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-[var(--text-muted)] italic">
                Activity will appear here as flows are created and actions are taken.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
