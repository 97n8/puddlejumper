export function WhatIsGPR() {
  const pillars = [
    {
      label: "Authority is a runtime condition",
      tag: "VAULT",
      body: "Every action in PuddleJumper is evaluated against five conditions before it executes: Verification, Authority, Utility, Legitimacy, Transfer. Not as a policy. As a constraint. The software won't route work to someone who lacks the authority to act on it.",
    },
    {
      label: "Audit is infrastructure, not afterthought",
      tag: "SQLite Triggers",
      body: "The audit_events table is append-only, enforced by SQLite triggers. You cannot UPDATE or DELETE an audit record. This isn't a feature you can turn off — it's the shape of the data. Every action produces an immutable, hash-chained receipt.",
    },
    {
      label: "AI assists, never decides",
      tag: "Puddles",
      body: "Puddles, the PuddleJumper AI, surfaces options, drafts language, and flags gaps. It does not approve flows, execute automations, or make authority determinations. Every decision stays with a human who has the authority to make it.",
    },
  ];

  return (
    <section className="py-24 px-6 bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// WHAT IS A GPR</p>
        <h2 className="text-4xl mb-4">
          A runtime, not an engine.
        </h2>
        <p className="text-lg text-[var(--text-muted)] mb-16 max-w-2xl">
          PuddleJumper doesn&apos;t execute work. It enforces the conditions under which work
          can happen — authority, policy, audit — then routes to the right person.
          It&apos;s the environment everything else runs inside.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {pillars.map((p) => (
            <div key={p.tag} className="space-y-3">
              <span className="inline-block text-xs font-mono text-[var(--pj-gold)] bg-[var(--pj-midnight)] px-2 py-1 rounded">
                {p.tag}
              </span>
              <h3 className="text-xl font-semibold leading-snug">{p.label}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
