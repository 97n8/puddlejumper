'use client';

import { useState, type FormEvent } from 'react';

const field =
  'w-full rounded-md border border-bd bg-s0 px-3 py-2 text-[15px] text-ink placeholder:text-ink4 focus:border-g focus:outline-none focus:ring-1 focus:ring-g-bd';
const label = 'block text-[13px] font-medium text-ink2 mb-1';

type Status = 'idle' | 'sending' | 'ok' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus('ok');
        form.reset();
      } else {
        setStatus('error');
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setError('Network error. Please email nate@publiclogic.org directly.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="max-w-xl rounded-lg border border-g-bd bg-g-lt p-6">
        <p className="font-display text-2xl text-g mb-2">Thank you — we’ve got it.</p>
        <p className="text-[15px] text-ink2 leading-relaxed">
          We read every note ourselves and reply within a couple of business days. If it’s urgent,
          email <span className="font-medium text-ink">nate@publiclogic.org</span> or call
          978-807-0829.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
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

      {status === 'error' && (
        <p className="text-[14px] text-red" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-full bg-g px-6 py-3 text-[14px] font-medium text-white hover:bg-g-mid transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
