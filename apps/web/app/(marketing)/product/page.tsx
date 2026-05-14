import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PuddleJumper GPR",
  description:
    "The first governance process runtime. Authority as a runtime condition. Audit as infrastructure, not afterthought.",
};

const vaultConditions = [
  { letter: "V", word: "Verification", desc: "Is the claim being made about this action actually true? Is the identity of the actor confirmed? Is the record what it says it is?" },
  { letter: "A", word: "Authority", desc: "Does the actor have the authority to take this action? Authority is not assumed — it is resolved at runtime against Org Manager." },
  { letter: "U", word: "Utility", desc: "Does this action actually serve a legitimate purpose? PuddleJumper asks this structurally, not as a suggestion." },
  { letter: "L", word: "Legitimacy", desc: "Does a statute, policy, or bylaw permit this action? Legitimacy requires a documented basis — not common practice." },
  { letter: "T", word: "Transfer", desc: "When the action completes, where does the artifact land? Who receives it? What is the chain of custody?" },
];

const strategicGoals = [
  { name: "Institutional Survivability", desc: "When the clerk retires, the process doesn't leave with her. PuddleJumper externalizes governance logic from individuals into the system." },
  { name: "Governance Logic as a Service", desc: "VAULT evaluations, routing rules, and audit requirements are callable from any connected system — not locked inside a single application." },
  { name: "Non-destructive Modernization", desc: "PuddleJumper layers onto what municipalities already have. No ripping out CivicPlus. No forcing everyone off SharePoint." },
  { name: "Exit Without Dependency", desc: "Every artifact that touches PuddleJumper is exported in open formats. You own your data. Always." },
];

const prrStates: { status: string; label: string; desc: string }[] = [
  { status: "new", label: "New", desc: "Request received and stamped" },
  { status: "acknowledged", label: "Acknowledged", desc: "10-day clock starts, requester notified" },
  { status: "in_review", label: "In Review", desc: "Records located, responsive docs evaluated" },
  { status: "response_ready", label: "Response Ready", desc: "VAULT validates authority to release" },
  { status: "closed", label: "Closed", desc: "Records delivered, audit event written" },
  { status: "denied", label: "Denied", desc: "Basis documented, denial logged immutably" },
];

const frameworks = [
  { id: "VAULTCLERK.PublicRecords",   name: "Public Records",    chapter: "c.66",   statute: "M.G.L. c.66 §10",      domain: "clerk" },
  { id: "VAULTCLERK.OpenMeeting",     name: "Open Meeting",      chapter: "c.30A",  statute: "M.G.L. c.30A §§18-25", domain: "clerk" },
  { id: "VAULTFISCAL.Procurement",    name: "Procurement",       chapter: "c.30B",  statute: "M.G.L. c.30B",         domain: "fiscal" },
  { id: "VAULTFISCAL.Budget",         name: "Budget",            chapter: "c.44",   statute: "M.G.L. c.44",          domain: "fiscal" },
  { id: "VAULTFISCAL.Grants",         name: "Grant Compliance",  chapter: "2 CFR",  statute: "2 C.F.R. §200",        domain: "fiscal" },
  { id: "VAULTTIME.Personnel",        name: "Personnel",         chapter: "c.41",   statute: "M.G.L. c.41",          domain: "personnel" },
  { id: "VAULTTIME.Appointments",     name: "Appointments",      chapter: "c.31",   statute: "M.G.L. c.31",          domain: "personnel" },
  { id: "VAULTPERMIT.Zoning",         name: "Zoning",            chapter: "c.40A",  statute: "M.G.L. c.40A",         domain: "permits" },
  { id: "VAULTPERMIT.Building",       name: "Building",          chapter: "c.40B",  statute: "M.G.L. c.40B",         domain: "permits" },
  { id: "VAULTCLERK.BoardCompliance", name: "Board Compliance",  chapter: "c.268A", statute: "M.G.L. c.268A",        domain: "clerk" },
  { id: "NMTC.Compliance",            name: "NMTC Compliance",   chapter: "§45D",   statute: "26 U.S.C. §45D",       domain: "compliance" },
  { id: "OCPF.CampaignFinance",       name: "Campaign Finance",  chapter: "c.55",   statute: "M.G.L. c.55",          domain: "compliance" },
];

const domainColors: Record<string, string> = {
  clerk:      "text-[var(--pj-sky)]",
  fiscal:     "text-[var(--pj-success)]",
  personnel:  "text-[var(--pj-gold)]",
  permits:    "text-[var(--pj-navy)]",
  compliance: "text-[var(--pj-warning)]",
};

