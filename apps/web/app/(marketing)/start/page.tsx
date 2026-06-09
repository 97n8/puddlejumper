import type { Metadata } from 'next';
import { Hero, Section, P, Quote } from '../../../components/marketing/site';
import { ContactForm } from '../../../components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Start',
  description:
    'Start with a Stewardship Map, or just ask a question. A short, honest first conversation.',
};

export default function Start() {
  return (
    <>
      <Hero
        title="Start with a Stewardship Map."
        sub="Or just tell us what’s stuck. The first conversation is listening, not selling."
      />

      <Section title="Tell us a little">
        <ContactForm />
      </Section>

      <Section title="Or reach us directly">
        <P>nate@publiclogic.org &nbsp;·&nbsp; 978-807-0829</P>
        <Quote>If your planner leaves, does this still work? Let’s find out together.</Quote>
      </Section>
    </>
  );
}
