import type { Metadata } from "next";

export const metadata: Metadata = { title: "SYNCHRON8" };

const jobTypes = [
  { name: "prr.sla_check",       schedule: "*/15 * * * *", desc: "Check all open PRRs for SLA breach (10 business days). Write audit event on breach." },
  { name: "archieve.retention",  schedule: "0 2 * * *",    desc: "Evaluate retention schedules. Flag records past hold date." },
  { name: "fiscalintel.sync",    schedule: "0 6 * * *",    desc: "Sync DOR municipal data for 351 MA municipalities." },
  { name: "townregistry.sync",   schedule: "0 3 * * 1",    desc: "Sync MMA staff directory and Mass GIS data." },
  { name: "vault.daily_review",  schedule: "0 8 * * *",    desc: "Run VAULT evaluations for any pending governed actions." },
  { name: "health.ping",         schedule: "*/5 * * * *",  desc: "Write heartbeat to audit_events. Confirms job engine is running." },
];

export default function Sync8Page() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// SYNCHRON8</p>
        <h1 className="text-2xl font-semibold">SYNCHRON8 Jobs</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Job engine · Every run logged to audit_events</p>
      </div>

      <div className="mb-6 border border-[var(--pj-steel)]/20 rounded-lg px-4 py-3 bg-[var(--surface-elevated)]">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-1">// AUDIT GUARANTEE</p>
        <p className="text-xs text-[var(--text-muted)]">
          Every SYNCHRON8 job execution is written to <code className="font-mono">audit_events</code> on start and completion.
          Failed runs include the error payload. You cannot run a job without a record of it.
        </p>
      </div>

      <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
        <div className="px-4 py-3 border-b border-[var(--pj-steel)]/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Scheduled Jobs</h2>
          <span className="text-xs font-mono text-[var(--text-muted)]">0 jobs active</span>
        </div>
        <div className="grid grid-cols-[1fr_120px_1fr] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/10">
          <span>JOB</span>
          <span>SCHEDULE (CRON)</span>
          <span>DESCRIPTION</span>
        </div>
        {jobTypes.map((j, i) => (
          <div
            key={j.name}
            className={`grid grid-cols-[1fr_120px_1fr] px-4 py-3 text-sm items-start gap-4 ${i < jobTypes.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
          >
            <code className="text-xs font-mono text-[var(--pj-sky)] break-all">{j.name}</code>
            <code className="text-xs font-mono text-[var(--text-muted)]">{j.schedule}</code>
            <span className="text-xs text-[var(--text-muted)]">{j.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center py-8 border border-[var(--pj-steel)]/20 rounded-lg bg-[var(--surface-elevated)]">
        <p className="text-sm text-[var(--text-muted)] italic">
          No jobs running. Connect the PuddleJumper API to activate scheduled job execution.
        </p>
      </div>
    </div>
  );
}
