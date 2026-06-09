import { NextResponse } from 'next/server';

// Contact intake for the marketing /start form. Provider-agnostic:
//   - RESEND_API_KEY + CONTACT_TO + CONTACT_FROM  → sends email via Resend
//   - CONTACT_WEBHOOK_URL                          → POSTs JSON (Slack/Zapier/etc.)
//   - neither                                      → logs to the server (dev)
// No SDK dependency; uses fetch against provider HTTP APIs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Payload = {
  Name?: string;
  Organization?: string;
  Email?: string;
  Problem?: string;
  Where?: string;
  Success?: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  let data: Payload;
  try {
    data = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const name = (data.Name ?? '').trim();
  const email = (data.Email ?? '').trim();
  if (!name || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Please include your name and a valid email address.' },
      { status: 422 },
    );
  }

  const subject = `New inquiry — ${name}${data.Organization ? ` (${data.Organization.trim()})` : ''}`;
  const body = [
    `Name: ${name}`,
    `Organization: ${data.Organization?.trim() || '—'}`,
    `Email: ${email}`,
    `Where: ${data.Where?.trim() || '—'}`,
    '',
    'What’s the function or project they’re worried about:',
    data.Problem?.trim() || '—',
    '',
    'What “this is handled” looks like to them:',
    data.Success?.trim() || '—',
  ].join('\n');

  try {
    const RESEND = process.env.RESEND_API_KEY;
    const TO = process.env.CONTACT_TO;
    const FROM = process.env.CONTACT_FROM;
    const HOOK = process.env.CONTACT_WEBHOOK_URL;

    if (RESEND && TO && FROM) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject, text: body }),
      });
      if (!r.ok) throw new Error(`Resend responded ${r.status}`);
    } else if (HOOK) {
      const r = await fetch(HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, ...data }),
      });
      if (!r.ok) throw new Error(`Webhook responded ${r.status}`);
    } else {
      // No provider configured yet — keep the submission in the server log so
      // nothing is lost in dev/preview before email is wired up.
      console.info(`[contact] (no provider configured)\nSubject: ${subject}\n${body}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          'Something went wrong sending your message. Please email nate@publiclogic.org directly.',
      },
      { status: 502 },
    );
  }
}
