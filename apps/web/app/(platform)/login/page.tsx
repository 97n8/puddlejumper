import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--pj-midnight)]">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Mark */}
        <div className="text-center">
          <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// GPR</p>
          <h1 className="text-2xl font-semibold text-[var(--pj-cream)]">PuddleJumper</h1>
          <p className="text-sm text-[var(--pj-sky)] mt-1">Governance process runtime</p>
        </div>

        {/* Form */}
        <div className="bg-[var(--pj-navy)] rounded-xl p-6 border border-[var(--pj-steel)]/30 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-mono text-[var(--pj-sky)]" htmlFor="email">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@municipality.gov"
              className="w-full bg-[var(--pj-midnight)] border border-[var(--pj-steel)]/40 rounded-md px-3 py-2.5 text-sm text-[var(--pj-cream)] placeholder:text-[var(--pj-steel)] focus:outline-none focus:border-[var(--pj-gold)] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[var(--pj-sky)]" htmlFor="password">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-[var(--pj-midnight)] border border-[var(--pj-steel)]/40 rounded-md px-3 py-2.5 text-sm text-[var(--pj-cream)] placeholder:text-[var(--pj-steel)] focus:outline-none focus:border-[var(--pj-gold)] transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--pj-gold)] text-[var(--pj-midnight)] py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
        </div>

        <p className="text-center text-xs text-[var(--pj-steel)]">
          Session is tenant-scoped. Every query is bound to your tenant.
        </p>
      </div>
    </div>
  );
}
