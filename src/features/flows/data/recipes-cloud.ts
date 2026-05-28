import { pjApi } from '@/services/pjApi'
import type { Recipe, Connection } from '../types'

export const recipesCloud: Recipe[] = [
  {
    id: 'vault-approved-github', name: 'Publish approved docs to GitHub',
    trigger: 'Vault doc approved', triggerType: 'vault_approved', action: 'GitHub commit', canRunNow: false,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Repository', placeholder: 'owner/repo', required: true, type: 'repo' as const },
    ],
  },

  {
    id: 'vault-audit-email', name: 'Email Audit Pack on approval',
    trigger: 'Vault doc approved', triggerType: 'vault_approved', action: 'Outlook email', canRunNow: false,
    configFields: [
      { key: 'to', label: 'Compliance email', placeholder: 'compliance@org.com', type: 'email' },
    ],
  },

  {
    id: 'cloud-find-meeting-time', name: 'Find when everyone is actually free',
    trigger: 'You click Go', triggerType: 'manual', action: 'Microsoft Calendar', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'emails', label: 'Add attendees (search to add, comma-separate multiple)', placeholder: 'Search contacts…', required: true, type: 'contacts' as const },
      { key: 'duration', label: 'Meeting length (minutes)', placeholder: '30', type: 'number' as const },
      { key: 'days', label: 'Look ahead (days)', placeholder: '5', type: 'number' as const },
    ],
    run: async (cfg) => {
      const attendees = cfg.emails.split(',').map((e: string) => ({ type: 'required', emailAddress: { address: e.trim() } }))
      const start = new Date(); start.setHours(9, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + parseInt(cfg.days || '5', 10)); end.setHours(17, 0, 0, 0)
      const res = await pjApi.microsoft.post('me/findMeetingTimes', {
        attendees,
        meetingDuration: `PT${cfg.duration || '30'}M`,
        timeConstraint: {
          activityDomain: 'work',
          timeslots: [{ start: { dateTime: start.toISOString(), timeZone: 'UTC' }, end: { dateTime: end.toISOString(), timeZone: 'UTC' } }],
        },
        maxCandidates: 3,
        minimumAttendeePercentage: 100,
      }) as { meetingTimeSuggestions?: { meetingTimeSlot: { start: { dateTime: string }; end: { dateTime: string } }; confidence: number }[] }
      const slots = res.meetingTimeSuggestions ?? []
      if (slots.length === 0) return 'No common free time found in that window — try a longer look-ahead.'
      return slots.map((s, i) => {
        const st = new Date(s.meetingTimeSlot.start.dateTime)
        return `${i + 1}. ${st.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${st.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (${Math.round(s.confidence)}% confidence)`
      }).join('\n')
    },
  },

  {
    id: 'cloud-share-link', name: 'Share a file as a link — not an attachment',
    trigger: 'You click Go', triggerType: 'manual', action: 'OneDrive → email', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'filename', label: 'File name in your OneDrive', placeholder: 'Q4 Report.pdf', required: true, type: 'onedrive-file' as const },
      { key: 'to', label: 'Send link to (email)', placeholder: 'client@example.com', required: true, type: 'email' as const },
      { key: 'permission', label: 'Permission: view or edit', placeholder: 'view' },
    ],
    run: async (cfg) => {
      const search = await pjApi.microsoft.get(`me/drive/root/search(q='${encodeURIComponent(cfg.filename)}')?$top=1`) as { value?: { id: string; name: string; webUrl: string }[] }
      const file = search.value?.[0]
      if (!file) throw new Error(`"${cfg.filename}" not found in your OneDrive`)
      const type = cfg.permission === 'edit' ? 'edit' : 'view'
      const link = await pjApi.microsoft.post(`me/drive/items/${file.id}/createLink`, { type, scope: 'anonymous' }) as { link?: { webUrl: string } }
      const shareUrl = link.link?.webUrl ?? file.webUrl
      await pjApi.microsoft.post('me/sendMail', {
        message: {
          subject: `📎 ${file.name}`,
          body: { contentType: 'HTML', content: `<p>Here's the file you requested:</p><p><a href="${shareUrl}">${file.name}</a></p><p><em>Shared securely via LogicOS. No attachment needed.</em></p>` },
          toRecipients: [{ emailAddress: { address: cfg.to } }],
        },
      })
      return `Link emailed to ${cfg.to} — ${type} access, no attachment needed`
    },
  },

  {
    id: 'cloud-oof', name: 'Turn on out-of-office in one shot',
    trigger: 'You click Go', triggerType: 'manual', action: 'Outlook auto-reply', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'message', label: 'Your message', placeholder: 'I\'m out of office and will reply when I return.', required: true, type: 'textarea' as const },
      { key: 'start', label: 'Start (leave blank for now)', placeholder: '2024-03-01T08:00', type: 'date' as const },
      { key: 'end', label: 'End date/time', placeholder: '2024-03-05T17:00', type: 'date' as const },
    ],
    run: async (cfg) => {
      const body: Record<string, unknown> = {
        automaticRepliesSetting: {
          status: 'scheduled',
          internalReplyMessage: `<html><body>${cfg.message}</body></html>`,
          externalReplyMessage: `<html><body>${cfg.message}</body></html>`,
        },
      }
      if (cfg.start && cfg.end) {
        (body.automaticRepliesSetting as Record<string, unknown>).scheduledStartDateTime = { dateTime: new Date(cfg.start).toISOString(), timeZone: 'UTC' };
        (body.automaticRepliesSetting as Record<string, unknown>).scheduledEndDateTime = { dateTime: new Date(cfg.end).toISOString(), timeZone: 'UTC' }
      } else {
        (body.automaticRepliesSetting as Record<string, unknown>).status = 'alwaysEnabled'
      }
      await pjApi.microsoft.patch('me/mailboxSettings', body)
      return `Out-of-office is on${cfg.end ? ` until ${new Date(cfg.end).toLocaleDateString()}` : ''}`
    },
  },

  {
    id: 'cloud-oof-off', name: 'Turn off out-of-office',
    trigger: 'You click Go', triggerType: 'manual', action: 'Outlook auto-reply', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [],
    run: async () => {
      await pjApi.microsoft.patch('me/mailboxSettings', { automaticRepliesSetting: { status: 'disabled' } })
      return 'Out-of-office is off — you look available again.'
    },
  },

  {
    id: 'cloud-who-has-access', name: 'See who can access your file',
    trigger: 'You click Go', triggerType: 'manual', action: 'OneDrive permissions', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'filename', label: 'File in OneDrive', placeholder: 'Budget 2024.xlsx', required: true, type: 'onedrive-file' as const },
    ],
    run: async (cfg) => {
      const search = await pjApi.microsoft.get(`me/drive/root/search(q='${encodeURIComponent(cfg.filename)}')?$top=1`) as { value?: { id: string; name: string }[] }
      const file = search.value?.[0]
      if (!file) throw new Error(`"${cfg.filename}" not found in your OneDrive`)
      const perms = await pjApi.microsoft.get(`me/drive/items/${file.id}/permissions`) as { value?: { grantedToV2?: { user?: { displayName: string; email: string } }; link?: { type: string; scope: string }; roles: string[] }[] }
      const list = (perms.value ?? []).map(p => {
        if (p.link) return `🔗 Anonymous link (${p.link.type}) — ${p.link.scope}`
        const who = p.grantedToV2?.user
        return who ? `👤 ${who.displayName} <${who.email}> — ${p.roles.join(', ')}` : null
      }).filter(Boolean)
      if (list.length === 0) return `Only you have access to "${file.name}"`
      return `"${file.name}" is accessible by:\n${list.join('\n')}`
    },
  },

  {
    id: 'cloud-revoke-link', name: 'Remove public sharing from a file',
    trigger: 'You click Go', triggerType: 'manual', action: 'OneDrive permissions', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'filename', label: 'File in OneDrive', placeholder: 'Sensitive Document.docx', required: true, type: 'onedrive-file' as const },
    ],
    run: async (cfg) => {
      const search = await pjApi.microsoft.get(`me/drive/root/search(q='${encodeURIComponent(cfg.filename)}')?$top=1`) as { value?: { id: string; name: string }[] }
      const file = search.value?.[0]
      if (!file) throw new Error(`"${cfg.filename}" not found`)
      const perms = await pjApi.microsoft.get(`me/drive/items/${file.id}/permissions`) as { value?: { id: string; link?: { scope: string } }[] }
      const publicPerms = (perms.value ?? []).filter(p => p.link?.scope === 'anonymous')
      if (publicPerms.length === 0) return `"${file.name}" has no public links — you're already good.`
      for (const p of publicPerms) await pjApi.microsoft.delete(`me/drive/items/${file.id}/permissions/${p.id}`)
      return `Removed ${publicPerms.length} public link${publicPerms.length !== 1 ? 's' : ''} from "${file.name}"`
    },
  },

  {
    id: 'cloud-storage', name: 'Check how full your cloud storage is',
    trigger: 'You click Go', triggerType: 'manual', action: 'OneDrive + Google Drive', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [],
    run: async () => {
      const lines: string[] = []
      try {
        const od = await pjApi.microsoft.get('me/drive') as { quota?: { used: number; total: number; remaining: number } }
        if (od.quota) {
          const gb = (n: number) => (n / 1e9).toFixed(1) + ' GB'
          const pct = Math.round(od.quota.used / od.quota.total * 100)
          const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
          lines.push(`OneDrive: ${bar} ${pct}% used (${gb(od.quota.used)} of ${gb(od.quota.total)})`)
        }
      } catch { /* intentional */ }
      try {
        const gd = await pjApi.google.get('drive/v3/about?fields=storageQuota') as { storageQuota?: { usage: string; limit: string } }
        if (gd.storageQuota) {
          const gb = (n: string) => (parseInt(n) / 1e9).toFixed(1) + ' GB'
          const used = parseInt(gd.storageQuota.usage); const total = parseInt(gd.storageQuota.limit)
          const pct = Math.round(used / total * 100)
          const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
          lines.push(`Google Drive: ${bar} ${pct}% used (${gb(gd.storageQuota.usage)} of ${gb(gd.storageQuota.limit)})`)
        }
      } catch { /* intentional */ }
      if (lines.length === 0) throw new Error('Connect Microsoft or Google to check storage.')
      return lines.join('\n')
    },
  },

  {
    id: 'cloud-shared-with-me', name: 'See what was shared with you this week',
    trigger: 'You click Go', triggerType: 'manual', action: 'OneDrive shared items', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [],
    run: async () => {
      const res = await pjApi.microsoft.get('me/drive/sharedWithMe?$top=20') as { value?: { name: string; remoteItem?: { lastModifiedDateTime: string; webUrl: string; shared?: { sharedBy?: { user?: { displayName: string } } } } }[] }
      const week = Date.now() - 7 * 86400000
      const recent = (res.value ?? []).filter(f => {
        const t = new Date(f.remoteItem?.lastModifiedDateTime ?? 0).getTime()
        return t > week
      })
      if (recent.length === 0) return 'Nothing new shared with you in the past 7 days.'
      return recent.map(f => {
        const by = f.remoteItem?.shared?.sharedBy?.user?.displayName ?? 'someone'
        const when = f.remoteItem?.lastModifiedDateTime ? new Date(f.remoteItem.lastModifiedDateTime).toLocaleDateString() : ''
        return `📄 ${f.name} — from ${by} (${when})`
      }).join('\n')
    },
  },

  {
    id: 'cloud-password-breach', name: 'Check if a password has been leaked',
    trigger: 'You click Go', triggerType: 'manual', action: 'HaveIBeenPwned (k-anon)', canRunNow: true,
    configFields: [
      { key: 'password', label: 'Password to check (never sent — only a 5-char hash prefix is transmitted)', placeholder: 'your-password-here', required: true },
    ],
    run: async (cfg) => {
      const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(cfg.password))
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
      const prefix = hex.slice(0, 5); const suffix = hex.slice(5)
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
      if (!res.ok) throw new Error('Could not reach HaveIBeenPwned')
      const text = await res.text()
      const line = text.split('\n').find(l => l.startsWith(suffix))
      const count = line ? parseInt(line.split(':')[1]) : 0
      if (count === 0) return '✅ This password has NOT been seen in any known breach. Looks good.'
      return `🚨 This password has appeared ${count.toLocaleString()} times in known data breaches. Change it now.`
    },
  },

  {
    id: 'cloud-recall-email', name: 'Recall a sent email (Outlook)',
    trigger: 'You click Go', triggerType: 'manual', action: 'Outlook recall', canRunNow: true,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'subject', label: 'Subject of email to recall', placeholder: 'Q4 Budget (wrong version)', required: true },
    ],
    run: async (cfg) => {
      const sent = await pjApi.microsoft.get(`me/mailFolders/SentItems/messages?$filter=startswith(subject,'${encodeURIComponent(cfg.subject)}')&$top=1&$select=id,subject,toRecipients`) as { value?: { id: string; subject: string; toRecipients: { emailAddress: { address: string } }[] }[] }
      const msg = sent.value?.[0]
      if (!msg) throw new Error(`No sent email found with subject containing "${cfg.subject}"`)
      await pjApi.microsoft.post(`me/messages/${msg.id}/recall`, {})
      const to = msg.toRecipients.map(r => r.emailAddress.address).join(', ')
      return `Recall requested for "${msg.subject}" sent to ${to}. Works instantly if recipient hasn't read it yet.`
    },
  },
]
