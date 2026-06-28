/**
 * PRRPage — Public Records Request module for CIVIC V1
 * Backs the "PRR in under an hour" claim: intake → route → gather → redact → respond.
 *
 * Statutory basis: MGL c.66 §10 — 10 business days to respond or seek extension.
 */

import { useState, useEffect, useCallback } from 'react'
import { civicApi } from '../api/civicApi'
import type { CivicObject, CivicTemplate } from '../api/civicApi'

// ── Statutory clock helpers ────────────────────────────────────────────────────

function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function businessDaysRemaining(deadline: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let count = 0
  const cursor = new Date(now)
  while (cursor < deadline) {
    cursor.setDate(cursor.getDate() + 1)
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return deadline < now ? -Math.abs(count) : count
}

function deadlineStatus(daysLeft: number): { color: string; label: string; barColor: string } {
  if (daysLeft < 0) return { color: 'text-red-400', label: `${Math.abs(daysLeft)}d OVERDUE`, barColor: 'bg-red-500' }
  if (daysLeft === 0) return { color: 'text-red-400', label: 'DUE TODAY', barColor: 'bg-red-500' }
  if (daysLeft <= 2) return { color: 'text-amber-400', label: `${daysLeft}d left`, barColor: 'bg-amber-400' }
  if (daysLeft <= 5) return { color: 'text-yellow-400', label: `${daysLeft}d left`, barColor: 'bg-yellow-400' }
  return { color: 'text-green-400', label: `${daysLeft}d left`, barColor: 'bg-green-500' }
}

// ── PRR data helpers ───────────────────────────────────────────────────────────

interface PRRData {
  requester_name?: string
  requester_email?: string
  subject?: string
  channel?: string
  notes?: string
  dept_assigned?: string
  response_sent?: boolean
}

function parsePRR(obj: CivicObject): PRRData {
  return (obj.data as PRRData) ?? {}
}

const STEP_LABELS = ['Intake', 'Route', 'Gather', 'Redact', 'Respond']
const STATUS_TO_STEP: Record<string, number> = {
  open: 0,
  in_progress: 1,
  under_review: 3,
  closed: 4,
}

const CHANNELS = ['Portal', 'Email', 'In person', 'Phone', 'Mail']
const DEPTS = ['Town Clerk', 'Selectboard', 'DPW', 'Police', 'Finance', 'Assessors', 'Health', 'Planning', 'Building']

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <div key={label} className="flex items-center">
            <div className={`flex flex-col items-center ${i < STEP_LABELS.length - 1 ? 'mr-0' : ''}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                done ? 'bg-green-600 border-green-500 text-white' :
                active ? 'bg-red-700 border-red-500 text-white' :
                'bg-muted border-border text-muted-foreground'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[8px] mt-0.5 ${active ? 'text-red-400' : done ? 'text-green-500' : 'text-muted-foreground/60'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-8 mb-3 ${done ? 'bg-green-600' : 'bg-muted'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatPill({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col items-center bg-muted/60 border border-border rounded-xl px-5 py-3 min-w-[80px]">
      <span className={`text-2xl font-black ${accent ?? 'text-foreground'}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PRRPage() {
  const [requests, setRequests] = useState<CivicObject[]>([])
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<CivicTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // New request form state
  const [form, setForm] = useState({
    requester_name: '', requester_email: '', subject: '', channel: 'Portal', dept_assigned: 'Town Clerk', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Template panel
  const [showTemplates, setShowTemplates] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [recs, tmpl] = await Promise.all([
        civicApi.objects({ type: 'record', subtype: 'public_records_request' }),
        civicApi.templates(),
      ])
      setRequests(recs.objects)
      setTemplates(tmpl.templates.filter(t => t.category === 'records'))
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.requester_name.trim() || !form.subject.trim()) {
      setSubmitError('Requester name and subject are required.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await civicApi.createObject({
        type: 'record',
        subtype: 'public_records_request',
        status: 'open',
        vault_class: 'restricted',
        data: {
          requester_name: form.requester_name.trim(),
          requester_email: form.requester_email.trim(),
          subject: form.subject.trim(),
          channel: form.channel,
          dept_assigned: form.dept_assigned,
          notes: form.notes.trim(),
        },
      })
      setForm({ requester_name: '', requester_email: '', subject: '', channel: 'Portal', dept_assigned: 'Town Clerk', notes: '' })
      setShowForm(false)
      await load()
    } catch {
      setSubmitError('Failed to create request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAdvance = async (obj: CivicObject) => {
    const nextStatus: Record<string, string> = {
      open: 'in_progress',
      in_progress: 'under_review',
      under_review: 'closed',
    }
    const next = nextStatus[obj.status]
    if (!next) return
    try {
      await civicApi.setObjectStatus(obj.id, next)
      setRequests(prev => prev.map(r => r.id === obj.id ? { ...r, status: next } : r))
    } catch { /* non-fatal */ }
  }

  const handleClose = async (id: string) => {
    setClosingId(id)
    try {
      await civicApi.setObjectStatus(id, 'closed')
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'closed' } : r))
    } catch { /* non-fatal */ }
    setClosingId(null)
  }

  // Derived stats
  const open = requests.filter(r => r.status !== 'closed')
  const closed = requests.filter(r => r.status === 'closed')
  const overdue = open.filter(r => {
    const deadline = addBusinessDays(new Date(r.created_at), 10)
    return businessDaysRemaining(deadline) < 0
  })

  const displayed = statusFilter === 'active'
    ? open
    : statusFilter === 'overdue'
    ? overdue
    : closed

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">

        {/* Header bar */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-4 shrink-0">
          <div>
            <h2 className="text-foreground font-bold text-sm">Public Records Requests</h2>
            <p className="text-muted-foreground text-[10px]">MGL c.66 §10 · 10 business-day statutory clock</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShowTemplates(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              showTemplates ? 'bg-muted border-border/80 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setSubmitError(null) }}
            className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold transition"
          >
            + New Request
          </button>
        </div>

        {/* The under-an-hour promise */}
        <div className="px-5 py-3 bg-card/60 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center text-red-400 text-base">⏱</div>
              <div>
                <p className="text-foreground text-xs font-bold">PRR handled in under an hour</p>
                <p className="text-muted-foreground text-[10px]">Receive · Route · Gather · Redact · Respond</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              {STEP_LABELS.map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] text-muted-foreground font-bold">{i + 1}</div>
                  <span className="text-muted-foreground text-[10px]">{step}</span>
                  {i < STEP_LABELS.length - 1 && <span className="text-muted-foreground/40 text-[10px]">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats + filter strip */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-4 shrink-0 flex-wrap">
          <div className="flex gap-3">
            <StatPill label="Open" value={open.length} accent={open.length > 0 ? 'text-foreground' : 'text-muted-foreground'} />
            <StatPill label="Overdue" value={overdue.length} accent={overdue.length > 0 ? 'text-red-400' : 'text-muted-foreground'} />
            <StatPill label="Closed" value={closed.length} accent="text-green-400" />
          </div>
          <div className="flex-1" />
          <div className="flex gap-1">
            {[
              { id: 'active', label: 'Active' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'closed', label: 'Closed' },
            ].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`text-xs px-3 py-1 rounded-md transition ${
                  statusFilter === f.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inline new-request form */}
        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/50 shrink-0">
            <p className="text-foreground text-sm font-bold mb-3">Log New Request</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Requester Name *</label>
                <input value={form.requester_name} onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Email</label>
                <input value={form.requester_email} onChange={e => setForm(f => ({ ...f, requester_email: e.target.value }))}
                  placeholder="jane@example.com" type="email"
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Channel</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none">
                  {CHANNELS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Subject / Records Requested *</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Meeting minutes from Jan 2025 Selectboard session"
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Route to Department</label>
                <select value={form.dept_assigned} onChange={e => setForm(f => ({ ...f, dept_assigned: e.target.value }))}
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none">
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional context"
                  className="w-full bg-background border border-border text-foreground/80 text-xs rounded-lg px-3 py-2 focus:border-primary focus:outline-none" />
              </div>
            </div>
            {submitError && <p className="text-red-400 text-xs mb-2">{submitError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:text-foreground">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg disabled:opacity-40 transition">
                {submitting ? 'Logging…' : 'Log Request → Start Clock'}
              </button>
            </div>
          </div>
        )}

        {/* Request list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-muted-foreground/60 text-3xl mb-3">✓</p>
              <p className="text-muted-foreground text-sm font-medium">
                {statusFilter === 'active' ? 'No open requests.' :
                 statusFilter === 'overdue' ? 'No overdue requests.' :
                 'No closed requests yet.'}
              </p>
              {statusFilter === 'active' && (
                <button onClick={() => { setShowForm(true); setSubmitError(null) }}
                  className="mt-3 text-xs text-red-400 hover:underline">Log a request →</button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayed.map(obj => {
                const data = parsePRR(obj)
                const deadline = addBusinessDays(new Date(obj.created_at), 10)
                const daysLeft = businessDaysRemaining(deadline)
                const ds = deadlineStatus(daysLeft)
                const step = STATUS_TO_STEP[obj.status] ?? 0
                const isExpanded = expandedId === obj.id
                const nextLabel: Record<string, string> = {
                  open: 'Route →', in_progress: 'Mark Gathered →', under_review: 'Close',
                }

                return (
                  <div key={obj.id} className="bg-card hover:bg-muted/60 transition-colors">
                    {/* Row */}
                    <div
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : obj.id)}
                    >
                      {/* Deadline clock */}
                      <div className="shrink-0 w-20 text-center">
                        <div className={`text-xs font-black ${ds.color}`}>{ds.label}</div>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${ds.barColor} transition-all`}
                            style={{ width: `${Math.max(0, Math.min(100, (daysLeft / 10) * 100))}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                          Due {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground/80 text-xs font-medium truncate">{data.subject ?? '(no subject)'}</p>
                        <p className="text-muted-foreground text-[10px] truncate">
                          {data.requester_name ?? 'Unknown'}{data.channel ? ` · via ${data.channel}` : ''}{data.dept_assigned ? ` · ${data.dept_assigned}` : ''}
                        </p>
                      </div>

                      {/* Step bar */}
                      <div className="hidden lg:block shrink-0">
                        <StepBar step={step} />
                      </div>

                      {/* Status badge */}
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded hidden sm:inline ${
                        obj.status === 'closed' ? 'bg-muted text-muted-foreground' :
                        obj.status === 'under_review' ? 'bg-purple-800 text-purple-200' :
                        obj.status === 'in_progress' ? 'bg-amber-800 text-amber-200' :
                        'bg-blue-800 text-blue-200'
                      }`}>
                        {obj.status.replace('_', ' ')}
                      </span>

                      {/* Advance button */}
                      {obj.status !== 'closed' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAdvance(obj) }}
                          className="shrink-0 text-[10px] font-semibold px-2.5 py-1 bg-muted hover:bg-red-700 text-muted-foreground hover:text-white rounded-lg transition"
                        >
                          {nextLabel[obj.status] ?? 'Next →'}
                        </button>
                      )}

                      <span className="text-muted-foreground/40 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-muted/30 border-t border-border">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 mb-4">
                          {[
                            { label: 'Received', value: new Date(obj.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                            { label: 'Statutory Deadline', value: deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                            { label: 'Channel', value: data.channel ?? '—' },
                            { label: 'VAULT Class', value: obj.vault_class },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wide">{label}</p>
                              <p className="text-foreground/80 text-xs font-medium mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>
                        {data.requester_email && (
                          <p className="text-muted-foreground text-xs mb-2">✉ <span className="text-foreground/80">{data.requester_email}</span></p>
                        )}
                        {data.notes && (
                          <p className="text-muted-foreground text-xs mb-3">Notes: <span className="text-foreground/80">{data.notes}</span></p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {obj.status !== 'closed' && (
                            <button
                              onClick={() => handleClose(obj.id)}
                              disabled={closingId === obj.id}
                              className="text-[10px] px-3 py-1 bg-green-800 hover:bg-green-700 text-green-100 rounded-lg font-semibold transition disabled:opacity-40"
                            >
                              {closingId === obj.id ? 'Closing…' : '✓ Mark Responded & Close'}
                            </button>
                          )}
                          <button
                            onClick={() => setShowTemplates(true)}
                            className="text-[10px] px-3 py-1 bg-muted hover:bg-muted/80 text-foreground/80 rounded-lg transition"
                          >
                            📄 Use Response Template
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Templates sidebar */}
      {showTemplates && (
        <div className="w-72 shrink-0 border-l border-border flex flex-col bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-foreground text-sm font-bold">Response Templates</h3>
            <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground/60 text-xs">No records templates found.</div>
            ) : (
              templates.map(t => (
                <div key={t.id} className="bg-muted/50 border border-border rounded-lg p-3">
                  <p className="text-foreground/80 text-xs font-medium">{t.name}</p>
                  {t.description && <p className="text-muted-foreground text-[10px] mt-1">{t.description}</p>}
                  <pre className="text-muted-foreground text-[9px] mt-2 whitespace-pre-wrap leading-relaxed line-clamp-4 font-mono bg-card/50 rounded p-2">
                    {t.body}
                  </pre>
                  <button className="mt-2 w-full text-[10px] py-1 bg-muted hover:bg-muted/80 text-foreground/80 rounded transition">
                    Copy template
                  </button>
                </div>
              ))
            )}

            {/* Evergreen notices — always useful */}
            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground/60 text-[9px] uppercase tracking-widest font-bold mb-2 px-1">Quick Notices</p>
              {[
                { name: 'Acknowledgment of Receipt', body: 'We have received your public records request dated [DATE]. We will respond within 10 business days per MGL c.66 §10.' },
                { name: 'Extension Notice', body: 'Your request requires additional time due to [REASON]. We will respond by [NEW DATE] per MGL c.66 §10(b).' },
                { name: 'Denial Notice', body: 'Your request is denied in whole/part because [EXEMPTION]. See MGL c.66 §10(d) for appeal rights.' },
              ].map(t => (
                <div key={t.name} className="bg-muted/30 border border-border/50 rounded-lg p-2.5 mb-2">
                  <p className="text-foreground/80 text-[10px] font-semibold">{t.name}</p>
                  <p className="text-muted-foreground text-[9px] mt-1 leading-relaxed">{t.body}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.body).catch(() => {})}
                    className="mt-1.5 text-[9px] px-2 py-0.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded transition"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
