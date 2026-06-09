import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, Quote, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'Permit & Bridge',
  description:
    'Help understanding the path, and help moving through it — for residents and for project sponsors.',
};

export default function PermitAndBridge() {
  return (
    <>
      <Hero
        title="Permit & Bridge helps the public understand the path and helps project sponsors move through it."
        sub="Two sides of the same bridge: simple help for the public, white-glove help for project sponsors."
      />

      <Section title="Two sides of the bridge">
        <Bullets
          items={[
            <><strong className="text-ink">Public Help Layer</strong> — for residents, small owners, and nonprofits. “Can I do X in my backyard, on my property, in my building?” Cheap, simple, framework-guided.</>,
            <><strong className="text-ink">Project Sponsor Layer</strong> — for developers, towns, nonprofits, and businesses. A white-glove path through permits, boards, funding, and stakeholders.</>,
          ]}
        />
      </Section>

      <Section title="Why it exists">
        <P>
          Most sponsors understand their project. What stalls them is the public system around it — the
          permits, the boards, the funding rules, the politics. That gap is where good projects die. We
          become the bridge: we translate between the project and the public system so the project keeps
          moving and nothing falls through the cracks between the people involved.
        </P>
      </Section>

      <Section title="The offer ladder">
        <Bullets
          items={[
            <><strong className="text-ink">Tier 0 · Public Permit Helper</strong> — free or very low cost.</>,
            <><strong className="text-ink">Tier 1 · Permit Path Scan</strong> — $250–$750.</>,
            <><strong className="text-ink">Tier 2 · Stewardship Map</strong> — $2,500–$7,500.</>,
            <><strong className="text-ink">Tier 3 · Permit &amp; Bridge Sprint</strong> — $7,500–$15,000.</>,
            <><strong className="text-ink">Tier 4 · White-Glove Implementation</strong> — $3,500–$8,500 / month.</>,
            <><strong className="text-ink">Tier 5 · Funding / Grant Build</strong> — $5,000–$25,000, scope-dependent.</>,
          ]}
        />
        <P>
          The free tier builds trust; the paid tiers handle complexity. A paid tier credits toward the
          next engagement — credits don’t stack, so you never pay twice for the same step.
        </P>
      </Section>

      <Section title="Our promise to a sponsor">
        <Quote>
          You leave with a clear path forward, a clear record of how you got there, and a clear
          understanding of who owns what next.
        </Quote>
        <CTA href="/start">Book a Permit &amp; Bridge conversation</CTA>
      </Section>
    </>
  );
}
