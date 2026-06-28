import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ArrowClockwise, Lightning, CheckCircle, WarningCircle, XCircle,
  PauseCircle, Archive, Database, Pulse, Plus, Play, Pause,
  Shield, ClockCountdown, ArrowRight, X,
  WarningOctagon, ArrowUUpLeft, CaretRight, Rows,
  Trash, PencilSimple,
} from '@phosphor-icons/react'
import { pjApi } from '@/services/pjApi'
import synchron8Logo from '@/assets/images/Synchron8.webp'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'feeds' | 'jobs'
type FeedStatus = 'draft' | 'active' | 'paused' | 'retired'

interface SyncJob {
  jobId: string; feedId: string; status: string; triggerType: string
  startedAt: string; completedAt?: string
  stats: { ingested: number; skipped: number; blocked: number; delivered: number }
}

interface FieldMap { sourceField: string; targetField: string; required?: boolean; piiClass?: string }

interface FeedDef {
  feedId: string; displayName: string; status: FeedStatus
  source: { type: string; connectorId: string; config?: Record<string, string> }
  sinks: Array<{ type: string; connectorId: string; config?: Record<string, string> }>
  fieldMap: FieldMap[]; syncConfig: { scheduleExpression?: string; dlpInboundAction?: string; batchSize?: number }
  lastSyncAt?: string; createdAt?: string
}

interface Dashboard {
  activeFeeds: number; jobsToday: number; recordsIngested: number; dlpBlocks: number
  recentJobs: SyncJob[]
}

interface FeedRecord {
  recordId: string; externalId: string; sourceUpdatedAt: string; createdAt: string
  fields: Record<string, { value: unknown; piiClass?: string; masked?: boolean }>
}

interface DlpReport { totalRecords: number; recordsWithFindings: number; findings: Array<{ recordId: string; findings: Array<{ field: string; entityType: string; confidence: string }> }> }
interface AuditEntry { logId: string; eventType: string; actor: { userId: string; role: string }; createdAt: string; data?: Record<string, unknown> }

// ── Source / Sink catalogs ────────────────────────────────────────────────────

const SOURCE_TYPES = [
  { type: 'civicplus',   label: 'CivicPlus PADS',  icon: '🏛️', fields: [
    { key: 'baseUrl',      label: 'PADS API URL',                  placeholder: 'https://api.civicplus.com/pads/v2' },
    { key: 'clientId',     label: 'Client ID',                     placeholder: '' },
    { key: 'clientSecret', label: 'Client Secret',                  placeholder: '' },
    { key: 'formId',       label: 'Form ID (blank = all forms)',    placeholder: '' },
  ]},
  { type: 'monday',      label: 'Monday.com',  icon: '📋', fields: [{ key: 'boardId', label: 'Board ID' }, { key: 'apiToken', label: 'API Token' }] },
  { type: 'salesforce',  label: 'Salesforce',  icon: '☁️', fields: [{ key: 'object', label: 'Object (e.g. Contact)' }, { key: 'clientId', label: 'Client ID' }] },
  { type: 'polimorphic', label: 'Webhook',     icon: '🔗', fields: [{ key: 'secret', label: 'Webhook Secret' }] },
]

const SINK_TYPES = [
  { type: 'orgmanager', label: 'Org Manager',  icon: '🏢', fields: [{ key: 'matchField', label: 'Match on field', placeholder: 'employee_id' }, { key: 'onConflict', label: 'On conflict (update/skip)', placeholder: 'update' }] },
  { type: 'powerbi',    label: 'Power BI',     icon: '📊', fields: [{ key: 'datasetId', label: 'Dataset ID' }, { key: 'tableId', label: 'Table ID' }] },
  { type: 'kahana',     label: 'Kahana',       icon: '📦', fields: [{ key: 'bundleId', label: 'Bundle ID' }] },
]

