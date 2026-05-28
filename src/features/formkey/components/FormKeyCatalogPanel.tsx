// ── FormKeyCatalogPanel — Layer 3: AI-Assisted Intake (schema-driven, no AI) ──
//
// Internal form catalog: lists all published forms grouped by namespace.
// Users can browse, select, and submit forms entirely from the schema — no AI,
// no external navigation. FormKey drives the entire rendering cycle.

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowsClockwise,
  FileText,
  CheckCircle,
  Clock,
  Recycle,
  ShieldCheck,
  CaretRight,
  CaretLeft,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { pjApi } from '@/services/pjApi'
import type { FKFormDefinition, FKFormField } from '@/services/pj/types'

// ── Field renderer ─────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FKFormField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const base = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  if (field.type === 'select') {
    const opts = field.validation?.allowedValues ?? []
    return (
      <select
        className={base}
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'multiselect') {
    const opts = field.validation?.allowedValues ?? []
    const selected = Array.isArray(value) ? value as string[] : []
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o])}
            className={cn(
              'rounded border px-2 py-0.5 text-xs transition-colors',
              selected.includes(o) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox' || field.type === 'consent_checkbox') {
    return (
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="text-xs text-muted-foreground">{field.label}</span>
      </label>
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        className={cn(base, 'min-h-[80px] resize-y')}
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        placeholder={field.outputPlaceholder ?? `Enter ${field.label.toLowerCase()}…`}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={base}
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        min={field.validation?.min}
        max={field.validation?.max}
      />
    )
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        className={base}
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
      />
    )
  }
  // text / email / signature / file → text input
  return (
    <input
      type="text"
      className={base}
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      placeholder={field.outputPlaceholder ?? `Enter ${field.label.toLowerCase()}…`}
      maxLength={field.validation?.maxLength}
    />
  )
}

// ── Form card ──────────────────────────────────────────────────────────────

function FormCard({ form, onSelect }: { form: FKFormDefinition; onSelect: () => void }) {
  const slaHours = form.vaultMapping?.slaHours
  const requiresApproval = form.vaultMapping?.requiresApproval
  const recurrence = form.vaultMapping?.recurrence

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium leading-snug truncate">{form.name}</div>
            {form.description && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{form.description}</div>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{form.fields.length} fields</Badge>
              {form.vaultMapping?.namespace && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{form.vaultMapping.namespace}</Badge>
              )}
              {slaHours && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                  <Clock size={10} /> {slaHours}h SLA
                </span>
              )}
              {requiresApproval && (
                <span className="flex items-center gap-0.5 text-[10px] text-violet-600">
                  <ShieldCheck size={10} /> Approval required
                </span>
              )}
              {recurrence && recurrence !== 'once' && (
                <span className="flex items-center gap-0.5 text-[10px] text-blue-600">
                  <Recycle size={10} /> {recurrence}
                </span>
              )}
            </div>
          </div>
        </div>
        <CaretRight size={14} className="mt-1 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </button>
  )
}

// ── Inline form submission ─────────────────────────────────────────────────

function FormSubmission({
  form,
  onBack,
  onDone,
}: {
  form: FKFormDefinition
  onBack: () => void
  onDone: (recordId: string, slaDueAt?: string) => void
}) {
  const sortedFields = useMemo(
    () => [...form.fields].sort((a, b) => a.order - b.order),
    [form.fields],
  )
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)

  const setValue = (id: string, v: unknown) => setValues(prev => ({ ...prev, [id]: v }))

  // Evaluate showIf condition
  const isVisible = (field: FKFormField) => {
    if (!field.showIf) return true
    return values[field.showIf.fieldId] === field.showIf.value
  }

  const handleSubmit = async () => {
    const missing = sortedFields.filter(f => isVisible(f) && f.required && !values[f.id] && values[f.id] !== false)
    if (missing.length > 0) {
      toast.error(`Please complete: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    setSubmitting(true)
    try {
      const submitterId = `staff-${Date.now().toString(36)}`
      const res = await pjApi.formkey.submit(form.formId, {
        submitterId,
        fields: values,
      })
      const record = (res as { record?: { id?: string; slaDueAt?: string } }).record
      onDone(record?.id ?? '', record?.slaDueAt)
      toast.success('Form submitted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <CaretLeft size={12} /> Back to catalog
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4">
          <div className="text-sm font-semibold">{form.name}</div>
          {form.description && <div className="text-xs text-muted-foreground mt-0.5">{form.description}</div>}
          {form.vaultMapping?.slaHours && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
              <Clock size={10} /> Response expected within {form.vaultMapping.slaHours}h
            </div>
          )}
          {form.vaultMapping?.requiresApproval && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-violet-600">
              <ShieldCheck size={10} /> This submission requires approval before action
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {sortedFields.filter(isVisible).map(field => (
            <div key={field.id}>
              <label className="block text-xs font-medium mb-1">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              <FieldInput field={field} value={values[field.id]} onChange={v => setValue(field.id, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit form'}
        </Button>
      </div>
    </div>
  )
}

// ── Success screen ─────────────────────────────────────────────────────────

function SubmitSuccess({ recordId, slaDueAt, onReset }: { recordId: string; slaDueAt?: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle size={32} className="text-emerald-500" />
      <div className="text-sm font-medium">Form submitted</div>
      <div className="text-xs text-muted-foreground font-mono">{recordId}</div>
      {slaDueAt && (
        <div className="text-xs text-muted-foreground">
          Response expected by {new Date(slaDueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onReset} className="mt-2">
        Submit another
      </Button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function FormKeyCatalogPanel() {
  const [forms, setForms] = useState<FKFormDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FKFormDefinition | null>(null)
  const [submitted, setSubmitted] = useState<{ recordId: string; slaDueAt?: string } | null>(null)

  const loadForms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pjApi.formkey.list('published')
      setForms((res.forms ?? []) as FKFormDefinition[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load forms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadForms() }, [loadForms])

  const filtered = useMemo(() => {
    if (!search.trim()) return forms
    const q = search.toLowerCase()
    return forms.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.vaultMapping?.namespace?.toLowerCase().includes(q) ||
      f.vaultMapping?.recordType?.toLowerCase().includes(q),
    )
  }, [forms, search])

  // Group by namespace
  const grouped = useMemo(() => {
    const map = new Map<string, FKFormDefinition[]>()
    for (const form of filtered) {
      const key = form.vaultMapping?.namespace ?? 'General'
      const arr = map.get(key) ?? []
      arr.push(form)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (submitted) {
    return <SubmitSuccess
      recordId={submitted.recordId}
      slaDueAt={submitted.slaDueAt}
      onReset={() => { setSubmitted(null); setSelected(null) }}
    />
  }

  if (selected) {
    return <FormSubmission
      form={selected}
      onBack={() => setSelected(null)}
      onDone={(recordId, slaDueAt) => setSubmitted({ recordId, slaDueAt })}
    />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          placeholder="Search forms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" variant="ghost" onClick={loadForms} disabled={loading}>
          <ArrowsClockwise size={14} className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading forms…</div>
      ) : forms.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No published forms yet. Create and publish forms in the FormKey builder.
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No forms match your search.</div>
      ) : (
        grouped.map(([namespace, formList]) => (
          <div key={namespace} className="flex flex-col gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
              {namespace}
            </div>
            {formList.map(form => (
              <FormCard key={form.id} form={form} onSelect={() => setSelected(form)} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
