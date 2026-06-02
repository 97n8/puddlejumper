'use client';

// PublicLogic primary nav (Build Sequence step 1 — brand/nav lock).
// Wordmark + "Systems for Continuity" subheading + nav links + product CTA.
// Mobile: collapses to a hamburger (Builder Clarifications — Mobile).

import { useState } from 'react';
import Link from 'next/link';
import { BRAND, NAV } from '../../lib/site-content';

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="pl-nav">
      <Link href="/" className="pl-brand" onClick={() => setOpen(false)}>
        <span className="pl-wordmark">{BRAND.wordmark}</span>
        <span className="pl-subhead">{BRAND.subheading}</span>
      </Link>

      <button
        type="button"
        className="pl-nav-toggle"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>

      <nav className={`pl-nav-links${open ? ' is-open' : ''}`}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </Link>
        ))}
        <a className="pl-nav-cta" href={BRAND.productCta.href}>
          {BRAND.productCta.label}
        </a>
      </nav>
    </header>
  );
}
