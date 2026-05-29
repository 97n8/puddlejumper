import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  ArrowClockwise,
  FileText,
  Gavel,
  ShieldCheck,
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
import { cn } from '@/lib/utils'
import type { ProcurementItem, ProcurementStatus, ProcurementMethod } from '../types'
import { useProcurements, useCreateProcurement } from '../api'

const procurementSchema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().min(5, 'Please provide more detail'),
  estimatedValue: z.coerce.number().min(0, 'Must be a positive number'),
  method: z.enum(['ifw', 'rfp', 'rfq', 'sole_source', 'emergency', 'cooperative']),
  departmentName: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})
type ProcurementFormValues = z.infer<typeof procurementSchema>

const STATUS_CONFIG: Record<ProcurementStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  advertised: { label: 'Advertised', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  bid_open: { label: 'Bid Open', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  awarded: { label: 'Awarded', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  closed: { label: 'Closed', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
}

const METHOD_CONFIG: Record<ProcurementMethod, { label: string; className: string }> = {
  ifw: { label: 'IFW', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  rfp: { label: 'RFP', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  rfq: { label: 'RFQ', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  sole_source: { label: 'Sole Source', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  emergency: { label: 'Emergency', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  cooperative: { label: 'Cooperative', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
}

function StatusBadge({ status }: { status: ProcurementStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function MethodBadge({ method }: { method: ProcurementMethod }) {
  const cfg = METHOD_CONFIG[method]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const MGL_THRESHOLDS = [
  {
    label: 'Under $10,000',
    className: 'border-l-4 border-l-emerald-500',
    rule: 'No competitive process required.',
    methods: ['Direct purchase or informal quote recommended'],
  },
  {
    label: '$10,000 – $50,000',
    className: 'border-l-4 border-l-amber-500',
    rule: 'Minimum 3 written quotes required (MGL Ch. 30B §7).',
    methods: ['RFQ — Request for Quotations'],
  },
  {
    label: 'Above $50,000',
    className: 'border-l-4 border-l-blue-500',
    rule: 'Invitation for Bids (IFB) or Request for Proposals required (MGL Ch. 30B §5/§6).',
    methods: ['IFW — Invitation for Written Bids', 'RFP — Request for Proposals'],
  },
  {
    label: 'Emergency (up to $25,000)',
    className: 'border-l-4 border-l-red-500',
    rule: 'Emergency procurement allowed; must document justification and report to Inspector General.',
    methods: ['Emergency — must record circumstances and report'],
  },
  {
    label: 'Cooperative Purchasing',
    className: 'border-l-4 border-l-purple-500',
    rule: 'May piggyback on state or regional contracts without independent bid (MGL Ch. 30B §22).',
    methods: ['Cooperative — state contract or OMNIA/Sourcewell'],
  },
]

function ItemsTable({ items }: { items: ProcurementItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        No procurement items found.
      </div>
    )
  }
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Department</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Method</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Est. Value</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
              <td className="px-4 py-3">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{item.departmentName}</td>
              <td className="px-4 py-3"><MethodBadge method={item.method} /></td>
              <td className="px-4 py-3 tabular-nums hidden sm:table-cell">{formatCurrency(item.estimatedValue)}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProcurementPanel({ onBack }: { onBack: () => void }) {
  const [newOpen, setNewOpen] = useState(false)
  const { data: items = [], isLoading, refetch } = useProcurements()
  const createMutation = useCreateProcurement()

  const form = useForm<ProcurementFormValues>({
    resolver: zodResolver(procurementSchema),
    defaultValues: { title: '', description: '', estimatedValue: 0, method: 'rfq', departmentName: '', notes: '' },
  })

  const active = items.filter(i => !['closed', 'cancelled'].includes(i.status))
  const awarded = items.filter(i => i.status === 'awarded')

  const compliantCount = items.filter(i => i.mglCompliant).length
  const nonCompliantCount = items.filter(i => !i.mglCompliant).length

  async function onSubmit(values: ProcurementFormValues) {
    try {
      await createMutation.mutateAsync(values)
      toast.success('Procurement item created')
      setNewOpen(false)
      form.reset()
    } catch {
      toast.error('Failed to create procurement item')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <Gavel size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Procurement</h1>
          <p className="text-xs text-muted-foreground leading-tight">MGL Chapter 30B compliance tracker</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isLoading}>
            <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} />
            New
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="active" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {active.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{active.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="awarded">
                Awarded
                {awarded.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{awarded.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="p-5 space-y-4">
            <ItemsTable items={active} />
          </TabsContent>

          <TabsContent value="awarded" className="p-5 space-y-4">
            {awarded.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No awarded contracts yet.</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Vendor</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awarded.map((item, i) => (
                      <tr key={item.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                        <td className="px-4 py-3 font-medium">{item.title}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{item.awardedTo ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums">{item.awardedAmount != null ? formatCurrency(item.awardedAmount) : '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {item.awardedAt ? new Date(item.awardedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold">{items.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Items</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-emerald-600">{compliantCount}</div>
                <div className="text-xs text-muted-foreground mt-1">MGL Compliant</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-red-600">{nonCompliantCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Non-Compliant</div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-muted-foreground" />
                MGL Chapter 30B Threshold Reference
              </h2>
              <div className="space-y-3">
                {MGL_THRESHOLDS.map(threshold => (
                  <div key={threshold.label} className={cn('rounded-lg border bg-card p-4', threshold.className)}>
                    <div className="font-medium text-sm mb-1">{threshold.label}</div>
                    <div className="text-xs text-muted-foreground mb-2">{threshold.rule}</div>
                    <ul className="space-y-0.5">
                      {threshold.methods.map(m => (
                        <li key={m} className="text-xs flex items-start gap-1.5">
                          <FileText size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Procurement Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proc-title">Title</Label>
              <Input id="proc-title" {...form.register('title')} placeholder="e.g., Road Resurfacing — Main St" />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-desc">Description</Label>
              <Textarea id="proc-desc" {...form.register('description')} rows={3} placeholder="Scope of work..." />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proc-value">Estimated Value ($)</Label>
                <Input id="proc-value" type="number" min={0} {...form.register('estimatedValue')} />
                {form.formState.errors.estimatedValue && (
                  <p className="text-xs text-destructive">{form.formState.errors.estimatedValue.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proc-method">Method</Label>
                <select
                  id="proc-method"
                  {...form.register('method')}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ifw">IFW</option>
                  <option value="rfp">RFP</option>
                  <option value="rfq">RFQ</option>
                  <option value="sole_source">Sole Source</option>
                  <option value="emergency">Emergency</option>
                  <option value="cooperative">Cooperative</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-dept">Department</Label>
              <Input id="proc-dept" {...form.register('departmentName')} placeholder="e.g., Department of Public Works" />
              {form.formState.errors.departmentName && (
                <p className="text-xs text-destructive">{form.formState.errors.departmentName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-notes">Notes (optional)</Label>
              <Textarea id="proc-notes" {...form.register('notes')} rows={2} placeholder="Any additional notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
