// PublicLogic marketing — shared presentational components.
// Server components only; styled against the @pj/ui design tokens exposed
// as Tailwind v4 theme colors (bg, ink, g, amber, bd…) in globals.css.
import Link from 'next/link';

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/logiccommons', label: 'LogicCommons' },
  { href: '/services', label: 'Services' },
  { href: '/proof', label: 'Proof' },
  { href: '/about', label: 'About' },
];

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</div>;
}

export function Nav() {
  return (
    <header className="border-b border-bd bg-s1/80 backdrop-blur sticky top-0 z-20">
      <Container className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
        <Link href="/" className="font-display text-2xl text-ink mr-2 tracking-tight">
          PublicLogic
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink2">
          {NAV.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-g transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <Link
            href="/start"
            className="inline-block rounded-full bg-g px-4 py-2 text-[13px] font-medium text-white hover:bg-g-mid transition-colors"
          >
            Start with a Stewardship Map
          </Link>
        </div>
      </Container>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-bd bg-s2">
      <Container className="py-12">
        <p className="font-display text-xl text-g italic mb-4">
          Honor the past. Improve the present. Continue the work.
        </p>
        <p className="max-w-2xl text-[13px] text-ink2 leading-relaxed mb-6">
          PublicLogic helps organizations understand, improve, and continue their work. Municipal
          government is our home ground, but the method serves mission-driven and legacy-minded
          organizations wherever continuity matters.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink2 mb-6">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-g transition-colors">
              {l.label}
            </Link>
          ))}
          <Link href="/faq" className="hover:text-g transition-colors">FAQ</Link>
          <Link href="/start" className="hover:text-g transition-colors">Start</Link>
        </div>
        <p className="text-[12px] text-ink3 mb-1">
          nate@publiclogic.org &nbsp;·&nbsp; PublicLogic LLC &nbsp;·&nbsp; Continuity • Data • Stewardship
        </p>
        <p className="text-[12px] text-ink4 max-w-2xl">
          PublicLogic provides stewardship and advisory services. We are not a software vendor and our
          materials are not legal advice. © {new Date().getFullYear()} PublicLogic LLC.
        </p>
      </Container>
    </footer>
  );
}

export function Hero({
  kicker,
  title,
  sub,
}: {
  kicker?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="pt-16 pb-8">
      {kicker && (
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-amber">{kicker}</p>
      )}
      <h1 className="font-display text-4xl sm:text-5xl leading-[1.08] text-ink max-w-3xl">{title}</h1>
      {sub && <p className="mt-5 max-w-2xl text-lg italic text-g leading-relaxed">{sub}</p>}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="py-7 border-t border-bd first:border-t-0">
      {title && <h2 className="font-display text-2xl text-g mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl text-base text-ink2 leading-relaxed mb-3">{children}</p>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl text-[15px] text-ink2 leading-relaxed mb-3">{children}</p>;
}

export function Quote({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-2xl italic text-ink leading-snug max-w-2xl my-4">{children}</p>
  );
}

export function Band({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-xl italic text-g leading-snug max-w-3xl my-5 border-l-2 border-g-bd pl-5">
      {children}
    </p>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 max-w-2xl mb-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] text-ink2 leading-relaxed">
          <span className="text-amber font-medium select-none">—</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function CTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-block rounded-full bg-g px-6 py-3 text-[14px] font-medium text-white hover:bg-g-mid transition-colors"
    >
      {children}
    </Link>
  );
}

export function CTARow({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center gap-4">{children}</div>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[14px] font-medium text-g hover:text-g-mid underline underline-offset-4">
      {children}
    </Link>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 my-4">{children}</div>;
}

export function Card({
  label,
  title,
  children,
  price,
}: {
  label?: string;
  title: string;
  children?: React.ReactNode;
  price?: string;
}) {
  return (
    <div className="rounded-lg border border-bd bg-s0 p-5">
      {label && <p className="text-[11px] uppercase tracking-[0.14em] text-amber mb-1">{label}</p>}
      <h3 className="font-display text-xl text-ink mb-1">{title}</h3>
      {price && <p className="text-[13px] font-medium text-g mb-2">{price}</p>}
      {children && <div className="text-[14px] text-ink2 leading-relaxed">{children}</div>}
    </div>
  );
}
