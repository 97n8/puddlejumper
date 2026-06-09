import {
  Hero, Section, P, Lead, Band, Bullets, CTA, CTARow, TextLink, Quote, CardGrid, Card,
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

      <Section title="What breaks">
        <P>Good work fails for boring reasons. In a town, it usually looks like one of these:</P>
        <Bullets
          items={[
            <><strong className="text-ink">Stalled projects</strong> — no one owns the next step, so it sits.</>,
            <><strong className="text-ink">Lost grants</strong> — a funding window closes before anyone is ready.</>,
            <><strong className="text-ink">Missing records</strong> — how and why things were done was never written down.</>,
            <><strong className="text-ink">Retirements &amp; turnover</strong> — the person who held it leaves, and the knowledge leaves too.</>,
            <><strong className="text-ink">Single points of failure</strong> — a whole function runs through one person’s head.</>,
          ]}
        />
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

      <Section title="In 30 seconds">
        <CardGrid>
          <Card label="The problem" title="Continuity fails">
            When people leave, projects stall, grants are missed, and records scatter. It’s a budget and
            governance problem, not a technology one.
          </Card>
          <Card label="The first step" title="A Stewardship Map" price="$2,500–$7,500 · 2–4 weeks">
            A short, fixed-fee look at one function: how it runs, where it’s fragile, and what to do next.
            Low risk, non-contingent.
          </Card>
          <Card label="The outcome" title="You know what to do">
            A clear picture, the real risks named, and a prioritized next step — so you can move with
            confidence instead of guessing.
          </Card>
        </CardGrid>
      </Section>

      <Section title="Who it’s for">
        <P>
          <strong className="text-ink">Municipal governments — our focus.</strong> For our first year we
          are building one reputation: continuity and implementation support for towns and cities, and
          the partners around them — regional planning agencies, engineering firms, and municipal
          consulting firms.
        </P>
        <P>
          The method also serves mission-driven and legacy-minded organizations wherever continuity
          matters, but municipalities are home ground and where we start.
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
