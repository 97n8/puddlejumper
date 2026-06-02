// About (Build Sequence step 7). Nate + Allie are CO-EQUAL method owners.
// Allie is not a training footnote (Builder Clarifications).

import type { Metadata } from 'next';
import { Hero, Cta } from '../../../components/site/Bits';
import { BRAND, ABOUT } from '../../../lib/site-content';

export const metadata: Metadata = {
  title: 'About',
  description:
    'PublicLogic is built by Nathan R. Boudreau and Dr. Allison Weiss ' +
    'Rothschild — governance and behavioral systems, in one operating test.',
};

export default function About() {
  return (
    <main>
      <Hero
        headline={ABOUT.hero.headline}
        body={ABOUT.hero.body}
        primary={{ label: 'Contact PublicLogic', href: '/contact' }}
        secondary={{ label: 'Read the Method', href: '/method' }}
      />

      <section className="pl-section">
        <h2>{ABOUT.founderPair.headline}</h2>
        <p className="pl-lead">{ABOUT.founderPair.body}</p>
        <div className="pl-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {ABOUT.founders.map((f) => (
            <article className="pl-card" key={f.name}>
              <h3>{f.name}</h3>
              <p className="pl-status">{f.role}</p>
              <p>{f.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="pl-pullquote">{BRAND.noHeroLine}</p>

      <section className="pl-section">
        <h2>{ABOUT.thesis.headline}</h2>
        <p className="pl-lead">{ABOUT.thesis.body}</p>
        <Cta label={BRAND.primaryCta.label} href={BRAND.primaryCta.href} />
      </section>
    </main>
  );
}
