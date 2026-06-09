import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, Band, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'The PublicLogic path: Understand, Navigate, Diagnose, Deliver, Sustain — built on Continuity & Stewardship Systems.',
};

export default function HowItWorks() {
  return (
    <>
      <Hero
        title="One path, five steps. Enter anywhere."
        sub="You don’t have to buy the whole thing to start. Each step stands on its own and leads naturally to the next."
      />

      <Section title="The path">
        <Bullets
          items={[
            <><strong className="text-ink">Understand · LogicCommons</strong> — free templates, checklists, and frameworks that help you see the path before you need paid help.</>,
            <><strong className="text-ink">Navigate · Permit &amp; Bridge</strong> — help moving through permits, boards, funding, and stakeholders.</>,
            <><strong className="text-ink">Diagnose · Stewardship Map</strong> — a short, fixed-fee look at how one function really runs and what to do next.</>,
            <><strong className="text-ink">Deliver · PublicLogic</strong> — the project development, funding, implementation, or capacity work itself.</>,
            <><strong className="text-ink">Sustain · Continuity &amp; Stewardship Systems</strong> — the records and routines that keep it all working after we step back.</>,
          ]}
        />
      </Section>

      <Section title="How we actually do the work">
        <P>
          Our method is four moves: <strong className="text-ink">Map → Embed → Encode → Sustain</strong>.
          We map how work, knowledge, authority, records, and risk actually move; we embed the right
          structure into the live workflow with the people who do the work; we encode the knowledge and
          rules so they outlast any one person; and we sustain it until it runs without us.
        </P>
        <P>
          Across an engagement, a client moves through a simple cycle: Discover · Honor · Understand ·
          Improve · Build · Steward · Continue. We honor what already works before we change anything.
        </P>
      </Section>

      <Section title="What “Continuity & Stewardship Systems” means">
        <P>
          It’s the plumbing, not a product. Continuity &amp; Stewardship Systems are the records,
          processes, templates, environments, accountability structures, and proof that help important
          work survive turnover, changing priorities, and organizational change.
        </P>
        <Band>Continuity is the outcome. Stewardship is the practice. Systems are the mechanism.</Band>
        <P>You never have to think about the parts — you just get work that holds together.</P>
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
