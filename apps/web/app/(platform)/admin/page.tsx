import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin" };

const sections = [
  {
    title: "Tenant Management",
    desc: "Create, configure, and suspend tenants. Each tenant is isolated — no cross-tenant data access.",
    actions: ["Create Tenant", "Configure Modules", "Suspend Tenant"],
    status: "0 tenants",
  },
  {
    title: "Module Provisioning",
    desc: "Activate modules per tenant. VAULT is always required. Additional modules are provisioned by tenant scope.",
    actions: ["Provision VAULT", "Provision CAL", "Provision ARCHIEVE"],
    status: "dev-tenant active",
  },
  {
    title: "Audit Log Explorer",
    desc: "Read-only view of all audit_events. Append-only enforced by SQLite triggers — you cannot modify this data.",
    actions: ["View All Events", "Filter by Actor", "Filter by Resource"],
    status: "0 events",
  },
  {
    title: "SYNCHRON8 Monitor",
    desc: "Active jobs, failed runs, scheduled tasks. Every job execution is logged to audit_events.",
    actions: ["View Job Queue", "Failed Runs", "Schedule Job"],
    status: "0 jobs",
  },
  {
    title: "MCP Tool Registry",
    desc: "60+ tools across 12 domains. Each tool call is authenticated, scoped to tenant, and logged.",
    actions: ["Browse Tools", "Domain Catalog", "Tool Logs"],
    status: "60+ tools available",
  },
  {
    title: "User & Role Management",
    desc: "Users and roles managed through Org Manager. Authority is resolved from the org map at runtime.",
    actions: ["View Users", "Manage Roles", "Org Map"],
    status: "Org Manager",
  },
];

export default function AdminPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// ADMIN</p>
        <h1 className="text-2xl font-semibold">PuddleJumper Admin</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">System administration · Role-gated</p>
      </div>

      <div className="mb-6 border border-[var(--pj-warning)]/30 rounded-lg px-4 py-3 bg-[var(--pj-warning)]/5">
        <p className="text-xs font-mono text-[var(--pj-warning)]">
          // ADMIN ACTIONS ARE AUDITED — every action taken here is logged to audit_events and cannot be deleted
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{s.title}</h2>
              <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">{s.status}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {s.actions.map((a) => (
                <button
                  key={a}
                  className="text-xs border border-[var(--pj-steel)]/30 rounded px-3 py-1.5 hover:border-[var(--pj-navy)] hover:text-[var(--pj-navy)] transition-colors"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
        <h2 className="font-semibold mb-2">System Health</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "API", value: ":3001", ok: true },
            { label: "SQLite", value: "WAL mode", ok: true },
            { label: "Audit triggers", value: "enforced", ok: true },
          ].map((h) => (
            <div key={h.label} className="space-y-1">
              <p className="text-xs font-mono text-[var(--text-muted)]">{h.label}</p>
              <p className={`text-sm font-medium ${h.ok ? "text-[var(--pj-success)]" : "text-[var(--pj-error)]"}`}>
                {h.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
