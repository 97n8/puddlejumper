import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, Quote, CTA, CardGrid, Card } from '../../../components/marketing/site';

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
            <><strong className="text-ink">Tier 1 · Permit Path Scan</strong> — $500 flat.</>,
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

      <Section title="The Permit & Bridge Sprint — what you actually get">
        <P>
          When you’re ready to move a specific project, the sprint is fixed-fee
          ($7,500–$15,000, non-contingent) and delivers six concrete things:
        </P>
        <CardGrid>
          <Card title="Approvals Map">Every permit, board, and approval the project needs — in the order they have to happen.</Card>
          <Card title="Stakeholder & Board Plan">Who must say yes, in what sequence, and what each one will want to see.</Card>
          <Card title="Submission Checklist">The documents, drawings, and filings each body will require — gathered before you go.</Card>
          <Card title="Coordination & Hearing Support">We manage the path, prep the submissions, and ready you for the meetings.</Card>
          <Card title="Funding Alignment (optional)">Line the approvals up with grant or funding timing so nothing expires waiting.</Card>
          <Card title="Handoff Record">A clear record of how you got there and who owns what next — so it survives the project.</Card>
        </CardGrid>
        <P>
          Just need to know which path you’re on first? Start with a
          $500 flat Permit Path Scan and it credits toward the sprint.
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
