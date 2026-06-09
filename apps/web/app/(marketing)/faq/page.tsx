import type { Metadata } from 'next';
import { Hero, Section, CTA } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Plain answers: what a Stewardship Map is, what it costs, and what PublicLogic is and isn’t.',
};

const QA: { q: string; a: string }[] = [
  {
    q: 'Is this software?',
    a: 'No. PublicLogic is a stewardship and advisory practice. We work in ordinary tools your team already uses — documents, workbooks, registers, calendars — and make them behave like a governed system. The value is the discipline, not a platform.',
  },
  {
    q: 'Is this an “AI” service?',
    a: 'No. We use good judgment, real experience, and practical tools. We’re careful not to overclaim — we make the work easier to understand and continue, not magically automated.',
  },
  {
    q: 'What’s a Stewardship Map?',
    a: 'A short, fixed-fee diagnostic of one function: how it runs, where it’s fragile, and what to do next. It’s the safest way to start, because it tells both of us exactly what should come next.',
  },
  {
    q: 'What does it cost?',
    a: 'The Stewardship Map is $2,500–$7,500, fixed and non-contingent. Other offers range from a $500 flat Permit Path Scan up to monthly support. Our fee never depends on a funding outcome.',
  },
  {
    q: 'How long does it take?',
    a: 'A Stewardship Map is usually 2–4 weeks. A Permit Path Scan is a few business days.',
  },
  {
    q: 'Do you replace our staff?',
    a: 'Only if you ask us to, and only until it transfers back. Capacity Support means we hold a role temporarily; Implementation Support means we help your team carry it. Either way, the goal is to make you less dependent on us, not more.',
  },
  {
    q: 'Who do you work with?',
    a: 'Municipal governments and their partners — regional planning agencies, engineering firms, municipal consulting firms — and mission-driven or legacy-minded organizations where continuity matters.',
  },
  {
    q: 'Where do I start?',
    a: 'With a Stewardship Map, or a short call. If you just have a permitting question, start free in LogicCommons.',
  },
];

export default function FAQ() {
  return (
    <>
      <Hero title="Straight answers." />
      <Section>
        <dl className="max-w-2xl divide-y divide-bd">
          {QA.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="font-display text-xl text-g mb-1">{item.q}</dt>
              <dd className="text-[15px] text-ink2 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
        <CTA href="/start">Start with a Stewardship Map</CTA>
      </Section>
    </>
  );
}
