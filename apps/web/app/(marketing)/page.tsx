// Marketing landing page — placeholder.
// The marketing site (publiclogic.org / puddlejumper.com) lives in this
// route group. For Phase 5 it is a single heading; richer marketing
// content is out of scope until the brand surface is finalized.

export default function MarketingHome() {
  return (
    <main className="min-h-screen px-8 py-24 max-w-3xl mx-auto">
      <h1 className="text-5xl mb-4">PuddleJumper</h1>
      <p className="text-lg text-[var(--color-ink2)] mb-8">
        The first Governance Process Runtime.
      </p>
      <p className="text-base text-[var(--color-ink3)]">
        Calm on the surface, governance machinery underneath.
      </p>
      <p className="mt-12 text-sm text-[var(--color-ink4)] mono">
        // GPR — GOVERNANCE PROCESS RUNTIME
      </p>
    </main>
  );
}
