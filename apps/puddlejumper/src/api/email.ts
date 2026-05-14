// ── Email service (Resend) ────────────────────────────────────────────────────
//
// Sends transactional email via Resend. Requires RESEND_API_KEY Fly secret.
// From address: pj@publiclogic.org
// If RESEND_API_KEY is not set, logs a warning and skips silently.
//

import { Resend } from "resend";

const FROM = "PuddleJumper <pj@publiclogic.org>";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendInviteEmail({
  toEmail,
  inviterName,
  workspaceName,
  role,
  loginUrl,
}: {
  toEmail: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  loginUrl: string;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping invite email to", toEmail);
    return;
  }

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  await client.emails.send({
    from: FROM,
    to: toEmail,
    subject: `You've been invited to ${workspaceName} on PublicLogic`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:40px auto;color:#111;">
  <h2 style="margin-bottom:4px;">You're invited</h2>
  <p style="margin-top:0;color:#555;">${inviterName} has invited you to join <strong>${workspaceName}</strong> as a <strong>${roleLabel}</strong>.</p>
  <p>
    <a href="${loginUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      Accept invitation
    </a>
  </p>
  <p style="color:#777;font-size:13px;">
    Sign in with GitHub, Google, or Microsoft using the email address this was sent to.<br>
    Your access will be granted automatically after login.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#aaa;font-size:12px;">PublicLogic · <a href="https://publiclogic.org" style="color:#aaa;">publiclogic.org</a></p>
</body>
</html>
    `.trim(),
  });
}
