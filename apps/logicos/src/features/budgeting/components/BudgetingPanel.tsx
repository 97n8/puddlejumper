import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import {
  CurrencyDollar, ArrowLeft, Plus, ArrowClockwise, TrendUp,
  CalendarBlank, ChartBar,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { FiscalYear, ProjectionYear } from '../types'
import { calculateCompoundModel } from '../lib/compoundInterest'
import { useFiscalYears, useCreateFiscalYear, useCreateModel } from '../api'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const modelSchema = z.object({
  scenarioLabel: z.string().min(1, 'Required'),
  principal: z.coerce.number().min(0, 'Must be >= 0'),
  annualRate: z.coerce.number().min(0.01).max(100, 'Enter as percent, e.g. 4.75'),
  compoundingPeriods: z.coerce.number(),
  durationYears: z.coerce.number().min(1).max(30),
  periodicContribution: z.coerce.number().min(0),
  contributionFrequency: z.enum(['monthly', 'quarterly', 'annual']),
})
type ModelFormValues = z.infer<typeof modelSchema>

const fySchema = z.object({
  label: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  status: z.enum(['draft', 'proposed', 'adopted', 'closed']),
})
type FyFormValues = z.infer<typeof fySchema>

const projectionColumns: ColDef<ProjectionYear>[] = [
  { field: 'year', headerName: 'Year', width: 80, type: 'numericColumn' },
  { field: 'openingBalance', headerName: 'Opening Balance', valueFormatter: (p) => formatCurrency(p.value) },
  { field: 'contributions', headerName: 'Contributions', valueFormatter: (p) => formatCurrency(p.value) },
  { field: 'interestEarned', headerName: 'Interest Earned', valueFormatter: (p) => formatCurrency(p.value) },
  { field: 'closingBalance', headerName: 'Closing Balance', valueFormatter: (p) => formatCurrency(p.value) },
]

const fyStatusStyles: Record<FiscalYear['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  proposed: 'bg-blue-500/10 text-blue-600',
  adopted: 'bg-emerald-500/10 text-emerald-600',
  closed: 'bg-slate-500/10 text-slate-500',
}

export function BudgetingPanel({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState('models')
  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [fyDialogOpen, setFyDialogOpen] = useState(false)
  const [currentProjection, setCurrentProjection] = useState<ProjectionYear[] | null>(null)
  const [scenarios, setScenarios] = useState<Array<{ label: string; rate: number; rows: ProjectionYear[] }> | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: fiscalYears = [], isLoading: fyLoading, refetch: refetchFiscalYears } = useFiscalYears()
  const createFiscalYear = useCreateFiscalYear()
  const createModel = useCreateModel()

  const modelForm = useForm<ModelFormValues>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      scenarioLabel: '',
      principal: 100000,
      annualRate: 4.75,
      compoundingPeriods: 12,
      durationYears: 10,
      periodicContribution: 0,
      contributionFrequency: 'monthly',
    },
  })

  const fyForm = useForm<FyFormValues>({
    resolver: zodResolver(fySchema),
    defaultValues: {
      label: '',
      startDate: '',
      endDate: '',
      status: 'draft',
    },
  })

  const loadFiscalYears = () => refetchFiscalYears()

  async function handleModelSubmit(values: ModelFormValues) {
    setSaving(true)
    try {
      const rateDecimal = values.annualRate / 100

      const baseRows = calculateCompoundModel({
        ...values,
        annualRate: rateDecimal,
      })
      const conservativeRows = calculateCompoundModel({
        ...values,
        annualRate: Math.max(0.001, rateDecimal - 0.005),
      })
      const optimisticRows = calculateCompoundModel({
        ...values,
        annualRate: rateDecimal + 0.005,
      })

      setCurrentProjection(baseRows)
      setScenarios([
        { label: 'Conservative', rate: rateDecimal - 0.005, rows: conservativeRows },
        { label: 'Base', rate: rateDecimal, rows: baseRows },
        { label: 'Optimistic', rate: rateDecimal + 0.005, rows: optimisticRows },
      ])

      createModel.mutate(
        { ...values, annualRate: rateDecimal, projectionSeries: baseRows } as Parameters<typeof createModel.mutate>[0],
        {
          onError: () => { /* model stored locally */ },
        },
      )

      setModelDialogOpen(false)
      toast.success('Model calculated')
    } finally {
      setSaving(false)
    }
  }

  async function handleFySubmit(values: FyFormValues) {
    setSaving(true)
    try {
      await createFiscalYear.mutateAsync(values)
      toast.success('Fiscal year created')
      setFyDialogOpen(false)
      fyForm.reset()
    } catch (err) {
      console.error('[BudgetingPanel] Failed to create fiscal year:', err)
      toast.error('Failed to create fiscal year')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Sticky top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <CurrencyDollar size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Budgeting</h1>
          <p className="text-xs text-muted-foreground">Model long-term fund growth and track fiscal years</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4 space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="models">
                <ChartBar size={14} className="mr-1.5" />
                Projections
              </TabsTrigger>
              <TabsTrigger value="fiscalyears">
                <CalendarBlank size={14} className="mr-1.5" />
                Fiscal Years
              </TabsTrigger>
            </TabsList>

            {/* Financial Models tab */}
            <TabsContent value="models" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Compound interest projections</p>
                <Button size="sm" onClick={() => setModelDialogOpen(true)}>
                  <Plus size={14} className="mr-1.5" />
                  New Model
                </Button>
              </div>

              {currentProjection ? (
                <div className="space-y-4">
                  <div className="ag-theme-quartz rounded-md overflow-hidden border" style={{ height: 400, width: '100%' }}>
                    <AgGridReact
                      rowData={currentProjection}
                      columnDefs={projectionColumns}
                      defaultColDef={{ flex: 1, minWidth: 100 }}
                      suppressMenuHide
                      animateRows
                    />
                  </div>

                  {scenarios && (
                    <div className="grid grid-cols-3 gap-3">
                      {scenarios.map((s) => (
                        <Card key={s.label} className={cn(s.label === 'Base' && 'ring-1 ring-primary/40')}>
                          <CardHeader className="pb-1 pt-3 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <TrendUp size={13} />
                              {s.label}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-3">
                            <p className="text-lg font-semibold tabular-nums">
                              {formatCurrency(s.rows[s.rows.length - 1]?.closingBalance ?? 0)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              @ {(s.rate * 100).toFixed(2)}%
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                  <ChartBar size={36} className="opacity-30" />
                  <p className="text-sm">Run a projection to see how a fund, reserve, or investment grows over time. Try it with a 4.75% rate on your stabilization fund.</p>
                </div>
              )}
            </TabsContent>

            {/* Fiscal Years tab */}
            <TabsContent value="fiscalyears" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Track fiscal year periods and status</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={loadFiscalYears} disabled={fyLoading}>
                    <ArrowClockwise size={14} className={cn('mr-1.5', fyLoading && 'animate-spin')} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => setFyDialogOpen(true)}>
                    <Plus size={14} className="mr-1.5" />
                    New Fiscal Year
                  </Button>
                </div>
              </div>

              {fyLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading…</div>
              ) : fiscalYears.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                  <CalendarBlank size={36} className="opacity-30" />
                  <p className="text-sm">No fiscal years on file. Add a fiscal year to track budget cycles and link financial models.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fiscalYears.map((fy) => (
                    <div
                      key={fy.id}
                      className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{fy.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fy.startDate} → {fy.endDate}
                        </p>
                      </div>
                      <Badge className={cn('ml-3 capitalize text-xs', fyStatusStyles[fy.status])}>
                        {fy.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Model Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Financial Model</DialogTitle>
          </DialogHeader>
          <form onSubmit={modelForm.handleSubmit(handleModelSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scenarioLabel">Scenario Label</Label>
              <Input id="scenarioLabel" {...modelForm.register('scenarioLabel')} placeholder="e.g. Reserve Fund 2025" />
              {modelForm.formState.errors.scenarioLabel && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.scenarioLabel.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="principal">Principal ($)</Label>
                <Input id="principal" type="number" step="1000" {...modelForm.register('principal')} />
                {modelForm.formState.errors.principal && (
                  <p className="text-xs text-destructive">{modelForm.formState.errors.principal.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="annualRate">Annual Rate (%)</Label>
                <Input id="annualRate" type="number" step="0.01" {...modelForm.register('annualRate')} placeholder="e.g. 4.75" />
                {modelForm.formState.errors.annualRate && (
                  <p className="text-xs text-destructive">{modelForm.formState.errors.annualRate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="compoundingPeriods">Compounding</Label>
                <Select
                  defaultValue={String(modelForm.getValues('compoundingPeriods'))}
                  onValueChange={(v) => modelForm.setValue('compoundingPeriods', Number(v))}
                >
                  <SelectTrigger id="compoundingPeriods">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Annual</SelectItem>
                    <SelectItem value="4">Quarterly</SelectItem>
                    <SelectItem value="12">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationYears">Duration (years)</Label>
                <Input id="durationYears" type="number" min={1} max={30} {...modelForm.register('durationYears')} />
                {modelForm.formState.errors.durationYears && (
                  <p className="text-xs text-destructive">{modelForm.formState.errors.durationYears.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="periodicContribution">Periodic Contribution ($)</Label>
                <Input id="periodicContribution" type="number" step="100" {...modelForm.register('periodicContribution')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contributionFrequency">Contribution Frequency</Label>
                <Select
                  defaultValue={modelForm.getValues('contributionFrequency')}
                  onValueChange={(v) => modelForm.setValue('contributionFrequency', v as ModelFormValues['contributionFrequency'])}
                >
                  <SelectTrigger id="contributionFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModelDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Calculating…' : 'Calculate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fiscal Year Dialog */}
      <Dialog open={fyDialogOpen} onOpenChange={setFyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Fiscal Year</DialogTitle>
          </DialogHeader>
          <form onSubmit={fyForm.handleSubmit(handleFySubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fy-label">Label</Label>
              <Input id="fy-label" {...fyForm.register('label')} placeholder="e.g. FY 2025–26" />
              {fyForm.formState.errors.label && (
                <p className="text-xs text-destructive">{fyForm.formState.errors.label.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fy-startDate">Start Date</Label>
                <Input id="fy-startDate" type="date" {...fyForm.register('startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fy-endDate">End Date</Label>
                <Input id="fy-endDate" type="date" {...fyForm.register('endDate')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fy-status">Status</Label>
              <Select
                defaultValue={fyForm.getValues('status')}
                onValueChange={(v) => fyForm.setValue('status', v as FyFormValues['status'])}
              >
                <SelectTrigger id="fy-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="adopted">Adopted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFyDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
