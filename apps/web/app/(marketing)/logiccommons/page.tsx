import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, Band, CTA, CTARow, TextLink } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'LogicCommons',
  description:
    'Free, plain-language tools that help residents, owners, and organizations understand the path before they need paid help.',
};

export default function LogicCommons() {
  return (
    <>
      <Hero
        kicker="The public layer — free"
        title="Help understanding the path — free."
        sub="LogicCommons is our public layer: free templates, checklists, and frameworks. No account, no pitch. Just help."
      />

      <Section title="Why it’s free">
        <P>
          Some questions don’t need a consultant. They need a checklist, a starting point, and the right
          office to call. LogicCommons exists for that. Its purpose is access, trust, and triage — not
          selling. It does not replace your municipality, inspector, planner, or permitting authority.
        </P>
      </Section>

      <Section title="Start here">
        <Bullets
          items={[
            <><strong className="text-ink">“Can I Do This?”</strong> — a plain-language permit-path worksheet for residents, small owners, and project sponsors.</>,
            'More templates and checklists added over time, drawn from real municipal work.',
          ]}
        />
        <CTARow>
          <CTA href="/start">Request the “Can I Do This?” worksheet</CTA>
        </CTARow>
      </Section>

      <Section title="When you need more than a template">
        <P>
          If your project touches several systems at once, involves a public hearing, or you’ve already
          been bounced between offices, a Permit Path Scan ($250–$750) lays out the likely path, the
          boards involved, and the documents you’ll need — so you stop guessing.
        </P>
        <Band>LogicCommons helps people start. PublicLogic helps them carry it through.</Band>
        <TextLink href="/permit-and-bridge">See Permit &amp; Bridge →</TextLink>
      </Section>
    </>
  );
}
