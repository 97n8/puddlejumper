import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, Buildings, ShieldCheck,
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
import { pjFetch } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectType = 'Capital Improvement' | 'Infrastructure' | 'Equipment' | 'Facility' | 'Technology' | 'Other'
type Authorization = 'Annual Budget' | 'Debt Exclusion' | 'Special Act' | 'Grant Funded' | 'Enterprise Fund'
type ProjectStatus = 'Planning' | 'Authorized' | 'Procurement' | 'In Progress' | 'Substantially Complete' | 'Closed'

interface Project {
  id: string
  projectName: string
  department: string
  projectType: ProjectType
  authorization: Authorization
  authorizedAmount: number
  spentAmount?: number
  fiscalYear: string
  projectManager?: string
  procurementRequired: boolean
  startDate?: string
  completionDate?: string
  status: ProjectStatus
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<ProjectStatus, string> = {
  'Planning': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  'Authorized': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Procurement': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'In Progress': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Substantially Complete': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Closed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function BudgetBar({ spent, authorized }: { spent: number; authorized: number }) {
  const pct = authorized > 0 ? Math.min((spent / authorized) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground shrink-0">{pct.toFixed(0)}% spent</span>
    </div>
  )
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  projectName: string
  department: string
  projectType: ProjectType
  authorization: Authorization
  authorizedAmount: string
  fiscalYear: string
  projectManager: string
  procurementRequired: boolean
  startDate: string
  completionDate: string
  description: string
}

const DEFAULT_FORM: FormState = {
  projectName: '', department: '', projectType: 'Capital Improvement',
  authorization: 'Annual Budget', authorizedAmount: '', fiscalYear: '',
  projectManager: '', procurementRequired: false, startDate: '', completionDate: '',
  description: '',
}

const ACTIVE_STATUSES: ProjectStatus[] = ['Authorized', 'Procurement', 'In Progress', 'Substantially Complete']
const PIPELINE_STATUSES: ProjectStatus[] = ['Planning']
const CLOSED_STATUSES: ProjectStatus[] = ['Closed']

// ── Project card ───────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const daysUntilCompletion = project.completionDate
    ? Math.round((new Date(project.completionDate).getTime() - Date.now()) / 86_400_000)
    : null
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium text-sm">{project.projectName}</div>
          <div className="text-xs text-muted-foreground">{project.department} · {project.projectType} · FY{project.fiscalYear}</div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Badge label={project.status} className={STATUS_CLASS[project.status]} />
          {project.procurementRequired && <Badge label="Procurement" className="bg-amber-500/10 text-amber-600 border-amber-500/20" />}
        </div>
      </div>
      <BudgetBar spent={project.spentAmount ?? 0} authorized={project.authorizedAmount} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">${project.authorizedAmount.toLocaleString()} authorized</span>
        {daysUntilCompletion !== null && (
          <span className={daysUntilCompletion < 0 ? 'text-red-500' : daysUntilCompletion < 30 ? 'text-amber-600' : ''}>
            {daysUntilCompletion < 0 ? `${Math.abs(daysUntilCompletion)}d overdue` : `${daysUntilCompletion}d remaining`}
          </span>
        )}
        {project.projectManager && <span>PM: {project.projectManager}</span>}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function CapitalProjectsPanel({ onBack }: { onBack: () => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<Project[]>('/v1/projects/capital')
      setProjects(data ?? [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active = projects.filter(p => ACTIVE_STATUSES.includes(p.status))
  const pipeline = projects.filter(p => PIPELINE_STATUSES.includes(p.status))
  const closed = projects.filter(p => CLOSED_STATUSES.includes(p.status))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.projectName || !form.department || !form.authorizedAmount || !form.fiscalYear || !form.description) {
      toast.error('Project name, department, authorized amount, fiscal year, and description are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/projects/capital', {
        method: 'POST',
        body: JSON.stringify({ ...form, authorizedAmount: Number(form.authorizedAmount) }),
      })
      toast.success('Project created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <Buildings size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Projects</h1>
          <p className="text-xs text-muted-foreground leading-tight">CIP · Town Charter · MGL c.44 debt exclusion</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New
          </Button>
        </div>
      </div>

      {/* Governance banner */}
      <div className="shrink-0 px-5 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Capital project documents → permanent · Contract records → 10 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Required steps are governed — staff see guidance, server enforces hard stops</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="active" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {active.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                Pipeline
                {pipeline.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{pipeline.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Expenditure & Closeout Requirements</div>
              <p>Expenditures require appropriation authority. Procurement above threshold requires competitive process per MGL c.30B. Closeout requires: final cost reconciliation, all contracts closed, retainage released, and capital asset recorded.</p>
            </div>
            {active.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active capital projects. Add a project to track authorization, spending, milestones, and closeout.</p>
            ) : active.map(p => <ProjectCard key={p.id} project={p} />)}
          </TabsContent>

          <TabsContent value="pipeline" className="p-5 space-y-3">
            {pipeline.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No projects in the planning pipeline. Projects in the CIP planning phase will appear here.</p>
            ) : pipeline.map(p => <ProjectCard key={p.id} project={p} />)}
          </TabsContent>

          <TabsContent value="closed" className="p-5 space-y-3">
            {closed.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No closed projects. Completed projects with closeout packages will appear here.</p>
            ) : closed.map(p => <ProjectCard key={p.id} project={p} />)}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Project Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Capital Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-name">Project Name *</Label>
              <Input id="cp-name" value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} placeholder="e.g., Town Hall HVAC Replacement" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-dept">Department *</Label>
                <Input id="cp-dept" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g., DPW" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-fy">Fiscal Year *</Label>
                <Input id="cp-fy" value={form.fiscalYear} onChange={e => setForm(f => ({ ...f, fiscalYear: e.target.value }))} placeholder="e.g., FY2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-ptype">Project Type</Label>
                <select id="cp-ptype" value={form.projectType} onChange={e => setForm(f => ({ ...f, projectType: e.target.value as ProjectType }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {(['Capital Improvement', 'Infrastructure', 'Equipment', 'Facility', 'Technology', 'Other'] as ProjectType[]).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-auth">Authorization</Label>
                <select id="cp-auth" value={form.authorization} onChange={e => setForm(f => ({ ...f, authorization: e.target.value as Authorization }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {(['Annual Budget', 'Debt Exclusion', 'Special Act', 'Grant Funded', 'Enterprise Fund'] as Authorization[]).map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-amount">Authorized Amount *</Label>
                <Input id="cp-amount" type="number" value={form.authorizedAmount} onChange={e => setForm(f => ({ ...f, authorizedAmount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-pm">Project Manager</Label>
                <Input id="cp-pm" value={form.projectManager} onChange={e => setForm(f => ({ ...f, projectManager: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-start">Est. Start Date</Label>
                <Input id="cp-start" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-end">Est. Completion Date</Label>
                <Input id="cp-end" type="date" value={form.completionDate} onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="cp-proc" checked={form.procurementRequired} onChange={e => setForm(f => ({ ...f, procurementRequired: e.target.checked }))} className="h-4 w-4 rounded border" />
              <Label htmlFor="cp-proc">Procurement required?</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-desc">Description / Scope *</Label>
              <Textarea id="cp-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the project scope" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
