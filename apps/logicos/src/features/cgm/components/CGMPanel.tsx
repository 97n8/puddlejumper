import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, CurrencyDollar,
  ShieldCheck, Warning, WarningCircle, CheckCircle,
  SealWarning,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { cgmApi } from '../api'
import {
  type CgmCase, type CgmCaseClassification, type NewCgmCaseForm,
  CLASSIFICATION_LABELS, STATUS_LABELS,
} from '../types'

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

const STATUS_CLASS: Record<string, string> = {
  setup:      'bg-slate-500/10 text-slate-600 border-slate-500/20',
  active:     'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  compliance: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  closed:     'bg-slate-400/10 text-slate-500 border-slate-400/20',
}

const CLASSIFICATION_SHORT: Record<CgmCaseClassification, string> = {
  capital_municipal:  'Capital · Municipal',
  capital_state_aided:'Capital · State-Aided',
  grant_federal:      'Grant · Federal (2 CFR 200)',
  grant_state:        'Grant · State',
  grant_private:      'Grant · Private',
  hybrid:             'Hybrid',
  ppp:                'Public-Private Partnership',
}

// ── Watch alert badge ─────────────────────────────────────────────────────────

function AlertBadge({ severity }: { severity: string }) {
  if (severity === 'critical') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
      <SealWarning size={11} weight="fill" /> Critical
    </span>
  )
  if (severity === 'high') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-700">
      <WarningCircle size={11} weight="fill" /> High
    </span>
  )
  if (severity === 'warning') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Warning size={11} weight="fill" /> Warning
    </span>
  )
  return null
}

// ── Budget bar ────────────────────────────────────────────────────────────────

function BudgetSummary({ cases: c }: { cases: CgmCase }) {
  const budget = c.budget
  if (!budget) return null
  const total = budget.lineItems.reduce((s, li) => s + li.appropriated, 0)
  const spent = budget.lineItems.reduce((s, li) => s + li.expended, 0)
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground shrink-0">
        ${spent.toLocaleString()} / ${total.toLocaleString()}
      </span>
    </div>
  )
}

// ── Case card ─────────────────────────────────────────────────────────────────

function CgmCaseCard({ cgmCase }: { cgmCase: CgmCase }) {
  const topAlert = cgmCase.watchAlerts?.[0]
  const overdueObligations = cgmCase.obligations?.filter(o => o.status === 'overdue') ?? []

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{cgmCase.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {CLASSIFICATION_SHORT[cgmCase.classification]}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0 items-center">
          {topAlert && <AlertBadge severity={topAlert.severity} />}
          <Badge label={STATUS_LABELS[cgmCase.status]} className={STATUS_CLASS[cgmCase.status]} />
        </div>
      </div>

      {cgmCase.budget && <BudgetSummary cases={cgmCase} />}

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {(cgmCase.fundingSources?.length ?? 0) > 0 && (
          <span>{cgmCase.fundingSources!.length} funding source{cgmCase.fundingSources!.length !== 1 ? 's' : ''}</span>
        )}
        {(cgmCase.openDisbursements ?? 0) > 0 && (
          <span className="text-amber-700 font-medium">
            {cgmCase.openDisbursements} disbursement{cgmCase.openDisbursements !== 1 ? 's' : ''} pending
          </span>
        )}
        {overdueObligations.length > 0 && (
          <span className="text-red-600 font-medium">
            {overdueObligations.length} obligation{overdueObligations.length !== 1 ? 's' : ''} overdue
          </span>
        )}
      </div>

      {topAlert && (
        <div className="rounded border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-700">
          {topAlert.message}
        </div>
      )}
    </div>
  )
}

// ── New case form ─────────────────────────────────────────────────────────────

const DEFAULT_FORM: NewCgmCaseForm = {
  name: '',
  classification: 'capital_municipal',
  description: '',
}

const CLASSIFICATIONS: CgmCaseClassification[] = [
  'capital_municipal', 'capital_state_aided',
  'grant_federal', 'grant_state', 'grant_private',
  'hybrid', 'ppp',
]

function NewCaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<NewCgmCaseForm>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Project name and description are required')
      return
    }
    setSubmitting(true)
    try {
      await cgmApi.createCase(form)
      toast.success('CGM case created')
      onOpenChange(false)
      setForm(DEFAULT_FORM)
      onCreated()
    } catch {
      toast.error('Failed to create case')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Capital & Grant Case</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Classification determines which compliance rules, approval chains, and reporting obligations apply. It can be updated during setup before activation.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="cgm-name">Project / Grant Name *</Label>
            <Input
              id="cgm-name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Community Development Block Grant FY2025"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cgm-class">Classification *</Label>
            <select
              id="cgm-class"
              value={form.classification}
              onChange={e => setForm(f => ({ ...f, classification: e.target.value as CgmCaseClassification }))}
              className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CLASSIFICATIONS.map(c => (
                <option key={c} value={c}>{CLASSIFICATION_LABELS[c]}</option>
              ))}
            </select>
            {form.classification === 'grant_federal' && (
              <p className="text-xs text-amber-700 bg-amber-500/8 border border-amber-500/20 rounded px-2.5 py-1.5">
                2 CFR Part 200 (Uniform Guidance) applies. Subrecipient monitoring required if funds flow to third parties. Single Audit threshold will be tracked.
              </p>
            )}
            {form.classification === 'hybrid' && (
              <p className="text-xs text-amber-700 bg-amber-500/8 border border-amber-500/20 rounded px-2.5 py-1.5">
                Hybrid cases apply the strictest compliance rule across all funding sources.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cgm-desc">Scope / Description *</Label>
            <Textarea
              id="cgm-desc"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Describe the project scope, funding purpose, and primary objectives"
            />
          </div>
          <div className="rounded border border-muted bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground">What happens next</div>
            <div>After creation you will load funding sources, define a budget by line item, set reporting obligations, and obtain Finance Authority activation. No spending can proceed until the case is active.</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Case'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function CGMPanel({ onBack }: { onBack: () => void }) {
  const [cases, setCases] = useState<CgmCase[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await cgmApi.listCases()
      setCases(data ?? [])
    } catch (err) {
      console.error('[CGMPanel] Failed to load cases:', err)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setup      = cases.filter(c => c.status === 'setup')
  const active     = cases.filter(c => c.status === 'active' || c.status === 'compliance')
  const closed     = cases.filter(c => c.status === 'closed')
  const critAlerts = cases.filter(c => c.watchAlerts?.some(a => a.severity === 'critical'))

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <CurrencyDollar size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Capital &amp; Grants</h1>
          <p className="text-xs text-muted-foreground leading-tight">MGL c.44 · 2 CFR 200 · ARPA · OMB Uniform Guidance</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New Case
          </Button>
        </div>
      </div>

      {/* Governance banner */}
      <div className="shrink-0 px-5 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">VAULT:</span> Award docs · Compliance reports · Audit packages</span>
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Federal grants 7 yr · Capital (infrastructure) permanent</span>
        <span><span className="font-semibold text-foreground">SEAL:</span> Applied at each disbursement approval, period close, and closeout</span>
      </div>

      {/* Critical alert bar */}
      {critAlerts.length > 0 && (
        <div className="shrink-0 px-5 py-2.5 border-b bg-red-500/5 border-red-500/20 text-xs text-red-700 flex items-center gap-2">
          <SealWarning size={14} weight="fill" className="shrink-0" />
          <span className="font-semibold">{critAlerts.length} critical alert{critAlerts.length !== 1 ? 's' : ''} require attention.</span>
          <span>Finance Authority must review before spending resumes on affected cases.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="active" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {active.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="setup">
                Setup
                {setup.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{setup.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck size={14} /> Expenditure Hard Stops
              </div>
              <p>
                Disbursements are blocked if: the budget line item balance is exceeded · a grant restriction would be violated · the funding source balance is zero · a required approver role is vacant in Org Manager · a reporting obligation is overdue against that funding source.
              </p>
            </div>
            {active.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active cases. Cases appear here after Finance Authority activation.
              </p>
            ) : active.map(c => <CgmCaseCard key={c.id} cgmCase={c} />)}
          </TabsContent>

          <TabsContent value="setup" className="p-5 space-y-5">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle size={14} /> Setup Checklist
              </div>
              <p>
                Before activation each case needs: funding sources loaded · budget approved by Finance Authority · reporting obligations entered · Finance Authority activation approval. No spending can proceed until all steps are complete.
              </p>
            </div>
            {setup.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cases in setup. Create a new case to begin.
              </p>
            ) : setup.map(c => <CgmCaseCard key={c.id} cgmCase={c} />)}
          </TabsContent>

          <TabsContent value="closed" className="p-5 space-y-3">
            {closed.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No closed cases. Completed cases with certified closeout packages will appear here.
              </p>
            ) : closed.map(c => <CgmCaseCard key={c.id} cgmCase={c} />)}
          </TabsContent>
        </Tabs>
      </div>

      <NewCaseDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={load}
      />
    </div>
  )
}
