import { useState } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { useKV } from '@/hooks/useKV'
import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import type { VaultCase } from '@/features/vault/types'
import { calendarDaysUntil } from '@/features/vault/utils/deadlines'
import { ArrowSquareOut, DownloadSimple, PaperPlaneTilt, Eye, FileHtml, ClockCountdown, EnvelopeOpen, CheckSquare } from '@phosphor-icons/react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedDoc {
  id: string
  title: string
  automationId: string
  createdAt: number
  html: string
  subject: string
}

const FROM_ADDRESS = { address: 'info@publiclogic.org', name: 'PublicLogic' }

// ── Email delivery ────────────────────────────────────────────────────────────

function buildGmailRaw(to: string, subject: string, htmlBody: string): string {
  const boundary = 'LP_BOUNDARY_' + Math.random().toString(36).slice(2)
  const raw = [
    `From: PublicLogic <info@publiclogic.org>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n')
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sendHtmlEmail(to: string, subject: string, htmlBody: string): Promise<'microsoft' | 'google' | 'mailto'> {
  try {
    await pjApi.microsoft.post('me/sendMail', {
      message: {
        subject,
        from: { emailAddress: FROM_ADDRESS },
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    })
    return 'microsoft'
  } catch { /* fall through */ }

  try {
    await pjApi.google.post('gmail/v1/users/me/messages/send', {
      raw: buildGmailRaw(to, subject, htmlBody),
    })
    return 'google'
  } catch { /* fall through */ }

  // Fallback: mailto with stripped text
  const text = htmlBody.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()
  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`)
  return 'mailto'
}

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ── HTML document generators ──────────────────────────────────────────────────

const BRAND = '#4F46E5' // indigo-600
const BRAND_LIGHT = '#EEF2FF'
const WARN = '#D97706'
const DANGER = '#DC2626'
const OK = '#16A34A'

