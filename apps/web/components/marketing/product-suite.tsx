const modules = [
  {
    name: "LogicOS",
    tag: "Platform",
    description:
      "The workspace operators live in. Cases, tasks, captures, and quick actions — organized by tenancy. Mobile-first, built for the people doing the work.",
  },
  {
    name: "VAULT",
    tag: "Governance",
    description:
      "Verification, Authority, Utility, Legitimacy, Transfer. Five conditions that must be satisfied before a governed action can proceed. Written as doctrine. Enforced as code.",
  },
  {
    name: "CAL",
    tag: "Civic Automation",
    description:
      "Civic Automation Layer. The structured form of automations — each with a trigger, a step chain, a statutory basis, and a compliance block. Not a canvas. A governance record.",
  },
  {
    name: "ARCHIEVE",
    tag: "Retention",
    description:
      "Retention enforcement at the output layer. Every artifact that exits PuddleJumper carries a retention class, a disposition schedule, and a chain of custody. ARCHIEVE enforces the rules MGL already requires.",
  },
  {
    name: "SYNCHRON8",
    tag: "Automation Engine",
    description:
      "PJ-native job scheduler and sync engine. Runs automations on time, state, and event triggers. Connects to SharePoint, Google Drive, CivicPlus, and other municipal platforms.",
  },
  {
    name: "Org Manager",
    tag: "Runtime Routing",
    description:
      "Maps roles to authority. When VAULT asks who has the authority to approve this action, Org Manager answers. Updated in real time — personnel changes don't break flows.",
  },
  {
    name: "Puddles",
    tag: "AI Interface",
    description:
      "Calm on the surface, governance machinery underneath. Puddles surfaces options, drafts language, and flags gaps in authority. It assists. It never decides.",
  },
];

export function ProductSuite() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3 text-center">// THE SUITE</p>
        <h2 className="text-4xl mb-4 text-center">The PuddleJumper Suite</h2>
        <p className="text-lg text-[var(--text-muted)] mb-16 text-center max-w-2xl mx-auto">
          Seven modules. One runtime. Everything is tenant-scoped, audit-enforced,
          and designed to carry the load that currently lives in someone&apos;s head.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.slice(0, 6).map((m) => (
            <div
              key={m.name}
              className="border border-[var(--pj-steel)]/20 rounded-lg p-6 space-y-3 bg-[var(--surface-elevated)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{m.name}</h3>
                <span className="shrink-0 text-xs font-mono text-[var(--text-muted)] mt-1">{m.tag}</span>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 border border-[var(--pj-gold)]/30 rounded-lg p-6 bg-[var(--pj-midnight)] text-[var(--pj-cream)]">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold">{modules[6].name}</h3>
            <span className="shrink-0 text-xs font-mono text-[var(--pj-gold)] mt-1">{modules[6].tag}</span>
          </div>
          <p className="text-sm opacity-80 leading-relaxed">{modules[6].description}</p>
        </div>
      </div>
    </section>
  );
}
