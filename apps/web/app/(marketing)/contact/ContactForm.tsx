'use client';

// Contact form (Build Sequence step 8). Short guided intake that routes by
// topic + urgency. Reads ?topic= from Solutions/Products into a hidden field.
// Render-only for the website build: submission is a stub (no backend wiring
// in this scope) — it shows a confirmation and preserves the routing fields.

import { useEffect, useState } from 'react';
import { CONTACT } from '../../../lib/site-content';

export default function ContactForm() {
  const [topic, setTopic] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Read the ?topic= routing param client-side (set by Solutions/Products
  // cards). Avoids useSearchParams so no Suspense boundary is required.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('topic');
    if (t) setTopic(t);
  }, []);

  if (submitted) {
    return (
      <p className="pl-note">
        Thanks — we’ll route this to the right conversation and follow up.
      </p>
    );
  }

  return (
    <form
      className="pl-form"
      onSubmit={(e) => {
        e.preventDefault();
        // Render-only scope: no network. A later step wires this to the
        // backend contact intake. The hidden topic field carries routing.
        setSubmitted(true);
      }}
    >
      {/* Hidden routing field from Solutions/Products cards. */}
      <input type="hidden" name="topic" value={topic} />

      <div className="pl-field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
      </div>
      <div className="pl-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div className="pl-field">
        <label htmlFor="org">Organization / Context</label>
        <select id="org" name="org" required defaultValue="">
          <option value="" disabled>Choose one…</option>
          {CONTACT.orgOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <fieldset className="pl-field">
        <label>What needs to hold together?</label>
        <div className="pl-checks">
          {CONTACT.needs.map((n) => (
            <label className="pl-check" key={n}>
              <input type="checkbox" name="needs" value={n} /> {n}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="pl-field">
        <label htmlFor="current">What is currently happening?</label>
        <textarea
          id="current"
          name="current"
          rows={3}
          required
          placeholder="What is active, stuck, scattered, or being carried by one person?"
        />
      </div>
      <div className="pl-field">
        <label htmlFor="next">What needs to happen next?</label>
        <textarea id="next" name="next" rows={2} placeholder="Desired next state or deadline" />
      </div>

      <div className="pl-field">
        <label htmlFor="urgency">Urgency</label>
        <select id="urgency" name="urgency" required defaultValue="">
          <option value="" disabled>Choose one…</option>
          {CONTACT.urgencyOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <div className="pl-field">
        <label htmlFor="start">Preferred starting point</label>
        <select id="start" name="start" defaultValue="">
          <option value="">No preference</option>
          {CONTACT.startingPoints.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="pl-cta pl-cta-primary">Submit</button>
    </form>
  );
}
