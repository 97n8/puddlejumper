/**
 * notifyEnvironmentCreated — silently sends an HTML confirmation email when a
 * new CaseSpace is created.  Priority: Microsoft Graph → Gmail.
 * No mailto fallback — automated notifications should not pop a browser window.
 */

import { pjApi } from '@/services/pjApi'

export interface EnvironmentCreatedPayload {
  envName: string
  envId: string
  moduleIds?: string[]
  userEmail?: string | null
  userName?: string | null
}

const MODULE_LABELS: Record<string, string> = {
  VAULTPRR:     'Public Records Requests',
  VAULTCLERK:   'Clerk Operations',
  VAULTMEET:    'Board Meetings',
  VAULTFISCAL:  'Fiscal Operations',
  VAULTTIME:    'Time & Attendance',
  VAULTFIX:     'Facilities & Fixes',
  VAULTONBOARD: 'Onboarding',
  VAULTPERMIT:  'Permitting',
  VAULTHR:      'HR',
  VAULTPROCURE: 'Procurement',
  VAULTRECS:    'Records Management',
}

const FROM = { address: 'info@publiclogic.org', name: 'LogicOS' }

function buildHtml(payload: Required<Pick<EnvironmentCreatedPayload, 'envName' | 'envId' | 'moduleIds' | 'userName'>>): string {
  const { envName, envId, moduleIds, userName } = payload
  const greeting = userName ? `Hi ${userName.split(' ')[0]},` : 'Hi,'
  const url = `https://os.publiclogic.org/casespaces/${envId}`
  const moduleItems = moduleIds.length > 0
    ? moduleIds.map(id => `<li style="margin:4px 0;">${MODULE_LABELS[id] ?? id}</li>`).join('')
    : '<li style="color:#888;">No modules selected — add from environment settings</li>'

  return `
<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;">
    <span style="font-size:13px;font-weight:600;letter-spacing:.05em;color:#6b7280;text-transform:uppercase;">LogicOS</span>
  </div>
  <p style="margin:0 0 8px;">${greeting}</p>
  <p style="margin:0 0 20px;">Your environment <strong>${envName}</strong> is ready.</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Active Modules</p>
    <ul style="margin:0;padding-left:20px;font-size:14px;">${moduleItems}</ul>
  </div>
  <a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">Open ${envName} →</a>
  <p style="margin:32px 0 0;font-size:12px;color:#9ca3af;">— LogicOS · <a href="https://os.publiclogic.org" style="color:#9ca3af;">os.publiclogic.org</a></p>
</body></html>`
}

function buildGmailRaw(to: string, subject: string, html: string): string {
  const boundary = 'LOS_' + Math.random().toString(36).slice(2)
  const raw = [
    `From: ${FROM.name} <${FROM.address}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n')
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function notifyEnvironmentCreated(payload: EnvironmentCreatedPayload): Promise<void> {
  const { envName, envId, moduleIds = [], userEmail, userName } = payload
  if (!userEmail) return

  const subject = `"${envName}" is ready — LogicOS`
  const html = buildHtml({ envName, envId, moduleIds, userName: userName ?? '' })

  // Try Microsoft Graph first
  try {
    await pjApi.microsoft.post('me/sendMail', {
      message: {
        subject,
        from: { emailAddress: FROM },
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: userEmail } }],
      },
      saveToSentItems: false,
    })
    return
  } catch { /* fall through */ }

  // Try Gmail
  try {
    await pjApi.google.post('gmail/v1/users/me/messages/send', {
      raw: buildGmailRaw(userEmail, subject, html),
    })
  } catch { /* silent — user may not have email connected */ }
}