function htmlShell(title: string, town: string, subtitle: string, body: string, docId: string): string {
  const ts = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;color:#1a1a2e;font-size:14px;line-height:1.6}
  .wrap{max-width:680px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}
  .header{background:${BRAND};padding:32px 36px 28px;color:#fff}
  .header-town{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.75;margin-bottom:6px}
  .header-title{font-size:24px;font-weight:700;line-height:1.2;margin-bottom:4px}
  .header-sub{font-size:13px;opacity:.80}
  .stamp{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:14px}
  .content{padding:32px 36px}
  .section{margin-bottom:28px}
  .section-label{font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${BRAND};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${BRAND_LIGHT}}
  .stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
  .stat{flex:1;min-width:120px;background:${BRAND_LIGHT};border-radius:10px;padding:14px 16px;text-align:center}
  .stat-n{font-size:28px;font-weight:800;color:${BRAND};line-height:1}
  .stat-lbl{font-size:11px;color:#6b7280;margin-top:4px;font-weight:600}
  .stat.warn{background:#FEF3C7}.stat.warn .stat-n{color:${WARN}}
  .stat.danger{background:#FEF2F2}.stat.danger .stat-n{color:${DANGER}}
  .stat.ok{background:#F0FDF4}.stat.ok .stat-n{color:${OK}}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f8f9fc;text-align:left;padding:9px 12px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb}
  td{padding:9px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .badge-danger{background:#FEF2F2;color:${DANGER}}
  .badge-warn{background:#FEF3C7;color:${WARN}}
  .badge-ok{background:#F0FDF4;color:${OK}}
  .badge-blue{background:#EFF6FF;color:#2563EB}
  .badge-neutral{background:#F3F4F6;color:#6b7280}
  .cta{text-align:center;margin:24px 0 8px}
  .btn{display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:.02em}
  .footer{background:#f8f9fc;border-top:1px solid #e5e7eb;padding:18px 36px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .footer strong{color:#6b7280}
  blockquote{background:#f8f9fc;border-left:4px solid ${BRAND};padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;color:#374151;margin:0}
  .notice{background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400E;margin-bottom:16px}
  @media(max-width:480px){.content{padding:20px 18px}.header{padding:22px 18px}.stat-n{font-size:22px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-town">Town of ${town}</div>
    <div class="header-title">${title}</div>
    <div class="header-sub">${subtitle}</div>
    <div class="stamp">Generated by Workspace</div>
  </div>
  <div class="content">
    ${body}
  </div>
  <div class="footer">
    <span><strong>Document ID:</strong> LGV-${docId.toUpperCase()}</span>
    <span><strong>Generated:</strong> ${ts}</span>
    <span><strong>Town of ${town}</strong> · Powered by Workspace / PublicLogic</span>
  </div>
</div>
</body>
</html>`
}

// ── Generator: Deadline Briefing ──────────────────────────────────────────────

function genDeadlineBriefing(town: string, cases: VaultCase[], docId: string): { html: string; subject: string } {
  const open = cases.filter(c => c.currentStage !== 'CLOSED')
  const closed = cases.filter(c => c.currentStage === 'CLOSED')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const deadlines = open
    .flatMap(c =>
      Object.values(c.deadlines)
        .filter(d => d.status === 'OPEN' && d.dueDate)
        .map(d => ({ c, d, days: calendarDaysUntil(d.dueDate) }))
    )
    .sort((a, b) => a.days - b.days)

  const overdue = deadlines.filter(x => x.days < 0)
  const dueSoon = deadlines.filter(x => x.days >= 0 && x.days <= 7)
  const upcoming = deadlines.filter(x => x.days > 7 && x.days <= 30)

  const rowBadge = (days: number) => {
    if (days < 0) return `<span class="badge badge-danger">Overdue ${Math.abs(days)}d</span>`
    if (days === 0) return `<span class="badge badge-danger">Due Today</span>`
    if (days <= 3) return `<span class="badge badge-warn">${days}d</span>`
    return `<span class="badge badge-blue">${days}d</span>`
  }

  const deadlineRows = (items: typeof deadlines) => items.slice(0, 10).map(({ c, d, days }) => {
    const subj = Object.values(c.subject).filter(Boolean).slice(0, 1).join('') || c.caseType
    return `<tr>
      <td><strong>${c.caseNumber}</strong></td>
      <td>${subj}</td>
      <td>${d.label}</td>
      <td>${rowBadge(days)}</td>
    </tr>`
  }).join('')

  const statsHtml = `
<div class="section">
  <div class="section-label">Executive Summary — ${today}</div>
  <div class="stat-row">
    <div class="stat"><div class="stat-n">${open.length}</div><div class="stat-lbl">Open Cases</div></div>
    <div class="stat ${overdue.length > 0 ? 'danger' : 'ok'}"><div class="stat-n">${overdue.length}</div><div class="stat-lbl">Overdue</div></div>
    <div class="stat ${dueSoon.length > 0 ? 'warn' : 'ok'}"><div class="stat-n">${dueSoon.length}</div><div class="stat-lbl">Due This Week</div></div>
    <div class="stat ok"><div class="stat-n">${closed.length}</div><div class="stat-lbl">Closed</div></div>
  </div>
</div>`

  const overdueSection = overdue.length > 0 ? `
<div class="section">
  <div class="section-label">⚠ Overdue — Immediate Attention Required</div>
  <div class="notice">The following cases have missed statutory deadlines and require immediate action. Failure to respond may expose the municipality to legal liability under M.G.L. c. 66 §10.</div>
  <table>
    <thead><tr><th>Case #</th><th>Subject</th><th>Deadline</th><th>Status</th></tr></thead>
    <tbody>${deadlineRows(overdue)}</tbody>
  </table>
</div>` : ''

  const soonSection = dueSoon.length > 0 ? `
<div class="section">
  <div class="section-label">Due This Week</div>
  <table>
    <thead><tr><th>Case #</th><th>Subject</th><th>Deadline</th><th>Days Left</th></tr></thead>
    <tbody>${deadlineRows(dueSoon)}</tbody>
  </table>
</div>` : `
<div class="section">
  <div class="section-label">Deadline Status</div>
  <blockquote>✓ No deadlines due this week. All ${open.length} open case${open.length !== 1 ? 's' : ''} are within compliance window.</blockquote>
</div>`

  const upcomingSection = upcoming.length > 0 ? `
<div class="section">
  <div class="section-label">Upcoming (Next 30 Days)</div>
  <table>
    <thead><tr><th>Case #</th><th>Subject</th><th>Deadline</th><th>Days Left</th></tr></thead>
    <tbody>${deadlineRows(upcoming)}</tbody>
  </table>
</div>` : ''

  const ctaSection = `
<div class="cta">
  <a class="btn" href="https://os.publiclogic.org">Open Workspace → Take Action</a>
</div>`

  const body = statsHtml + overdueSection + soonSection + upcomingSection + ctaSection

  return {
    subject: `${town} — Deadline Briefing · ${today}`,
    html: htmlShell(
      'Deadline Briefing',
      town,
      `Daily compliance overview for the Town Administrator — ${today}`,
      body,
      docId,
    ),
  }
}

// ── Generator: Intake Acknowledgment ─────────────────────────────────────────

function genIntakeAck(town: string, cases: VaultCase[], docId: string): { html: string; subject: string } {
  const sample = cases.find(c => c.moduleId === 'VAULTPRR') ?? cases[0]
  const caseNum = sample?.caseNumber ?? 'LGV-PRR-2026-001'
  const subj = Object.values(sample?.subject ?? {}).filter(Boolean)
  const name = subj[0] ?? 'Valued Resident'
  const address = subj[1] ?? '1 Town Common, Logicville, MA 01600'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const deadline = new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const body = `
<div class="section">
  <div class="section-label">Case Confirmation</div>
  <div class="stat-row">
    <div class="stat"><div class="stat-n" style="font-size:18px">${caseNum}</div><div class="stat-lbl">Case Number</div></div>
    <div class="stat ok"><div class="stat-n" style="font-size:18px">10</div><div class="stat-lbl">Business Days to Respond</div></div>
    <div class="stat warn"><div class="stat-n" style="font-size:16px">${deadline.split(',')[0]}</div><div class="stat-lbl">Response Deadline</div></div>
  </div>
</div>

<div class="section">
  <div class="section-label">Your Request</div>
  <table>
    <tbody>
      <tr><td style="width:140px;font-weight:700;color:#6b7280">Requestor</td><td>${name}</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Address</td><td>${address}</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Case Number</td><td>${caseNum}</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Received</td><td>${today}</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Module</td><td>${sample?.moduleId ?? 'VAULTPRR'} — Public Records</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Legal Basis</td><td>M.G.L. c. 66, §10 — Massachusetts Public Records Law</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Response Deadline</td><td><strong>${deadline}</strong> (10 business days)</td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-label">What Happens Next</div>
  <blockquote>
    Our office will review your request and respond within <strong>10 business days</strong> as required by M.G.L. c. 66, §10.
    If additional time is needed, you will receive written notice with the reason for any delay.
    You may track the status of your case at any time using your case number above.
  </blockquote>
</div>

<div class="section">
  <div class="section-label">Contact Information</div>
  <table>
    <tbody>
      <tr><td style="width:140px;font-weight:700;color:#6b7280">Records Officer</td><td>Robert A. Sinclair, Records Access Officer</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Email</td><td>rsinclair@logicvillema.gov</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Phone</td><td>(978) 555-0101</td></tr>
      <tr><td style="font-weight:700;color:#6b7280">Address</td><td>1 Logicville Common, Logicville, MA 01600</td></tr>
    </tbody>
  </table>
</div>

<div class="cta">
  <a class="btn" href="https://os.publiclogic.org/track?c=${caseNum}">Track Your Case → ${caseNum}</a>
</div>`

  return {
    subject: `Request Received — Case ${caseNum} · Town of ${town}`,
    html: htmlShell(
      'Public Records Request — Acknowledgment',
      town,
      `Case ${caseNum} received ${today}`,
      body,
      docId,
    ),
  }
}

// ── Generator: Approval Digest ────────────────────────────────────────────────

function genApprovalDigest(town: string, cases: VaultCase[], docId: string): { html: string; subject: string } {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const pending = cases.filter(c => ['REVIEW', 'RESPONSE', 'APPROVAL'].includes(c.currentStage))
  const open = cases.filter(c => c.currentStage !== 'CLOSED')

  const stageBadge = (stage: string) => {
    if (stage === 'APPROVAL') return `<span class="badge badge-warn">Approval</span>`
    if (stage === 'REVIEW') return `<span class="badge badge-blue">Review</span>`
    return `<span class="badge badge-neutral">${stage}</span>`
  }

  const urgencyBadge = (days: number | null) => {
    if (days === null) return ''
    if (days < 0) return `<span class="badge badge-danger">Overdue ${Math.abs(days)}d</span>`
    if (days <= 3) return `<span class="badge badge-warn">${days}d left</span>`
    if (days <= 7) return `<span class="badge badge-blue">${days}d left</span>`
    return `<span class="badge badge-neutral">${days}d</span>`
  }

  const pendingRows = pending.slice(0, 10).map(c => {
    const subj = Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseType
    const dl = Object.values(c.deadlines)
      .filter(d => d.status === 'OPEN' && d.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    const days = dl ? calendarDaysUntil(dl.dueDate) : null
    return `<tr>
      <td><strong>${c.caseNumber}</strong></td>
      <td>${subj}</td>
      <td>${stageBadge(c.currentStage)}</td>
      <td>${urgencyBadge(days)}</td>
    </tr>`
  }).join('')

  const summaryHtml = `
<div class="section">
  <div class="section-label">Approval Queue — ${today}</div>
  <div class="stat-row">
    <div class="stat ${pending.length > 0 ? 'warn' : 'ok'}"><div class="stat-n">${pending.length}</div><div class="stat-lbl">Awaiting Action</div></div>
    <div class="stat"><div class="stat-n">${pending.filter(c => c.currentStage === 'APPROVAL').length}</div><div class="stat-lbl">Need Signature</div></div>
    <div class="stat"><div class="stat-n">${pending.filter(c => c.currentStage === 'REVIEW').length}</div><div class="stat-lbl">In Review</div></div>
    <div class="stat ok"><div class="stat-n">${open.length - pending.length}</div><div class="stat-lbl">In Progress</div></div>
  </div>
</div>`

  const queueHtml = pending.length > 0 ? `
<div class="section">
  <div class="section-label">Cases Awaiting Your Action</div>
  <table>
    <thead><tr><th>Case #</th><th>Subject</th><th>Stage</th><th>Deadline</th></tr></thead>
    <tbody>${pendingRows}</tbody>
  </table>
  ${pending.length > 10 ? `<p style="margin-top:10px;font-size:12px;color:#6b7280">…and ${pending.length - 10} more cases in queue.</p>` : ''}
</div>` : `
<div class="section">
  <div class="section-label">Queue Status</div>
  <blockquote>✓ Approval queue is clear. No cases are pending review or signature.</blockquote>
</div>`

  const ctaSection = `
<div class="cta">
  <a class="btn" href="https://os.publiclogic.org">Open Workspace → Review & Sign Off</a>
</div>
<p style="text-align:center;margin-top:12px;font-size:12px;color:#9ca3af">This digest is sent daily at 8:00 AM and whenever queue depth changes.</p>`

  const body = summaryHtml + queueHtml + ctaSection

  return {
    subject: `${town} — ${pending.length} case${pending.length !== 1 ? 's' : ''} awaiting approval · ${today}`,
    html: htmlShell(
      'Approval Queue Digest',
      town,
      `Daily sign-off briefing for decision-makers — ${today}`,
      body,
      docId,
    ),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  envId: string
  town: string
}

interface AutomationDef {
  id: string
  icon: React.ReactNode
  name: string
  trigger: string
  description: string
  accentClass: string
  badgeClass: string
  generate: (docId: string) => { html: string; subject: string }
}

export function MunicipalAutomationsPanel({ envId, town }: Props) {
  const { user } = useAuth()
  const [allCases] = useKV<VaultCase[]>(`vault-cases-${envId}`, [])
  const [savedDocs, setSavedDocs] = useKV<SavedDoc[]>(`municipal-docs-${envId}`, [])
  const [busy, setBusy] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [sent, setSent] = useState<Record<string, string>>({})

  const email = user?.email ?? null
  const displayEmail = email ?? 'your@email.com'
  const cases = allCases ?? []
  const docs = savedDocs ?? []

  // ── Automation definitions ───────────────────────────────────────────────

  const automations: AutomationDef[] = [
    {
      id: 'deadline-briefing',
      icon: <ClockCountdown size={20} weight="duotone" />,
      name: 'Deadline Briefing Report',
      trigger: 'Daily · 7:45 AM Mon–Fri',
      description: `Generates a full compliance report across every open case — stat cards, overdue flags, upcoming deadlines, and legal exposure notes. Delivered as a formatted HTML document to the Town Administrator's inbox.`,
      accentClass: 'border-amber-500/30 bg-amber-500/5',
      badgeClass: 'text-amber-500 bg-amber-500/10',
      generate: (docId) => genDeadlineBriefing(town, cases, docId),
    },
    {
      id: 'intake-ack',
      icon: <EnvelopeOpen size={20} weight="duotone" />,
      name: 'Statutory Intake Acknowledgment',
      trigger: 'Instant · on every new case filed',
      description: `The moment a request is submitted, Workspace fires a statute-compliant acknowledgment to the resident — case number, legal response deadline, case tracker link, and Records Officer contact. No staff touches required.`,
      accentClass: 'border-blue-500/30 bg-blue-500/5',
      badgeClass: 'text-blue-500 bg-blue-500/10',
      generate: (docId) => genIntakeAck(town, cases, docId),
    },
    {
      id: 'approval-digest',
      icon: <CheckSquare size={20} weight="duotone" />,
      name: 'Approval Queue Digest',
      trigger: 'Daily · 8:00 AM + on queue change',
      description: `Consolidates every case sitting in REVIEW or APPROVAL into one rich document sent to decision-makers. Cases are sorted by urgency, with deadline countdown badges and a direct link to act in Workspace.`,
      accentClass: 'border-emerald-500/30 bg-emerald-500/5',
      badgeClass: 'text-emerald-500 bg-emerald-500/10',
      generate: (docId) => genApprovalDigest(town, cases, docId),
    },
  ]

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePreview = (a: AutomationDef) => {
    const docId = uid()
    const { html } = a.generate(docId)
    setPreviewHtml(html)
    setPreviewing(a.id)
  }

  const handleSendAndSave = async (a: AutomationDef) => {
    const docId = uid()
    const { html, subject } = a.generate(docId)

    // Save doc
    const doc: SavedDoc = { id: docId, title: `${a.name} · ${new Date().toLocaleDateString()}`, automationId: a.id, createdAt: Date.now(), html, subject }
    setSavedDocs(prev => [doc, ...(prev ?? []).slice(0, 19)])

    if (!email) {
      // No email — just save and download
      downloadHtml(`${a.id}-${docId}.html`, html)
      toast.success('Document saved and downloaded (no email connected)')
      setSent(prev => ({ ...prev, [a.id]: 'saved' }))
      return
    }

    setBusy(a.id)
    try {
      const method = await sendHtmlEmail(email, subject, html)
      setSent(prev => ({ ...prev, [a.id]: method }))
      const label = method === 'mailto' ? 'opened in email client' : `sent via ${method === 'microsoft' ? 'Outlook (M365)' : 'Gmail'}`
      toast.success(`HTML report ${label} → ${email}`)
    } catch {
      toast.error('Email failed — document saved locally.')
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = (a: AutomationDef) => {
    const docId = uid()
    const { html } = a.generate(docId)
    downloadHtml(`${a.id}-${new Date().toISOString().slice(0, 10)}.html`, html)
    toast.success('Report downloaded as HTML file')
  }

  // ── Preview overlay ───────────────────────────────────────────────────────

  if (previewing) {
    const a = automations.find(x => x.id === previewing)!
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        {/* Preview toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0 flex-wrap gap-y-2">
          <button
            onClick={() => setPreviewing(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Automations
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-semibold text-foreground">{a.name} — Document Preview</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleDownload(a)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <DownloadSimple size={13} />
              Download HTML
            </button>
            <button
              onClick={async () => { await handleSendAndSave(a); setPreviewing(null) }}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40 transition-colors"
            >
              <PaperPlaneTilt size={13} />
              {busy ? 'Sending…' : `Send to ${displayEmail}`}
            </button>
          </div>
        </div>
        {/* iFrame preview */}
        <div className="flex-1 min-h-0 bg-zinc-200 p-4">
          <iframe
            srcDoc={previewHtml}
            title="Document Preview"
            className="w-full h-full rounded-xl shadow-xl border-0 bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    )
  }

  // ── Main panel ────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-1">SYNCHRON8 · Document Automations</div>
          <h2 className="text-xl font-bold text-foreground">Municipal automations — real HTML documents, live data</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Each automation generates a full HTML document from live Logicville case data.
            Preview it, send it to <strong className="text-foreground">{displayEmail}</strong>, or download it.
            Documents auto-save to your workspace.
          </p>
        </div>

        {/* Automation cards */}
        {automations.map(a => (
          <div key={a.id} className={`rounded-2xl border p-5 ${a.accentClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex-shrink-0 ${a.badgeClass} p-2 rounded-xl`}>{a.icon}</div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{a.name}</div>
                  <div className={`mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block ${a.badgeClass}`}>
                    {a.trigger}
                  </div>
                </div>
              </div>
              {sent[a.id] && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide sm:text-right">
                  ✓ {sent[a.id] === 'saved' ? 'Saved' : sent[a.id] === 'mailto' ? 'Opened' : `Sent via ${sent[a.id] === 'microsoft' ? 'Outlook' : 'Gmail'}`}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-4">{a.description}</p>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handlePreview(a)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border/60 bg-background/80 hover:bg-muted transition-colors font-medium"
              >
                <Eye size={13} />
                Preview document
              </button>
              <button
                onClick={() => handleDownload(a)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border/60 bg-background/80 hover:bg-muted transition-colors font-medium"
              >
                <DownloadSimple size={13} />
                Download HTML
              </button>
              <button
                onClick={() => handleSendAndSave(a)}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors ml-auto"
              >
                <PaperPlaneTilt size={13} />
                {busy === a.id ? 'Sending…' : `Send & Save → ${displayEmail.split('@')[0]}`}
              </button>
            </div>
          </div>
        ))}

        {/* Saved docs */}
        {docs.length > 0 && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-3">Saved in this Workspace</div>
            <div className="space-y-2">
              {docs.slice(0, 8).map(doc => (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <FileHtml size={16} className="text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{doc.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleString()} · ID: LGV-{doc.id.toUpperCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setPreviewHtml(doc.html); setPreviewing(doc.automationId) }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Preview"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => downloadHtml(`${doc.id}.html`, doc.html)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <DownloadSimple size={13} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!email) { toast.error('No email connected'); return }
                        setBusy(doc.id)
                        try {
                          const method = await sendHtmlEmail(email, doc.subject, doc.html)
                          toast.success(`Re-sent via ${method === 'microsoft' ? 'Outlook' : method === 'google' ? 'Gmail' : 'email client'} → ${email}`)
                        } catch { toast.error('Could not send email.') } finally { setBusy(null) }
                      }}
                      disabled={busy !== null}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title="Re-send"
                    >
                      <ArrowSquareOut size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coming soon */}
        <div className="rounded-xl border border-dashed border-border py-5 px-6 text-center">
          <div className="text-sm text-muted-foreground">
            Coming: payment receipts, agenda packets, GIS event reports, cross-system sync digests, and Payments integration.
          </div>
        </div>

      </div>
    </div>
  )
}
