import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-[var(--surface-elevated)]/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          {/* Duck logo */}
          <span className="font-semibold">PuddleJumper</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">// GPR</span>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="/product">Product</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/about">About</Link>
          <Link href="/login" className="rounded-md bg-[var(--pj-navy)] px-4 py-2 text-sm text-white">
            Sign In
          </Link>
        </div>
      </nav>
    </header>
  );
}
