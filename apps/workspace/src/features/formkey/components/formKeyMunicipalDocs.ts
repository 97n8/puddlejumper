import type { Municipality } from '@/data/maMunicipalities'

export type FormKeyTownRiskFlag = {
  code: string
  label: string
  severity: 'critical' | 'warning' | 'info' | 'passing'
  detail: string
  threshold: string
}

export type FormKeyTownSnapshot = {
  municipality: string
  dorCode: number
  county: string
  fiscalYear: number
  computedAt: string
  metrics: {
    operatingBudget: number | null
    totalEmployees: number | null
    certifiedFreeCash: number | null
    freeCashPctBudget: number | null
    totalStateAid: number | null
    salariesPctBudget: number | null
    averageSalary: number | null
    excessLevyCapacityPct: number | null
    debtServicePctBudget: number | null
  }
  riskFlags: FormKeyTownRiskFlag[]
}

export type FormKeyDocumentTemplate = {
  id: string
  label: string
  summary: string
  outputName: string
  defaultAudience: string
  outcome: string
  actionItems: string[]
  fieldFocus: string[]
}

export const FORMKEY_DOCUMENT_TEMPLATES: FormKeyDocumentTemplate[] = [
  {
    id: 'board-brief',
    label: 'Board decision brief',
    summary: 'Turn live town signals into a plain-language memo for a board, manager, or department head.',
    outputName: 'Board Decision Brief',
    defaultAudience: 'Select Board and Town Manager',
    outcome: 'Gives leadership one fast, readable packet instead of six disconnected attachments.',
    actionItems: [
      'Name the decision or agenda item this brief is supporting.',
      'Pull forward the two or three signals that matter now, not every available number.',
      'State what should be decided, deferred, or escalated before the meeting closes.',
    ],
    fieldFocus: ['agenda_item', 'decision_needed', 'owner', 'deadline', 'supporting_packet'],
  },
  {
    id: 'budget-watch',
    label: 'Budget watch memo',
    summary: 'Build a finance-ready memo from the latest LogicDASH pull with reserve, levy, and staffing context.',
    outputName: 'Budget Watch Memo',
    defaultAudience: 'Finance Committee and Town Administrator',
    outcome: 'Makes budget pressure legible before the town has to explain a surprise shortfall.',
    actionItems: [
      'Show the current year posture in reserve, levy headroom, staffing, and debt service.',
      'Call out what changed enough to matter for the next budget turn.',
      'End with the actions leadership can take before pressure becomes crisis.',
    ],
    fieldFocus: ['budget_line', 'watch_item', 'recommended_action', 'owner', 'review_date'],
  },
  {
    id: 'public-notice',
    label: 'Resident-facing notice',
    summary: 'Generate a clean public notice or summary that translates town data into understandable language.',
    outputName: 'Resident Notice',
    defaultAudience: 'Residents and board packet readers',
    outcome: 'Lets the town publish something clear and defensible without rewriting it three times.',
    actionItems: [
      'Explain what the town is doing in public language first.',
      'Translate any fiscal or compliance flags into resident-facing implications.',
      'Close with what happens next, when, and who owns the next communication.',
    ],
    fieldFocus: ['notice_title', 'public_summary', 'timeline', 'contact_email', 'publication_channel'],
  },
  {
    id: 'grant-procurement',
    label: 'Grant or procurement summary',
    summary: 'Package funding, procurement, or implementation status into a ready-to-share memo with next steps.',
    outputName: 'Grant and Procurement Summary',
    defaultAudience: 'Department Head and Procurement Team',
    outcome: 'Keeps purchasing, grant timing, and operating risk in one governed record.',
    actionItems: [
      'Anchor the memo in the current fiscal posture and staffing capacity.',
      'State what the town is buying, applying for, or moving forward now.',
      'Name the operational guardrails that protect the town if the timeline slips.',
    ],
    fieldFocus: ['project_name', 'funding_source', 'procurement_path', 'decision_date', 'risk_owner'],
  },
]

type MunicipalDocumentPackageInput = {
  municipality: Municipality
  template: FormKeyDocumentTemplate
  snapshot: FormKeyTownSnapshot | null
  audience: string
  goal: string
}

type MunicipalDocumentPackage = {
  title: string
  filenameStem: string
  textContent: string
  htmlContent: string
  dataContent: string
  sourceStamp: string
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not connected yet'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${Math.round(value).toLocaleString()}`
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not connected yet'
  return `${value.toFixed(digits)}%`
}

function summarizeFlags(snapshot: FormKeyTownSnapshot | null): string[] {
  if (!snapshot) {
    return ['Pull LogicDASH town data to ground the document in live reserve, levy, staffing, and risk signals.']
  }

  const flagged = snapshot.riskFlags.filter(flag => flag.severity !== 'passing').slice(0, 3)
  if (flagged.length === 0) {
    return ['Current LogicDASH pull did not surface an urgent warning. Keep the document focused on the decision and operating follow-through.']
  }

  return flagged.map(flag => `${flag.label}: ${flag.detail}`)
}

function buildNarrativeSummary(template: FormKeyDocumentTemplate, municipality: Municipality, snapshot: FormKeyTownSnapshot | null, goal: string): string {
  const townName = snapshot?.municipality ?? municipality.name
  const lead = goal.trim() || template.summary

  if (!snapshot) {
    return `${townName} can use this ${template.outputName.toLowerCase()} to move from scattered notes to one governed packet. ${lead} Pull the latest LogicDASH town data to replace placeholders with live municipal numbers before sharing.`
  }

  return `${townName} can use this ${template.outputName.toLowerCase()} to move from scattered notes to one governed packet. ${lead} The current LogicDASH pull shows operating budget at ${formatCurrency(snapshot.metrics.operatingBudget)}, free cash at ${formatPercent(snapshot.metrics.freeCashPctBudget)}, levy headroom at ${formatPercent(snapshot.metrics.excessLevyCapacityPct)}, and staffing at ${snapshot.metrics.totalEmployees?.toLocaleString() ?? 'not connected yet'} employees.`
}