export default function ProductPage() {
  return (
    <article>
      {/* Lead */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// PRODUCT</p>
        <h1 className="text-5xl md:text-6xl leading-tight mb-6">
          Governed Processes.<br />Institutional Certainty.
        </h1>
        <p className="text-xl text-[var(--text-muted)] max-w-2xl leading-relaxed">
          PuddleJumper automates municipal workflows while keeping governance in place —
          so institutions run on systems, not individuals.
        </p>
        <p className="mt-4 text-base text-[var(--text-muted)]">
          Used by municipal administrators in Massachusetts.
        </p>
        <div className="mt-8 flex gap-4 flex-wrap">
          <Link href="/docs" className="rounded-md bg-[var(--pj-navy)] px-6 py-3 text-white font-medium">
            Read the Docs
          </Link>
          <Link href="/pricing" className="rounded-md border border-current px-6 py-3 font-medium">
            Pricing
          </Link>
        </div>
      </section>

      {/* Three pillars */}
      <section className="bg-[var(--surface-elevated)] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// HOW IT WORKS</p>
          <h2 className="text-3xl mb-12">Three things that make a GPR different</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { tag: "Documented Governance", body: "PRR workflows — received → logged → assigned → searching → reviewing → responded → closed — built into code. Not policy. Not training. Code." },
              { tag: "Audit Trail Built In", body: "Every action tracked via append-only audit_events. SQLite trigger-enforced. You cannot UPDATE or DELETE an audit record. It's the shape of the data." },
              { tag: "Automation Without Anarchy", body: "AI assists, never decides. Humans remain decision-makers. Puddles surfaces options. A VAULT evaluation approves the path. The responsible party signs." },
            ].map((p) => (
              <div key={p.tag} className="space-y-3">
                <h3 className="font-semibold text-lg">{p.tag}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VAULT */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// THE FRAMEWORK</p>
          <h2 className="text-3xl mb-4">VAULT</h2>
          <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl">
            Five conditions that must be satisfied before a governed action can proceed.
            Written as doctrine. Enforced as code.
          </p>
          <div className="space-y-0 border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden">
            {vaultConditions.map((c, i) => (
              <div key={c.letter} className={`flex gap-6 p-6 ${i < vaultConditions.length - 1 ? "border-b border-[var(--pj-steel)]/20" : ""}`}>
                <div className="shrink-0 w-10 h-10 rounded bg-[var(--pj-midnight)] text-[var(--pj-cream)] flex items-center justify-center font-mono font-bold text-lg">
                  {c.letter}
                </div>
                <div>
                  <p className="font-semibold mb-1">{c.word}</p>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRR State Machine */}
      <section className="bg-[var(--surface-elevated)] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// EXAMPLE</p>
          <h2 className="text-3xl mb-4">A Public Records Request in PuddleJumper</h2>
          <p className="text-lg text-[var(--text-muted)] mb-10 max-w-2xl">
            Every status in the PRR lifecycle is a governed transition. Authority is checked.
            The 10-day clock runs. The audit record is immutable.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {prrStates.map((s) => (
              <div key={s.status} className="border border-[var(--pj-steel)]/20 rounded-lg p-4 bg-[var(--surface-elevated)]">
                <p className="text-xs font-mono text-[var(--pj-gold)] mb-1">{s.status}</p>
                <p className="font-medium mb-1">{s.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--text-muted)] border-l-2 border-[var(--pj-gold)] pl-4">
            Each transition triggers a VAULT evaluation. Each evaluation produces an immutable audit event.
            SLA breach at 10 business days is enforced automatically — extensions require documented authority.
          </p>
        </div>
      </section>

      {/* Governed Frameworks */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// FRAMEWORKS</p>
          <h2 className="text-3xl mb-4">Governed by statute, not policy</h2>
          <p className="text-lg text-[var(--text-muted)] mb-10 max-w-2xl">
            PuddleJumper ships with enforcement frameworks for 12 Massachusetts General Laws
            and federal regulations. Each framework defines the authority structure,
            required audit points, and VAULT conditions for that domain.
          </p>
          <div className="border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_1fr_100px] text-xs font-mono text-[var(--text-muted)] px-4 py-2 border-b border-[var(--pj-steel)]/20 bg-[var(--surface-elevated)]">
              <span>FRAMEWORK</span>
              <span>CHAPTER</span>
              <span>PRIMARY STATUTE</span>
              <span>DOMAIN</span>
            </div>
            {frameworks.map((f, i) => (
              <div
                key={f.id}
                className={`grid grid-cols-[1fr_80px_1fr_100px] px-4 py-3 text-sm items-center ${i < frameworks.length - 1 ? "border-b border-[var(--pj-steel)]/10" : ""}`}
              >
                <span className="font-medium">{f.name}</span>
                <span className="font-mono text-xs text-[var(--text-muted)]">{f.chapter}</span>
                <span className="text-xs text-[var(--text-muted)]">{f.statute}</span>
                <span className={`text-xs font-mono ${domainColors[f.domain] ?? "text-[var(--text-muted)]"}`}>{f.domain}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)] font-mono">
            // Framework IDs are addressable at runtime — e.g. VAULTCLERK.PublicRecords, VAULTFISCAL.Procurement
          </p>
        </div>
      </section>

      {/* Strategic Goals */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// WHY IT EXISTS</p>
          <h2 className="text-3xl mb-4">What PuddleJumper is actually for</h2>
          <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl">
            PuddleJumper is not a workflow tool. It is the product that operationalizes
            institutional certainty — four strategic goals that municipalities cannot achieve
            with conventional software.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {strategicGoals.map((g) => (
              <div key={g.name} className="border border-[var(--pj-steel)]/20 rounded-lg p-6 space-y-2">
                <h3 className="font-semibold">{g.name}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Duck */}
      <section className="bg-[var(--pj-midnight)] text-[var(--pj-cream)] py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// THE DUCK</p>
          <h2 className="text-3xl mb-6">Calm on the surface.</h2>
          <p className="text-lg opacity-80 max-w-xl mx-auto leading-relaxed">
            The PuddleJumper logo is a duck in a WWII fighter plane.
            Calm on the surface, governance machinery underneath.
            That&apos;s the whole pitch.
          </p>
        </div>
      </section>
    </article>
  );
}
