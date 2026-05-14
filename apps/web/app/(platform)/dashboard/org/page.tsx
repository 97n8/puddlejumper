import type { Metadata } from "next";

export const metadata: Metadata = { title: "Org Manager" };

const roles = [
  { name: "tenant_admin",  desc: "Full access to tenant configuration, modules, and user management", scope: "tenant" },
  { name: "operator",      desc: "Can create and manage flows, run VAULT evaluations, assign work", scope: "tenant" },
  { name: "clerk",         desc: "Manages PRR queue, public records workflows, meeting compliance", scope: "domain" },
  { name: "fiscal",        desc: "Procurement, budget, and grant compliance flows", scope: "domain" },
  { name: "reviewer",      desc: "Read-only access to flows and audit log, can approve gated steps", scope: "flow" },
  { name: "viewer",        desc: "Read-only access to dashboard and audit stream", scope: "flow" },
];

const orgMapConcepts = [
  { label: "Authority Resolution", body: "At runtime, authority is resolved by walking the org map — not by checking a role string. The hierarchy determines whether the actor can take the action." },
  { label: "Delegated Authority", body: "Roles can be scoped to a domain (clerk, fiscal) or to a specific flow. A clerk cannot take fiscal actions unless explicitly delegated." },
  { label: "Session Binding", body: "Every session carries tenant_id and user_id. All DB queries are scoped. Cross-tenant access is structurally impossible." },
  { label: "Audit on Assignment", body: "Role assignments and changes are written to audit_events. You cannot grant authority without a record of it." },
];

export default function OrgPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// ORG MANAGER</p>
        <h1 className="text-2xl font-semibold">Org Manager</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Authority routing · Tenant isolation · Role resolution</p>
      </div>

      {/* Roles */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Role Reference</h2>
        <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
          <div className="grid grid-cols-[1fr_80px_1fr] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/20">
            <span>ROLE</span>
            <span>SCOPE</span>
            <span>AUTHORITY</span>
          </div>
          {roles.map((r, i) => (
            <div
              key={r.name}
              className={`grid grid-cols-[1fr_80px_1fr] px-4 py-3 text-sm items-start ${i < roles.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
            >
              <code className="font-mono text-xs text-[var(--pj-sky)]">{r.name}</code>
              <span className="font-mono text-xs text-[var(--text-muted)]">{r.scope}</span>
              <span className="text-xs text-[var(--text-muted)]">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Org Map Concepts */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {orgMapConcepts.map((c) => (
          <div key={c.label} className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
            <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">{c.label.toUpperCase()}</p>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// CURRENT TENANT</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Tenant ID</p>
            <code className="font-mono text-xs">dev-tenant</code>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Users</p>
            <p className="font-medium">—</p>
          </div>
        </div>
      </div>
    </div>
  );
}
