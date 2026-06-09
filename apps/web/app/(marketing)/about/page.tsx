import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'About',
  description:
    'PublicLogic emerged from the work — municipal administration, capital planning, grant development — not from a theory.',
};

export default function About() {
  return (
    <>
      <Hero
        title="We didn’t start from a theory. We started from the work."
        sub="PublicLogic is the company that already existed in our day jobs — named, and made repeatable."
      />

      <Section title="Why we exist">
        <P>
          Across years inside municipal administration, capital planning, and grant development, we kept
          seeing the same thing: good, important work would stall or quietly disappear — not because the
          idea was wrong, but because the person holding it left, the knowledge was never written down, or
          no one owned what came next. PublicLogic is our attempt to fix that, with the practices we wish
          we’d had when we were inside it.
        </P>
      </Section>

      <Section title="Nathan + Allie">
        <P>
          <strong className="text-ink">Nathan Boudreau</strong> (MPA, MCPPO) knows institutional systems —
          how municipalities, money, grants, procurement, and projects actually work from the inside.
        </P>
        <P>
          <strong className="text-ink">Allie Weiss Rothschild</strong> knows human systems — how people,
          roles, adoption, and change actually work, and why systems get used or ignored. In our model,
          that’s the Governance Steward lane: the human-centered guide who makes systems fit real people
          and keeps them trusted and adopted over time.
        </P>
        <P>
          Most firms have one side or the other. Projects fail for whichever side gets ignored. That’s why
          we work together this way.
        </P>
      </Section>

      <Section title="What we believe">
        <Bullets
          items={[
            <><strong className="text-ink">Vision</strong> — organizations should be easier to inherit than they were to build.</>,
            <><strong className="text-ink">Promise</strong> — we do not create dependency. We create understanding.</>,
            <><strong className="text-ink">North Star</strong> — every system should make it easier for the next person to do the right thing.</>,
          ]}
        />
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
