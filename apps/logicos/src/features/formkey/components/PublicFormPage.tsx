import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FKFieldType, FKFormDefinition } from '@/services/pjApi'
import { pjBase } from '@/services/pjBase'

const PJ = pjBase

function inferSubmitterId(values: Record<string, unknown>): string {
  const preferredKeys = ['email', 'email_address', 'contact_email', 'submitter_email', 'phone', 'phone_number', 'full_name', 'name']
  for (const key of preferredKeys) {
    const value = values[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return `public-${Date.now().toString(36)}`
}

function inputTypeForField(type: FKFieldType): 'text' | 'number' | 'date' {
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  return 'text'
}

export function PublicFormPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const formId = params.get('id')?.trim() ?? ''
  const embedMode = params.get('embed') === '1'
  const [form, setForm] = useState<FKFormDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submittedRecordId, setSubmittedRecordId] = useState<string | null>(null)

  useEffect(() => {
    if (!formId) {
      setError('No form ID was provided.')
      setLoading(false)
      return
    }

    let cancelled = false
    fetch(`${PJ}/v1/forms/${encodeURIComponent(formId)}`)
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(payload.error ?? `HTTP ${response.status}`)
        }
        return response.json() as Promise<FKFormDefinition>
      })
      .then(nextForm => {
        if (cancelled) return
        setForm(nextForm)
        setError(nextForm.status === 'published' ? null : 'This form is not currently accepting public submissions.')
      })
      .catch(fetchError => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Could not load the form.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [formId])

  const sortedFields = useMemo(
    () => [...(form?.fields ?? [])].sort((left, right) => left.order - right.order),
    [form],
  )

  const setValue = (id: string, nextValue: unknown) => setValues(current => ({ ...current, [id]: nextValue }))

  const handleSubmit = async () => {
    const missing = sortedFields.filter(field => field.required && !values[field.id] && values[field.id] !== false)
    if (missing.length > 0) {
      setError(`Please complete: ${missing.map(field => field.label).join(', ')}`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${PJ}/v1/forms/${encodeURIComponent(formId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterId: inferSubmitterId(values),
          fields: values,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? `HTTP ${response.status}`)
      }
      const payload = await response.json() as { record?: { id?: string } }
      setSubmittedRecordId(payload.record?.id ?? 'submitted')
      setValues({})
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const shellClassName = embedMode
    ? 'min-h-screen bg-background'
    : 'min-h-screen bg-background/95 px-4 py-8 md:px-6'

  return (
    <main className={shellClassName}>
      <div className={`mx-auto ${embedMode ? 'max-w-none' : 'max-w-3xl'}`}>
        <div className={`${embedMode ? 'rounded-none border-0 shadow-none' : 'rounded-[28px] border shadow-sm'} overflow-hidden bg-card`}>
          {!embedMode && (
            <div className="border-b bg-muted/15 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">Public FormKey</Badge>
                <Badge variant="outline">No account required</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Fill this form directly. Submissions go into this organization&apos;s governed FormKey intake lane.
              </p>
            </div>
          )}

          <div className="px-5 py-6 md:px-6">
            {loading && (
              <div className="py-20 text-center text-sm text-muted-foreground">Loading form…</div>
            )}

            {!loading && error && !form && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            )}

            {!loading && form && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
                  {form.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{form.description}</p>}
                </div>

                {submittedRecordId && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                    Submission received. Record ID: <span className="font-semibold">{submittedRecordId}</span>
                  </div>
                )}

                {error && form && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
                )}

                <div className="space-y-4">
                  {sortedFields.map(field => {
                    const value = values[field.id]
                    const inputClassName = 'w-full rounded-xl border bg-background px-3 py-2.5 text-sm'
                    const inputId = `public-form-field-${field.id}`

                    return (
                      <div key={field.id}>
                        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
                          {field.label}
                          {field.required && <span className="ml-1 text-red-500">*</span>}
                        </label>

                        {field.type === 'textarea' && (
                          <textarea
                            id={inputId}
                            className={`${inputClassName} min-h-28 resize-y`}
                            value={String(value ?? '')}
                            onChange={event => setValue(field.id, event.target.value)}
                          />
                        )}

                        {(field.type === 'checkbox' || field.type === 'consent_checkbox') && (
                          <label htmlFor={inputId} className="flex items-start gap-3 rounded-xl border bg-muted/20 px-3 py-3 text-sm">
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={event => setValue(field.id, event.target.checked)}
                              className="mt-1 h-4 w-4"
                            />
                            <span className="text-muted-foreground">
                              {field.type === 'consent_checkbox'
                                ? field.label || form.consentConfig?.consentText || 'I consent to the processing of this submission.'
                                : 'Yes'}
                            </span>
                          </label>
                        )}

                        {field.type === 'select' && (
                          <select
                            id={inputId}
                            className={inputClassName}
                            value={String(value ?? '')}
                            onChange={event => setValue(field.id, event.target.value)}
                          >
                            <option value="">Select an option</option>
                            {field.validation?.allowedValues?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        )}

                        {field.type === 'multiselect' && (
                          <div className="space-y-2 rounded-xl border bg-muted/20 px-3 py-3">
                            {field.validation?.allowedValues?.map(option => {
                              const valuesArray = Array.isArray(value) ? value : []
                              const checked = valuesArray.includes(option)
                              return (
                                <label key={option} className="flex items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={event => {
                                      const nextValues = Array.isArray(value) ? [...value] : []
                                      setValue(
                                        field.id,
                                        event.target.checked
                                          ? [...nextValues, option]
                                          : nextValues.filter(entry => entry !== option),
                                      )
                                    }}
                                  />
                                  <span>{option}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {!['textarea', 'checkbox', 'consent_checkbox', 'select', 'multiselect'].includes(field.type) && (
                          <input
                            id={inputId}
                            className={inputClassName}
                            type={inputTypeForField(field.type)}
                            value={String(value ?? '')}
                            onChange={event => setValue(field.id, field.type === 'number' ? Number(event.target.value) : event.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Public submissions are stamped and routed through FormKey. If this form was shared with you, you do not need a LogicOS account.
                  </p>
                  <Button onClick={handleSubmit} disabled={submitting || !!error && !form}>
                    {submitting ? 'Submitting…' : 'Submit form'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
