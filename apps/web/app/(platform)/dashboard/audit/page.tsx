import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit Log" };

const eventTypes = [
  { type: "flow.created",           module: "civic",    desc: "A new governed flow was created" },
  { type: "flow.transition",        module: "civic",    desc: "Flow status transitioned (VAULT evaluated)" },
  { type: "prr.received",           module: "prr",      desc: "Public records request received and stamped" },
  { type: "prr.acknowledged",       module: "prr",      desc: "PRR acknowledged, 10-day SLA started" },
  { type: "prr.closed",             module: "prr",      desc: "PRR closed with records or denial basis" },
  { type: "vault.evaluated",        module: "vault",    desc: "VAULT condition check ran (pass or fail)" },
  { type: "seal.verification.pass", module: "seal",     desc: "ECDSA-P256 artifact signature verified" },
  { type: "seal.verification.fail", module: "seal",     desc: "Signature verification failed — logged with reason" },
  { type: "archieve.retained",      module: "archieve", desc: "Record entered retention schedule" },
  { type: "user.login",             module: "auth",     desc: "User authenticated, session scoped to tenant" },
  { type: "admin.tenant.created",   module: "admin",    desc: "Tenant provisioned by system administrator" },
];

export default function AuditPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// AUDIT</p>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Append-only · SQLite trigger-enforced · Cannot UPDATE or DELETE
        </p>
      </div>

      <div className="mb-6 border border-[var(--pj-steel)]/20 rounded-lg px-4 py-3 bg-[var(--surface-elevated)]">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-1">// SCHEMA NOTE</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <code className="font-mono">audit_events</code> is enforced append-only by SQLite triggers.
          Any attempt to <code className="font-mono">UPDATE</code> or <code className="font-mono">DELETE</code> a
          record raises <code className="font-mono">ABORT</code> at the database level — not application code.
          This is the foundation of institutional certainty.
        </p>
      </div>

      {/* Event Type Reference */}
      <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
        <div className="px-4 py-3 border-b border-[var(--pj-steel)]/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Known Event Types</h2>
          <span className="text-xs font-mono text-[var(--text-muted)]">0 events · dev-tenant</span>
        </div>
        <div className="grid grid-cols-[1fr_80px_1fr] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/10">
          <span>EVENT TYPE</span>
          <span>MODULE</span>
          <span>DESCRIPTION</span>
        </div>
        {eventTypes.map((e, i) => (
          <div
            key={e.type}
            className={`grid grid-cols-[1fr_80px_1fr] px-4 py-2.5 text-sm items-center ${i < eventTypes.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
          >
            <code className="text-xs font-mono text-[var(--pj-sky)]">{e.type}</code>
            <span className="text-xs font-mono text-[var(--text-muted)]">{e.module}</span>
            <span className="text-xs text-[var(--text-muted)]">{e.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center py-8 border border-[var(--pj-steel)]/20 rounded-lg bg-[var(--surface-elevated)]">
        <p className="text-sm text-[var(--text-muted)] italic">
          No audit events yet. Events appear here as flows are created and governed actions are taken.
        </p>
      </div>
    </div>
  );
}
