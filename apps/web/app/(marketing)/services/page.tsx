import type { Metadata } from 'next';
import { Hero, Section, P, CardGrid, Card, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'From a free worksheet to ongoing capacity support — a clear ladder, honestly priced, non-contingent.',
};

const OFFERS: { title: string; price: string; body: string; label?: string }[] = [
  { label: 'Entry', title: 'Stewardship Map', price: '$2,500–$7,500', body: 'Make one function visible — the safe first step.' },
  { title: 'Project Development Sprint', price: '$5,000–$15,000', body: 'Turn a priority or challenge into an actionable project.' },
  { title: 'Funding Strategy Sprint', price: '$5,000–$12,500', body: 'Find realistic funding and the readiness it requires.' },
  { title: 'Permit & Bridge Sprint', price: '$7,500–$15,000', body: 'Move a project through the public systems around it.' },
  { title: 'Diagnostic', price: '$10,000–$25,000+', body: 'A deep review of risks, records, structure, and next steps when a Map reveals serious drift.' },
  { title: 'Implementation Support', price: '$3,500–$8,500 / mo', body: 'Coordinate and hold accountability while your team executes.' },
  { title: 'Capacity Support', price: '$4,000–$10,000 / mo', body: 'Step in and hold a role directly until it transfers back.' },
];

export default function Services() {
  return (
    <>
      <Hero
        title="Simple offers, honestly priced."
        sub="Everything starts with making the work visible. The Map comes first; the rest follows from what it finds."
      />

      <Section title="The offers">
        <CardGrid>
          {OFFERS.map((o) => (
            <Card key={o.title} label={o.label} title={o.title} price={o.price}>
              {o.body}
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section title="How we price">
        <P>
          Fixed-fee or retainer, and non-contingent. A paid tier credits toward the next engagement —
          credits don’t stack, so you never pay twice for the same step. We tell you the smallest useful
          next step, not the biggest.
        </P>
      </Section>

      <Section title="Implementation vs. Capacity">
        <P>
          Implementation Support helps your team execute — the work stays theirs. Capacity Support means
          we hold the role ourselves until it transfers back. Same discipline; different level of who
          holds the chair.
        </P>
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
