import { useState } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash, Eye, DownloadSimple, PaperPlaneTilt,
  DotsSixVertical, ToggleLeft, TextT, NumberSquareOne, CalendarBlank,
  ListBullets, CheckSquare, File, Pen, CaretDown, CaretUp,
} from '@phosphor-icons/react'

// ── Field types ───────────────────────────────────────────────────────────────

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'file' | 'signature'

interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: string[]
  hint?: string
}

interface FormTemplate {
  id: string
  name: string
  moduleId: string
  moduleBadge: string
  badgeColor: string
  description: string
  legalNote?: string
  fields: FormField[]
}

// ── Pre-built Logicville templates ────────────────────────────────────────────

const TEMPLATES: FormTemplate[] = [
  {
    id: 'prr-intake',
    name: 'Public Records Request',
    moduleId: 'VAULTPRR',
    moduleBadge: 'VAULTPRR',
    badgeColor: '#4F46E5',
    description: 'M.G.L. c. 66 §10 compliant intake form for all public records requests. Captures requestor info, record description, format preference, and consent.',
    legalNote: 'Pursuant to M.G.L. c. 66, §10, the Town of Logicville will respond within 10 business days of receipt.',
    fields: [
      { id: 'f1', label: 'Full Name', type: 'text', required: true, placeholder: 'Jane Smith' },
      { id: 'f2', label: 'Email Address', type: 'text', required: true, placeholder: 'jane@example.com' },
      { id: 'f3', label: 'Mailing Address', type: 'text', required: false, placeholder: '123 Main St, Logicville, MA 01600' },
      { id: 'f4', label: 'Phone Number', type: 'text', required: false, placeholder: '(978) 555-0100' },
      { id: 'f5', label: 'Description of Records Requested', type: 'textarea', required: true, placeholder: 'Describe the records you are requesting in as much detail as possible…', hint: 'Be as specific as possible to help us locate the records quickly.' },
      { id: 'f6', label: 'Date Range (if applicable)', type: 'text', required: false, placeholder: 'e.g. Jan 2024 – Dec 2024' },
      { id: 'f7', label: 'Preferred Format', type: 'select', required: true, options: ['Electronic (PDF)', 'Electronic (Excel/CSV)', 'Paper copy', 'Inspection only'] },
      { id: 'f8', label: 'Fee Waiver Requested?', type: 'select', required: false, options: ['No', 'Yes — I am a journalist', 'Yes — nonprofit/public interest', 'Yes — other reason'] },
      { id: 'f9', label: 'Waiver Reason (if applicable)', type: 'textarea', required: false, placeholder: 'Explain your basis for requesting a fee waiver…' },
      { id: 'f10', label: 'I certify that the information provided is accurate', type: 'checkbox', required: true },
    ],
  },
  {
    id: 'permit-app',
    name: 'Building Permit Application',
    moduleId: 'VAULTPERMIT',
    moduleBadge: 'VAULTPERMIT',
    badgeColor: '#D97706',
    description: 'Residential and commercial building permit application covering project scope, contractor info, and compliance attestation.',
    legalNote: 'This application is subject to review under 780 CMR (Massachusetts State Building Code). Incomplete applications will not be processed.',
    fields: [
      { id: 'f1', label: 'Property Address', type: 'text', required: true, placeholder: '45 Oak Street, Logicville, MA 01600' },
      { id: 'f2', label: 'Parcel ID / Map-Lot', type: 'text', required: false, placeholder: '12-045-001' },
      { id: 'f3', label: 'Owner Name', type: 'text', required: true, placeholder: 'Robert A. Sinclair' },
      { id: 'f4', label: 'Owner Phone', type: 'text', required: true, placeholder: '(978) 555-0101' },
      { id: 'f5', label: 'Owner Email', type: 'text', required: true, placeholder: 'owner@example.com' },
      { id: 'f6', label: 'Contractor Name & License #', type: 'text', required: false, placeholder: 'ABC Construction · MA-CS-12345' },
      { id: 'f7', label: 'Type of Work', type: 'select', required: true, options: ['New Construction', 'Addition', 'Renovation / Alteration', 'Demolition', 'Foundation Only', 'Roofing', 'Other'] },
      { id: 'f8', label: 'Project Description', type: 'textarea', required: true, placeholder: 'Describe the proposed work in detail…' },
      { id: 'f9', label: 'Estimated Cost of Construction ($)', type: 'number', required: true, placeholder: '50000' },
      { id: 'f10', label: 'Estimated Start Date', type: 'date', required: false },
      { id: 'f11', label: 'Estimated Completion Date', type: 'date', required: false },
      { id: 'f12', label: 'I certify all information is accurate and work will comply with applicable codes', type: 'checkbox', required: true },
    ],
  },
  {
    id: 'onboard-intake',
    name: 'New Employee Onboarding',
    moduleId: 'VAULTONBOARD',
    moduleBadge: 'VAULTONBOARD',
    badgeColor: '#16A34A',
    description: 'HR onboarding intake for all new municipal hires. Captures personal info, direct deposit, emergency contacts, and policy acknowledgments.',
    fields: [
      { id: 'f1', label: 'Legal Name (Last, First, Middle)', type: 'text', required: true, placeholder: 'Sinclair, Robert Allen' },
      { id: 'f2', label: 'Preferred Name', type: 'text', required: false, placeholder: 'Rob' },
      { id: 'f3', label: 'Date of Birth', type: 'date', required: true },
      { id: 'f4', label: 'Personal Email', type: 'text', required: true, placeholder: 'rob.sinclair@gmail.com' },
      { id: 'f5', label: 'Personal Phone', type: 'text', required: true, placeholder: '(978) 555-0101' },
      { id: 'f6', label: 'Home Address', type: 'textarea', required: true, placeholder: '12 Elm Street\nLogicville, MA 01600' },
      { id: 'f7', label: 'Department', type: 'select', required: true, options: ['Town Administration', 'Finance', 'DPW', 'Police', 'Fire', 'Building / Inspectional', 'Library', 'Recreation', 'Other'] },
      { id: 'f8', label: 'Position Title', type: 'text', required: true, placeholder: 'Administrative Assistant' },
      { id: 'f9', label: 'Start Date', type: 'date', required: true },
      { id: 'f10', label: 'Direct Deposit Bank Name', type: 'text', required: false, placeholder: 'First National Bank' },
      { id: 'f11', label: 'Emergency Contact Name', type: 'text', required: true, placeholder: 'Mary Sinclair' },
      { id: 'f12', label: 'Emergency Contact Phone', type: 'text', required: true, placeholder: '(978) 555-0199' },
      { id: 'f13', label: 'I have read and accept the Town Employee Handbook', type: 'checkbox', required: true },
      { id: 'f14', label: 'I consent to background check processing', type: 'checkbox', required: true },
    ],
  },
  {
    id: 'vendor-reg',
    name: 'Vendor / Procurement Registration',
    moduleId: 'VAULTPROCURE',
    moduleBadge: 'VAULTPROCURE',
    badgeColor: '#7C3AED',
    description: 'Supplier registration for municipal procurement. Captures business info, NIGP commodity codes, certifications, and insurance attestation.',
    legalNote: 'Registration does not guarantee contract award. All procurement is subject to M.G.L. c. 30B.',
    fields: [
      { id: 'f1', label: 'Business / Company Name', type: 'text', required: true, placeholder: 'Acme Municipal Services LLC' },
      { id: 'f2', label: 'Federal EIN / Tax ID', type: 'text', required: true, placeholder: '12-3456789' },
      { id: 'f3', label: 'Business Address', type: 'textarea', required: true, placeholder: '55 Commerce Way\nWorcester, MA 01602' },
      { id: 'f4', label: 'Primary Contact Name', type: 'text', required: true, placeholder: 'Sarah Torres' },
      { id: 'f5', label: 'Contact Email', type: 'text', required: true, placeholder: 'storres@acmemunicipal.com' },
      { id: 'f6', label: 'Contact Phone', type: 'text', required: true, placeholder: '(508) 555-0200' },
      { id: 'f7', label: 'Service Categories', type: 'multiselect', required: true, options: ['Road / Infrastructure', 'Landscaping', 'IT Services', 'Legal', 'Engineering', 'Janitorial', 'Fleet Maintenance', 'Construction', 'Other'] },
      { id: 'f8', label: 'Certifications (check all that apply)', type: 'multiselect', required: false, options: ['MBE (Minority-owned)', 'WBE (Women-owned)', 'VBE (Veteran-owned)', 'SBE (Small Business)', 'DBE (Disadvantaged)'] },
      { id: 'f9', label: 'Current Certificate of Insurance on file?', type: 'select', required: true, options: ['Yes — I will upload below', 'No — I will provide separately'] },
      { id: 'f10', label: 'Upload Certificate of Insurance', type: 'file', required: false },
      { id: 'f11', label: 'I certify all information is true and accurate', type: 'checkbox', required: true },
    ],
  },
  {
    id: 'property-request',
    name: 'Property Maintenance Request',
    moduleId: 'VAULTFIX',
    moduleBadge: 'VAULTFIX',
    badgeColor: '#DC2626',
    description: 'Public-facing work order intake for infrastructure and property issues — potholes, streetlights, parks, municipal buildings.',
    fields: [
      { id: 'f1', label: 'Your Name', type: 'text', required: false, placeholder: 'Jane Smith (optional)' },
      { id: 'f2', label: 'Your Email (for status updates)', type: 'text', required: false, placeholder: 'jane@example.com' },
      { id: 'f3', label: 'Location / Address of Issue', type: 'text', required: true, placeholder: '78 Elm Street or intersection of Oak & Main' },
      { id: 'f4', label: 'Issue Category', type: 'select', required: true, options: ['Pothole / Road Damage', 'Streetlight Out', 'Sidewalk Damage', 'Sign Damaged / Missing', 'Tree / Debris', 'Park / Recreation Area', 'Municipal Building', 'Drainage / Flooding', 'Other'] },
      { id: 'f5', label: 'Description', type: 'textarea', required: true, placeholder: 'Please describe the issue in detail, including any safety hazards…' },
      { id: 'f6', label: 'How long has the issue existed?', type: 'select', required: false, options: ['Just noticed', 'A few days', '1–2 weeks', 'More than a month'] },
      { id: 'f7', label: 'Photo (optional)', type: 'file', required: false },
    ],
  },
  {
    id: 'meeting-request',
    name: 'Meeting Room / Facility Request',
    moduleId: 'VAULTMEET',
    moduleBadge: 'VAULTMEET',
    badgeColor: '#0891B2',
    description: 'Reserve town hall meeting rooms, council chambers, or community facilities for public and private events.',
    fields: [
      { id: 'f1', label: 'Organization / Group Name', type: 'text', required: true, placeholder: 'Logicville Garden Club' },
      { id: 'f2', label: 'Contact Name', type: 'text', required: true, placeholder: 'Patricia Wells' },
      { id: 'f3', label: 'Contact Email', type: 'text', required: true, placeholder: 'pwells@example.com' },
      { id: 'f4', label: 'Contact Phone', type: 'text', required: true, placeholder: '(978) 555-0150' },
      { id: 'f5', label: 'Requested Space', type: 'select', required: true, options: ['Council Chambers (seats 60)', 'Room 101 — Small Conference (seats 12)', 'Room 205 — Large Conference (seats 30)', 'Community Room (seats 80)', 'Senior Center Hall (seats 120)', 'Outdoor Pavilion'] },
      { id: 'f6', label: 'Event Date', type: 'date', required: true },
      { id: 'f7', label: 'Start Time', type: 'text', required: true, placeholder: '6:30 PM' },
      { id: 'f8', label: 'End Time', type: 'text', required: true, placeholder: '9:00 PM' },
      { id: 'f9', label: 'Expected Attendance', type: 'number', required: true, placeholder: '25' },
      { id: 'f10', label: 'Purpose of Event', type: 'textarea', required: true, placeholder: 'Describe the nature of your event…' },
      { id: 'f11', label: 'Equipment Needed', type: 'multiselect', required: false, options: ['Projector / Screen', 'Microphone', 'Tables', 'Chairs', 'Whiteboard', 'Video conferencing', 'Podium'] },
      { id: 'f12', label: 'I agree to the Town Facility Use Policy', type: 'checkbox', required: true },
    ],
  },
]

