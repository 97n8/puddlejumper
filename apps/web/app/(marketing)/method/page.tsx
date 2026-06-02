// Method (Build Sequence step 6). Principles FIRST; canon lower on the page.
// Never lead Method with pond/heron/mascot/canon (Builder Clarifications).

import { Hero } from '../../../components/site/Bits';
import { BRAND, METHOD } from '../../../lib/site-content';

export default function Method() {
  return (
    <main>
      <Hero headline={METHOD.hero.headline} body={METHOD.hero.body} />

      <p className="pl-pullquote">{BRAND.noHeroLine}</p>

      <section className="pl-section">
        <h2>Operating principles</h2>
        <div className="pl-principles">
          {METHOD.principles.map((p) => (
            <div className="pl-principle" key={p.name}>
              <h3>{p.name}</h3>
              <p>{p.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Canon appears AFTER the method principles, never in the hero. */}
      <section className="pl-section pl-canon">
        <h2>Canon</h2>
        <div className="pl-principles">
          {METHOD.canon.map((c) => (
            <div className="pl-principle" key={c.term}>
              <h3>{c.term}</h3>
              <p>{c.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
