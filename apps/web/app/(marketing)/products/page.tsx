// Products / Login (Build Sequence step 4). Access doors only.
// PuddleJumper login + Permit&Bridge coming soon. No FORM/VAULT explanation.

import type { Metadata } from 'next';
import { Hero, Cta } from '../../../components/site/Bits';
import { PRODUCTS } from '../../../lib/site-content';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Log in to PuddleJumper. Permit&Bridge coming soon.',
};

export default function Products() {
  return (
    <main>
      <Hero headline={PRODUCTS.hero.headline} body={PRODUCTS.hero.body} />
      <section className="pl-section">
        <div className="pl-grid">
          {PRODUCTS.doors.map((d) => (
            <article className="pl-card" key={d.name}>
              <h3>{d.name}</h3>
              <p
                className={
                  d.status === 'Coming Soon' ? 'pl-status pl-status-soon' : 'pl-status'
                }
              >
                {d.status}
              </p>
              <p>{d.copy}</p>
              <Cta
                label={d.button}
                href={d.href}
                variant={d.status === 'Active' ? 'primary' : 'secondary'}
              />
            </article>
          ))}
        </div>
        <p className="pl-note" style={{ marginTop: 20 }}>
          {PRODUCTS.help.copy}{' '}
          <a href={PRODUCTS.help.href}>{PRODUCTS.help.button}</a>
        </p>
      </section>
    </main>
  );
}