export function buildMunicipalDocumentPackage({
  municipality,
  template,
  snapshot,
  audience,
  goal,
}: MunicipalDocumentPackageInput): MunicipalDocumentPackage {
  const townName = snapshot?.municipality ?? municipality.name
  const dateStamp = new Date().toISOString().slice(0, 10)
  const riskLines = summarizeFlags(snapshot)
  const sourceStamp = snapshot
    ? `LogicDASH pull · FY${snapshot.fiscalYear} · ${snapshot.county} County · updated ${new Date(snapshot.computedAt).toLocaleString()}`
    : `Town profile mode · ${municipality.county} County · pull live LogicDASH data to replace placeholders`
  const summary = buildNarrativeSummary(template, municipality, snapshot, goal)
  const metricRows = [
    ['Operating budget', formatCurrency(snapshot?.metrics.operatingBudget)],
    ['Certified free cash', formatCurrency(snapshot?.metrics.certifiedFreeCash)],
    ['Free cash % of budget', formatPercent(snapshot?.metrics.freeCashPctBudget)],
    ['Levy headroom %', formatPercent(snapshot?.metrics.excessLevyCapacityPct)],
    ['Debt service % of budget', formatPercent(snapshot?.metrics.debtServicePctBudget)],
    ['State aid', formatCurrency(snapshot?.metrics.totalStateAid)],
    ['Total employees', snapshot?.metrics.totalEmployees?.toLocaleString() ?? 'Not connected yet'],
    ['Average salary', formatCurrency(snapshot?.metrics.averageSalary)],
    ['Salary share of budget', formatPercent(snapshot?.metrics.salariesPctBudget)],
  ]
  const title = `${townName} ${template.outputName}`
  const textContent = [
    title,
    `Prepared for: ${audience}`,
    `Town: ${townName}, ${municipality.county} County`,
    `Source: ${sourceStamp}`,
    '',
    'Executive summary',
    summary,
    '',
    'Municipal signals',
    ...metricRows.map(([label, value]) => `- ${label}: ${value}`),
    '',
    'Watch items',
    ...riskLines.map(line => `- ${line}`),
    '',
    'Recommended actions',
    ...template.actionItems.map(item => `- ${item}`),
    '',
    'Suggested FormKey fields',
    ...template.fieldFocus.map(field => `- ${field}`),
    '',
    `Outcome: ${template.outcome}`,
  ].join('\n')

  const htmlMetricRows = metricRows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('')
  const htmlRiskRows = riskLines
    .map(line => `<li>${escapeHtml(line)}</li>`)
    .join('')
  const htmlActionRows = template.actionItems
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('')
  const htmlFieldRows = template.fieldFocus
    .map(field => `<span class="pill">${escapeHtml(field)}</span>`)
    .join('')

  const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .page {
        max-width: 980px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      .card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        box-shadow: 0 24px 60px -44px rgba(15, 23, 42, 0.35);
        overflow: hidden;
      }
      .hero {
        padding: 28px;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        color: white;
      }
      .eyebrow {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        opacity: 0.78;
      }
      h1 {
        margin: 12px 0 8px;
        font-size: 32px;
        line-height: 1.1;
      }
      .meta {
        margin-top: 12px;
        font-size: 13px;
        color: rgba(255,255,255,0.82);
      }
      .section {
        padding: 24px 28px;
        border-top: 1px solid #e2e8f0;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      p, li, td, th {
        font-size: 14px;
        line-height: 1.65;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      th {
        width: 40%;
        color: #475569;
        font-weight: 600;
        background: #f8fafc;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        padding: 7px 12px;
        font-size: 12px;
        color: #334155;
        background: #f8fafc;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <section class="hero">
          <div class="eyebrow">FormKey municipal document builder</div>
          <h1>${escapeHtml(title)}</h1>
          <div>${escapeHtml(summary)}</div>
          <div class="meta">Prepared for ${escapeHtml(audience)} · ${escapeHtml(sourceStamp)}</div>
        </section>
        <section class="section">
          <h2>Municipal signals</h2>
          <table>
            <tbody>${htmlMetricRows}</tbody>
          </table>
        </section>
        <section class="section">
          <h2>Watch items</h2>
          <ul>${htmlRiskRows}</ul>
        </section>
        <section class="section">
          <h2>Recommended actions</h2>
          <ul>${htmlActionRows}</ul>
        </section>
        <section class="section">
          <h2>Suggested FormKey fields</h2>
          <div class="pill-row">${htmlFieldRows}</div>
        </section>
      </div>
    </div>
  </body>
</html>`

  const dataContent = JSON.stringify({
    title,
    audience,
    municipality: {
      name: municipality.name,
      county: municipality.county,
      dorCode: municipality.dor_code,
      population: municipality.population ?? null,
    },
    sourceStamp,
    summary,
    template: {
      id: template.id,
      label: template.label,
      actionItems: template.actionItems,
      fieldFocus: template.fieldFocus,
      outcome: template.outcome,
    },
    snapshot,
  }, null, 2)

  return {
    title,
    filenameStem: `${slugify(townName)}-${template.id}-${dateStamp}`,
    textContent,
    htmlContent,
    dataContent,
    sourceStamp,
  }
}
