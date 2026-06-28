import { useMemo, useState } from 'react'
import { useCivicTown } from '../context/CivicTownContext'
import { VaultModuleMaker } from '@/features/builder/components/VaultModuleMaker'
import { CommsPanel } from '@/features/comms/components/CommsPanel'
import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'

type Props = { onBack?: () => void }

const CIVIC_TEMPLATES = [
  { id: 'oml_meeting_notice', name: 'OML Meeting Notice', category: 'Meetings & OML', statute: 'c.30A §20', description: 'Required 48-hour public notice for open meetings', fields: ['body_name', 'meeting_date', 'meeting_time', 'meeting_location', 'agenda_items'] },
  { id: 'oml_agenda', name: 'Meeting Agenda', category: 'Meetings & OML', statute: 'c.30A §20', description: 'Standard agenda format for public meetings', fields: ['body_name', 'meeting_date', 'meeting_time', 'agenda_items'] },
  { id: 'oml_minutes', name: 'Meeting Minutes', category: 'Meetings & OML', statute: 'c.30A §22', description: 'Open meeting law compliant meeting minutes', fields: ['body_name', 'meeting_date', 'members_present', 'votes', 'actions'] },
  { id: 'oml_packet_cover', name: 'Meeting Packet Cover', category: 'Meetings & OML', statute: '', description: 'Cover page for full meeting packet distribution', fields: ['body_name', 'meeting_date', 'packet_contents'] },
  { id: 'records_receipt', name: 'Records Request Receipt', category: 'Records', statute: 'c.66 §10', description: '10-day acknowledgment to records requestor', fields: ['requestor_name', 'request_date', 'request_description', 'rao_name'] },
  { id: 'records_response', name: 'Records Request Response', category: 'Records', statute: 'c.66 §10', description: 'Final response with documents or denial', fields: ['requestor_name', 'request_date', 'request_description', 'rao_name', 'response_type', 'documents'] },
  { id: 'records_exemption', name: 'Records Exemption Notice', category: 'Records', statute: 'c.66 §10', description: 'Cite specific exemptions for withheld records', fields: ['requestor_name', 'exemption_basis', 'withheld_description'] },
  { id: 'proc_30b_ifb', name: 'IFB — Invitation for Bids', category: 'Procurement', statute: 'c.30B §5', description: 'Formal competitive bid for goods/services', fields: ['project_name', 'estimated_value', 'bid_due_date', 'spec_summary'] },
  { id: 'proc_award', name: 'Contract Award Notice', category: 'Procurement', statute: 'c.30B', description: 'Required notice of contract award', fields: ['project_name', 'awarded_vendor', 'award_amount', 'award_date'] },
  { id: 'proc_contract', name: 'Contract Cover Sheet', category: 'Procurement', statute: 'c.30B', description: 'Standard contract execution cover page', fields: ['vendor_name', 'project_name', 'contract_amount', 'term_start', 'term_end'] },
  { id: 'appointment_notice', name: 'Appointment Notice', category: 'Personnel', statute: '', description: 'Official notice of board/committee appointment', fields: ['appointee_name', 'position', 'appointing_body', 'term_end'] },
  { id: 'permit_approval', name: 'Permit Approval', category: 'Permitting', statute: '', description: 'Issued permit with conditions', fields: ['applicant_name', 'permit_type', 'permit_number', 'conditions'] },
  { id: 'permit_denial', name: 'Permit Denial', category: 'Permitting', statute: '', description: 'Denial with stated reasons and appeal rights', fields: ['applicant_name', 'permit_type', 'denial_reasons', 'appeal_deadline'] },
  { id: 'grant_closeout', name: 'Grant Closeout Certificate', category: 'Finance', statute: '', description: 'Final grant closeout documentation', fields: ['grant_name', 'grantor', 'grant_amount', 'project_summary', 'outcomes'] },
]

const CATEGORY_ACCENTS: Record<string, string> = {
  'Meetings & OML': '#6B9EBB',
  'Records': '#D4A853',
  'Procurement': '#8BBF7A',
  'Personnel': '#B07FBB',
  'Permitting': '#CC7070',
  'Finance': '#7C9DBB',
}

const CATEGORY_LINKS: Record<string, string> = {
  'Meetings & OML': 'https://www.mass.gov/guides/open-meeting-law-guide-for-public-bodies',
  'Records': 'https://www.sec.state.ma.us/pre/preidx.htm',
  'Procurement': 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter30B',
}