const DLP_ACTIONS = ['mask', 'redact', 'block']
const SCHEDULE_PRESETS = [
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Hourly',       value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Manual only', value: '' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    completed:    { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle size={10} /> },
    partial:      { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       icon: <WarningCircle size={10} /> },
    failed:       { color: 'bg-red-500/10 text-red-400 border-red-500/20',             icon: <XCircle size={10} /> },
    running:      { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',          icon: <Pulse size={10} /> },
    queued:       { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',       icon: <Archive size={10} /> },
    active:       { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle size={10} /> },
    paused:       { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       icon: <PauseCircle size={10} /> },
    draft:        { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',       icon: <PencilSimple size={10} /> },
    retired:      { color: 'bg-red-500/10 text-red-400 border-red-500/20',             icon: <XCircle size={10} /> },
    delivering:   { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',          icon: <Pulse size={10} /> },
    transforming: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',    icon: <Pulse size={10} /> },
  }
  const { color, icon } = map[status] ?? map.queued
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase ${color}`}>
      {icon}{status}
    </span>
  )
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function dur(start: string, end?: string) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// ── New Feed Wizard ───────────────────────────────────────────────────────────

interface WizardState {
  displayName: string
  sourceType: string; sourceConnectorId: string; sourceConfig: Record<string, string>
  sinks: Array<{ type: string; connectorId: string; config: Record<string, string> }>
  fieldMap: FieldMap[]
  scheduleExpression: string; dlpAction: string; batchSize: number
}

const BLANK_WIZARD: WizardState = {
  displayName: '', sourceType: '', sourceConnectorId: '', sourceConfig: {},
  sinks: [{ type: '', connectorId: '', config: {} }],
  fieldMap: [{ sourceField: '', targetField: '' }],
  scheduleExpression: '', dlpAction: 'mask', batchSize: 100,
}

type WizardStep = 'source' | 'sinks' | 'fields' | 'schedule'
const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'source',   label: 'Source',   icon: <Database size={14} /> },
  { id: 'sinks',    label: 'Delivery', icon: <ArrowRight size={14} /> },
  { id: 'fields',   label: 'Fields',   icon: <Rows size={14} /> },
  { id: 'schedule', label: 'Schedule', icon: <ClockCountdown size={14} /> },
]

function NewFeedWizard({ onSave, onCancel }: { onSave: (feed: FeedDef) => void; onCancel: () => void }) {
  const [step, setStep] = useState<WizardStep>('source')
  const [w, setW] = useState<WizardState>(BLANK_WIZARD)
  const [saving, setSaving] = useState(false)

  function patchW(patch: Partial<WizardState>) { setW(prev => ({ ...prev, ...patch })) }
  function patchSink(i: number, patch: Partial<WizardState['sinks'][0]>) {
    const sinks = w.sinks.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    patchW({ sinks })
  }
  function patchField(i: number, patch: Partial<FieldMap>) {
    const fieldMap = w.fieldMap.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    patchW({ fieldMap })
  }

  const stepIdx = WIZARD_STEPS.findIndex(s => s.id === step)
  const srcMeta = SOURCE_TYPES.find(s => s.type === w.sourceType)

  async function save() {
    if (!w.displayName || !w.sourceType) { toast.error('Fill in name and source'); return }
    setSaving(true)
    try {
      const payload = {
        displayName: w.displayName,
        source: { type: w.sourceType, connectorId: w.sourceConnectorId || w.sourceType, config: w.sourceConfig },
        sinks: w.sinks.filter(s => s.type).map(s => ({ type: s.type, connectorId: s.connectorId || s.type, config: s.config })),
        fieldMap: w.fieldMap.filter(f => f.sourceField && f.targetField),
        syncConfig: {
          scheduleExpression: w.scheduleExpression || undefined,
          dlpInboundAction: w.dlpAction,
          batchSize: w.batchSize,
        },
      }
      const res = await pjApi.syncronate.createFeed(payload) as Record<string, unknown>
      const feed = res?.data ?? res
      toast.success(`Feed "${w.displayName}" created`)
      onSave(feed as FeedDef)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create feed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Wizard header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
        <h2 className="text-sm font-bold text-slate-200">New Feed</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i <= stepIdx && setStep(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                s.id === step ? 'bg-violet-600 text-white' : i < stepIdx ? 'text-violet-400 hover:text-white' : 'text-slate-600'
              }`}
            >
              {s.icon}{s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
        {/* Feed name — always visible */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Feed Name</Label>
          <Input
            value={w.displayName}
            onChange={e => patchW({ displayName: e.target.value })}
            placeholder="e.g. Monday → Power BI nightly"
            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* ── Source step ── */}
        {step === 'source' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400 mb-2 block">Source Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_TYPES.map(s => (
                  <button
                    key={s.type}
                    onClick={() => patchW({ sourceType: s.type, sourceConfig: {} })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      w.sourceType === s.type
                        ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="text-xs font-semibold">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {srcMeta && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Connector ID</Label>
                  <Input
                    value={w.sourceConnectorId}
                    onChange={e => patchW({ sourceConnectorId: e.target.value })}
                    placeholder={`${w.sourceType}-connector-1`}
                    className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                {srcMeta.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs text-slate-400">{f.label}</Label>
                    <Input
                      value={w.sourceConfig[f.key] ?? ''}
                      onChange={e => patchW({ sourceConfig: { ...w.sourceConfig, [f.key]: e.target.value } })}
                      className="bg-slate-800 border-slate-700 text-slate-200"
                      type={f.key.toLowerCase().includes('token') || f.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                    />
                  </div>
                ))}
                {w.sourceType === 'polimorphic' && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                    <p className="font-semibold text-slate-300 mb-1">Webhook URL (after activation)</p>
                    <p className="font-mono text-violet-400">POST {'{api}'}/api/syncronate/polimorphic/webhook</p>
                    <p className="mt-1">Send your webhook secret in <span className="font-mono">x-hub-signature-256</span></p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Sinks step ── */}
        {step === 'sinks' && (
          <div className="space-y-4">
            {w.sinks.map((sink, i) => {
              const sinkMeta = SINK_TYPES.find(s => s.type === sink.type)
              return (
                <div key={i} className="border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">Destination {i + 1}</p>
                    {w.sinks.length > 1 && (
                      <button onClick={() => patchW({ sinks: w.sinks.filter((_, idx) => idx !== i) })} className="text-slate-600 hover:text-red-400">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SINK_TYPES.map(s => (
                      <button
                        key={s.type}
                        onClick={() => patchSink(i, { type: s.type, config: {} })}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          sink.type === s.type ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-lg">{s.icon}</span>
                        <div className="text-xs font-semibold mt-1">{s.label}</div>
                      </button>
                    ))}
                  </div>
                  {sinkMeta && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-400">Connector ID</Label>
                        <Input
                          value={sink.connectorId}
                          onChange={e => patchSink(i, { connectorId: e.target.value })}
                          placeholder={`${sink.type}-out-1`}
                          className="bg-slate-800 border-slate-700 text-slate-200"
                        />
                      </div>
                      {sinkMeta.fields.map(f => (
                        <div key={f.key} className="space-y-1.5">
                          <Label className="text-xs text-slate-400">{f.label}</Label>
                          <Input
                            value={sink.config[f.key] ?? ''}
                            onChange={e => patchSink(i, { config: { ...sink.config, [f.key]: e.target.value } })}
                            className="bg-slate-800 border-slate-700 text-slate-200"
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
            <button
              onClick={() => patchW({ sinks: [...w.sinks, { type: '', connectorId: '', config: {} }] })}
              className="w-full border border-dashed border-slate-700 rounded-lg py-3 text-xs text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={13} /> Add another destination
            </button>
          </div>
        )}

        {/* ── Fields step ── */}
        {step === 'fields' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Map source fields to destination field names. Mark fields as PII to trigger DLP scanning.</p>
            <div className="grid grid-cols-[1fr_1fr_80px_60px] gap-2 text-[10px] text-slate-500 font-semibold uppercase px-1">
              <span>Source field</span><span>Target field</span><span>PII class</span><span></span>
            </div>
            {w.fieldMap.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_60px] gap-2 items-center">
                <Input value={f.sourceField} onChange={e => patchField(i, { sourceField: e.target.value })}
                  placeholder="source_name" className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8" />
                <Input value={f.targetField} onChange={e => patchField(i, { targetField: e.target.value })}
                  placeholder="TargetName" className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8" />
                <select
                  value={f.piiClass ?? ''}
                  onChange={e => patchField(i, { piiClass: e.target.value || undefined })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md h-8 px-2"
                >
                  <option value="">None</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="ssn">SSN</option>
                  <option value="name">Name</option>
                  <option value="dob">DOB</option>
                </select>
                <button onClick={() => patchW({ fieldMap: w.fieldMap.filter((_, idx) => idx !== i) })}
                  className="text-slate-600 hover:text-red-400 flex items-center justify-center h-8">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={() => patchW({ fieldMap: [...w.fieldMap, { sourceField: '', targetField: '' }] })}
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              <Plus size={12} /> Add field mapping
            </button>
          </div>
        )}

        {/* ── Schedule step ── */}
        {step === 'schedule' && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-slate-400 mb-2 block">Run Schedule</Label>
              <div className="grid grid-cols-2 gap-2">
                {SCHEDULE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => patchW({ scheduleExpression: p.value })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      w.scheduleExpression === p.value ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-semibold">{p.label}</div>
                    {p.value && <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.value}</div>}
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-slate-400">Custom cron expression</Label>
                <Input value={w.scheduleExpression} onChange={e => patchW({ scheduleExpression: e.target.value })}
                  placeholder="*/15 * * * *" className="bg-slate-800 border-slate-700 text-slate-200 font-mono text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-400 mb-2 block">DLP Action (when PII is detected)</Label>
              <div className="flex gap-2">
                {DLP_ACTIONS.map(a => (
                  <button key={a} onClick={() => patchW({ dlpAction: a })}
                    className={`flex-1 py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${
                      w.dlpAction === a ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {a === 'mask' ? '●●● Mask' : a === 'redact' ? '█ Redact' : '🚫 Block'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Mask replaces with ●●●, redact removes the field, block stops the whole record from being delivered.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Batch Size</Label>
              <div className="flex items-center gap-3">
                <Input type="number" value={w.batchSize} min={1} max={1000}
                  onChange={e => patchW({ batchSize: parseInt(e.target.value) || 100 })}
                  className="bg-slate-800 border-slate-700 text-slate-200 w-24 text-xs" />
                <span className="text-xs text-slate-500">records per sync batch</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wizard footer */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => stepIdx > 0 && setStep(WIZARD_STEPS[stepIdx - 1].id)}
          disabled={stepIdx === 0}
          className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-400 h-7 text-xs">Cancel</Button>
          {stepIdx < WIZARD_STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(WIZARD_STEPS[stepIdx + 1].id)}
              disabled={!w.displayName || (step === 'source' && !w.sourceType)}
              className="h-7 text-xs bg-violet-600 hover:bg-violet-500">
              Next →
            </Button>
          ) : (
            <Button size="sm" onClick={save} disabled={saving}
              className="h-7 text-xs bg-violet-600 hover:bg-violet-500">
              {saving ? 'Creating…' : 'Create Feed'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Feed Detail Drawer ────────────────────────────────────────────────────────

type DetailTab = 'jobs' | 'records' | 'dlp' | 'audit'

function FeedDetail({ feed, onClose, onRefresh }: { feed: FeedDef; onClose: () => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<DetailTab>('jobs')
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [records, setRecords] = useState<FeedRecord[]>([])
  const [dlp, setDlp] = useState<DlpReport | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [actioning, setActioning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'jobs') {
        const d = await pjApi.syncronate.listJobs(feed.feedId) as Record<string, unknown>
        setJobs((d?.data as Record<string, unknown>)?.jobs as SyncJob[] ?? d?.jobs as SyncJob[] ?? [])
      } else if (tab === 'records') {
        const d = await pjApi.syncronate.listRecords(feed.feedId) as Record<string, unknown>
        setRecords((d?.data as Record<string, unknown>)?.records as FeedRecord[] ?? d?.records as FeedRecord[] ?? [])
      } else if (tab === 'dlp') {
        const d = await pjApi.syncronate.dlpReport(feed.feedId) as Record<string, unknown>
        setDlp((d?.data ?? d) as DlpReport | null)
      } else if (tab === 'audit') {
        const d = await pjApi.syncronate.feedAudit(feed.feedId) as Record<string, unknown>
        setAudit((d?.data as Record<string, unknown>)?.entries as AuditEntry[] ?? d?.entries as AuditEntry[] ?? [])
      }
    } catch { /* silently */ } finally { setLoading(false) }
  }, [feed.feedId, tab])

  useEffect(() => { load() }, [load])

  async function runNow() {
    setActioning(true)
    try { await pjApi.syncronate.triggerSync(feed.feedId); toast.success('Sync queued'); setTimeout(load, 800) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Trigger failed') }
    finally { setActioning(false) }
  }

  async function togglePause() {
    setActioning(true)
    try {
      if (feed.status === 'active') { await pjApi.syncronate.pauseFeed(feed.feedId); toast.success('Feed paused') }
      else { await pjApi.syncronate.activateFeed(feed.feedId); toast.success('Feed activated') }
      onRefresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed') }
    finally { setActioning(false) }
  }

  async function retireFeed() {
    if (!confirm(`Retire "${feed.displayName}"? This cannot be undone.`)) return
    setActioning(true)
    try { await pjApi.syncronate.retireFeed(feed.feedId); toast.success('Feed retired'); onClose(); onRefresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Retire failed') }
    finally { setActioning(false) }
  }

  async function retrySinks(jobId: string) {
    try { await pjApi.syncronate.retrySinks(feed.feedId, jobId); toast.success('Retrying sinks…'); setTimeout(load, 800) }
    catch { toast.error('Retry failed') }
  }

  const DETAIL_TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'jobs',    label: 'Jobs',    icon: <Lightning size={12} /> },
    { id: 'records', label: 'Records', icon: <Database size={12} /> },
    { id: 'dlp',     label: 'DLP',     icon: <Shield size={12} /> },
    { id: 'audit',   label: 'Audit',   icon: <ClockCountdown size={12} /> },
  ]

  return (
    <div className="w-[520px] shrink-0 border-l border-border flex flex-col bg-[#0d1117] h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 mt-0.5 shrink-0"><X size={15} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-200 text-sm truncate">{feed.displayName}</p>
            {statusBadge(feed.status)}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">{feed.source.type} → {feed.sinks.map(s => s.type).join(', ') || 'no sinks'}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        {feed.status === 'active' && (
          <Button size="sm" onClick={runNow} disabled={actioning} className="h-7 text-xs bg-violet-600 hover:bg-violet-500 gap-1">
            <Lightning size={12} />Run Now
          </Button>
        )}
        {(feed.status === 'active' || feed.status === 'paused') && (
          <Button size="sm" variant="outline" onClick={togglePause} disabled={actioning}
            className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1">
            {feed.status === 'active' ? <><Pause size={12} />Pause</> : <><Play size={12} />Activate</>}
          </Button>
        )}
        {feed.status === 'draft' && (
          <Button size="sm" onClick={async () => { setActioning(true); try { await pjApi.syncronate.activateFeed(feed.feedId); toast.success('Feed activated!'); onRefresh() } catch { toast.error('Activate failed') } finally { setActioning(false) } }}
            disabled={actioning} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1">
            <Play size={12} />Activate Feed
          </Button>
        )}
        {feed.status !== 'retired' && (
          <button onClick={retireFeed} disabled={actioning} className="ml-auto text-[10px] text-slate-600 hover:text-red-400 flex items-center gap-1">
            <Trash size={11} />Retire
          </button>
        )}
      </div>

      {/* Detail tabs */}
      <div className="flex border-b border-border px-4">
        {DETAIL_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-violet-500 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Detail content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading ? (
          <div className="text-slate-500 text-xs text-center py-8">Loading…</div>
        ) : tab === 'jobs' ? (
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-8">No jobs yet — activate and run the feed.</div>
            ) : jobs.map(job => (
              <div key={job.jobId} className="border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  {statusBadge(job.status)}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{dur(job.startedAt, job.completedAt)}</span>
                    <span className="text-[10px] text-slate-500">{ago(job.startedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-4 text-[10px]">
                  <span className="text-emerald-400">↓ {job.stats?.ingested ?? 0} in</span>
                  <span className="text-amber-400">⊘ {job.stats?.skipped ?? 0} skip</span>
                  <span className="text-red-400">⛔ {job.stats?.blocked ?? 0} block</span>
                  <span className="text-blue-400">↑ {job.stats?.delivered ?? 0} out</span>
                  {job.status === 'partial' && (
                    <button onClick={() => retrySinks(job.jobId)} className="ml-auto text-violet-400 hover:text-violet-300 flex items-center gap-1">
                      <ArrowUUpLeft size={11} />retry sinks
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'records' ? (
          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-8">No records synced yet.</div>
            ) : records.map(rec => (
              <div key={rec.recordId} className="border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-400">{rec.externalId}</span>
                  <span className="text-[10px] text-slate-500">{ago(rec.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(rec.fields).slice(0, 6).map(([k, v]) => (
                    <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${v.masked ? 'bg-red-900/30 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                      {k}: {v.masked ? '●●●' : String(v.value).slice(0, 20)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'dlp' ? (
          dlp ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <div className="text-xl font-bold font-mono text-slate-200">{dlp.totalRecords}</div>
                  <div className="text-[10px] text-slate-400">Total Records</div>
                </div>
                <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-3">
                  <div className="text-xl font-bold font-mono text-red-400">{dlp.recordsWithFindings}</div>
                  <div className="text-[10px] text-slate-400">PII Detected</div>
                </div>
              </div>
              {dlp.findings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Findings</p>
                  {dlp.findings.slice(0, 20).map((f, i) => (
                    <div key={i} className="border border-slate-800 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] font-mono text-slate-400">{f.recordId.slice(0, 12)}…</p>
                      {f.findings.map((fi, j) => (
                        <div key={j} className="flex items-center gap-2 text-[10px]">
                          <WarningOctagon size={11} className="text-red-400" />
                          <span className="text-slate-300 font-mono">{fi.field}</span>
                          <span className="text-red-400">{fi.entityType}</span>
                          <span className="text-slate-500 ml-auto">{fi.confidence}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {dlp.recordsWithFindings === 0 && (
                <div className="text-center py-6 text-emerald-400 text-sm">
                  <CheckCircle size={24} className="mx-auto mb-2" />
                  No PII detected in this feed's records.
                </div>
              )}
            </div>
          ) : <div className="text-slate-500 text-xs text-center py-8">No DLP data yet.</div>
        ) : (
          <div className="space-y-2">
            {audit.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-8">No audit entries yet.</div>
            ) : audit.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-xs py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{ago(e.createdAt)}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-violet-400 text-[10px]">{e.eventType}</span>
                  <span className="text-slate-400 ml-2">by {e.actor?.role ?? 'system'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardTab({ dashboard, loading }: { dashboard: Dashboard | null; loading: boolean }) {
  if (loading) return <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>
  if (!dashboard) return <div className="text-slate-500 text-sm py-12 text-center">No data</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Feeds',      value: dashboard.activeFeeds,     color: 'text-emerald-400' },
          { label: 'Jobs Today',        value: dashboard.jobsToday,       color: 'text-blue-400'    },
          { label: 'Records Ingested',  value: dashboard.recordsIngested, color: 'text-violet-400'  },
          { label: 'DLP Blocks',        value: dashboard.dlpBlocks,       color: 'text-red-400'     },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
            <div className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Recent Jobs</p>
        {dashboard.recentJobs.length === 0 ? (
          <div className="text-slate-500 text-sm py-6 text-center">No recent jobs</div>
        ) : (
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  {['Feed', 'Status', 'Records', 'Duration', 'When'].map(h => (
                    <th key={h} className={`p-2 text-slate-500 font-medium ${h === 'Feed' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.recentJobs.map(job => (
                  <tr key={job.jobId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="p-2 font-mono text-slate-400">{job.feedId.slice(0, 10)}…</td>
                    <td className="p-2">{statusBadge(job.status)}</td>
                    <td className="p-2 text-right text-slate-300">{job.stats?.ingested ?? 0}</td>
                    <td className="p-2 text-right text-slate-500">{dur(job.startedAt, job.completedAt)}</td>
                    <td className="p-2 text-right text-slate-500">{ago(job.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Feeds list ────────────────────────────────────────────────────────────────

function FeedsTab({
  feeds, loading, selectedFeed, onSelect, onNew, onRefresh: _onRefresh,
}: {
  feeds: FeedDef[]; loading: boolean; selectedFeed: FeedDef | null
  onSelect: (f: FeedDef | null) => void; onNew: () => void; onRefresh: () => void
}) {
  if (loading) return <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{feeds.length} feed{feeds.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={onNew} className="h-7 text-xs bg-violet-600 hover:bg-violet-500 gap-1">
          <Plus size={12} />New Feed
        </Button>
      </div>

      {feeds.length === 0 ? (
        <div className="text-center py-16">
          <Database size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium mb-1">No feeds yet</p>
          <p className="text-slate-600 text-xs mb-4">Create your first sync pipeline to start moving data.</p>
          <Button onClick={onNew} className="bg-violet-600 hover:bg-violet-500 text-xs h-8 gap-1">
            <Plus size={12} />Create Feed
          </Button>
        </div>
      ) : feeds.map(feed => (
        <div
          key={feed.feedId}
          onClick={() => onSelect(selectedFeed?.feedId === feed.feedId ? null : feed)}
          className={`rounded-lg border p-4 cursor-pointer transition-all ${
            selectedFeed?.feedId === feed.feedId
              ? 'border-violet-500/50 bg-violet-500/5'
              : 'border-slate-800 bg-slate-800/20 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-sm">{feed.displayName}</span>
              {statusBadge(feed.status)}
            </div>
            <CaretRight size={14} className={`text-slate-600 transition-transform ${selectedFeed?.feedId === feed.feedId ? 'rotate-90' : ''}`} />
          </div>
          <div className="flex gap-4 text-[10px] text-slate-500">
            <span>Source: <span className="text-slate-400">{feed.source.type}</span></span>
            <span>Sinks: <span className="text-slate-400">{feed.sinks.map(s => s.type).join(', ') || '—'}</span></span>
            <span>Fields: <span className="text-slate-400">{feed.fieldMap?.length ?? 0}</span></span>
            {feed.lastSyncAt && <span>Last sync: <span className="text-slate-400">{ago(feed.lastSyncAt)}</span></span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Jobs list ─────────────────────────────────────────────────────────────────

function JobsTab({ jobs, loading }: { jobs: SyncJob[]; loading: boolean }) {
  if (loading) return <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>

  return (
    <div>
      {jobs.length === 0 ? (
        <div className="text-slate-500 text-sm py-12 text-center">No jobs</div>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                {['Feed', 'Status', 'In', 'Skip', 'Block', 'Duration', 'Trigger'].map(h => (
                  <th key={h} className={`p-2 text-slate-500 font-medium ${h === 'Feed' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.jobId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-2 font-mono text-slate-400">{job.feedId.slice(0, 10)}…</td>
                  <td className="p-2">{statusBadge(job.status)}</td>
                  <td className="p-2 text-right text-emerald-400">{job.stats?.ingested ?? 0}</td>
                  <td className="p-2 text-right text-amber-400">{job.stats?.skipped ?? 0}</td>
                  <td className="p-2 text-right text-red-400">{job.stats?.blocked ?? 0}</td>
                  <td className="p-2 text-right text-slate-500">{dur(job.startedAt, job.completedAt)}</td>
                  <td className="p-2 text-right text-slate-500">{job.triggerType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SyncronatePanel() {
  const [tab, setTab] = useState<Tab>('feeds')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [feeds, setFeeds] = useState<FeedDef[]>([])
  const [allJobs, setAllJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFeed, setSelectedFeed] = useState<FeedDef | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dashData, feedsData] = await Promise.all([
        pjApi.syncronate.dashboard() as Promise<any>,
        pjApi.syncronate.listFeeds() as Promise<any>,
      ])
      const d = dashData?.data ?? dashData
      const f = feedsData?.data ?? feedsData
      setDashboard(d)
      setFeeds(f?.feeds ?? [])
      setAllJobs(d?.recentJobs ?? [])
    } catch { toast.error('Failed to load Syncronate') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (creating) {
    return (
      <div className="flex flex-col h-full bg-[#0d1117] text-slate-200">
        <NewFeedWizard
          onSave={() => { setCreating(false); load() }}
          onCancel={() => setCreating(false)}
        />
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'feeds',     label: 'Feeds' },
    { key: 'jobs',      label: 'All Jobs' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <img src={synchron8Logo} alt="SYNCHRON8" className="h-7 w-auto"
          style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.65)) drop-shadow(0 0 10px rgba(74,222,128,0.35))' }} />
        <div className="flex-1">
          <div className="text-[9px] text-slate-600 uppercase tracking-widest">Data-in pipeline — pulls records from external systems into Workspace on a schedule</div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-400" onClick={load}>
          <ArrowClockwise size={13} />Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 px-4 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-violet-500 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body — split when feed selected */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === 'dashboard' && <DashboardTab dashboard={dashboard} loading={loading} />}
          {tab === 'feeds' && (
            <FeedsTab
              feeds={feeds} loading={loading} selectedFeed={selectedFeed}
              onSelect={setSelectedFeed} onNew={() => setCreating(true)} onRefresh={load}
            />
          )}
          {tab === 'jobs' && <JobsTab jobs={allJobs} loading={loading} />}
        </div>

        {selectedFeed && tab === 'feeds' && (
          <FeedDetail
            feed={selectedFeed}
            onClose={() => setSelectedFeed(null)}
            onRefresh={load}
          />
        )}
      </div>
    </div>
  )
}
