import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import { pjApi } from '@/services/pjApi'
import { downloadBlob, generateDocument } from '@/lib/documentUtils'
import {
  Buildings,
  CheckCircle,
  ClipboardText,
  Database,
  DownloadSimple,
  Link,
  Plus,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { FORMKEY_DEMO_FIELDS, FORMKEY_DEMO_SUBMISSIONS } from './formKeyStarterData'
import {
  buildMunicipalDocumentPackage,
  FORMKEY_DOCUMENT_TEMPLATES,
  type FormKeyTownSnapshot,
} from './formKeyMunicipalDocs'

interface FormKeyDemoPanelProps {
  onCreateBlank: () => void
  onUseStarter: () => void
  creatingStarter: boolean
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${Math.round(value).toLocaleString()}`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

type DownloadFormat = 'html' | 'pdf' | 'docx' | 'md' | 'json'

export function FormKeyDemoPanel({ onCreateBlank, onUseStarter, creatingStarter }: FormKeyDemoPanelProps) {
  const [showDocumentBuilder, setShowDocumentBuilder] = useState(false)
  const [selectedTownCode, setSelectedTownCode] = useState<number>(297)
  const [selectedTemplateId, setSelectedTemplateId] = useState(FORMKEY_DOCUMENT_TEMPLATES[0]?.id ?? 'board-brief')
  const [customAudience, setCustomAudience] = useState('')
  const [documentGoal, setDocumentGoal] = useState('')
  const [townSnapshot, setTownSnapshot] = useState<FormKeyTownSnapshot | null>(null)
  const [pullingTownData, setPullingTownData] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<DownloadFormat | null>(null)
  const [townDataError, setTownDataError] = useState<string | null>(null)

  const selectedMunicipality = useMemo(
    () => MA_MUNICIPALITIES.find(municipality => municipality.dor_code === selectedTownCode) ?? MA_MUNICIPALITIES[0],
    [selectedTownCode],
  )
  const selectedTemplate = useMemo(
    () => FORMKEY_DOCUMENT_TEMPLATES.find(template => template.id === selectedTemplateId) ?? FORMKEY_DOCUMENT_TEMPLATES[0],
    [selectedTemplateId],
  )
  const preparedFor = customAudience.trim() || selectedTemplate.defaultAudience
  const documentPackage = useMemo(
    () => buildMunicipalDocumentPackage({
      municipality: selectedMunicipality,
      template: selectedTemplate,
      snapshot: townSnapshot,
      audience: preparedFor,
      goal: documentGoal,
    }),
    [documentGoal, preparedFor, selectedMunicipality, selectedTemplate, townSnapshot],
  )

  const metricCards = [
    {
      label: 'Operating budget',
      value: formatCurrency(townSnapshot?.metrics.operatingBudget),
      detail: 'Ground the packet in real scale, not guesswork.',
    },
    {
      label: 'Free cash',
      value: formatPercent(townSnapshot?.metrics.freeCashPctBudget),
      detail: 'Shows cushion before the budget turn gets tight.',
    },
    {
      label: 'Levy headroom',
      value: formatPercent(townSnapshot?.metrics.excessLevyCapacityPct),
      detail: 'Signals tax-room pressure under Prop 2 1/2.',
    },
    {
      label: 'Staff footprint',
      value: townSnapshot?.metrics.totalEmployees?.toLocaleString() ?? '—',
      detail: 'Keeps staffing strain visible in the document itself.',
    },
  ]

  const meaningfulFlags = townSnapshot?.riskFlags.filter(flag => flag.severity !== 'passing').slice(0, 3) ?? []

  const handlePullTownData = async () => {
    setPullingTownData(true)
    setTownDataError(null)
    toast.loading(`Pulling LogicDASH civic data for ${selectedMunicipality.name}…`, { id: 'formkey-town-data' })
    try {
      const data = await pjApi.fiscal.sync(selectedMunicipality.name)
      setTownSnapshot(data as unknown as FormKeyTownSnapshot)
      toast.success(`${selectedMunicipality.name} civic template data is now grounding the document builder.`, { id: 'formkey-town-data' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTownDataError(message)
      toast.error(`Could not pull LogicDASH data: ${message}`, { id: 'formkey-town-data' })
    } finally {
      setPullingTownData(false)
    }
  }

  const handleDownload = async (format: DownloadFormat) => {
    setDownloadingFormat(format)
    try {
      if (format === 'html') {
        downloadBlob(new Blob([documentPackage.htmlContent], { type: 'text/html' }), `${documentPackage.filenameStem}.html`)
      } else if (format === 'json') {
        downloadBlob(new Blob([documentPackage.dataContent], { type: 'application/json' }), `${documentPackage.filenameStem}.json`)
      } else {
        const blob = await generateDocument({
          title: documentPackage.title,
          content: documentPackage.textContent,
          format,
        })
        downloadBlob(blob, `${documentPackage.filenameStem}.${format}`)
      }
      toast.success(`${documentPackage.title} downloaded as ${format.toUpperCase()}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Document download failed')
    } finally {
      setDownloadingFormat(null)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-muted/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <ShieldCheck size={14} weight="fill" />
                FormKey
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Create a form without needing a training session first.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Start with a civic template or a blank form. Add the fields you need, make it live once, then share it by link, QR code, or embed.
                FormKey is broader than municipal work; the heavier Civic Templates builder is still here when you need it, but it stays out of the way until then.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Start with a template', 'Public share-ready', 'QR and embed included', 'Advanced tools when needed'].map(item => (
                  <Badge key={item} variant="secondary" className="bg-primary/10 text-primary">
                    {item}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" onClick={onUseStarter} className="gap-2" disabled={creatingStarter}>
                  <ClipboardText size={16} />
                  {creatingStarter ? 'Creating template…' : 'Start with Civic Template'}
                </Button>
                <Button onClick={onCreateBlank} className="gap-2">
                  <Plus size={16} />
                  Create blank form
                </Button>
                <Button variant="ghost" onClick={() => setShowDocumentBuilder(value => !value)} className="gap-2 text-muted-foreground">
                  <Sparkle size={16} />
                  {showDocumentBuilder ? 'Hide advanced document builder' : 'Open advanced document builder'}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What staff sees first</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {[
                  { title: 'Pick a simple starting point', detail: 'Choose a civic template or a blank form. You do not need to set everything up at once.' },
                  { title: 'Make it live when it is ready', detail: 'Build the fields first, then publish once to get the public link, QR code, and embed options.' },
                  { title: 'Use advanced tools later', detail: 'The LogicDASH-backed document builder is still available, but it should not block a basic public form.' },
                ].map(item => (
                  <div key={item.title} className="rounded-xl border bg-card p-3">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {showDocumentBuilder ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-6">
                <div className="rounded-3xl border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Buildings size={14} />
                    Civic Templates · pull LogicDASH data
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">Municipality</span>
                      <select
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={selectedTownCode}
                        onChange={event => setSelectedTownCode(Number(event.target.value))}
                      >
                        {MA_MUNICIPALITIES.map(municipality => (
                          <option key={municipality.dor_code} value={municipality.dor_code}>
                            {municipality.name} · {municipality.county}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <Button onClick={handlePullTownData} disabled={pullingTownData} className="gap-2">
                        <Sparkle size={15} />
                        {pullingTownData ? 'Pulling…' : 'Pull LogicDASH data'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                    {townSnapshot
                      ? documentPackage.sourceStamp
                      : `${selectedMunicipality.name} is ready. Pull live LogicDASH data to ground this civic template in budget, staffing, reserve, and risk signals.`}
                  </div>
                  {townDataError && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {townDataError}
                    </div>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {metricCards.map(card => (
                      <div key={card.label} className="rounded-2xl border bg-muted/20 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{card.label}</div>
                        <div className="mt-2 text-xl font-semibold">{card.value}</div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Risk watch</div>
                    <div className="mt-3 space-y-2">
                      {meaningfulFlags.length > 0 ? meaningfulFlags.map(flag => (
                        <div key={flag.code} className="rounded-xl border bg-card px-3 py-2">
                          <div className="text-sm font-medium">{flag.label}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">{flag.detail}</div>
                        </div>
                      )) : (
                        <div className="rounded-xl border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
                          Pulling LogicDASH data will surface the active warnings that should shape the civic packet or memo.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Link size={14} />
                    FormKey field carry-forward
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.fieldFocus.map(field => (
                      <Badge key={field} variant="outline" className="bg-muted/30">
                        {field}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    These are the governed fields a civic team will usually want if this document becomes a repeatable intake, notice, or approval workflow later.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <CheckCircle size={14} />
                    Choose the civic template
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {FORMKEY_DOCUMENT_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          selectedTemplate.id === template.id ? 'border-primary bg-primary/5' : 'bg-muted/20 hover:bg-muted/30'
                        }`}
                      >
                        <div className="text-sm font-medium">{template.label}</div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">{template.summary}</div>
                        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{template.outcome}</div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">Prepared for</span>
                      <input
                        value={customAudience}
                        onChange={event => setCustomAudience(event.target.value)}
                        placeholder={selectedTemplate.defaultAudience}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">Document goal</span>
                      <input
                        value={documentGoal}
                        onChange={event => setDocumentGoal(event.target.value)}
                        placeholder="What should this document help the audience decide or explain?"
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      { format: 'html' as const, label: 'Download HTML' },
                      { format: 'pdf' as const, label: 'Download PDF' },
                      { format: 'docx' as const, label: 'Download DOCX' },
                      { format: 'md' as const, label: 'Download MD' },
                      { format: 'json' as const, label: 'Download JSON' },
                    ].map(item => (
                      <Button
                        key={item.format}
                        variant={item.format === 'html' ? 'default' : 'outline'}
                        onClick={() => handleDownload(item.format)}
                        disabled={downloadingFormat !== null}
                        className="gap-2"
                      >
                        <DownloadSimple size={15} />
                        {downloadingFormat === item.format ? 'Preparing…' : item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Database size={14} />
                    Generated preview
                  </div>
                  <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                    <div className="text-sm font-semibold">{documentPackage.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{documentPackage.sourceStamp}</div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
                    <iframe
                      title="FormKey civic template preview"
                      srcDoc={documentPackage.htmlContent}
                      className="h-[520px] w-full"
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <CheckCircle size={14} />
                Fastest path
              </div>
              <div className="space-y-3">
                {[
                  'Use the governed starter if you want to prove the full public-share flow in minutes.',
                  'Create a blank form if you already know the fields you need.',
                  'Open the document builder only when you want LogicDASH-backed packets and exports.',
                ].map(item => (
                  <div key={item} className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkle size={14} />
                Expand when you need more power
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-sm font-semibold">{selectedMunicipality.name} {selectedTemplate.label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  The Civic Templates builder can pull live LogicDASH data, surface risk signals, and export as HTML, PDF, DOCX, Markdown, or JSON.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['LogicDASH data', 'Governed packet', 'Shareable exports'].map(item => (
                    <Badge key={item} variant="outline" className="bg-card">
                      {item}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setShowDocumentBuilder(true)} className="gap-2">
                    <Sparkle size={15} />
                    Open Civic Templates builder
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Link size={14} />
              Intake still ships with it
            </div>
            <div className="space-y-3">
              {FORMKEY_DEMO_FIELDS.map(field => (
                <div key={field.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{field.label}</div>
                    <Badge variant="outline" className="text-[10px] capitalize">{field.type}</Badge>
                    {field.required && <span className="text-[10px] font-semibold text-primary">required</span>}
                    {field.pii && <span className="text-[10px] font-semibold text-amber-600">PII</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {field.id === 'consent' ? 'Consent is explicit and part of the record.' : 'The same governed field model still powers shareable public intake forms.'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Database size={14} />
              Sample submissions
            </div>
            <div className="space-y-3">
              {FORMKEY_DEMO_SUBMISSIONS.map(sample => (
                <div key={sample.submitterId} className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-sm font-medium">{sample.preview}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(sample.fields).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-card px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                        <div className="mt-1 text-sm">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
