import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  FolderOpen, ArrowLeft, Plus, ArrowClockwise, CheckCircle,
  Clock, Warning, X, CaretDown, CaretUp
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PRRRequest } from '../types'
import { usePRRRequests, useCreatePRR, useAcknowledgePRR, useClosePRR } from '../api'

const prrSchema = z.object({
  requesterName: z.string().min(1, 'Required'),
  requesterEmail: z.string().email('Valid email required'),
  description: z.string().min(10, 'Please provide more detail'),
})
type PRRFormValues = z.infer<typeof prrSchema>

const STATUS_CONFIG: Record<PRRRequest['status'], { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  acknowledged: { label: 'Acknowledged', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  in_review: { label: 'In Review', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  response_ready: { label: 'Response Ready', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
  denied: { label: 'Denied', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
}

const RETENTION_CLASSES = [
  {
    label: 'Permanent',
    color: 'border-l-4 border-l-slate-700',
    description: 'Must be preserved indefinitely',
    examples: ['Meeting minutes', 'Adopted budgets', 'Deeds and land records', 'Town warrants', 'Ordinances and bylaws'],
  },
  {
    label: 'Long-term (7–30 years)',
    color: 'border-l-4 border-l-blue-500',
    description: 'Extended retention for significant records',
    examples: ['Personnel records', 'Contracts', 'Legal correspondence', 'Grant records', 'Collective bargaining agreements'],
  },
  {
    label: 'Standard (3–7 years)',
    color: 'border-l-4 border-l-amber-500',
    description: 'Standard retention period',
    examples: ['Financial records', 'Procurement files', 'Permits and licenses', 'Correspondence files', 'Health and safety records'],
  },
  {
    label: 'Short-term (1–3 years)',
    color: 'border-l-4 border-l-emerald-500',
    description: 'Short-term operational records',
    examples: ['Routine correspondence', 'Working drafts', 'Reference materials', 'Event planning files', 'Non-binding notices'],
  },
  {
    label: 'Transitory',
    color: 'border-l-4 border-l-muted-foreground',
    description: 'No formal retention requirement',
    examples: ['Convenience copies', 'Draft communications', 'Informal notes', 'Transmittal documents', 'Routine acknowledgements'],
  },
]

function SlaIndicator({ days, breached }: { days: number; breached: boolean }) {
  if (breached || days > 10) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <Warning size={12} weight="fill" />
        SLA breached
      </span>
    )
  }
  if (days >= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Clock size={12} weight="fill" />
        Due soon
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      On track
    </span>
  )
}

export function RecordsPanel({ onBack }: { onBack: () => void }) {
  const [newPrrOpen, setNewPrrOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState('prr')
  const [showEmptyDespiteError, setShowEmptyDespiteError] = useState(false)
  const [closeTarget, setCloseTarget] = useState<string | null>(null)
  const [closeNote, setCloseNote] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PRRFormValues>({ resolver: zodResolver(prrSchema) })

  const { data: prrs = [], isLoading: loading, isError, error: queryError, refetch: refetchPRRs } = usePRRRequests()
  const createPRR = useCreatePRR()
  const acknowledgePRR = useAcknowledgePRR()
  const closePRR = useClosePRR()

  const error = isError ? (queryError instanceof Error ? queryError.message : 'Failed to load requests') : null

  async function handleSubmitPRR(values: PRRFormValues) {
    try {
      await createPRR.mutateAsync({
        requester_name: values.requesterName,
        requester_email: values.requesterEmail,
        request_description: values.description,
      })
      toast.success('Request submitted')
      setNewPrrOpen(false)
      reset()
    } catch {
      toast.error('Failed to submit request')
    }
  }

  async function handleAcknowledge(id: string) {
    try {
      await acknowledgePRR.mutateAsync(id)
      toast.success('Acknowledged')
    } catch {
      toast.error('Failed to acknowledge')
    }
  }


  const showList = !error || showEmptyDespiteError

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Sticky top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <FolderOpen size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Records</h1>
          <p className="text-xs text-muted-foreground">Public records requests &amp; retention</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetchPRRs()} aria-label="Refresh">
          <ArrowClockwise size={16} />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4 space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="prr">Public Records Requests</TabsTrigger>
              <TabsTrigger value="retention">Retention Schedule</TabsTrigger>
            </TabsList>

            {/* PRR Tab */}
            <TabsContent value="prr" className="mt-4 space-y-3">
              {/* Actions row */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setNewPrrOpen(true)}>
                  <Plus size={14} className="mr-1" />
                  Log Request
                </Button>
              </div>

              {/* Error banner */}
              {error && !showEmptyDespiteError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                  <Warning size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-700">{error}</p>
                    <button
                      className="text-xs text-amber-600 underline mt-1 hover:text-amber-800"
                      onClick={() => setShowEmptyDespiteError(true)}
                    >
                      Still show empty table
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <ArrowClockwise size={18} className="animate-spin mr-2" />
                  <span className="text-sm">Loading requests…</span>
                </div>
              )}

              {/* List */}
              {!loading && showList && (
                <>
                  {prrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground gap-2">
                      <FolderOpen size={32} className="opacity-30" />
                      <p className="text-sm">No requests on file. Use this panel to log and track public records requests (MGL Ch. 66). The 10-day acknowledgement clock starts when you create a request.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prrs.map((prr) => (
                        <div key={prr.id} className="rounded-lg border bg-card overflow-hidden">
                          {/* Summary row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedId(expandedId === prr.id ? null : prr.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-semibold text-muted-foreground">
                                  {prr.caseNumber}
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium',
                                    STATUS_CONFIG[prr.status].className
                                  )}
                                >
                                  {STATUS_CONFIG[prr.status].label}
                                </span>
                                <SlaIndicator days={prr.daysSinceCreation} breached={prr.isSlaBreached} />
                              </div>
                              <p className="text-sm font-medium truncate mt-0.5">{prr.requesterName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {prr.description.substring(0, 80)}
                                {prr.description.length > 80 ? '…' : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">{prr.daysSinceCreation}d open</p>
                              {expandedId === prr.id
                                ? <CaretUp size={14} className="text-muted-foreground ml-auto mt-1" />
                                : <CaretDown size={14} className="text-muted-foreground ml-auto mt-1" />
                              }
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {expandedId === prr.id && (
                            <div className="px-4 pb-4 border-t bg-muted/20 space-y-3 pt-3">
                              <div>
                                <p className="text-xs text-muted-foreground font-medium">Requester</p>
                                <p className="text-sm">{prr.requesterName} — {prr.requesterEmail}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-medium">Description</p>
                                <p className="text-sm whitespace-pre-wrap">{prr.description}</p>
                              </div>
                              <div className="flex gap-3 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  Created: {new Date(prr.createdAt).toLocaleDateString()}
                                </p>
                                {prr.acknowledgedAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Acknowledged: {new Date(prr.acknowledgedAt).toLocaleDateString()}
                                  </p>
                                )}
                                {prr.dueAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Due: {new Date(prr.dueAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {prr.status === 'new' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={acknowledgePRR.isPending}
                                    onClick={() => handleAcknowledge(prr.id)}
                                  >
                                    <CheckCircle size={14} className="mr-1" />
                                    {acknowledgePRR.isPending ? 'Acknowledging…' : 'Acknowledge'}
                                  </Button>
                                )}
                                {(prr.status === 'acknowledged' || prr.status === 'in_review' || prr.status === 'response_ready') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={closePRR.isPending}
                                    onClick={() => { setCloseTarget(prr.id); setCloseNote('') }}
                                  >
                                    <X size={14} className="mr-1" />
                                    {closePRR.isPending ? 'Closing…' : 'Close Request'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Retention Schedule Tab */}
            <TabsContent value="retention" className="mt-4 space-y-3">
              {RETENTION_CLASSES.map((cls) => (
                <Card key={cls.label} className={cn('pl-0 overflow-hidden', cls.color)}>
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">{cls.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{cls.description}</p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1">
                      {cls.examples.map((ex) => (
                        <li key={ex} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0 inline-block" />
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}

            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* New PRR Dialog */}
      <Dialog open={newPrrOpen} onOpenChange={setNewPrrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Public Records Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleSubmitPRR)} className="space-y-4">
            <div>
              <Label>Requester Name</Label>
              <Input {...register('requesterName')} placeholder="Full name" className="mt-1" />
              {errors.requesterName && (
                <p className="text-xs text-destructive mt-1">{errors.requesterName.message}</p>
              )}
            </div>
            <div>
              <Label>Requester Email</Label>
              <Input {...register('requesterEmail')} type="email" placeholder="email@example.com" className="mt-1" />
              {errors.requesterEmail && (
                <p className="text-xs text-destructive mt-1">{errors.requesterEmail.message}</p>
              )}
            </div>
            <div>
              <Label>Description of Records Requested</Label>
              <Textarea
                {...register('description')}
                placeholder="Please describe the records you are requesting…"
                className="mt-1 min-h-[100px]"
              />
              {errors.description && (
                <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewPrrOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPRR.isPending}>
                {createPRR.isPending ? 'Submitting…' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Request Dialog */}
      <Dialog open={!!closeTarget} onOpenChange={open => !open && setCloseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Add optional closing notes for this record.</p>
            <Textarea
              placeholder="Closing notes (optional)"
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              className="resize-none"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!closeTarget) return
                try {
                  await closePRR.mutateAsync({ id: closeTarget, notes: closeNote || undefined })
                  toast.success('Request closed')
                  setCloseTarget(null)
                } catch {
                  toast.error('Failed to close request')
                }
              }}
              disabled={closePRR.isPending}
            >
              {closePRR.isPending ? 'Closing…' : 'Close Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