export function DocumentsHub({ onBack: _onBack }: Props) {
  const { town, townName, governanceForm, fiscalYearEnd, county } = useCivicTown()
  const [tab, setTab] = useState<'templates' | 'builder' | 'comms'>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)

  const categories = Array.from(new Set(CIVIC_TEMPLATES.map(t => t.category)))

  const getPrefill = useMemo(() => (_template: typeof CIVIC_TEMPLATES[0]) => {
    const prefill: Record<string, string> = {
      town_name: townName,
      county,
      governance_form: governanceForm.replace(/_/g, ' '),
      fiscal_year_end: fiscalYearEnd,
    }
    return prefill
  }, [county, fiscalYearEnd, governanceForm, townName])

  const resetFieldValues = (template: typeof CIVIC_TEMPLATES[0]) => {
    const nextValues: Record<string, string> = {}
    template.fields.forEach((field) => {
      nextValues[field] = ''
    })
    setFieldValues(nextValues)
  }

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = CIVIC_TEMPLATES.find((item) => item.id === templateId)
    if (template) resetFieldValues(template)
  }

  const handleFieldChange = (field: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [field]: value }))
  }

  const renderLabel = (value: string) => value.replace(/_/g, ' ')

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const buildDocumentHtml = (template: typeof CIVIC_TEMPLATES[0], prefill: Record<string, string>) => {
    const completedFields = template.fields
      .map((field) => ({
        field,
        value: fieldValues[field]?.trim() ?? '',
      }))
      .filter((entry) => entry.value.length > 0)

    const prefillRows = Object.entries(prefill)
      .map(([key, value]) => `
        <div class="doc-row">
          <span class="doc-label">${escapeHtml(renderLabel(key))}</span>
          <span class="doc-value">${escapeHtml(value)}</span>
        </div>
      `)
      .join('')

    const fieldRows = completedFields.length > 0
      ? completedFields.map(({ field, value }) => `
          <div class="doc-row">
            <span class="doc-label">${escapeHtml(renderLabel(field))}</span>
            <span class="doc-value">${escapeHtml(value)}</span>
          </div>
        `).join('')
      : `<p class="doc-empty">No additional field values were entered yet.</p>`

    return `
      <article class="civic-doc">
        <header class="doc-header">
          <p class="doc-kicker">${escapeHtml(template.category)}</p>
          <h1>${escapeHtml(template.name)}</h1>
          <p class="doc-town">${escapeHtml(townName || town?.name || 'Municipal workspace')}</p>
          ${template.statute ? `<p class="doc-statute">MGL ${escapeHtml(template.statute)}</p>` : ''}
          <p class="doc-description">${escapeHtml(template.description)}</p>
        </header>

        <section class="doc-section">
          <h2>Municipality context</h2>
          ${prefillRows}
        </section>

        <section class="doc-section">
          <h2>Completed fields</h2>
          ${fieldRows}
        </section>
      </article>
    `
  }

  const DOCUMENT_CSS = `
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 32px;
      color: #111827;
      background: #ffffff;
    }
    .civic-doc {
      max-width: 840px;
      margin: 0 auto;
    }
    .doc-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .doc-kicker,
    .doc-statute {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6b7280;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 30px;
      line-height: 1.1;
    }
    .doc-town,
    .doc-description {
      margin: 0;
      color: #374151;
      line-height: 1.6;
    }
    .doc-section + .doc-section {
      margin-top: 28px;
    }
    .doc-section h2 {
      margin: 0 0 14px;
      font-size: 16px;
    }
    .doc-row {
      display: grid;
      grid-template-columns: minmax(180px, 220px) 1fr;
      gap: 16px;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .doc-label {
      font-weight: 600;
      color: #6b7280;
      text-transform: capitalize;
    }
    .doc-value,
    .doc-empty {
      color: #111827;
      white-space: pre-wrap;
    }
  `

  const handleGenerateDocument = async () => {
    if (!selected) return
    const prefill = getPrefill(selected)
    const docName = `${selected.name} — ${townName || town?.name || 'Municipal'}`

    setIsGenerating(true)
    try {
      const doc = await pjApi.docs.create({
        name: docName,
        html: buildDocumentHtml(selected, prefill),
        css: DOCUMENT_CSS,
        pageSize: 'letter',
      })
      toast.success(`Generated ${doc.name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate document')
    } finally {
      setIsGenerating(false)
    }
  }

  if (tab === 'builder') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <button onClick={() => setTab('templates')} className="text-muted-foreground hover:text-foreground text-sm transition">← Documents</button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground text-sm font-medium">Module Builder</span>
        </div>
        <VaultModuleMaker initialTownCode={town?.dor_code ?? null} />
      </div>
    )
  }

  if (tab === 'comms') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <CommsPanel onBack={() => setTab('templates')} />
      </div>
    )
  }

  const selected = selectedTemplate ? CIVIC_TEMPLATES.find(t => t.id === selectedTemplate) : null
  const prefill = selected ? getPrefill(selected) : null

  return (
    <div className="flex-1 flex overflow-hidden bg-background text-foreground">
      {/* Template list sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-foreground font-bold text-sm">Vault Templates</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Pre-filled for {townName || 'your town'}</p>
        </div>
        <div className="flex gap-1 px-3 py-2 border-b border-border">
          <button onClick={() => setTab('templates')} className="flex-1 py-1.5 text-xs font-medium bg-muted text-foreground rounded-lg">Templates</button>
          <button onClick={() => setTab('builder')} className="flex-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition">Module Builder</button>
          <button onClick={() => setTab('comms')} className="flex-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition">Notices</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {categories.map(cat => (
            <div key={cat} className="mb-3">
              <div className="flex items-center justify-between px-4 mb-1">
                <div
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: CATEGORY_ACCENTS[cat] ?? 'var(--muted-foreground)', opacity: 0.8 }}
                >
                  {cat}
                </div>
                {CATEGORY_LINKS[cat] && (
                  <a
                    href={CATEGORY_LINKS[cat]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    MA law ↗
                  </a>
                )}
              </div>
              {CIVIC_TEMPLATES.filter(t => t.category === cat).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`w-full text-left px-4 py-2.5 transition ${
                    selectedTemplate === t.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="text-xs font-medium">{t.name}</div>
                  {t.statute && <div className="text-[10px] text-muted-foreground/60 mt-0.5">MGL {t.statute}</div>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Template detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-foreground text-xl font-bold">{selected.name}</h2>
                  {selected.statute && (
                    <span className="text-xs font-bold px-2 py-1 bg-muted text-muted-foreground rounded-lg shrink-0 ml-3">
                      MGL {selected.statute}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">{selected.description}</p>
              </div>

              {/* Pre-filled fields */}
              <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Pre-filled from {townName}
                </div>
                {prefill && Object.entries(prefill).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-xs w-36 shrink-0">{key.replace(/_/g, ' ')}</span>
                    <span className="text-foreground text-sm font-medium">{val}</span>
                  </div>
                ))}
              </div>

              {/* Fields to complete */}
              <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Fields to complete</div>
                  {selected.fields.map(f => (
                    <div key={f} className="py-2 border-b border-border last:border-0">
                      <div className="text-foreground/80 text-xs font-medium">{f.replace(/_/g, ' ')}</div>
                      <input
                        type="text"
                        placeholder={`Enter ${f.replace(/_/g, ' ')}…`}
                        value={fieldValues[f] ?? ''}
                        onChange={(event) => handleFieldChange(f, event.target.value)}
                        className="mt-1 w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40 transition"
                      />
                    </div>
                  ))}
                </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateDocument()}
                  disabled={isGenerating}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition"
                >
                  {isGenerating ? 'Generating…' : 'Generate Document'}
                </button>
                <button className="px-4 py-2.5 bg-muted hover:bg-muted text-foreground/80 text-sm font-medium rounded-xl transition">
                  Copy Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-foreground font-bold text-lg mb-2">Vault Templates</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {CIVIC_TEMPLATES.length} MGL-compliant templates pre-filled with {townName || 'your town'}'s data. Select a template to preview and complete it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button onClick={() => setTab('builder')} className="px-3 py-1.5 bg-muted hover:bg-muted text-foreground/80 text-xs rounded-lg transition">Module Builder →</button>
                <button onClick={() => setTab('comms')} className="px-3 py-1.5 bg-muted hover:bg-muted text-foreground/80 text-xs rounded-lg transition">Notices & Comms →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
