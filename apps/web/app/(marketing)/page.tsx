import {
  Hero, Section, P, Lead, Band, Bullets, CTA, CTARow, TextLink, Quote,
} from '../../components/marketing/site';

export default function Home() {
  return (
    <>
      <Hero
        kicker="Continuity • Data • Stewardship"
        title={
          <>
            Most organizations don’t lose ground from a lack of effort. They lose it from a lack of{' '}
            <span className="text-g">visibility</span>.
          </>
        }
        sub="PublicLogic helps projects move through public systems — and helps organizations keep the capacity to sustain what they build."
      />
      <CTARow>
        <CTA href="/start">Start with a Stewardship Map</CTA>
        <TextLink href="/how-it-works">See how it works →</TextLink>
      </CTARow>

      <Band>
        Help people understand the path. Help projects move through the path. Leave the path easier for
        the next person.
      </Band>

      <Section title="The quiet problem">
        <P>
          Good work fails for boring reasons. The person who held it leaves. How and why things were done
          was never written down. A funding window closes before anyone is ready. A plan gets made, then
          sits on a shelf. By the time anyone notices, the momentum, the money, or the knowledge is
          already gone.
        </P>
        <P>
          The central question isn’t whether risk exists. It’s where it will live — and who carries it
          when the people change.
        </P>
      </Section>

      <Section title="How we help — five steps, in plain language">
        <Bullets
          items={[
            <><strong className="text-ink">Understand</strong> — free public tools that explain the path (LogicCommons).</>,
            <><strong className="text-ink">Navigate</strong> — help finding the way through permits, boards, and funding (Permit &amp; Bridge).</>,
            <><strong className="text-ink">Diagnose</strong> — a short, paid look at what actually needs to happen (Stewardship Map).</>,
            <><strong className="text-ink">Deliver</strong> — the project, funding, or capacity work itself (PublicLogic).</>,
            <><strong className="text-ink">Sustain</strong> — the records and routines that keep it working after we step back (Continuity &amp; Stewardship Systems).</>,
          ]}
        />
        <Lead>You can enter anywhere. Most clients start with a Stewardship Map — the safe, fixed-fee first step.</Lead>
      </Section>

      <Section title="What makes us different">
        <P>
          Most systems manage work. PublicLogic helps steward what has to survive the work. And we hold
          ourselves to a rule: we do not create dependency. We create understanding.
        </P>
      </Section>

      <Section title="Who it’s for">
        <P>
          Municipal governments and the partners around them — regional planning agencies, engineering
          firms, and municipal consulting firms — plus mission-driven and legacy-minded organizations
          wherever continuity matters.
        </P>
      </Section>

      <Section>
        <Quote>If your planner leaves, does this still work?</Quote>
        <P>That’s the question a Stewardship Map answers. Small, fixed-fee, and honest.</P>
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
