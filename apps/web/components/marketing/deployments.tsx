const deployments = [
  {
    name: "Phillipston, MA",
    status: "Live",
    detail: "CivicPlus migration, public records requests, FY26 budget cycle. First full GPR deployment.",
    grant: null,
  },
  {
    name: "Sutton, MA",
    status: "Active",
    detail: "Municipal automation and records management.",
    grant: "Community Compact IT",
  },
  {
    name: "Westminster, MA",
    status: "Active",
    detail: "Governance workflow deployment under state grant.",
    grant: "Community Compact IT",
  },
  {
    name: "NEPM / AED — Pocomoke Biochar",
    status: "Active",
    detail: "$10M+ New Markets Tax Credit compliance. VAULT evaluations on every transaction in the deal structure.",
    grant: "NMTC",
  },
];

export function Deployments() {
  return (
    <section className="py-24 px-6 bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// IN PRODUCTION</p>
        <h2 className="text-4xl mb-4">Live Deployments</h2>
        <p className="text-lg text-[var(--text-muted)] mb-12">
          PuddleJumper is deployed and running in Massachusetts municipalities and
          in a $10M+ federal compliance stack. These aren&apos;t pilots. They&apos;re production.
        </p>
        <div className="divide-y divide-[var(--pj-steel)]/20">
          {deployments.map((d) => (
            <div key={d.name} className="py-6 flex items-start justify-between gap-8">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{d.name}</span>
                  {d.grant && (
                    <span className="text-xs font-mono text-[var(--pj-gold)] bg-[var(--pj-midnight)] px-2 py-0.5 rounded">
                      {d.grant}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)]">{d.detail}</p>
              </div>
              <span className="shrink-0 flex items-center gap-1.5 text-xs font-mono text-[var(--pj-success)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pj-success)] inline-block" />
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
