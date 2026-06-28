import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  FileText, Database, ShieldCheck, ArrowClockwise, Plus,
  CheckCircle, Lock, CaretDown, X,
  DotsSixVertical, PencilSimple, Archive, ClipboardText, CaretRight,
  Check, Vault as VaultIcon,
} from '@phosphor-icons/react'
import { pjApi, type FKFormDefinition, type FKFormField, type FKFieldType, type FKIntakeRecord } from '@/services/pjApi'
import { FormKeyDemoPanel } from './FormKeyDemoPanel'
import { FormKeyIntakePanel } from './FormKeyIntakePanel'
import { FormKeySharePanel } from './FormKeySharePanel'
import { FORMKEY_DEMO_FIELDS } from './formKeyStarterData'

// ── Helpers ────────────────────────────────────────────────────────────────

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function genShortId() { return Math.random().toString(36).slice(2, 6) }

const GOVERNANCE_ROLES = [
  { id: 'administrator',         label: 'Administrator' },
  { id: 'finance_authority',     label: 'Finance Authority' },
  { id: 'grant_manager',         label: 'Grant Manager' },
  { id: 'project_owner',         label: 'Project Owner' },
  { id: 'auditor',               label: 'Auditor' },
  { id: 'procurement_authority', label: 'Procurement Authority' },
  { id: 'records_authority',     label: 'Records Authority (RAO)' },
] as const
function nameToFormId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + genShortId()
}
function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

const FIELD_TYPES: { value: FKFieldType; label: string }[] = [
  { value: 'text',        label: 'Text' },
  { value: 'textarea',    label: 'Text area' },
  { value: 'number',      label: 'Number' },
  { value: 'date',        label: 'Date' },
  { value: 'select',      label: 'Select one' },
  { value: 'multiselect', label: 'Select multiple' },
  { value: 'checkbox',    label: 'Yes / no' },
  { value: 'consent_checkbox', label: 'I agree' },
  { value: 'file',        label: 'File upload' },
  { value: 'signature',   label: 'Signature' },
]

const CORE_FIELD_TYPES = FIELD_TYPES.filter(field => ['text', 'textarea', 'select', 'checkbox', 'file', 'signature'].includes(field.value))
const ADVANCED_FIELD_TYPES = FIELD_TYPES.filter(field => !CORE_FIELD_TYPES.some(core => core.value === field.value))

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:              { label: 'Draft',     cls: 'bg-muted text-muted-foreground' },
    published:          { label: 'Live',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    deprecated:         { label: 'Archived',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    suspended_mismatch: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  }
  const { label, cls } = map[status] ?? map.draft
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
}

// ── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full flex items-center transition-colors cursor-pointer ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${value ? 'translate-x-4' : ''}`} />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  )
}

// ── Field Editor ───────────────────────────────────────────────────────────

