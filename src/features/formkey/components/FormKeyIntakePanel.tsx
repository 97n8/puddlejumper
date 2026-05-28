// ── FormKeyIntakePanel — Layer 8: User Guidance + Layer 4: Intake Lifecycle ───
//
// Shows intake records across all forms with status badges, SLA countdowns,
// and inline review/respond/close actions.

import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Warning,
  XCircle,
  CaretRight,
  Gavel,
  Robot,
  CaretDown,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { pjApi } from '@/services/pjApi'
import type { FKIntakeRecord, FKIntakeStatus, FKReview } from '@/services/pj/types'

const STATUS_CONFIG: Record<FKIntakeStatus, { label: string; color: string; icon: React.ReactNode }> = {
  received:     { label: 'Received',     color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',   icon: <Clock size={12} weight="fill" /> },
  under_review: { label: 'In Review',    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800', icon: <Warning size={12} weight="fill" /> },
  responded:    { label: 'Responded',    color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800', icon: <CaretRight size={12} weight="fill" /> },
  closed:       { label: 'Closed',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800', icon: <CheckCircle size={12} weight="fill" /> },
}

function slaTimeLeft(slaDueAt: string): { ms: number; label: string; urgent: boolean; overdue: boolean } {
  const ms = new Date(slaDueAt).getTime() - Date.now()
  const overdue = ms < 0
  const abs = Math.abs(ms)
  const hours = abs / (1000 * 60 * 60)
  let label: string
  if (hours < 1) {
    label = `${Math.ceil(abs / 60000)}m ${overdue ? 'overdue' : 'left'}`
  } else if (hours < 24) {
    label = `${Math.ceil(hours)}h ${overdue ? 'overdue' : 'left'}`
  } else {
    label = `${Math.ceil(hours / 24)}d ${overdue ? 'overdue' : 'left'}`
  }
  return { ms, label, urgent: !overdue && hours < 24, overdue }
}

function SlaChip({ slaDueAt }: { slaDueAt: string }) {
  const { label, urgent, overdue } = slaTimeLeft(slaDueAt)
  if (overdue) return <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">{label}</span>
  if (urgent)  return <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">{label}</span>
  return <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{label}</span>
}

type InboxFilter = 'all' | 'needs_action' | 'overdue'

interface SubmissionWithForm extends FKIntakeRecord {
  formTitle?: string
}

interface FormKeyIntakePanelProps {
  initialTab?: 'inbox' | 'reviews'
}

export function FormKeyIntakePanel({ initialTab = 'inbox' }: FormKeyIntakePanelProps) {
  const [forms, setForms] = useState<Array<{ id: string; formId: string; name: string; fields?: { id: string; label: string }[] }>>([])
  const [submissions, setSubmissions] = useState<SubmissionWithForm[]>([])
  const [reviews, setReviews] = useState<FKReview[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'inbox' | 'reviews'>(initialTab)
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const formsRes = await pjApi.formkey.list()
      const flist = (formsRes.forms ?? []) as Array<{ id: string; formId: string; name: string; fields?: { id: string; label: string }[] }>
      setForms(flist)

      const allSubs: SubmissionWithForm[] = []
      await Promise.all(
        flist.map(async f => {
          try {
            const res = await pjApi.formkey.listSubmissions(f.formId)
            for (const s of res.submissions ?? []) {
              allSubs.push({ ...(s as FKIntakeRecord), formTitle: f.name })
            }
          } catch { /* skip failed forms */ }
        })
      )
      allSubs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setSubmissions(allSubs)

      try {
        const reviewRes = await pjApi.formkey.listReviews('pending')
        setReviews(reviewRes.reviews ?? [])
      } catch { /* reviews table may not exist yet */ }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load intake records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const updateStatus = async (sub: SubmissionWithForm, status: FKIntakeStatus) => {
    setUpdating(sub.id)
    try {
      await pjApi.formkey.updateStatus(sub.formId, sub.id, status)
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status } : s))
      toast.success(`Status updated to ${STATUS_CONFIG[status].label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(null)
    }
  }

  const decideReview = async (review: FKReview, decision: 'approved' | 'rejected') => {
    setUpdating(review.id)
    try {
      const note = reviewNotes[review.id]?.trim() || undefined
      await pjApi.formkey.decideReview(review.id, decision, undefined, note)
      setReviews(prev => prev.filter(r => r.id !== review.id))
      setReviewNotes(prev => { const n = { ...prev }; delete n[review.id]; return n })
      toast.success(`Review ${decision}`)
      await loadAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Decision failed')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
        <ArrowsClockwise size={16} className="animate-spin" />
        Loading intake records…
      </div>
    )
  }

  const open = submissions.filter(s => !['responded', 'closed'].includes(s.status ?? 'received'))
  const closed = submissions.filter(s => ['responded', 'closed'].includes(s.status ?? 'received'))
  const overdueCount = open.filter(s => s.slaDueAt && slaTimeLeft(s.slaDueAt).overdue).length

  const filteredOpen = inboxFilter === 'needs_action'
    ? open.filter(s => s.status === 'received' || s.status === 'under_review')
    : inboxFilter === 'overdue'
      ? open.filter(s => s.slaDueAt && slaTimeLeft(s.slaDueAt).overdue)
      : open

  const getFieldLabel = (sub: SubmissionWithForm, fieldId: string) => {
    const f = forms.find(fo => fo.formId === sub.formId)
    return f?.fields?.find(fl => fl.id === fieldId)?.label ?? fieldId
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">FormKey Intake</span>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 py-0 text-[9px]">
              {overdueCount} overdue
            </Badge>
          )}
          {reviews.length > 0 && (
            <Badge className="h-4 bg-amber-500 px-1.5 py-0 text-[9px] text-white hover:bg-amber-500">
              {reviews.length} pending review
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void loadAll()}>
          <ArrowsClockwise size={12} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['inbox', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'inbox' ? `Inbox (${open.length})` : `Reviews (${reviews.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'inbox' && (
        <div className="space-y-3">
          {/* Filter strip */}
          {open.length > 0 && (
            <div className="flex gap-1">
              {(['all', 'needs_action', 'overdue'] as InboxFilter[]).map(f => (
                <button key={f} onClick={() => setInboxFilter(f)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors',
                    inboxFilter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}>
                  {f === 'all' ? `All (${open.length})` : f === 'needs_action' ? 'Needs Action' : `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}`}
                </button>
              ))}
            </div>
          )}

          {filteredOpen.length === 0 && (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              {inboxFilter === 'overdue' ? 'No overdue records.' : inboxFilter === 'needs_action' ? 'No records need action.' : 'No open intake records.'}
            </div>
          )}
          {filteredOpen.map(sub => {
            const status = (sub.status ?? 'received') as FKIntakeStatus
            const cfg = STATUS_CONFIG[status]
            const isExpanded = expandedId === sub.id
            const fieldEntries = Object.entries(sub.fields ?? {}).slice(0, 4)
            return (
              <div key={sub.id} className="rounded-md border overflow-hidden text-xs">
                <button className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium leading-snug">
                      <span className="truncate">{sub.formTitle ?? sub.formId}</span>
                      <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]', cfg.color)}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {sub.slaDueAt && <SlaChip slaDueAt={sub.slaDueAt} />}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {sub.id.slice(0, 8)}… · {new Date(sub.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {status === 'received' && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        disabled={updating === sub.id}
                        onClick={e => { e.stopPropagation(); void updateStatus(sub, 'under_review') }}>
                        Review
                      </Button>
                    )}
                    {status === 'under_review' && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        disabled={updating === sub.id}
                        onClick={e => { e.stopPropagation(); void updateStatus(sub, 'responded') }}>
                        Responded
                      </Button>
                    )}
                    {status !== 'closed' && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground"
                        disabled={updating === sub.id}
                        onClick={e => { e.stopPropagation(); void updateStatus(sub, 'closed') }}>
                        Close
                      </Button>
                    )}
                    <CaretDown size={11} className={cn('text-muted-foreground/40 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </button>
                {isExpanded && fieldEntries.length > 0 && (
                  <div className="border-t px-3 py-2.5 bg-muted/10 space-y-1">
                    {fieldEntries.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0 min-w-[90px] truncate">{getFieldLabel(sub, k)}</span>
                        <span className="truncate text-foreground/80">
                          {v === null || v === undefined ? '—'
                            : typeof v === 'boolean' ? (v ? 'Yes' : 'No')
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
          {closed.length > 0 && (
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                {closed.length} closed record{closed.length !== 1 ? 's' : ''}
              </summary>
              <div className="space-y-1 px-3 pb-3 pt-1">
                {closed.map(sub => {
                  const autoRejected = sub.reviewId && sub.status === 'closed'
                  return (
                    <div key={sub.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {autoRejected
                        ? <Robot size={11} className="shrink-0 text-red-400" weight="fill" />
                        : <CheckCircle size={11} className="shrink-0 text-emerald-500" weight="fill" />
                      }
                      <span className="truncate">{sub.formTitle ?? sub.formId}</span>
                      {autoRejected && <span className="text-[10px] text-red-500 font-medium shrink-0">auto-rejected</span>}
                      <span className="ml-auto shrink-0">{new Date(sub.createdAt).toLocaleDateString()}</span>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 && (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              No pending review gates.
            </div>
          )}
          {reviews.map(review => {
            const note = reviewNotes[review.id] ?? ''
            const slaLabel = review.sla_due_at ? slaTimeLeft(review.sla_due_at) : null
            return (
              <div key={review.id} className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/20 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      <Gavel size={12} className="shrink-0 text-amber-600" weight="fill" />
                      <span>Review gate — {review.formId}</span>
                      {slaLabel && (
                        <span className={cn('rounded border px-1.5 py-0.5 text-[10px]',
                          slaLabel.overdue ? 'bg-red-50 text-red-600 border-red-300' : slaLabel.urgent ? 'bg-amber-50 text-amber-700 border-amber-300' : 'border-border text-muted-foreground')}>
                          {slaLabel.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      Record {review.recordId.slice(0, 8)}…
                      {review.requiredRole && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {review.requiredRole.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={updating === review.id}
                      onClick={() => void decideReview(review, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/5"
                      disabled={updating === review.id}
                      onClick={() => void decideReview(review, 'rejected')}>
                      <XCircle size={11} className="mr-0.5" /> Reject
                    </Button>
                  </div>
                </div>
                {/* Optional note */}
                <div>
                  <input
                    type="text"
                    placeholder="Add a note (optional)…"
                    value={note}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [review.id]: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
