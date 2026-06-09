import type { Metadata } from 'next';
import { Hero, Section, P, Bullets, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'Proof',
  description:
    'Stewardship is provable, not just stated: continuity, record, readiness, adoption, outcome.',
};

export default function Proof() {
  return (
    <>
      <Hero
        title="We can show it."
        sub="Five kinds of proof, each tied to work we’ve actually done."
      />

      <Section title="How we prove the work">
        <Bullets
          items={[
            <><strong className="text-ink">Continuity</strong> — a function survives when the person who ran it leaves. (Successor tests and structure mapped to authority.)</>,
            <><strong className="text-ink">Record</strong> — every claim, number, and decision traces to a source. (A governed record: source file → workbook row → output.)</>,
            <><strong className="text-ink">Readiness</strong> — the organization can absorb and sustain the change, assessed before any build.</>,
            <><strong className="text-ink">Adoption</strong> — staff actually use the system, monitored through implementation.</>,
            <><strong className="text-ink">Outcome</strong> — the work moved forward and got funded, documented.</>,
          ]}
        />
      </Section>

      <Section title="Where it comes from">
        <P>
          PublicLogic came out of real work — municipal administration, capital planning, grant
          development, and engagements across Massachusetts and beyond. We share specific examples in
          conversation, with client permission, rather than publishing confidential detail here.
        </P>
        <p className="text-[13px] italic text-ink3 max-w-2xl">
          Some of our work is client-confidential. We confirm what we’re comfortable naming before
          sharing it.
        </p>
        <CTA href="/start">Talk to us about your situation</CTA>
      </Section>
    </>
  );
}
