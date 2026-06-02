// PublicLogic footer — brand mark + the stake, plus primary routes.

import Link from 'next/link';
import { BRAND, NAV } from '../../lib/site-content';

export default function Footer() {
  return (
    <footer className="pl-footer">
      <div className="pl-footer-brand">
        <span className="pl-wordmark">{BRAND.wordmark}</span>
        <span className="pl-subhead">{BRAND.subheading}</span>
      </div>
      <nav className="pl-footer-links">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
      <p className="pl-footer-note">{BRAND.bodyPhrase}</p>
    </footer>
  );
}
