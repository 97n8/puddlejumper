// Solutions (Build Sequence step 3). Routing page, not a service catalog.
// Six cards max; each routes to Contact with a hidden topic field.

import { Hero, Cta } from '../../../components/site/Bits';
import { BRAND, SOLUTIONS } from '../../../lib/site-content';

export default function Solutions() {
  return (
    <main>
      <Hero
        headline={SOLUTIONS.hero.headline}
        body={SOLUTIONS.hero.body}
        primary={BRAND.primaryCta}
        secondary={{ label: 'Contact PublicLogic', href: '/contact' }}
      />
      <section className="pl-section">
        <div className="pl-grid">
          {SOLUTIONS.cards.map((c) => (
            <article className="pl-card" key={c.topic}>
              <h3>{c.title}</h3>
              <p>{c.copy}</p>
              <Cta label="Start Here" href={`/contact?topic=${c.topic}`} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
