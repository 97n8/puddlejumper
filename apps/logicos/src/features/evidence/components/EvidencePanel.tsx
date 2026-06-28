import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowClockwise,
  Package,
  Copy,
  CaretDown,
  CaretUp,
  Plus,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AuditEvent } from '../types'
import { useAuditEvents, useEvidencePackages, useGeneratePackage } from '../api'

const packageSchema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  eventIds: z.array(z.string()).min(1, 'Select at least one event'),
})
type PackageFormValues = z.infer<typeof packageSchema>

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false)

  function copyHash() {
    if (event.sealHash) {
      navigator.clipboard.writeText(event.sealHash).then(() => toast.success('Hash copied'))
    }
  }

  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{event.eventType}</td>
        <td className="px-4 py-3 text-sm">{event.actorName}</td>
        <td className="px-4 py-3 text-sm hidden md:table-cell">{event.targetType}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
          {new Date(event.occurredAt).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          {event.sealHash ? (
            <div className="flex items-center gap-1">
              <code className="text-xs font-mono">{event.sealHash.slice(0, 8)}</code>
              <button
                onClick={e => { e.stopPropagation(); copyHash() }}
                className="p-0.5 rounded hover:bg-muted"
                title="Copy hash"
              >
                <Copy size={12} />
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-xs font-mono bg-muted p-2 rounded-md overflow-auto max-h-48">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

function GenerateDialog({
  open,
  onOpenChange,
  events,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  events: AuditEvent[]
}) {
  const generateMutation = useGeneratePackage()
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: { title: '', description: '', eventIds: [] },
  })

  const selectedIds = form.watch('eventIds')

  function toggleEvent(id: string) {
    const current = form.getValues('eventIds')
    form.setValue(
      'eventIds',
      current.includes(id) ? current.filter(e => e !== id) : [...current, id],
      { shouldValidate: true },
    )
  }

  async function onSubmit(values: PackageFormValues) {
    try {
      await generateMutation.mutateAsync(values)
      toast.success('Evidence package generated')
      onOpenChange(false)
      form.reset()
    } catch {
      toast.error('Failed to generate package')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Evidence Package</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-title">Title</Label>
            <Input id="pkg-title" {...form.register('title')} placeholder="Package title" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc">Description</Label>
            <Textarea id="pkg-desc" {...form.register('description')} rows={2} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>
          <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
            <Label>Select Events ({selectedIds.length} selected)</Label>
            {form.formState.errors.eventIds && (
              <p className="text-xs text-destructive">{form.formState.errors.eventIds.message}</p>
            )}
            <div className="rounded-md border overflow-y-auto flex-1">
              {events.map(event => (
                <label
                  key={event.id}
                  className="flex items-start gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer border-b last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-muted-foreground">{event.eventType}</div>
                    <div className="text-xs">{event.actorName} · {new Date(event.occurredAt).toLocaleDateString()}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EvidencePanel({ onBack }: { onBack: () => void }) {
  const [generateOpen, setGenerateOpen] = useState(false)
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useAuditEvents()
  const { data: packages = [], isLoading: packagesLoading, refetch: refetchPackages } = useEvidencePackages()

  const isLoading = eventsLoading || packagesLoading

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <Package size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Evidence Packages</h1>
          <p className="text-xs text-muted-foreground leading-tight">Compile audit events into signed packages for legal proceedings or formal review</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => { refetchEvents(); refetchPackages() }}
            disabled={isLoading}
          >
            <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setGenerateOpen(true)}>
            <Plus size={14} />
            Generate
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="events" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="events">
                Audit Events
                {events.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{events.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="packages">
                Packages
                {packages.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{packages.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="events" className="p-5">
            {events.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No audit events found.</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Actor</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Target</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Occurred</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Hash</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => <EventRow key={event.id} event={event} />)}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="packages" className="p-5 space-y-4">
            {packages.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Package size={32} className="mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No packages yet. Select audit events and bundle them into a signed, tamper-evident package — for records requests, legal proceedings, or compliance review.</p>
                <Button size="sm" className="gap-1.5" onClick={() => setGenerateOpen(true)}>
                  <Plus size={14} />
                  Generate Package
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {packages.map(pkg => (
                  <div key={pkg.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{pkg.title}</div>
                        <div className="text-xs text-muted-foreground">{pkg.description}</div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {pkg.eventIds.length} event{pkg.eventIds.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Generated {new Date(pkg.generatedAt).toLocaleDateString()}</span>
                      <span>by {pkg.generatedBy}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{pkg.packageHash.slice(0, 16)}…</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(pkg.packageHash).then(() => toast.success('Hash copied'))}
                        className="p-0.5 rounded hover:bg-muted"
                        title="Copy hash"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} events={events} />
    </div>
  )
}
