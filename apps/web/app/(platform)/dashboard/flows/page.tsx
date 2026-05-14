import type { Metadata } from "next";

export const metadata: Metadata = { title: "Flows & Approvals" };

const frameworks = [
  { id: "VAULTCLERK.PublicRecords",   name: "Public Records",   chapter: "c.66",   statute: "M.G.L. c.66 §10" },
  { id: "VAULTCLERK.OpenMeeting",     name: "Open Meeting",     chapter: "c.30A",  statute: "M.G.L. c.30A §§18-25" },
  { id: "VAULTFISCAL.Procurement",    name: "Procurement",      chapter: "c.30B",  statute: "M.G.L. c.30B" },
  { id: "VAULTFISCAL.Budget",         name: "Budget",           chapter: "c.44",   statute: "M.G.L. c.44" },
  { id: "VAULTFISCAL.Grants",         name: "Grant Compliance", chapter: "2 CFR",  statute: "2 C.F.R. §200" },
  { id: "VAULTTIME.Personnel",        name: "Personnel",        chapter: "c.41",   statute: "M.G.L. c.41" },
  { id: "VAULTPERMIT.Zoning",         name: "Zoning",           chapter: "c.40A",  statute: "M.G.L. c.40A" },
  { id: "VAULTPERMIT.Building",       name: "Building",         chapter: "c.40B",  statute: "M.G.L. c.40B" },
  { id: "VAULTCLERK.BoardCompliance", name: "Board Compliance", chapter: "c.268A", statute: "M.G.L. c.268A" },
];

const prrStatuses = ["new", "acknowledged", "in_review", "response_ready", "closed", "denied"] as const;

const statusColors: Record<string, string> = {
  new:            "bg-[var(--pj-sky)]/20 text-[var(--pj-sky)]",
  acknowledged:   "bg-[var(--pj-gold)]/20 text-[var(--pj-gold)]",
  in_review:      "bg-[var(--pj-warning)]/20 text-[var(--pj-warning)]",
  response_ready: "bg-[var(--pj-success)]/20 text-[var(--pj-success)]",
  closed:         "bg-[var(--pj-steel)]/20 text-[var(--pj-steel)]",
  denied:         "bg-[var(--pj-error)]/20 text-[var(--pj-error)]",
};

export default function FlowsPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// FLOWS</p>
        <h1 className="text-2xl font-semibold">Flows & Approvals</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Governed processes · VAULT-evaluated transitions</p>
      </div>

      {/* PRR Status Reference */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Public Records Request — Status Reference</h2>
        <div className="flex flex-wrap gap-2">
          {prrStatuses.map((s) => (
            <span
              key={s}
              className={`text-xs font-mono px-3 py-1.5 rounded ${statusColors[s]}`}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          SLA: 10 business days from <code className="font-mono">acknowledged</code>. Breach tracked automatically.
        </p>
      </div>

      {/* Framework Catalog */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Available Frameworks</h2>
        <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden bg-[var(--surface-elevated)]">
          <div className="grid grid-cols-[1fr_70px_1fr] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/20">
            <span>FRAMEWORK</span>
            <span>CHAPTER</span>
            <span>STATUTE</span>
          </div>
          {frameworks.map((f, i) => (
            <div
              key={f.id}
              className={`grid grid-cols-[1fr_70px_1fr] px-4 py-3 text-sm items-center ${i < frameworks.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
            >
              <span className="font-medium">{f.name}</span>
              <span className="font-mono text-xs text-[var(--text-muted)]">{f.chapter}</span>
              <span className="text-xs text-[var(--text-muted)]">{f.statute}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono mt-2">
          // Framework IDs: e.g. VAULTCLERK.PublicRecords, VAULTFISCAL.Procurement
        </p>
      </div>

      <div className="mt-8 border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// CONNECT API</p>
        <p className="text-sm text-[var(--text-muted)]">
          Active flows are served by the PuddleJumper API on <code className="font-mono text-xs">:3001</code>.
          Connect your tenant to begin creating governed flows.
        </p>
      </div>
    </div>
  );
}
