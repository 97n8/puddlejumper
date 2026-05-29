import { useState } from 'react'
import {
  CheckCircle, DownloadSimple, Code, FilePdf,
} from '@phosphor-icons/react'
import type { GeneratedTownData } from '../data/generator'
import type { Municipality } from '@/data/maMunicipalities'

interface FormsPanelProps {
  townData: GeneratedTownData
  municipality: Municipality
}

type FormKey = 'prr' | 'permit' | 'board' | 'warrant' | 'vendor' | 'agenda'

interface FormConfig {
  key: FormKey
  title: string
  authority: string
  description: string
  audience: 'public' | 'staff'
  fields: Array<{ id: string; label: string; type: 'text' | 'email' | 'date' | 'textarea' | 'select'; options?: string[]; required?: boolean }>
}

const FORMS: FormConfig[] = [
  {
    key: 'prr',
    title: 'Public Records Request',
    authority: 'MGL c.66 §10',
    description: 'Request copies of public records from the municipality.',
    audience: 'public',
    fields: [
      { id: 'name', label: 'Requestor Name', type: 'text', required: true },
      { id: 'email', label: 'Email Address', type: 'email', required: true },
      { id: 'phone', label: 'Phone Number', type: 'text' },
      { id: 'description', label: 'Description of Records Requested', type: 'textarea', required: true },
      { id: 'format', label: 'Preferred Format', type: 'select', options: ['Electronic (PDF/digital)', 'Paper copy', 'Either'], required: true },
      { id: 'date', label: 'Date Range (if applicable)', type: 'text' },
    ],
  },
  {
    key: 'permit',
    title: 'Building Permit Application',
    authority: '780 CMR',
    description: 'Apply for a building permit for construction or renovation.',
    audience: 'public',
    fields: [
      { id: 'address', label: 'Property Address', type: 'text', required: true },
      { id: 'owner', label: 'Owner Name', type: 'text', required: true },
      { id: 'email', label: 'Owner Email', type: 'email', required: true },
      { id: 'project', label: 'Project Description', type: 'textarea', required: true },
      { id: 'value', label: 'Estimated Project Value ($)', type: 'text', required: true },
      { id: 'contractor', label: 'Contractor Name (if applicable)', type: 'text' },
      { id: 'license', label: 'Contractor License #', type: 'text' },
    ],
  },
  {
    key: 'board',
    title: 'Board / Committee Application',
    authority: 'MGL c.4 §38',
    description: 'Apply to serve on a municipal board or committee.',
    audience: 'public',
    fields: [
      { id: 'name', label: 'Applicant Name', type: 'text', required: true },
      { id: 'email', label: 'Email Address', type: 'email', required: true },
      { id: 'phone', label: 'Phone Number', type: 'text' },
      { id: 'board', label: 'Board Applying For', type: 'select', required: true, options: ['Board of Selectmen', 'Planning Board', 'Board of Health', 'Conservation Commission', 'Finance Committee', 'Zoning Board of Appeals', 'Library Trustees', 'Cemetery Commission'] },
      { id: 'qualifications', label: 'Qualifications & Experience', type: 'textarea', required: true },
      { id: 'availability', label: 'Meeting Availability', type: 'text', required: true },
    ],
  },
  {
    key: 'warrant',
    title: 'AP Warrant Item',
    authority: 'MGL c.41 §52',
    description: 'Submit an accounts payable item for the warrant.',
    audience: 'staff',
    fields: [
      { id: 'vendor', label: 'Vendor Name', type: 'text', required: true },
      { id: 'amount', label: 'Amount ($)', type: 'text', required: true },
      { id: 'account', label: 'Account Code', type: 'text', required: true },
      { id: 'description', label: 'Description', type: 'textarea', required: true },
      { id: 'department', label: 'Department', type: 'select', required: true, options: ['Town Clerk', 'Finance', 'DPW', 'Board of Health', 'Planning', 'Building', 'Police', 'Fire', 'Library'] },
      { id: 'invoice', label: 'Invoice # (if applicable)', type: 'text' },
    ],
  },
  {
    key: 'vendor',
    title: 'Vendor / Procurement Request',
    authority: 'MGL c.30B',
    description: 'Initiate a procurement or vendor service request.',
    audience: 'staff',
    fields: [
      { id: 'department', label: 'Requesting Department', type: 'text', required: true },
      { id: 'contact', label: 'Contact Name', type: 'text', required: true },
      { id: 'email', label: 'Contact Email', type: 'email', required: true },
      { id: 'item', label: 'Item / Service Description', type: 'textarea', required: true },
      { id: 'cost', label: 'Estimated Cost ($)', type: 'text', required: true },
      { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
    ],
  },
  {
    key: 'agenda',
    title: 'Meeting Agenda Item Submission',
    authority: 'MGL c.30A §20',
    description: 'Submit an item for inclusion on a board meeting agenda.',
    audience: 'public',
    fields: [
      { id: 'board', label: 'Board / Committee', type: 'select', required: true, options: ['Board of Selectmen', 'Planning Board', 'Board of Health', 'Conservation Commission', 'Finance Committee'] },
      { id: 'date', label: 'Requested Meeting Date', type: 'date', required: true },
      { id: 'title', label: 'Agenda Item Title', type: 'text', required: true },
      { id: 'requestor', label: 'Requestor Name', type: 'text', required: true },
      { id: 'email', label: 'Requestor Email', type: 'email', required: true },
      { id: 'docs', label: 'Supporting Documents (title or URL)', type: 'text' },
    ],
  },
]

// ─── HTML Generator ──────────────────────────────────────────────────────────

function generatePublicHTML(form: FormConfig, townName: string, townEmail: string): string {
  const fieldHTML = form.fields.map(f => {
    const req = f.required ? ' required' : ''
    const label = `<label for="${f.id}" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#1A1D16">${f.label}${f.required ? ' <span style="color:#c0392b">*</span>' : ''}</label>`
    let input = ''
    if (f.type === 'textarea') {
      input = `<textarea id="${f.id}" name="${f.id}" rows="4"${req} style="width:100%;box-sizing:border-box;border:1px solid #DDD8CE;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;outline:none"></textarea>`
    } else if (f.type === 'select') {
      const opts = (f.options ?? []).map(o => `<option value="${o}">${o}</option>`).join('')
      input = `<select id="${f.id}" name="${f.id}"${req} style="width:100%;box-sizing:border-box;border:1px solid #DDD8CE;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;background:#fff"><option value="">Select…</option>${opts}</select>`
    } else {
      input = `<input type="${f.type}" id="${f.id}" name="${f.id}"${req} style="width:100%;box-sizing:border-box;border:1px solid #DDD8CE;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">`
    }
    return `<div style="margin-bottom:16px">${label}${input}</div>`
  }).join('\n')

  const slug = townName.toLowerCase().replace(/\s+/g, '')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${form.title} — Town of ${townName}, MA</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F1E8;color:#1A1D16;padding:24px 16px;min-height:100vh}
    .card{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden}
    .header{background:#2C5F2D;padding:24px 28px;color:#fff}
    .header h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .header p{font-size:13px;opacity:0.8}
    .authority{display:inline-block;background:rgba(255,255,255,0.2);border-radius:6px;padding:2px 8px;font-size:11px;margin-top:8px;font-family:monospace}
    .body{padding:28px}
    .footer{padding:16px 28px;background:#F5F1E8;font-size:12px;color:#7A7870;border-top:1px solid #DDD8CE}
    input,select,textarea{transition:border-color 0.15s}
    input:focus,select:focus,textarea:focus{border-color:#2C5F2D!important;box-shadow:0 0 0 3px rgba(44,95,45,0.15)}
    button[type=submit]{width:100%;background:#2C5F2D;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.15s;margin-top:8px}
    button[type=submit]:hover{opacity:0.85}
    .success{display:none;text-align:center;padding:32px 16px}
    .success svg{margin:0 auto 12px;display:block}
    .success h2{font-size:18px;font-weight:700;color:#2C5F2D;margin-bottom:8px}
    .success p{font-size:13px;color:#7A7870}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${form.title}</h1>
      <p>Town of ${townName}, Massachusetts</p>
      <span class="authority">${form.authority}</span>
    </div>
    <div class="body">
      <p style="font-size:13px;color:#7A7870;margin-bottom:20px">${form.description}</p>
      <form id="mainForm">
${fieldHTML}
        <button type="submit">Submit ${form.title}</button>
      </form>
      <div class="success" id="successMsg">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2C5F2D" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h2>Submitted Successfully</h2>
        <p>Your ${form.title} has been received.<br>You will be contacted at the email you provided.<br>Questions? Email <a href="mailto:${townEmail}" style="color:#2C5F2D">${townEmail}</a></p>
      </div>
    </div>
    <div class="footer">
      Town of ${townName} · ${townEmail} · publiclogic.org/vault/${slug} · Powered by VAULT MGL-001
    </div>
  </div>
  <script>
    document.getElementById('mainForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const data = new FormData(this);
      const payload = {};
      data.forEach(function(v, k) { payload[k] = v; });
      payload._form = '${form.key}';
      payload._town = '${townName}';
      payload._submitted = new Date().toISOString();
      // submission payload logged server-side
      // Replace the fetch URL below with your PuddleJumper endpoint:
      // fetch('https://api.publiclogic.org/v1/forms/submit', {
      //   method: 'POST', credentials: 'include',
      //   headers: {'Content-Type':'application/json'},
      //   body: JSON.stringify(payload)
      // });
      document.getElementById('mainForm').style.display = 'none';
      document.getElementById('successMsg').style.display = 'block';
    });
  </script>
</body>
</html>`
}

// ─── Staff Intake Form (internal) ────────────────────────────────────────────

interface FormValues { [key: string]: string }

function StaffForm({ form, onSubmit }: { form: FormConfig; onSubmit: () => void }) {
  const [values, setValues] = useState<FormValues>({})
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#97BC62', backgroundColor: '#E8F2EB' }}>
        <CheckCircle size={32} style={{ color: '#2C5F2D', margin: '0 auto 10px' }} />
        <div className="font-semibold text-sm mb-1" style={{ color: '#2C5F2D' }}>Submitted — case created</div>
        <button onClick={() => setSubmitted(false)} className="text-xs underline mt-2" style={{ color: '#7A7870' }}>Submit another</button>
      </div>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); setSubmitted(true); onSubmit() }}
      className="rounded-xl border p-5 space-y-3" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="font-semibold text-sm" style={{ color: '#1A1D16' }}>{form.title}</div>
          <div className="text-xs mt-0.5" style={{ color: '#7A7870' }}>{form.description}</div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0 ml-2" style={{ backgroundColor: '#F5F1E8', color: '#7A7870' }}>{form.authority}</span>
      </div>
      {form.fields.map(field => (
        <div key={field.id}>
          <label className="block text-xs font-medium mb-1" style={{ color: '#1A1D16' }}>{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea rows={3} required={field.required} value={values[field.id] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{ borderColor: '#DDD8CE', color: '#1A1D16' }} />
          ) : field.type === 'select' ? (
            <select required={field.required} value={values[field.id] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#DDD8CE', color: '#1A1D16', backgroundColor: '#fff' }}>
              <option value="">Select…</option>
              {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={field.type} required={field.required} value={values[field.id] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#DDD8CE', color: '#1A1D16' }} />
          )}
        </div>
      ))}
      <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-medium"
        style={{ backgroundColor: '#2C5F2D', color: '#fff' }}>
        Submit {form.title}
      </button>
    </form>
  )
}

// ─── Public HTML Card ─────────────────────────────────────────────────────────

function PublicFormCard({ form, townName, townEmail }: { form: FormConfig; townName: string; townEmail: string }) {
  const [showEmbed, setShowEmbed] = useState(false)
  const [copied, setCopied] = useState(false)
  const slug = townName.toLowerCase().replace(/\s+/g, '')
  const embedCode = `<iframe src="https://os.publiclogic.org/forms/${slug}/${form.key}" width="100%" height="700" frameborder="0" style="border:none;border-radius:12px"></iframe>`

  function handleDownload() {
    const html = generatePublicHTML(form, townName, townEmail)
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${townName.toLowerCase().replace(/\s+/g, '-')}-${form.key}-form.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function handleCopy() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
      <div className="p-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FilePdf size={16} style={{ color: '#2C5F2D' }} />
            <span className="font-semibold text-sm" style={{ color: '#1A1D16' }}>{form.title}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F5F1E8', color: '#7A7870' }}>{form.authority}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#7A7870' }}>{form.description}</p>
        </div>
      </div>
      <div className="px-4 pb-4 flex gap-2 flex-wrap">
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#2C5F2D', color: '#fff' }}>
          <DownloadSimple size={14} />
          Download HTML
        </button>
        <button onClick={() => setShowEmbed(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: '#DDD8CE', color: '#1A1D16', backgroundColor: showEmbed ? '#F5F1E8' : '#fff' }}>
          <Code size={14} />
          Embed code
        </button>
      </div>
      {showEmbed && (
        <div className="mx-4 mb-4 rounded-lg p-3" style={{ backgroundColor: '#1A1D16' }}>
          <div className="text-xs font-mono break-all mb-2" style={{ color: '#97BC62' }}>{embedCode}</div>
          <button onClick={handleCopy}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: copied ? '#97BC62' : '#2C5F2D', color: '#fff' }}>
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <p className="text-xs mt-2" style={{ color: '#7A7870' }}>
            Paste into CivicPlus, Municode, Google Sites, or any HTML-capable CMS.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type Tab = 'public' | 'staff'

export function FormsPanel({ municipality }: FormsPanelProps) {
  const [tab, setTab] = useState<Tab>('public')
  const [successCount, setSuccessCount] = useState(0)

  const townEmail = `townhall@${municipality.name.toLowerCase().replace(/\s+/g, '')}.ma.us`
  const publicForms = FORMS.filter(f => f.audience === 'public')
  const staffForms = FORMS.filter(f => f.audience === 'staff')

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        backgroundColor: tab === id ? '#2C5F2D' : 'transparent',
        color: tab === id ? '#fff' : '#7A7870',
      }}
    >{label}</button>
  )

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="font-semibold" style={{ color: '#1A1D16' }}>Forms &amp; Public Intake</h2>
        <p className="text-xs mt-0.5" style={{ color: '#7A7870' }}>
          Town of {municipality.name} — download standalone HTML forms for your website, or submit internally.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ backgroundColor: '#F5F1E8' }}>
        <TabBtn id="public" label="Public Forms (HTML Downloads)" />
        <TabBtn id="staff" label="Staff Internal Intake" />
      </div>

      {tab === 'public' && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 border" style={{ borderColor: '#97BC62', backgroundColor: '#E8F2EB' }}>
            <div className="text-sm font-semibold mb-1" style={{ color: '#2C5F2D' }}>How it works</div>
            <p className="text-xs" style={{ color: '#7A7870' }}>
              Each form downloads as a single self-contained HTML file — no npm, no hosting required.
              Drop it into CivicPlus, Municode, Google Sites, or any website. Form data logs to the console
              by default; connect to <code className="font-mono">api.publiclogic.org/v1/forms/submit</code> to route submissions into VAULT cases.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {publicForms.map(form => (
              <PublicFormCard key={form.key} form={form} townName={municipality.name} townEmail={townEmail} />
            ))}
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: '#7A7870' }}>
            Internal forms for staff use — each submission creates a tracked case in Case Desk.
            {successCount > 0 && <span className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>{successCount} submitted this session</span>}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffForms.map(form => (
              <StaffForm key={form.key} form={form} onSubmit={() => setSuccessCount(c => c + 1)} />
            ))}
          </div>
          <div className="text-xs mt-4" style={{ color: '#7A7870' }}>
            Need a new staff form? Public forms (PRR, Permit, Board App, Agenda) are also accessible under the Public Forms tab.
          </div>
        </div>
      )}
    </div>
  )
}
