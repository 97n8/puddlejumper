// Pricing (Build Sequence step 9). Public prices for CaseSpaces ONLY; bigger
// work (diagnostics/builds/retainers) is request-based — keep serious work
// protected. Custom quote math stays internal (not on this page).

import type { Metadata } from 'next';
import { Hero, Cta } from '../../../components/site/Bits';
import { PRICING } from '../../../lib/site-content';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'CaseSpaces from $19/month. Projects, diagnostics, and full builds are ' +
    'scoped on request.',
};

export default function Pricing() {
  return (
    <main>
      <Hero
        headline="Start small. Scale when the work needs it."
        body="CaseSpaces are the public entry. Projects, diagnostics, and full builds are scoped on request."
      />

      <section className="pl-section">
        <h2>CaseSpaces</h2>
        <div className="pl-grid">
          {PRICING.publicTiers.map((t) => (
            <article className="pl-card" key={t.name}>
              <h3>{t.name}</h3>
              <p className="pl-price">{t.price}</p>
              <p>{t.bestFor}</p>
              <p className="pl-note">{t.includes}</p>
              <Cta label={t.cta} href="/contact?topic=casespace" />
            </article>
          ))}
        </div>
      </section>

      {/* Pricing bridge — explain the jump from subscription to project work. */}
      <p className="pl-pullquote">{PRICING.bridge}</p>

      <section className="pl-section">
        <h2>Bigger work — by request</h2>
        <ul className="pl-list">
          {PRICING.requestTiers.map((t) => (
            <li className="pl-list-row" key={t.name}>
              <span>
                <strong>{t.name}</strong>
                <span className="pl-note"> · {t.price}</span>
              </span>
              <Cta
                label={t.cta}
                href="/contact?topic=project"
                variant="secondary"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
