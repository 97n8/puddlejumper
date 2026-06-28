// Home (Build Sequence step 2). Brand promise + proof + previews + trust.
// Acceptance gate: homepage shows OUTPUTS before explaining architecture.

import { Hero, ProofBar, Cta } from '../../components/site/Bits';
import { BRAND, HOME, BOOM_PREVIEWS } from '../../lib/site-content';

export default function Home() {
  return (
    <main>
      <Hero
        headline={HOME.hero.headline}
        body={HOME.hero.body}
        primary={BRAND.primaryCta}
        secondary={BRAND.productCta}
      />

      <ProofBar body={HOME.proofBarBody} />

      {/* Boom previews — show the outputs, not the machinery. */}
      <section className="pl-section">
        <h2>{HOME.boom.headline}</h2>
        <p className="pl-lead">{HOME.boom.body}</p>
        <div className="pl-grid">
          {BOOM_PREVIEWS.map((b) => (
            <article className="pl-card" key={b.title}>
              <span className="pl-card-line">{b.line}</span>
              <h3>{b.title}</h3>
              <ul>
                {b.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <Cta label={BRAND.primaryCta.label} href={BRAND.primaryCta.href} />
            </article>
          ))}
        </div>
      </section>

      {/* Before / After — the felt result. */}
      <section className="pl-section">
        <h2>{HOME.beforeAfter.headline}</h2>
        <div className="pl-before-after">
          <div className="pl-ba-col">
            <h4>Before</h4>
            <p>{HOME.beforeAfter.before}</p>
          </div>
          <div className="pl-ba-col">
            <h4>After</h4>
            <p>{HOME.beforeAfter.after}</p>
          </div>
        </div>
      </section>

      <p className="pl-pullquote">{BRAND.noHeroLine}</p>

      <div className="pl-hero-ctas">
        <Cta label={BRAND.primaryCta.label} href={BRAND.primaryCta.href} />
        <Cta label="See Solutions" href="/solutions" variant="secondary" />
      </div>
    </main>
  );
}
