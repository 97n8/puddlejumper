import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with PuddleJumper. Schedule a demo, ask about grant funding, or learn how to deploy the runtime in your municipality.",
};

const roles = [
  "Town/City Administrator",
  "Mayor / Manager",
  "Department Head",
  "IT Director",
  "Elected Official",
  "Grant Administrator",
  "Consultant / Integrator",
  "Other",
];

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 lg:grid lg:grid-cols-[1fr_480px] gap-16 items-start">
      {/* Left — context */}
      <div>
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// CONTACT</p>
        <h1 className="text-4xl mb-5">Let&apos;s talk governance.</h1>
        <p className="text-lg text-[var(--text-muted)] leading-relaxed mb-10 max-w-md">
          Whether you&apos;re exploring a pilot, applying for Community Compact IT funding, or ready to
          deploy — this is where it starts.
        </p>

        <div className="space-y-6 text-sm text-[var(--text-muted)]">
          <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
            <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// GRANT-FUNDABLE</p>
            <p className="leading-relaxed">
              PuddleJumper deployments qualify for Community Compact IT, SLCGP, CDBG/Digital Equity,
              and ARPA tech modernization funding. We can help you identify the right program.
            </p>
          </div>

          <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
            <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// TIMELINE</p>
            <p className="leading-relaxed">
              A typical pilot runs 90 days. No infrastructure changes required. SQLite-based —
              runs on any VPS or Vercel. We&apos;ll respond within one business day.
            </p>
          </div>

          <div className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
            <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// OFFICE</p>
            <p className="font-mono text-xs leading-loose opacity-70">
              PublicLogic LLC<br />
              Gardner, Massachusetts<br />
              contact@publiclogic.io
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="border border-[var(--pj-steel)]/20 rounded-xl p-7 bg-[var(--surface-elevated)]">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-5">// CONTACT FORM</p>

        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="first" className="block text-xs font-mono text-[var(--text-muted)]">
                FIRST NAME
              </label>
              <input
                id="first"
                type="text"
                autoComplete="given-name"
                className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-[var(--pj-navy)] transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="last" className="block text-xs font-mono text-[var(--text-muted)]">
                LAST NAME
              </label>
              <input
                id="last"
                type="text"
                autoComplete="family-name"
                className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-[var(--pj-navy)] transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-xs font-mono text-[var(--text-muted)]">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@municipality.gov"
              className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-[var(--pj-navy)] transition-colors placeholder:text-[var(--pj-steel)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="municipality" className="block text-xs font-mono text-[var(--text-muted)]">
              MUNICIPALITY / ORGANIZATION
            </label>
            <input
              id="municipality"
              type="text"
              placeholder="Town of Sutton, MA"
              className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-[var(--pj-navy)] transition-colors placeholder:text-[var(--pj-steel)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="role" className="block text-xs font-mono text-[var(--text-muted)]">
              YOUR ROLE
            </label>
            <select
              id="role"
              className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-[var(--surface-elevated)] focus:outline-none focus:border-[var(--pj-navy)] transition-colors"
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="message" className="block text-xs font-mono text-[var(--text-muted)]">
              MESSAGE
            </label>
            <textarea
              id="message"
              rows={4}
              placeholder="Tell us about your use case, the process you want to govern, or the grant you're applying for…"
              className="w-full border border-[var(--pj-steel)]/30 rounded-md px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-[var(--pj-navy)] transition-colors placeholder:text-[var(--pj-steel)] resize-none"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded border-[var(--pj-steel)]/40 accent-[var(--pj-gold)]"
            />
            <span className="text-xs text-[var(--text-muted)] leading-relaxed">
              I&apos;d like to schedule a live demo of the governance runtime in action.
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--pj-gold)] text-[var(--pj-midnight)] py-3 text-sm font-semibold hover:opacity-90 transition-opacity mt-2"
          >
            Send Message
          </button>
        </form>

        <p className="text-xs text-[var(--text-muted)] opacity-50 mt-4 text-center">
          We respond within one business day. No sales pressure.
        </p>
      </div>
    </div>
  );
}
