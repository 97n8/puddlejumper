import type { Metadata } from 'next';
import { Hero, Section, P, Quote } from '../../../components/marketing/site';

export const metadata: Metadata = {
  title: 'Start',
  description:
    'Start with a Stewardship Map, or just ask a question. A short, honest first conversation.',
};

const field = 'w-full rounded-md border border-bd bg-s0 px-3 py-2 text-[15px] text-ink placeholder:text-ink4 focus:border-g focus:outline-none focus:ring-1 focus:ring-g-bd';
const label = 'block text-[13px] font-medium text-ink2 mb-1';

export default function Start() {
  return (
    <>
      <Hero
        title="Start with a Stewardship Map."
        sub="Or just tell us what’s stuck. The first conversation is listening, not selling."
      />

      <Section title="Tell us a little">
        {/* v1: opens the visitor's mail client with the details. Wire to a form
            backend (Formspree, a route handler, etc.) when ready. */}
        <form
          action="mailto:hello@publiclogic.org"
          method="post"
          encType="text/plain"
          className="max-w-xl space-y-4"
        >
          <div>
            <label className={label} htmlFor="name">Name</label>
            <input className={field} id="name" name="Name" required />
          </div>
          <div>
            <label className={label} htmlFor="org">Organization</label>
            <input className={field} id="org" name="Organization" />
          </div>
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input className={field} id="email" name="Email" type="email" required />
          </div>
          <div>
            <label className={label} htmlFor="problem">
              What’s the function or project you’re worried about?
            </label>
            <textarea className={field} id="problem" name="Problem" rows={4} />
          </div>
          <div>
            <label className={label} htmlFor="where">Where are you — town, region, or organization type?</label>
            <input className={field} id="where" name="Where" />
          </div>
          <div>
            <label className={label} htmlFor="success">What would “this is handled” look like to you?</label>
            <textarea className={field} id="success" name="Success" rows={3} />
          </div>
          <button
            type="submit"
            className="rounded-full bg-g px-6 py-3 text-[14px] font-medium text-white hover:bg-g-mid transition-colors"
          >
            Send
          </button>
        </form>
      </Section>

      <Section title="Or reach us directly">
        <P>hello@publiclogic.org &nbsp;·&nbsp; 978-807-0829</P>
        <Quote>If your planner leaves, does this still work? Let’s find out together.</Quote>
      </Section>
    </>
  );
}
