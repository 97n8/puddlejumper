export function Hero() {
  return (
    <section className="relative overflow-hidden py-32 px-6">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-mono tracking-widest text-[var(--pj-gold)] mb-4">
          // GPR — PRE-RELEASE
        </p>
        <h1 className="text-5xl md:text-7xl leading-tight">
          The first governance<br />process runtime.
        </h1>
        <p className="mt-6 text-xl text-[var(--text-muted)] max-w-2xl mx-auto">
          PuddleJumper sits between a decision and an action — evaluating authority,
          routing to the right person, and producing an audit trail that can&apos;t be altered.
        </p>
        <p className="mt-3 text-base text-[var(--text-muted)]">
          It&apos;s not a feature. It&apos;s the environment.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a href="/docs" className="rounded-md bg-[var(--pj-navy)] px-6 py-3 text-white font-medium">
            Read the Docs
          </a>
          <a href="/product" className="rounded-md border border-current px-6 py-3 font-medium">
            How It Works
          </a>
        </div>
      </div>
      {/* Duck mascot illustration */}
    </section>
  );
}
