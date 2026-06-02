// Contact (Build Sequence step 8). Short guided form; route by topic/urgency.
// The form is a client component that reads ?topic= via window.location.

import { Hero } from '../../../components/site/Bits';
import { CONTACT } from '../../../lib/site-content';
import ContactForm from './ContactForm';

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
