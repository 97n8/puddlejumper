import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description: "PuddleJumper pricing — grant-fundable, built for municipalities.",
};

const deploymentModels = [
  {
    name: "Pilot",
    tag: "90-day",
    desc: "Single module deployment. Scoped to one workflow — typically Public Records Requests or Permit intake. Includes setup, configuration, and training.",
    includes: ["One workflow module", "VAULT framework", "Append-only audit log", "Staff training", "90-day support"],
    cta: "Start a Pilot",
  },
  {
    name: "Standard",
    tag: "Most common",
    desc: "LogicOS platform + VAULT governance framework. The operational baseline for a municipality ready to run on systems, not individuals.",
    includes: ["LogicOS full platform", "VAULT evaluations", "CAL automation layer", "Org Manager routing", "Audit infrastructure", "Ongoing support"],
    cta: "Get Standard",
    featured: true,
  },
  {
    name: "Full Runtime",
    tag: "Complete PJ suite",
    desc: "Every module. LogicOS, VAULT, CAL, ARCHIEVE, SYNCHRON8, Org Manager, and Puddles. For municipalities ready to run the full governance process runtime.",
    includes: ["Everything in Standard", "ARCHIEVE retention enforcement", "SYNCHRON8 automation engine", "Puddles AI interface", "MCP tool integrations", "Priority support"],
    cta: "Talk to Us",
  },
];

const grantPrograms = [
  {
    name: "Community Compact IT",
    body: "Mass EOTSS Community Compact IT grants fund municipal technology modernization. PuddleJumper has been funded through this program in Phillipston, Sutton, and Westminster.",
    amount: "Up to $60,000",
  },
  {
    name: "SLCGP",
    body: "State and Local Cybersecurity Grant Program. PuddleJumper's append-only audit infrastructure and access control framework align directly with SLCGP compliance goals.",
    amount: "Varies",
  },
  {
    name: "CDBG / Digital Equity",
    body: "Community Development Block Grants and Digital Equity Act funding for communities underserved by technology infrastructure. Available for qualifying municipalities.",
    amount: "Varies",
  },
  {
    name: "ARPA",
    body: "American Rescue Plan Act funds can be used for municipal modernization. PuddleJumper qualifies under government operations and technology infrastructure categories.",
    amount: "Varies",
  },
  {
    name: "Direct Procurement",
    body: "MGL c.30B compliant sole-source and competitive procurement. PublicLogic maintains current capability statement and references for all procurement vehicles.",
    amount: "MGL c.30B",
  },
];

export default function PricingPage() {
  return (
    <article>
      <section className="max-w-4xl mx-auto px-6 py-24">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// PRICING</p>
        <h1 className="text-5xl leading-tight mb-6">Grant-fundable.</h1>
        <p className="text-xl text-[var(--text-muted)] max-w-2xl leading-relaxed">
          PuddleJumper is built for municipalities operating under real budget constraints.
          Every deployment model is designed to be grant-fundable, procurement-compliant,
          and scoped to what you actually need.
        </p>
      </section>

      {/* Deployment Models */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl mb-10">Deployment Models</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {deploymentModels.map((m) => (
              <div
                key={m.name}
                className={`rounded-lg border p-6 flex flex-col ${
                  m.featured
                    ? "border-[var(--pj-navy)] bg-[var(--pj-midnight)] text-[var(--pj-cream)]"
                    : "border-[var(--pj-steel)]/20 bg-[var(--surface-elevated)]"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold">{m.name}</h3>
                  <span className={`text-xs font-mono px-2 py-1 rounded ${
                    m.featured ? "bg-[var(--pj-gold)] text-[var(--pj-midnight)]" : "bg-[var(--pj-midnight)] text-[var(--pj-gold)]"
                  }`}>{m.tag}</span>
                </div>
                <p className={`text-sm leading-relaxed mb-6 ${m.featured ? "opacity-80" : "text-[var(--text-muted)]"}`}>
                  {m.desc}
                </p>
                <ul className="space-y-2 mb-8 flex-1">
                  {m.includes.map((item) => (
                    <li key={item} className={`text-sm flex items-start gap-2 ${m.featured ? "opacity-80" : "text-[var(--text-muted)]"}`}>
                      <span className="mt-0.5 text-[var(--pj-gold)]">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`text-center rounded-md px-4 py-2 text-sm font-medium ${
                    m.featured
                      ? "bg-[var(--pj-gold)] text-[var(--pj-midnight)]"
                      : "bg-[var(--pj-navy)] text-white"
                  }`}
                >
                  {m.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[var(--text-muted)] text-center">
            All pricing is scoped per engagement. Contact us for a proposal tailored to your municipality.
          </p>
        </div>
      </section>

      {/* Grant Programs */}
      <section className="bg-[var(--surface-elevated)] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// FUNDING</p>
          <h2 className="text-3xl mb-4">Grant-Fundable Pathways</h2>
          <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl">
            PuddleJumper has been funded through multiple Massachusetts and federal grant programs.
            We can help you identify the right pathway for your municipality.
          </p>
          <div className="space-y-0 border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden">
            {grantPrograms.map((g, i) => (
              <div
                key={g.name}
                className={`flex gap-6 p-6 ${i < grantPrograms.length - 1 ? "border-b border-[var(--pj-steel)]/20" : ""}`}
              >
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{g.body}</p>
                </div>
                <div className="shrink-0 text-xs font-mono text-[var(--pj-gold)] text-right whitespace-nowrap">
                  {g.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl mb-4">Not sure where to start?</h2>
          <p className="text-[var(--text-muted)] mb-8">
            We&apos;ll scope the right deployment model for your municipality and help identify
            available grant funding. No sales call — a real conversation with a practitioner.
          </p>
          <Link
            href="/contact"
            className="rounded-md bg-[var(--pj-navy)] px-8 py-3 text-white font-medium inline-block"
          >
            Talk to Us
          </Link>
        </div>
      </section>
    </article>
  );
}