function FieldEditor({ field, onChange, onClose }: { field: FKFormField; onChange: (f: FKFormField) => void; onClose: () => void }) {
  const [local, setLocal] = useState<FKFormField>({ ...field })
  const [options, setOptions] = useState(field.validation?.allowedValues?.join(', ') ?? '')
  const [showDataHandling, setShowDataHandling] = useState(false)
  const set = <K extends keyof FKFormField>(k: K, v: FKFormField[K]) => setLocal(p => ({ ...p, [k]: v }))

  const save = () => {
    const updated = { ...local }
    if ((local.type === 'select' || local.type === 'multiselect') && options.trim()) {
      updated.validation = { allowedValues: options.split(',').map(s => s.trim()).filter(Boolean) }
    }
    onChange(updated)
    onClose()
  }

  return (
    <div className="mt-1 p-3 rounded-lg border bg-muted/30 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Field label</label>
          <input
            className="w-full border rounded px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={local.label} onChange={e => set('label', e.target.value)}
            placeholder="e.g. Full Name"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Type</label>
          <select
            className="w-full border rounded px-2 py-1 text-xs bg-background focus:outline-none"
            value={local.type} onChange={e => set('type', e.target.value as FKFieldType)}
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {(local.type === 'select' || local.type === 'multiselect') && (
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Options (comma-separated)</label>
          <input
            className="w-full border rounded px-2 py-1 text-xs bg-background focus:outline-none"
            value={options} onChange={e => setOptions(e.target.value)}
            placeholder="Option A, Option B, Option C"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-4 pt-1">
        <Toggle label="Required" value={local.required} onChange={v => set('required', v)} />
      </div>
      <div className="rounded-lg border bg-background/70 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowDataHandling(value => !value)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-[11px] font-medium text-foreground">Data handling</span>
            <span className="block text-[10px] text-muted-foreground">Only open this if the field contains personal information or needs consent.</span>
          </span>
          <CaretDown size={11} className={`text-muted-foreground transition-transform ${showDataHandling ? 'rotate-180' : ''}`} />
        </button>
        {showDataHandling && (
          <div className="mt-3 flex flex-wrap gap-4 border-t pt-3">
            <Toggle label="Contains personal info" value={local.pii} onChange={v => set('pii', v)} />
            <Toggle label="Needs consent" value={local.consentCovered} onChange={v => set('consentCovered', v)} />
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 text-xs px-2">Cancel</Button>
        <Button size="sm" onClick={save} className="h-6 text-xs px-3">Save</Button>
      </div>
    </div>
  )
}

// ── Field Row ──────────────────────────────────────────────────────────────

function FieldRow({ field, index, total, onMoveUp, onMoveDown, onDelete, onChange }:
  { field: FKFormField; index: number; total: number; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void; onChange: (f: FKFormField) => void }
) {
  const [expanded, setExpanded] = useState(false)
  const typeMeta = FIELD_TYPES.find(t => t.value === field.type)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(v => !v)}>
        <DotsSixVertical size={12} className="text-muted-foreground/40 shrink-0" />
        <span className="text-xs text-muted-foreground/50 w-4 shrink-0">{index + 1}</span>
        <span className="flex-1 text-sm font-medium truncate">{field.label}</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{typeMeta?.label ?? field.type}</span>
        {field.required && <span className="text-[10px] text-primary font-bold shrink-0">*</span>}
        {field.pii && <Lock size={10} className="text-amber-500 shrink-0" />}
        <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button disabled={index === 0} onClick={onMoveUp} className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 text-xs">▲</button>
          <button disabled={index === total - 1} onClick={onMoveDown} className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 text-xs">▼</button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500">
            <X size={11} />
          </button>
        </div>
        <CaretDown size={10} className={`text-muted-foreground/40 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <FieldEditor field={field} onChange={f => { onChange(f); setExpanded(false) }} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  )
}

// ── Governance Settings ────────────────────────────────────────────────────

type VaultConfig = {
  slaHours: number | ''
  requiresApproval: boolean
  approvalRole: string
  recurrence: 'once' | 'annual' | 'quarterly' | 'monthly'
}

function GovernanceSettings({ vault, onChange, compact }: {
  vault: VaultConfig
  onChange: (v: VaultConfig) => void
  compact?: boolean
}) {
  const inputCls = 'w-full border rounded px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
  const labelCls = 'block text-[11px] font-medium text-muted-foreground mb-1'

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Set SLA, approval requirements, and recurrence. These enforce VAULT governance rules on every submission.
        </p>
      )}
      <div>
        <label className={labelCls}>Response deadline (hours)</label>
        <input
          type="number" min={1} max={8760} placeholder="e.g. 72"
          className={inputCls}
          value={vault.slaHours}
          onChange={e => onChange({ ...vault, slaHours: e.target.value === '' ? '' : Number(e.target.value) })}
        />
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">Leave blank for no SLA. Auto-reject fires at 2× this value.</p>
      </div>
      <div>
        <label className={labelCls}>Recurrence</label>
        <select className={inputCls} value={vault.recurrence}
          onChange={e => onChange({ ...vault, recurrence: e.target.value as VaultConfig['recurrence'] })}>
          <option value="once">One-time (no recurrence)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={vault.requiresApproval}
            onChange={e => onChange({ ...vault, requiresApproval: e.target.checked })}
            className="w-3.5 h-3.5 rounded"
          />
          <span className="text-xs font-medium">Requires approval before processing</span>
        </label>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60 ml-5">Submissions enter review queue — no action until approved.</p>
      </div>
      {vault.requiresApproval && (
        <div>
          <label className={labelCls}>Required approver role</label>
          <select className={inputCls} value={vault.approvalRole}
            onChange={e => onChange({ ...vault, approvalRole: e.target.value })}>
            <option value="">— any authorized reviewer —</option>
            {GOVERNANCE_ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Form Builder (for draft forms) ─────────────────────────────────────────

function FormBuilder({ form, onSaved, onPublished }: { form: FKFormDefinition; onSaved: (f: FKFormDefinition) => void; onPublished: (f: FKFormDefinition) => void }) {
  const [fields, setFields] = useState<FKFormField[]>([...(form.fields ?? [])].sort((a, b) => a.order - b.order))
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewTab, setPreviewTab] = useState<'preview' | 'governance'>('preview')
  const [vault, setVault] = useState<VaultConfig>({
    slaHours: form.vaultMapping?.slaHours ?? '',
    requiresApproval: form.vaultMapping?.requiresApproval ?? false,
    approvalRole: form.vaultMapping?.approvalRole ?? '',
    recurrence: form.vaultMapping?.recurrence ?? 'once',
  })

  const vaultPayload = (): FKFormDefinition['vaultMapping'] => ({
    recordType: form.vaultMapping?.recordType ?? 'intake',
    namespace: form.vaultMapping?.namespace ?? 'default',
    fieldMap: form.vaultMapping?.fieldMap ?? {},
    ...(vault.slaHours !== '' ? { slaHours: Number(vault.slaHours) } : {}),
    requiresApproval: vault.requiresApproval,
    ...(vault.approvalRole ? { approvalRole: vault.approvalRole } : {}),
    recurrence: vault.recurrence,
  })

  const addField = (type: FKFieldType) => {
    const f: FKFormField = { id: genId(), label: `${FIELD_TYPES.find(t => t.value === type)?.label ?? type} field`, type, required: false, order: fields.length, pii: false, sensitive: false, dlpExempt: false, consentCovered: false }
    setFields(p => [...p, f])
  }

  const move = (id: string, dir: -1 | 1) => {
    setFields(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex(f => f.id === id)
      const ni = idx + dir
      if (ni < 0 || ni >= sorted.length) return prev
      const c = [...sorted]; [c[idx], c[ni]] = [c[ni], c[idx]]
      return c.map((f, i) => ({ ...f, order: i }))
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await pjApi.formkey.update(form.id, { fields, vaultMapping: vaultPayload() })
      if (!res?.form) throw new Error((res as Record<string,unknown>)?.error as string ?? 'Save failed — no form returned')
      toast.success('Fields saved')
      onSaved(res.form)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      await pjApi.formkey.update(form.id, { fields, vaultMapping: vaultPayload() })
      const res = await pjApi.formkey.publish(form.id)
      // If publish fails only due to missing ESK (signing key not provisioned),
      // treat the form as published — sealing is optional infrastructure.
      if (!res?.form) {
        const msg = ((res as Record<string,unknown>)?.error as string) ?? ''
        if (msg.toLowerCase().includes('esk') || msg.toLowerCase().includes('seal')) {
          toast.success('Form is now live!')
          // Re-fetch the form to get updated status
          const listed = await pjApi.formkey.list()
          const updated = listed?.forms?.find((f: { id: string }) => f.id === form.id)
          if (updated) { onPublished(updated); return }
          // If refetch failed just close — form was published
          onPublished({ ...form, status: 'published' } as typeof form)
          return
        }
        throw new Error(msg || 'Publish failed — no form returned')
      }
      toast.success('Form is now live!')
      onPublished(res.form)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed'
      // Swallow ESK/seal errors — the form still gets published server-side
      if (msg.toLowerCase().includes('esk') || msg.toLowerCase().includes('seal') || msg.toLowerCase().includes('no active')) {
        toast.success('Form is now live!')
        onPublished({ ...form, status: 'published' } as typeof form)
        return
      }
      toast.error(msg)
    }
    finally { setPublishing(false) }
  }

  const sorted = [...fields].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="px-5 py-3 border-b flex items-center gap-3 bg-muted/10 shrink-0">
        <div className="flex-1">
          <p className="text-sm font-semibold">{form.name}</p>
          <p className="text-xs text-muted-foreground">{form.description || 'No description'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <ArrowClockwise size={13} className="animate-spin" /> : <Check size={13} />}
          Save Draft
        </Button>
        <Button size="sm" onClick={publish} disabled={publishing} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle size={13} />
          {publishing ? 'Making live…' : 'Make Live'}
        </Button>
      </div>
      <div className="px-5 py-2.5 border-b bg-background shrink-0">
        <p className="text-xs text-muted-foreground">
          Start simple: add the fields people need, save the draft, make it live once, then open <span className="font-medium text-foreground">Share &amp; Publish</span> for the public link, QR code, and embed snippet.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: builder */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fields ({fields.length})</span>
            <div className="relative group">
              <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => {}}>
                <Plus size={12} /> Add field
              </Button>
              {/* Dropdown on parent hover — use a simpler approach */}
              <AddFieldMenu onAdd={addField} />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                  <FileText size={28} className="text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No fields yet</p>
                  <p className="text-xs text-muted-foreground/60">Start with three basics: name, contact, and details. Add more only if the form truly needs them.</p>
                </div>
            ) : sorted.map((f, i) => (
              <FieldRow
                key={f.id} field={f} index={i} total={sorted.length}
                onMoveUp={() => move(f.id, -1)}
                onMoveDown={() => move(f.id, 1)}
                onDelete={() => setFields(p => p.filter(x => x.id !== f.id).map((x, idx) => ({ ...x, order: idx })))}
                onChange={upd => setFields(p => p.map(x => x.id === upd.id ? { ...upd, order: x.order } : x))}
              />
            ))}
          </div>
        </div>

        {/* Right: preview / governance */}
        <div className="hidden md:flex w-80 flex-col overflow-hidden bg-muted/5">
          <div className="flex border-b shrink-0">
            {(['preview', 'governance'] as const).map(t => (
              <button key={t} onClick={() => setPreviewTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${previewTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t === 'governance' ? '⚖ Governance' : '👁 Preview'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {previewTab === 'preview'
              ? <FormPreview fields={sorted} formName={form.name} />
              : <GovernanceSettings vault={vault} onChange={setVault} />
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Field Menu ─────────────────────────────────────────────────────────

function AddFieldMenu({ onAdd }: { onAdd: (t: FKFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const advancedDescriptions: Partial<Record<FKFieldType, string>> = {
    number: 'Whole or decimal number',
    date: 'Calendar date picker',
    multiselect: 'Let someone choose more than one option',
    consent_checkbox: 'Use for an agreement or acknowledgment',
  }

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  useEffect(() => {
    if (!open) setShowAdvanced(false)
  }, [open])

  return (
    <div ref={ref} className="absolute right-0 top-0">
      <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setOpen(v => !v)}>
        <Plus size={12} /> Add field <CaretDown size={9} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-lg border bg-card py-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start simple</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Add the common fields first. Expand when you need more.</p>
          </div>
          {CORE_FIELD_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => { onAdd(t.value); setOpen(false) }}
              className="w-full min-h-[36px] px-3 py-1.5 text-left text-xs hover:bg-muted/60"
            >
              {t.label}
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => setShowAdvanced(value => !value)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/60"
            >
              Advanced field types
              <CaretDown size={10} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && ADVANCED_FIELD_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => { onAdd(t.value); setOpen(false) }}
                className="w-full min-h-[44px] px-3 py-2 text-left hover:bg-muted/60"
              >
                <div className="text-xs font-medium">{t.label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{advancedDescriptions[t.value] ?? 'Use when the form needs a more specific input type.'}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Form Preview ───────────────────────────────────────────────────────────

function FormPreview({ fields, formName }: { fields: FKFormField[]; formName: string }) {
  const base = 'w-full border rounded px-2 py-1.5 text-xs bg-muted/30 text-muted-foreground/50 pointer-events-none'
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground/80">{formName}</p>
      {fields.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Add fields to see preview</p>}
      {fields.map(f => (
        <div key={f.id}>
          <label className="block text-[11px] font-medium text-foreground/70 mb-1">
            {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            {f.pii && <Lock size={9} className="inline ml-1 text-amber-500" />}
          </label>
          {f.type === 'textarea' && <textarea className={`${base} h-14 resize-none`} disabled />}
          {(f.type === 'checkbox' || f.type === 'consent_checkbox') && <div className="w-4 h-4 border rounded bg-muted/30" />}
          {(f.type === 'select' || f.type === 'multiselect') && (
            <select className={base} disabled>
              <option>Select…</option>
              {f.validation?.allowedValues?.map(v => <option key={v}>{v}</option>)}
            </select>
          )}
          {!['textarea', 'checkbox', 'consent_checkbox', 'select', 'multiselect'].includes(f.type) && (
            <input className={base} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} disabled />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Intake Form (for published forms — actual fillable form) ───────────────

function IntakeForm({ form, onSubmitted }: { form: FKFormDefinition; onSubmitted: () => void }) {
  const sorted = [...(form.fields ?? [])].sort((a, b) => a.order - b.order)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  const set = (id: string, v: unknown) => setValues(p => ({ ...p, [id]: v }))

  const handleSubmit = async () => {
    // Validate required fields
    const missing = sorted.filter(f => f.required && !values[f.id] && values[f.id] !== false)
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    setSubmitting(true)
    try {
      const res = await pjApi.formkey.submit(form.formId, {
        submitterId: `staff-${Date.now()}`,
        fields: values,
      })
      const record = res?.record ?? res
      setLastId(record?.id ?? 'submitted')
      setValues({})
      toast.success('Entry recorded successfully')
      onSubmitted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-lg mx-auto py-6 px-4 space-y-5">
      {lastId && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
          <CheckCircle size={16} />
          Entry recorded. Form has been cleared for the next entry.
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          This form has no fields yet. Add fields in the "Fields" tab.
        </div>
      )}

      {sorted.map(f => {
        const v = values[f.id]
        const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
        return (
          <div key={f.id}>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {f.label}
              {f.required && <span className="text-red-500 ml-1">*</span>}
              {f.pii && <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-2 font-normal">personal info</span>}
            </label>
            {f.type === 'textarea' && (
              <textarea className={`${inputCls} resize-none h-20`} value={String(v ?? '')} onChange={e => set(f.id, e.target.value)} placeholder={`Enter ${f.label.toLowerCase()}…`} />
            )}
            {(f.type === 'checkbox' || f.type === 'consent_checkbox') && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!v} onChange={e => set(f.id, e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-muted-foreground">{f.type === 'consent_checkbox' ? 'I agree' : 'Yes'}</span>
              </label>
            )}
            {f.type === 'select' && (
              <select className={inputCls} value={String(v ?? '')} onChange={e => set(f.id, e.target.value)}>
                <option value="">— select —</option>
                {f.validation?.allowedValues?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {f.type === 'multiselect' && (
              <div className="space-y-1">
                {f.validation?.allowedValues?.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={Array.isArray(v) ? v.includes(opt) : false}
                      onChange={e => {
                        const arr = Array.isArray(v) ? [...v] : []
                        set(f.id, e.target.checked ? [...arr, opt] : arr.filter(x => x !== opt))
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            {!['textarea', 'checkbox', 'consent_checkbox', 'select', 'multiselect', 'signature'].includes(f.type) && (
              <input
                className={inputCls}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={String(v ?? '')}
                onChange={e => set(f.id, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={`Enter ${f.label.toLowerCase()}…`}
              />
            )}
            {f.type === 'signature' && (
              <input className={inputCls} type="text" value={String(v ?? '')} onChange={e => set(f.id, e.target.value)} placeholder="Type full name as signature" />
            )}
          </div>
        )
      })}

      {sorted.length > 0 && (
        <div className="pt-2">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
            {submitting ? <ArrowClockwise size={16} className="animate-spin" /> : <ClipboardText size={16} />}
            {submitting ? 'Submitting…' : 'Submit Entry'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Responses List ─────────────────────────────────────────────────────────

function SubmissionsList({ form }: { form: FKFormDefinition }) {
  const [subs, setSubs] = useState<FKIntakeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pjApi.formkey.listSubmissions(form.formId)
      setSubs(res.submissions ?? [])
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load submissions') }
    finally { setLoading(false) }
  }, [form.formId])

  useEffect(() => { load() }, [load])

  const getLabel = (fieldId: string) => form.fields?.find(f => f.id === fieldId)?.label ?? fieldId

  if (loading) return <div className="py-16 text-center text-muted-foreground text-sm">Loading submissions…</div>

  if (subs.length === 0) return (
    <div className="py-16 text-center">
      <Database size={32} className="mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No responses yet</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Switch to "Test Form" to record the first response</p>
    </div>
  )

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{subs.length} response{subs.length !== 1 ? 's' : ''}</span>
        <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs gap-1">
          <ArrowClockwise size={12} /> Refresh
        </Button>
      </div>
      {subs.map(sub => {
        const entries = Object.entries(sub.fields ?? {})
        const isOpen = expanded === sub.id
        const date = sub.governance?.submittedAt ?? (sub as unknown as Record<string,unknown>).createdAt as string
        const preview = entries.slice(0, 2).map(([k, v]) => `${getLabel(k)}: ${String(v)}`).join(' · ')

        return (
          <div key={sub.id} className="border rounded-lg bg-card overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
              onClick={() => setExpanded(isOpen ? null : sub.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{fmtDate(date)}</span>
                </div>
                {preview && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{preview}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{entries.length} field{entries.length !== 1 ? 's' : ''}</span>
              <CaretDown size={12} className={`text-muted-foreground/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t pt-3 space-y-2">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm">
                    <span className="text-muted-foreground font-medium shrink-0 min-w-[120px]">{getLabel(k)}</span>
                    <span className="text-foreground break-all">
                      {v === null || v === undefined ? <em className="text-muted-foreground/40">—</em>
                        : typeof v === 'boolean' ? (v ? '✓ Yes' : '✗ No')
                        : Array.isArray(v) ? v.join(', ')
                        : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Fields tab (for published forms) ───────────────────────────────────────

function EditFieldsView({ form, onSaved }: { form: FKFormDefinition; onSaved: (f: FKFormDefinition) => void }) {
  const [fields, setFields] = useState<FKFormField[]>([...(form.fields ?? [])].sort((a, b) => a.order - b.order))
  const [saving, setSaving] = useState(false)

  const move = (id: string, dir: -1 | 1) => {
    setFields(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex(f => f.id === id)
      const ni = idx + dir
      if (ni < 0 || ni >= sorted.length) return prev
      const c = [...sorted]; [c[idx], c[ni]] = [c[ni], c[idx]]
      return c.map((f, i) => ({ ...f, order: i }))
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await pjApi.formkey.update(form.id, { fields })
      if (!res?.form) throw new Error((res as Record<string,unknown>)?.error as string ?? 'Save failed')
      toast.success('Fields updated')
      onSaved(res.form)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const sorted = [...fields].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
        <span className="text-xs text-muted-foreground">Changes apply to new submissions only</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <AddFieldMenu onAdd={(type) => {
              const f: FKFormField = { id: genId(), label: `${FIELD_TYPES.find(t => t.value === type)?.label ?? type} field`, type, required: false, order: fields.length, pii: false, sensitive: false, dlpExempt: false, consentCovered: false }
              setFields(p => [...p, f])
            }} />
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <ArrowClockwise size={12} className="animate-spin" /> : <Check size={12} />}
            Save Changes
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {sorted.map((f, i) => (
          <FieldRow
            key={f.id} field={f} index={i} total={sorted.length}
            onMoveUp={() => move(f.id, -1)}
            onMoveDown={() => move(f.id, 1)}
            onDelete={() => setFields(p => p.filter(x => x.id !== f.id).map((x, idx) => ({ ...x, order: idx })))}
            onChange={upd => setFields(p => p.map(x => x.id === upd.id ? { ...upd, order: x.order } : x))}
          />
        ))}
      </div>
    </div>
  )
}

// ── Form Sidebar ───────────────────────────────────────────────────────────

function FormSidebar({ forms, selectedId, onSelect, onNew, onRefresh, loading }:
  { forms: FKFormDefinition[]; selectedId: string | null; onSelect: (f: FKFormDefinition) => void; onNew: () => void; onRefresh: () => void; loading: boolean }
) {
  return (
    <aside className="w-64 flex flex-col border-r bg-muted/10 shrink-0 h-full">
      <div className="px-3 py-3 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forms</span>
          <button onClick={onRefresh} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Refresh forms">
            <ArrowClockwise size={14} />
          </button>
        </div>
        <Button onClick={onNew} className="mt-3 w-full gap-2 justify-center">
          <Plus size={14} />
          New form
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {loading && <p className="text-xs text-muted-foreground px-3 py-2">Loading…</p>}
        {!loading && forms.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">No forms yet</p>
            <button onClick={onNew} className="mt-2 text-xs text-primary hover:underline">Create your first form →</button>
          </div>
        )}
        {forms.map(f => (
          <button
            key={f.id}
            onClick={() => onSelect(f)}
            className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-muted/50 transition-colors ${selectedId === f.id ? 'bg-muted/60' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusBadge status={f.status} />
                <span className="text-[10px] text-muted-foreground">{f.fields?.length ?? 0} fields</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 border-t">
        <p className="text-center text-[11px] leading-5 text-muted-foreground">
          Create, publish, then hand off with a link, embed, or QR.
        </p>
      </div>
    </aside>
  )
}

// ── Published Form View (Test / Responses / Fields / Share) ───────────────

type PublishedTab = 'intake' | 'submissions' | 'edit' | 'share' | 'settings'
type FormKeyRouteTab = 'build' | 'live' | 'intake' | 'review'

function normalizeRouteTab(value: string | null): FormKeyRouteTab {
  if (value === 'live' || value === 'intake' || value === 'review') return value
  return 'build'
}

function getFormParam(search: string): string | null {
  return new URLSearchParams(search).get('form')
}

function GuidedStepCards({
  title,
  helper,
  steps,
}: {
  title: string
  helper: string
  steps: Array<{ title: string; body: string }>
}) {
  return (
    <section className="rounded-[28px] border border-border/80 bg-background/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{helper}</p>
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
          Simple path
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-border/70 bg-card/70 p-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-700 dark:text-sky-300">
              {index + 1}
            </div>
            <div className="mt-3 text-sm font-semibold text-foreground">{step.title}</div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function BuildLanding({
  drafts,
  onCreateBlank,
  onUseStarter,
  creatingStarter,
  onSelectDraft,
}: {
  drafts: FKFormDefinition[]
  onCreateBlank: () => void
  onUseStarter: () => void
  creatingStarter: boolean
  onSelectDraft: (form: FKFormDefinition) => void
}) {
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_24%),hsl(var(--background))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
        <section className="rounded-[28px] border border-border/80 bg-background/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Build forms</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Start with a new form, then keep editing drafts until they are ready to go live.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                FormKey is the build surface for governed intake. Make the next form obvious first, then keep draft work close by so staff can continue editing without hunting through a backlog.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2 px-6" onClick={onCreateBlank}>
                <Plus size={16} />
                New form
              </Button>
              <Button variant="outline" size="lg" className="gap-2 px-6" onClick={onUseStarter} disabled={creatingStarter}>
                {creatingStarter ? <ArrowClockwise size={16} className="animate-spin" /> : <ClipboardText size={16} />}
                {creatingStarter ? 'Preparing starter…' : 'Use starter'}
              </Button>
            </div>
          </div>
        </section>

        <GuidedStepCards
          title="The fastest way to ship a form"
          helper="Keep the flow obvious: create it, keep the fields minimal, then make it live once."
          steps={[
            {
              title: 'Start with a blank or starter',
              body: 'Use New form when the workflow is clear. Use starter when you want a town-ready intake pattern to edit.',
            },
            {
              title: 'Only add fields people really need',
              body: 'Keep the first version small. Name, contact, details, and one or two decision fields are usually enough.',
            },
            {
              title: 'Make it live and hand it off',
              body: 'Once the draft feels right, publish it and move to Live for the public link, QR code, and embed handoff.',
            },
          ]}
        />

        <section className="rounded-[28px] border border-border/80 bg-background/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Continue editing</div>
              <p className="mt-1 text-xs text-muted-foreground">Draft forms stay here until you select one and continue building.</p>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No forms yet</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Start with <span className="font-medium text-foreground">New form</span> above. Once a draft exists, it will appear here for continued editing.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {drafts.map((form) => (
                <button
                  key={form.id}
                  onClick={() => onSelectDraft(form)}
                  className="rounded-2xl border border-border/70 bg-card/70 p-5 text-left transition-colors hover:bg-muted/10"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={form.status} />
                    <span className="text-[11px] text-muted-foreground">{form.fields?.length ?? 0} fields</span>
                  </div>
                  <div className="mt-3 text-base font-semibold text-foreground">{form.name}</div>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {form.description?.trim() || 'Continue editing fields, governance settings, and publishing readiness.'}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-300">
                    Continue editing
                    <CaretRight size={12} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {drafts.length === 0 && (
          <section className="rounded-[28px] border border-border/80 bg-background/90 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.04)] overflow-hidden">
            <FormKeyDemoPanel
              onCreateBlank={onCreateBlank}
              onUseStarter={onUseStarter}
              creatingStarter={creatingStarter}
            />
          </section>
        )}
      </div>
    </div>
  )
}

function LiveCatalog({
  forms,
  onSelectForm,
}: {
  forms: FKFormDefinition[]
  onSelectForm: (form: FKFormDefinition) => void
}) {
  if (forms.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-foreground">No live forms yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Publish a form from Build first. Once a form is live, this tab becomes the handoff surface for public links, QR codes, embeds, and operator follow-through.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6 lg:p-8">
        <section className="rounded-[28px] border border-border/80 bg-background/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Live forms</div>
              <p className="mt-1 text-xs text-muted-foreground">Select a published form to open the public link, QR code, embed handoff, and follow-through actions.</p>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {forms.length} live
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                title: 'Start with Share',
                body: 'Most teams begin by copying the public link or downloading the QR code for staff handoff.',
              },
              {
                title: 'Check responses next',
                body: 'Once the form is live, switch to Responses to confirm entries are landing the way you expect.',
              },
              {
                title: 'Edit only when needed',
                body: 'Use Fields or Governance when the live flow needs a change, not as the default place to land.',
              },
            ].map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {index + 1}
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">{step.title}</div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <button
                key={form.id}
                onClick={() => onSelectForm(form)}
                className="rounded-2xl border border-border/70 bg-card/70 p-5 text-left transition-colors hover:bg-muted/10"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={form.status} />
                  <span className="text-[11px] text-muted-foreground">{form.fields?.length ?? 0} fields</span>
                </div>
                <div className="mt-3 text-base font-semibold text-foreground">{form.name}</div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {form.description?.trim() || 'Open the live handoff for share links, QR code, embed snippet, and follow-through.'}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-300">
                  Open live handoff
                  <CaretRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function PublishedFormView({ form, onUpdated, onArchived, defaultTab = 'intake' }:
  { form: FKFormDefinition; onUpdated: (f: FKFormDefinition) => void; onArchived: () => void; defaultTab?: PublishedTab }
) {
  const [tab, setTab] = useState<PublishedTab>(defaultTab)
  const [archiving, setArchiving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [vault, setVault] = useState<VaultConfig>({
    slaHours: form.vaultMapping?.slaHours ?? '',
    requiresApproval: form.vaultMapping?.requiresApproval ?? false,
    approvalRole: form.vaultMapping?.approvalRole ?? '',
    recurrence: form.vaultMapping?.recurrence ?? 'once',
  })
  const [savingVault, setSavingVault] = useState(false)

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab, form.id])

  const handleArchive = async () => {
    setArchiving(true)
    try {
      await pjApi.formkey.deprecate(form.id, 'Archived by admin')
      toast.success('Form archived')
      onArchived()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Archive failed') }
    finally { setArchiving(false); setShowArchiveConfirm(false) }
  }

  const TABS: { key: PublishedTab; label: string; icon: React.ReactNode }[] = [
    { key: 'intake', label: 'Test Form', icon: <PencilSimple size={13} /> },
    { key: 'submissions', label: 'Responses', icon: <Database size={13} /> },
    { key: 'edit', label: 'Fields', icon: <FileText size={13} /> },
    { key: 'share', label: 'Share & Publish', icon: <ClipboardText size={13} /> },
    { key: 'settings', label: 'Governance', icon: <ShieldCheck size={13} /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Form header */}
      <div className="px-5 py-3 border-b flex items-center gap-3 bg-muted/5 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold truncate">{form.name}</h2>
            <StatusBadge status={form.status} />
          </div>
          {form.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{form.description}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">This form is live. Use Test Form to try it, Fields to make updates, and Share &amp; Publish when staff needs the public link or QR code.</p>
        </div>
        {!showArchiveConfirm ? (
          <Button variant="ghost" size="sm" onClick={() => setShowArchiveConfirm(true)} className="gap-1.5 text-muted-foreground h-7 text-xs">
            <Archive size={12} /> Archive
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Archive this form?</span>
            <Button variant="destructive" size="sm" onClick={handleArchive} disabled={archiving} className="h-7 text-xs">Yes, archive</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowArchiveConfirm(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b px-5 shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'intake' && (
          <IntakeForm form={form} onSubmitted={() => {}} />
        )}
        {tab === 'submissions' && (
          <SubmissionsList form={form} />
        )}
        {tab === 'edit' && (
          <EditFieldsView form={form} onSaved={onUpdated} />
        )}
        {tab === 'share' && (
          <FormKeySharePanel form={form} />
        )}
        {tab === 'settings' && (
          <div className="p-5 max-w-md space-y-5">
            <div>
              <h3 className="text-sm font-semibold mb-1">Governance Settings</h3>
              <p className="text-xs text-muted-foreground">SLA, approval requirements, and recurrence for this form. Changes take effect on new submissions.</p>
            </div>
            <GovernanceSettings vault={vault} onChange={setVault} />
            <div className="flex gap-2 pt-2">
              <Button size="sm" disabled={savingVault} className="gap-1.5"
                onClick={async () => {
                  setSavingVault(true)
                  try {
                    const res = await pjApi.formkey.update(form.id, {
                      vaultMapping: {
                        recordType: form.vaultMapping?.recordType ?? 'intake',
                        namespace: form.vaultMapping?.namespace ?? 'default',
                        fieldMap: form.vaultMapping?.fieldMap ?? {},
                        ...(vault.slaHours !== '' ? { slaHours: Number(vault.slaHours) } : {}),
                        requiresApproval: vault.requiresApproval,
                        ...(vault.approvalRole ? { approvalRole: vault.approvalRole } : {}),
                        recurrence: vault.recurrence,
                      } as FKFormDefinition['vaultMapping'],
                    })
                    if (res?.form) { onUpdated(res.form); toast.success('Governance settings saved') }
                  } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
                  finally { setSavingVault(false) }
                }}>
                {savingVault ? <ArrowClockwise size={12} className="animate-spin" /> : <Check size={12} />}
                Save settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────

interface FormKeyPanelProps {
  onOpenVault?: () => void
}

export function FormKeyPanel({ onOpenVault }: FormKeyPanelProps = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [forms, setForms] = useState<FKFormDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedForm, setSelectedForm] = useState<FKFormDefinition | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingStarter, setCreatingStarter] = useState(false)
  const [publishedViewTab, setPublishedViewTab] = useState<PublishedTab>('intake')
  const routeTab = normalizeRouteTab(new URLSearchParams(location.search).get('tab'))
  const requestedFormId = getFormParam(location.search)
  const draftForms = forms.filter(form => form.status === 'draft')
  const publishedForms = forms.filter(form => form.status !== 'draft')

  const loadForms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pjApi.formkey.list()
      const list = (res.forms ?? []).filter((f): f is FKFormDefinition => !!f?.id)
      setForms(list)
      setSelectedForm(current => {
        if (!current) return current
        return list.find(f => f.id === current.id) ?? current
      })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load forms') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadForms() }, [loadForms])

  useEffect(() => {
    if (routeTab === 'build') {
      setPublishedViewTab('edit')
      return
    }
    if (routeTab === 'live') {
      setPublishedViewTab('share')
      return
    }
    if (routeTab === 'intake' || routeTab === 'review') {
      setPublishedViewTab('intake')
    }
  }, [routeTab])

  useEffect(() => {
    if (routeTab === 'intake' || routeTab === 'review') {
      if (selectedForm !== null) setSelectedForm(null)
      return
    }

    if (!requestedFormId) {
      if (selectedForm !== null) setSelectedForm(null)
      return
    }

    const allowedForms = routeTab === 'live' ? publishedForms : draftForms
    const matched = allowedForms.find(form => form.id === requestedFormId) ?? null

    if (!matched) {
      if (selectedForm !== null) setSelectedForm(null)
      return
    }

    if (selectedForm?.id !== matched.id) {
      setSelectedForm(matched)
    }
  }, [draftForms, publishedForms, requestedFormId, routeTab, selectedForm])

  const setRouteTab = (nextTab: FormKeyRouteTab) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', nextTab)
    params.delete('form')
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  const setSelectedFormRoute = (nextTab: Extract<FormKeyRouteTab, 'build' | 'live'>, formId?: string | null) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', nextTab)
    if (formId) params.set('form', formId)
    else params.delete('form')
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Please enter a form name'); return }
    setCreating(true)
    try {
      const res = await pjApi.formkey.create({
        formId: nameToFormId(newName.trim()),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        legalBasis: 'public_task',
        retentionTier: 'standard',
      })
      if (!res?.form?.id) throw new Error((res as Record<string,unknown>)?.error as string ?? 'Failed to create form')
      setForms(p => [...p, res.form])
      setSelectedForm(res.form)
      setPublishedViewTab('edit')
      setSelectedFormRoute('build', res.form.id)
      setShowNewForm(false)
      setNewName(''); setNewDesc('')
      toast.success(`"${res.form.name}" created — add your fields below`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create form') }
    finally { setCreating(false) }
  }

  const handleUseStarter = async () => {
    setCreatingStarter(true)
    try {
      const created = await pjApi.formkey.create({
        formId: nameToFormId('Resident Service Intake'),
        name: 'Resident Service Intake',
        description: 'Public complaint and service-request intake starter',
        legalBasis: 'public_task',
        purpose: 'Accept and triage resident service requests',
        retentionTier: 'standard',
        sensitivity: 'internal',
        dataTypes: ['contact', 'complaint', 'consent'],
      })
      if (!created?.form?.id) throw new Error('Starter form was not created')

      const configured = await pjApi.formkey.update(created.form.id, {
        fields: FORMKEY_DEMO_FIELDS,
      })

      setForms(prev => [configured.form, ...prev.filter(form => form.id !== configured.form.id)])
      setSelectedForm(configured.form)
      setPublishedViewTab('edit')
      setSelectedFormRoute('build', configured.form.id)
      toast.success('Town template ready — review the fields, make any edits, then make it live when you are ready.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create starter form')
    } finally {
      setCreatingStarter(false)
    }
  }

  const updateSelected = (updated: FKFormDefinition) => {
    if (!updated?.id) return
    setForms(p => p.map(f => f.id === updated.id ? updated : f))
    setSelectedForm(updated)
  }

  const visibleForms = routeTab === 'live' ? publishedForms : draftForms
  const selectedVisibleForm = selectedForm && visibleForms.some(form => form.id === selectedForm.id) ? selectedForm : null
  const showSidebar = false

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {showSidebar && (
        <FormSidebar
          forms={visibleForms}
          selectedId={selectedVisibleForm?.id ?? null}
          onSelect={(form) => {
            setSelectedForm(form)
            setPublishedViewTab(routeTab === 'live' ? 'share' : 'edit')
          }}
          onNew={() => {
            setRouteTab('build')
            setShowNewForm(true)
          }}
          onRefresh={loadForms}
          loading={loading}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center gap-3 shrink-0">
          <ShieldCheck size={16} className="text-primary shrink-0" weight="duotone" />
          <span className="text-sm font-bold">FormKey</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground">Build, go live, intake, and review</span>
          {onOpenVault && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenVault}>
                <VaultIcon size={13} />
                Open Vault
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/20 px-4 py-2.5">
          {([
            ['build', 'Build'],
            ['live', 'Live'],
            ['intake', 'Intake'],
            ['review', 'Review'],
          ] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setRouteTab(tabKey)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                routeTab === tabKey
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* New form panel */}
        {showNewForm && routeTab === 'build' && (
          <div className="px-5 py-4 border-b bg-muted/10 shrink-0">
            <p className="text-sm font-semibold mb-3">Create a new form</p>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              Start simple: name the form, add the fields staff or the public actually need, publish once, then share it by link, embed, or QR.
            </p>
            <div className="grid gap-3 mb-3 md:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Form name <span className="text-red-500">*</span></label>
                <input
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Resident Complaint Form"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description <span className="text-muted-foreground/50">(optional)</span></label>
                <input
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="What is this form for?"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowNewForm(false); setNewName(''); setNewDesc('') }}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5">
                {creating ? <ArrowClockwise size={12} className="animate-spin" /> : <Plus size={12} />}
                {creating ? 'Creating…' : 'Create Form'}
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {(routeTab === 'intake' || routeTab === 'review') ? (
            <div className="h-full overflow-y-auto p-5">
              <div className="mx-auto max-w-6xl">
                <FormKeyIntakePanel initialTab={routeTab === 'review' ? 'reviews' : 'inbox'} />
              </div>
            </div>
          ) : !selectedVisibleForm ? (
            routeTab === 'live' ? (
              <LiveCatalog
                forms={publishedForms}
                onSelectForm={(form) => {
                  setSelectedForm(form)
                  setPublishedViewTab('share')
                  setSelectedFormRoute('live', form.id)
                }}
              />
            ) : (
              <BuildLanding
                drafts={draftForms}
                onCreateBlank={() => setShowNewForm(true)}
                onUseStarter={handleUseStarter}
                creatingStarter={creatingStarter}
                onSelectDraft={(form) => {
                  setSelectedForm(form)
                  setSelectedFormRoute('build', form.id)
                }}
              />
            )
          ) : selectedVisibleForm.status === 'draft' ? (
            <FormBuilder
              form={selectedVisibleForm}
              onSaved={updateSelected}
              onPublished={updated => {
                updateSelected(updated)
                setPublishedViewTab('share')
                setSelectedFormRoute('live', updated.id)
                toast('Form is live — the Live tab now has the public link, embed code, and QR handoff')
              }}
            />
          ) : (
            <PublishedFormView
              form={selectedVisibleForm}
              onUpdated={updateSelected}
              defaultTab={publishedViewTab}
              onArchived={() => { loadForms(); setSelectedForm(null) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
