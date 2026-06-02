// Resources (Build Sequence step 5). Give away the lens, not the machine.
// Each lane has one safe free resource; no internal IP exposed.

import { Hero, Cta } from '../../../components/site/Bits';
import { BRAND, RESOURCES } from '../../../lib/site-content';

export default function Resources() {
  return (
    <main>
      <Hero
        headline={RESOURCES.hero.headline}
        body={RESOURCES.hero.body}
        primary={BRAND.primaryCta}
      />
      <section className="pl-section">
        <ul className="pl-list">
          {RESOURCES.items.map((r) => (
            <li className="pl-list-row" key={r.lane}>
              <span>
                <strong>{r.resource}</strong>
                <span className="pl-note"> · {r.lane} · {r.format}</span>
              </span>
              <Cta label="Download" href={`/contact?topic=resource_${r.lane.toLowerCase()}`} variant="secondary" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
