// Contact (Build Sequence step 8). Short guided form; route by topic/urgency.
// The form is a client component that reads ?topic= via window.location.

import type { Metadata } from 'next';
import { Hero } from '../../../components/site/Bits';
import { CONTACT } from '../../../lib/site-content';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Tell us what needs to hold together. A short guided form routes your ' +
    'request to the right conversation.',
};

export default function Contact() {
  return (
    <main>
      <Hero headline={CONTACT.hero.headline} body={CONTACT.hero.body} />
      <section className="pl-section">
        <ContactForm />
      </section>
    </main>
  );
}
