import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, Quote, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'Stewardship Map',
  description:
    'The safe first step: a short, fixed-fee look at how one function really runs, where it’s fragile, and what to do next.',
};

export default function StewardshipMap() {
  return (
    <>
      <Hero
        kicker="The entry offer"
        title="The safest way to start working together."
        sub="A short, fixed-fee diagnostic that makes one function visible before anyone commits real money."
      />

      <Section title="What it is">
        <P>
          Before you commit to a project, a build, or a hire, the Stewardship Map shows how work,
          knowledge, authority, records, and risk actually move through your organization — and where the
          next person would get stuck.
        </P>
      </Section>

      <Section title="What you get">
        <Bullets
          items={[
            <><strong className="text-ink">Stewardship Map</strong> — a clear picture of how the function runs today.</>,
            <><strong className="text-ink">Continuity Risks</strong> — the points where turnover or a gap would actually break something.</>,
            <><strong className="text-ink">Readiness Findings</strong> — an honest read on what your organization can absorb and sustain now.</>,
            <><strong className="text-ink">Priority Roadmap</strong> — a short, sequenced list of next moves, with what each is worth.</>,
            <><strong className="text-ink">Recommended Next Step</strong> — our honest read on the single best move, or whether there isn’t one yet.</>,
          ]}
        />
      </Section>

      <Section title="Fee">
        <P>
          $2,500–$7,500, fixed and non-contingent — our fee never depends on a funding outcome or a
          decision going a particular way. Typically 2–4 weeks. The Map credits toward a follow-on
          engagement if you continue.
        </P>
      </Section>

      <Section title="Why start here">
        <P>
          Low risk. Small, fixed, and bounded — you learn what’s really going on before committing to
          anything bigger. Most clients use the Map to decide what to do next.
        </P>
        <Quote>
          Similar work has been used to identify continuity, governance, and implementation risks before
          capital, technology, and organizational investments.
        </Quote>
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
