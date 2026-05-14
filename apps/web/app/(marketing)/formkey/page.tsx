import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Formkey",
  description:
    "Structured data ingestion for PuddleJumper. Forms that create governed records, trigger flows, and know where the artifact lands.",
};

const whatFormkeyKnows = [
  { label: "What flow it starts", desc: "A Formkey is bound to a specific governance flow at configuration time. Submission activates the flow — not just a record." },
  { label: "What VAULT conditions apply", desc: "Before the submission enters the system, VAULT evaluates whether the incoming data satisfies the verification and legitimacy conditions for this flow type." },
  { label: "What data downstream steps need", desc: "Each field in a Formkey is mapped to what the next step in the flow requires. No re-keying. No lost data. No interpretation at the intake desk." },
  { label: "What ARCHIEVE retention policy governs", desc: "The submission carries its retention class at creation. Every artifact that exits PuddleJumper already knows its disposition schedule." },
  { label: "Where the artifact lands when Transfer completes", desc: "Transfer is the final condition in every VAULT evaluation. Formkey resolves it at submission — the responsible party sees the record in their casespace immediately." },
];

export default function FormkeyPage() {
  return (
    <article>
      <section className="max-w-4xl mx-auto px-6 py-24">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// FORMKEY</p>
        <h1 className="text-5xl leading-tight mb-4">Not a form builder.</h1>
        <h2 className="text-5xl leading-tight mb-8 text-[var(--text-muted)]">A form runtime.</h2>
        <p className="text-xl text-[var(--text-muted)] max-w-2xl leading-relaxed">
          Every form on your municipal site is currently a dead end. A resident submits.
          Someone reads their email. Someone else re-keys the data. Something gets lost.
          Formkey changes the moment of submission.
        </p>
      </section>

      {/* What Formkey Knows */}
      <section className="bg-[var(--surface-elevated)] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// WHAT IT KNOWS</p>
          <h2 className="text-3xl mb-4">A Formkey knows five things before a resident hits submit.</h2>
          <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl">
            Conventional form builders know how to collect data. Formkey knows what to do with it.
          </p>
          <div className="space-y-0 border border-[var(--pj-steel)]/20 rounded-lg overflow-hidden">
            {whatFormkeyKnows.map((item, i) => (
              <div
                key={item.label}
                className={`flex gap-6 p-6 ${i < whatFormkeyKnows.length - 1 ? "border-b border-[var(--pj-steel)]/20" : ""}`}
              >
                <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--pj-midnight)] text-[var(--pj-cream)] flex items-center justify-center text-xs font-mono font-bold mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold mb-1">{item.label}</p>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// THE SUBMISSION PATH</p>
          <h2 className="text-3xl mb-4">What happens when a resident submits</h2>
          <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl">
            In three seconds, a Formkey submission travels the entire path that used to take three days.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { step: "01", title: "Submission enters PuddleJumper as a governed record", body: "Not an email. Not a spreadsheet row. A record with a VAULT evaluation, a retention class, and a flow activation." },
              { step: "02", title: "The flow activates immediately", body: "The governance flow defined for this Formkey starts. VAULT evaluates. The responsible party is resolved from Org Manager." },
              { step: "03", title: "The casespace is ready", body: "The responsible party opens their casespace to find the submission fully structured — all intake fields mapped, all downstream steps pre-loaded." },
              { step: "04", title: "The clock starts", body: "For time-sensitive workflows (PRR: 10 days, permit review: varies), the statutory clock starts at submission. PuddleJumper tracks it. Escalations are automatic." },
            ].map((s) => (
              <div key={s.step} className="border border-[var(--pj-steel)]/20 rounded-lg p-6 space-y-2">
                <span className="text-xs font-mono text-[var(--pj-gold)]">{s.step}</span>
                <h3 className="font-semibold leading-snug">{s.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployment */}
      <section className="bg-[var(--pj-midnight)] text-[var(--pj-cream)] py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// DEPLOYMENT</p>
          <h2 className="text-3xl mb-6">Embeddable anywhere</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              { label: "Municipal website", desc: "Drop a Formkey iframe onto any page. Residents submit through your existing site." },
              { label: "CivicPlus", desc: "Embedded in your CivicPlus portal. Residents see the same form — the backend is PuddleJumper." },
              { label: "Tenant-served", desc: "Formkey served directly from your PuddleJumper tenant at your subdomain." },
            ].map((d) => (
              <div key={d.label} className="space-y-2">
                <h3 className="font-semibold">{d.label}</h3>
                <p className="text-sm opacity-70 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
          <Link
            href="/contact"
            className="inline-block rounded-md bg-[var(--pj-gold)] text-[var(--pj-midnight)] px-6 py-3 font-semibold"
          >
            See a Formkey Demo
          </Link>
        </div>
      </section>
    </article>
  );
}
