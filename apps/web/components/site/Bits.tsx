// Shared presentational bits for the PublicLogic marketing pages.
// Pure render — no data, no state.

import Link from 'next/link';
import { BRAND } from '../../lib/site-content';

export function Cta({
  label,
  href,
  variant = 'primary',
}: {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}) {
  const cls = variant === 'primary' ? 'pl-cta pl-cta-primary' : 'pl-cta pl-cta-secondary';
  // External (product) links use <a>; internal links use Next <Link>.
  if (href.startsWith('http')) {
    return (
      <a className={cls} href={href}>
        {label}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {label}
    </Link>
  );
}

export function Hero({
  headline,
  body,
  primary,
  secondary,
}: {
  headline: string;
  body: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="pl-hero">
      <h1>{headline}</h1>
      <p>{body}</p>
      {(primary || secondary) && (
        <div className="pl-hero-ctas">
          {primary && <Cta label={primary.label} href={primary.href} />}
          {secondary && <Cta label={secondary.label} href={secondary.href} variant="secondary" />}
        </div>
      )}
    </section>
  );
}

export function ProofBar({ body }: { body?: string }) {
  return (
    <section className="pl-proofbar" aria-label="Proof bar">
      <ul>
        {BRAND.proofBar.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {body && <p className="pl-proofbar-body">{body}</p>}
    </section>
  );
}