// ── HTML form generator ───────────────────────────────────────────────────────

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  text: <TextT size={12} />,
  textarea: <TextT size={12} />,
  number: <NumberSquareOne size={12} />,
  date: <CalendarBlank size={12} />,
  select: <ListBullets size={12} />,
  multiselect: <ListBullets size={12} />,
  checkbox: <CheckSquare size={12} />,
  file: <File size={12} />,
  signature: <Pen size={12} />,
}

function generateFormHtml(template: FormTemplate, town: string, docId: string): string {
  const ts = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const renderField = (f: FormField): string => {
    const req = f.required ? '<span style="color:#DC2626;margin-left:3px">*</span>' : ''
    const hint = f.hint ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">${f.hint}</div>` : ''
    const labelHtml = `<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px">${f.label}${req}</label>${hint}`

    const inputStyle = 'width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-size:13px;color:#111827;background:#fff;box-sizing:border-box;font-family:inherit'

    if (f.type === 'textarea') {
      return `<div style="margin-bottom:18px">${labelHtml}<textarea placeholder="${f.placeholder ?? ''}" rows="4" style="${inputStyle};resize:vertical"></textarea></div>`
    }
    if (f.type === 'select') {
      const opts = (f.options ?? []).map(o => `<option>${o}</option>`).join('')
      return `<div style="margin-bottom:18px">${labelHtml}<select style="${inputStyle}">${opts}</select></div>`
    }
    if (f.type === 'multiselect') {
      const opts = (f.options ?? []).map(o =>
        `<label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:13px;cursor:pointer"><input type="checkbox" style="width:14px;height:14px"> ${o}</label>`
      ).join('')
      return `<div style="margin-bottom:18px">${labelHtml}<div style="padding:10px 12px;border:1.5px solid #d1d5db;border-radius:7px;background:#fff">${opts}</div></div>`
    }
    if (f.type === 'checkbox') {
      return `<div style="margin-bottom:18px"><label style="display:flex;align-items:flex-start;gap:10px;font-size:13px;cursor:pointer"><input type="checkbox" style="width:16px;height:16px;margin-top:1px;flex-shrink:0"> <span>${f.label}${f.required ? '<span style="color:#DC2626;margin-left:3px">*</span>' : ''}</span></label></div>`
    }
    if (f.type === 'file') {
      return `<div style="margin-bottom:18px">${labelHtml}<input type="file" style="display:block;font-size:13px;color:#374151"></div>`
    }
    if (f.type === 'date') {
      return `<div style="margin-bottom:18px">${labelHtml}<input type="date" style="${inputStyle}"></div>`
    }
    if (f.type === 'number') {
      return `<div style="margin-bottom:18px">${labelHtml}<input type="number" placeholder="${f.placeholder ?? ''}" style="${inputStyle}"></div>`
    }
    // text / signature default
    return `<div style="margin-bottom:18px">${labelHtml}<input type="text" placeholder="${f.placeholder ?? ''}" style="${inputStyle}"></div>`
  }

  const fieldsHtml = template.fields.map(renderField).join('')
  const legalHtml = template.legalNote
    ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:12px;color:#92400E;line-height:1.5">${template.legalNote}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${template.name} — Town of ${town}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;color:#111827">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">

  <!-- Header -->
  <div style="background:${template.badgeColor};padding:28px 32px 24px;color:#fff">
    <div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.75;margin-bottom:6px">Town of ${town} · ${template.moduleBadge}</div>
    <div style="font-size:22px;font-weight:700;line-height:1.2;margin-bottom:4px">${template.name}</div>
    <div style="font-size:13px;opacity:.8">${template.description}</div>
    <div style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:14px">Form · ${ts}</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px">
    ${legalHtml}
    <div style="font-size:11px;color:#9ca3af;margin-bottom:20px">Fields marked <span style="color:#DC2626">*</span> are required.</div>
    ${fieldsHtml}
    <button type="submit" style="width:100%;background:${template.badgeColor};color:#fff;border:none;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;font-family:inherit">Submit →</button>
  </div>

  <!-- Footer -->
  <div style="background:#f8f9fc;border-top:1px solid #e5e7eb;padding:14px 32px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
    <span>Form ID: LGV-FORM-${docId.toUpperCase()}</span>
    <span>Town of ${town} · Powered by Workspace</span>
  </div>
</div>
</body>
</html>`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const FROM_ADDRESS = { address: 'info@publiclogic.org', name: 'PublicLogic' }

function buildGmailRaw(to: string, subject: string, html: string): string {
  const boundary = 'FORM_BOUND_' + Math.random().toString(36).slice(2)
  const raw = [
    `From: PublicLogic <info@publiclogic.org>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '', html, '', `--${boundary}--`,
  ].join('\r\n')
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sendFormEmail(to: string, subject: string, html: string): Promise<'microsoft' | 'google' | 'mailto'> {
  try {
    await pjApi.microsoft.post('me/sendMail', {
      message: { subject, from: { emailAddress: FROM_ADDRESS }, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: true,
    })
    return 'microsoft'
  } catch { /* fall through */ }
  try {
    await pjApi.google.post('gmail/v1/users/me/messages/send', { raw: buildGmailRaw(to, subject, html) })
    return 'google'
  } catch { /* fall through */ }
  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`)
  return 'mailto'
}

// ── Field type selector ───────────────────────────────────────────────────────

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File Upload' },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { town: string }

export function MunicipalTemplatesPanel({ town }: Props) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<FormTemplate | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [localTemplates, setLocalTemplates] = useState<FormTemplate[]>(TEMPLATES)
  const [previewing, setPreviewing] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendTarget, setSendTarget] = useState('')
  const [showSend, setShowSend] = useState(false)
  const [expandedOptions, setExpandedOptions] = useState<string | null>(null)

  const email = user?.email ?? ''

  // Work on a live copy of the selected template
  const template = selected
    ? (localTemplates.find(t => t.id === selected.id) ?? selected)
    : null

  // ── Field mutation helpers ─────────────────────────────────────────────────

  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    if (!template) return
    setLocalTemplates(prev => prev.map(t =>
      t.id !== template.id ? t : {
        ...t,
        fields: t.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f),
      }
    ))
  }

  const deleteField = (fieldId: string) => {
    if (!template) return
    setLocalTemplates(prev => prev.map(t =>
      t.id !== template.id ? t : { ...t, fields: t.fields.filter(f => f.id !== fieldId) }
    ))
    if (editingId === fieldId) setEditingId(null)
  }

  const addField = () => {
    if (!template) return
    const newField: FormField = { id: uid(), label: 'New field', type: 'text', required: false }
    setLocalTemplates(prev => prev.map(t =>
      t.id !== template.id ? t : { ...t, fields: [...t.fields, newField] }
    ))
    setEditingId(newField.id)
  }

  const moveField = (fieldId: string, dir: 'up' | 'down') => {
    if (!template) return
    setLocalTemplates(prev => prev.map(t => {
      if (t.id !== template.id) return t
      const idx = t.fields.findIndex(f => f.id === fieldId)
      if (idx < 0) return t
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= t.fields.length) return t
      const fields = [...t.fields]
      ;[fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]]
      return { ...t, fields }
    }))
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handlePreview = () => {
    if (!template) return
    const html = generateFormHtml(template, town, uid())
    setPreviewHtml(html)
    setPreviewing(true)
  }

  const handleDownload = () => {
    if (!template) return
    const html = generateFormHtml(template, town, uid())
    downloadHtml(`${template.id}-${new Date().toISOString().slice(0, 10)}.html`, html)
    toast.success(`${template.name} downloaded as HTML form`)
  }

  const handleSend = async () => {
    if (!template) return
    const target = sendTarget.trim() || email
    if (!target) { toast.error('Enter an email address'); return }
    setBusy(true)
    const docId = uid()
    const html = generateFormHtml(template, town, docId)
    try {
      const method = await sendFormEmail(target, `${template.name} — Town of ${town}`, html)
      const label = method === 'mailto' ? 'opened in email client' : `sent via ${method === 'microsoft' ? 'Outlook' : 'Gmail'}`
      toast.success(`Form ${label} → ${target}`)
      setShowSend(false)
      setSendTarget('')
    } catch {
      toast.error('Could not send email')
    } finally {
      setBusy(false)
    }
  }

  // ── Preview overlay ───────────────────────────────────────────────────────

  if (previewing && template) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0 flex-wrap gap-y-2">
          <button onClick={() => setPreviewing(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to editor
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-semibold">{template.name} — Form Preview</span>
          <div className="ml-auto flex gap-2">
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
              <DownloadSimple size={13} /> Download
            </button>
            <button onClick={() => { setPreviewing(false); setShowSend(true) }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
              <PaperPlaneTilt size={13} /> Send form
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-zinc-200 p-4">
          <iframe srcDoc={previewHtml} title="Form Preview" className="w-full h-full rounded-xl shadow-xl border-0 bg-white" sandbox="allow-same-origin" />
        </div>
      </div>
    )
  }

  // ── Editor view ───────────────────────────────────────────────────────────

  if (template) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-background">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background shrink-0 flex-wrap gap-y-2">
          <button onClick={() => { setSelected(null); setEditingId(null); setShowSend(false) }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={13} /> All templates
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: template.badgeColor }}>{template.moduleBadge}</span>
            <span className="text-xs font-semibold truncate">{template.name}</span>
            <span className="text-[10px] text-muted-foreground">{template.fields.length} fields</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handlePreview} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
              <Eye size={13} /> Preview
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
              <DownloadSimple size={13} /> Download
            </button>
            <button onClick={() => setShowSend(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
              <PaperPlaneTilt size={13} /> Send form
            </button>
          </div>
        </div>

        {/* Send bar */}
        {showSend && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-indigo-950/30 shrink-0 flex-wrap gap-y-2">
            <span className="text-xs text-muted-foreground">Send to:</span>
            <input
              value={sendTarget}
              onChange={e => setSendTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={email || 'recipient@example.com'}
              className="flex-1 min-w-0 max-w-xs text-xs px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={handleSend} disabled={busy} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40 transition-colors">
              {busy ? 'Sending…' : 'Send HTML form →'}
            </button>
            <button onClick={() => setShowSend(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        )}

        {/* Field editor */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-2">

            {/* Description + legal note */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 mb-4">
              <p className="text-xs text-muted-foreground">{template.description}</p>
              {template.legalNote && (
                <p className="text-xs text-amber-600 mt-2 font-medium">{template.legalNote}</p>
              )}
            </div>

            {template.fields.map((field, idx) => (
              <div key={field.id} className={`rounded-xl border transition-colors ${editingId === field.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border/50 bg-muted/10 hover:border-border'}`}>

                {/* Field row */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => setEditingId(editingId === field.id ? null : field.id)}
                >
                  <DotsSixVertical size={14} className="text-muted-foreground/40 flex-shrink-0" />
                  <span className="text-muted-foreground/60 flex-shrink-0">{FIELD_ICONS[field.type]}</span>
                  <span className="flex-1 text-xs font-medium text-foreground truncate">{field.label}</span>
                  {field.required && <span className="text-[10px] text-red-500 font-bold flex-shrink-0">Required</span>}
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:inline">{TYPES.find(t => t.value === field.type)?.label}</span>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); moveField(field.id, 'up') }} disabled={idx === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                      <CaretUp size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); moveField(field.id, 'down') }} disabled={idx === template.fields.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                      <CaretDown size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteField(field.id) }} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash size={11} />
                    </button>
                  </div>
                </div>

                {/* Inline editor */}
                {editingId === field.id && (
                  <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-border/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Field Label</label>
                        <input
                          value={field.label}
                          onChange={e => updateField(field.id, { label: e.target.value })}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Field Type</label>
                        <select
                          value={field.type}
                          onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Placeholder</label>
                        <input
                          value={field.placeholder ?? ''}
                          onChange={e => updateField(field.id, { placeholder: e.target.value })}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                    {(field.type === 'select' || field.type === 'multiselect') && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Options (one per line)</label>
                        <textarea
                          value={(field.options ?? []).join('\n')}
                          onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                          rows={4}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                        />
                        {/* Quick option adder */}
                        <button
                          onClick={() => setExpandedOptions(expandedOptions === field.id ? null : field.id)}
                          className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          + Add option
                        </button>
                        {expandedOptions === field.id && (
                          <input
                            autoFocus
                            placeholder="Type option and press Enter"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim()
                                if (val) updateField(field.id, { options: [...(field.options ?? []), val] });
                                (e.target as HTMLInputElement).value = ''
                              }
                            }}
                            className="w-full mt-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/50 bg-background focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Hint text (optional)</label>
                      <input
                        value={field.hint ?? ''}
                        onChange={e => updateField(field.id, { hint: e.target.value })}
                        placeholder="Helper text shown below the field"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => updateField(field.id, { required: !field.required })}
                        className={`relative w-9 h-5 rounded-full transition-colors ${field.required ? 'bg-indigo-600' : 'bg-muted-foreground/30'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${field.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-xs text-muted-foreground">Required field</span>
                      <ToggleLeft size={13} className="text-muted-foreground/40" />
                    </label>
                  </div>
                )}
              </div>
            ))}

            {/* Add field */}
            <button
              onClick={addField}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <Plus size={13} /> Add field
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Gallery view ──────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        <div className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-1">FormKey · Municipal Templates</div>
          <h2 className="text-xl font-bold text-foreground">Ready-to-use government forms</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Six VAULT-aligned intake forms pre-built for Logicville. Click any template to edit fields, preview, download as HTML, or email directly.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {localTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setEditingId(null) }}
              className="text-left rounded-2xl border border-border/60 bg-card hover:border-border hover:shadow-md transition-all overflow-hidden group"
            >
              {/* Color header */}
              <div className="h-1.5" style={{ background: t.badgeColor }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ background: t.badgeColor }}>{t.moduleBadge}</span>
                  <span className="text-[10px] text-muted-foreground">{t.fields.length} fields</span>
                </div>
                <div className="font-semibold text-sm text-foreground mb-1 group-hover:text-indigo-400 transition-colors">{t.name}</div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Eye size={11} />
                  <span>Preview</span>
                  <span className="mx-1">·</span>
                  <DownloadSimple size={11} />
                  <span>Download</span>
                  <span className="mx-1">·</span>
                  <PaperPlaneTilt size={11} />
                  <span>Send</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border py-4 px-5 text-center">
          <div className="text-sm text-muted-foreground">
            More coming: Annual financial disclosure, Abutter notification, Dog license renewal, Meeting warrant submission.
          </div>
        </div>
      </div>
    </div>
  )
}
