/**
 * sendVaultEmail — routes VAULT workflow email through the connected cloud provider.
 *
 * Priority:
 *   1. Microsoft Graph (me/sendMail) — if notificationProvider === 'microsoft'
 *   2. Gmail API (users/me/messages/send) — if notificationProvider === 'google'
 *   3. mailto: fallback — opens native email client
 *
 * Variable substitution supports: {{requesterName}} {{caseNumber}} {{town}}
 * {{deadline}} {{raoName}} {{stage}}
 */

import { pjApi } from '@/services/pjApi'
import type { VaultModuleSettings, WorkflowEmailTemplate } from '../types'

export interface VaultEmailVars {
  requesterName?: string
  caseNumber?: string
  town?: string
  deadline?: string
  raoName?: string
  stage?: string
  [key: string]: string | undefined
}

function interpolate(template: string, vars: VaultEmailVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function resolveToAddress(
  template: WorkflowEmailTemplate,
  settings: VaultModuleSettings,
  requesterEmail?: string,
): string | null {
  switch (template.toRecipient) {
    case 'REQUESTER': return requesterEmail ?? null
    case 'RAO':       return settings.raos?.[0]?.email ?? settings.notificationEmail ?? null
    case 'SUPERVISOR': return settings.escalation?.[0]?.email ?? settings.notificationEmail ?? null
    case 'CUSTOM':    return template.customEmail ?? null
    default:          return null
  }
}

export interface SendVaultEmailOptions {
  template: WorkflowEmailTemplate
  settings: VaultModuleSettings
  vars: VaultEmailVars
  requesterEmail?: string
}

export async function sendVaultEmail({
  template,
  settings,
  vars,
  requesterEmail,
}: SendVaultEmailOptions): Promise<{ sent: boolean; method: string }> {
  if (!settings.emailNotificationsEnabled || !template.enabled) {
    return { sent: false, method: 'disabled' }
  }

  const to = resolveToAddress(template, settings, requesterEmail)
  if (!to) return { sent: false, method: 'no-recipient' }

  const subject = interpolate(template.subject, vars)
  const body    = interpolate(template.body,    vars)
  const provider = settings.notificationProvider ?? 'mailto'

  // ── Microsoft Graph ─────────────────────────────────────────────────────────
  if (provider === 'microsoft') {
    try {
      await pjApi.microsoft.post('me/sendMail', {
        message: {
          subject,
          from: { emailAddress: { address: 'info@publiclogic.org', name: 'PublicLogic' } },
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      })
      return { sent: true, method: 'microsoft' }
    } catch {
      // fall through to mailto
    }
  }

  // ── Gmail ───────────────────────────────────────────────────────────────────
  if (provider === 'google') {
    try {
      // RFC 2822 message encoded as base64url
      const raw = [
        `From: PublicLogic <info@publiclogic.org>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        body,
      ].join('\r\n')
      const encoded = btoa(unescape(encodeURIComponent(raw)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      await pjApi.google.post('gmail/v1/users/me/messages/send', { raw: encoded })
      return { sent: true, method: 'google' }
    } catch {
      // fall through to mailto
    }
  }

  // ── mailto: fallback ────────────────────────────────────────────────────────
  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.open(mailtoUrl)
  return { sent: true, method: 'mailto' }
}

/**
 * Find and send all email templates matching a given trigger.
 * Returns the count of emails attempted.
 */
export async function fireVaultEmailTrigger(
  trigger: WorkflowEmailTemplate['trigger'],
  settings: VaultModuleSettings,
  vars: VaultEmailVars,
  options: { requesterEmail?: string; triggerStage?: string } = {},
): Promise<number> {
  const templates = settings.workflow?.emailTemplates ?? []
  const matching = templates.filter(t => {
    if (!t.enabled) return false
    if (t.trigger !== trigger) return false
    if (trigger === 'STAGE_CHANGE' && options.triggerStage && t.triggerStage) {
      return t.triggerStage === options.triggerStage
    }
    return true
  })

  let count = 0
  for (const tpl of matching) {
    const result = await sendVaultEmail({
      template: tpl,
      settings,
      vars,
      requesterEmail: options.requesterEmail,
    })
    if (result.sent) count++
  }
  return count
}
