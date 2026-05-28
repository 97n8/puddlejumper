import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ArrowRight, ArrowLeft, Check, Pencil, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'complete'

interface Project {
  id: string
  name: string
  emoji: string
  description: string
  department: string
  lead: string
  status: ProjectStatus
  dueDate: string
  budgetAmount: string
  tags: string[]
  notes: string
  createdAt: number
  updatedAt: number
  environmentId?: string
}

// ─── Catalogs ─────────────────────────────────────────────────────────────────

const PROJECT_STATUSES: Record<ProjectStatus, { label: string; color: string }> = {
  planning:  { label: 'Planning',   color: 'blue'   },
  active:    { label: 'Active',     color: 'emerald' },
  'on-hold': { label: 'On Hold',   color: 'amber'  },
  complete:  { label: 'Complete',   color: 'slate'  },
}

const PROJECT_EMOJI_OPTIONS = ['📋', '🏗️', '🎯', '🚀', '🔧', '📊', '🌿', '🏛️', '⚙️', '🗺️', '🔬', '🌐']

const DEPARTMENT_OPTIONS = [
  'Administration', 'Finance', 'Public Works', 'Planning',
  'Police', 'Fire', 'Health', 'IT', 'Parks & Recreation', 'Other',
]

const TAG_OPTIONS = ['Capital', 'Infrastructure', 'Technology', 'Community', 'Compliance', 'Grant-funded', 'Multi-year']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function Btn({ onClick, disabled, children, variant = 'primary', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'primary' | 'ghost' | 'outline'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40'
  const vars = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    ghost:   'text-muted-foreground hover:text-foreground hover:bg-muted',
    outline: 'border border-border text-foreground hover:bg-muted',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${vars[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

type WizardStep = 'basics' | 'details' | 'review'

const BLANK: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', emoji: '📋', description: '', department: '', lead: '',
  status: 'planning', dueDate: '', budgetAmount: '', tags: [], notes: '',
}

function ProjectWizard({ initial, onSave, onCancel }: {
  initial?: Project
  onSave: (p: Project) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<WizardStep>('basics')
  const [draft, setDraft] = useState<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>(
    initial ? { ...initial } : { ...BLANK }
  )

  const set = (k: keyof typeof draft, v: unknown) => setDraft(d => ({ ...d, [k]: v }))
  const toggleTag = (t: string) =>
    set('tags', draft.tags.includes(t) ? draft.tags.filter(x => x !== t) : [...draft.tags, t])

  function handleSave() {
    const now = Date.now()
    onSave({
      ...draft,
      id: initial?.id ?? `proj-${now}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    })
  }

  const canAdvanceBasics = draft.name.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
        {(['basics', 'details', 'review'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === s ? 'bg-primary text-primary-foreground' :
              (['basics', 'details', 'review'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
              'bg-muted text-muted-foreground'
            }`}>
              {(['basics', 'details', 'review'].indexOf(step) > i) ? <Check size={11} /> : i + 1}
            </div>
            <span className={`text-xs capitalize hidden sm:inline ${step === s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Step 1: Basics */}
        {step === 'basics' && (
          <>
            <h3 className="text-sm font-semibold">Project basics</h3>
            {/* Emoji picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => set('emoji', e)}
                    className={`text-xl w-9 h-9 rounded-lg border transition-colors ${draft.emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project name <span className="text-destructive">*</span></label>
              <Input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Town Hall HVAC Replacement" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Textarea value={draft.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="What is this project about?" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PROJECT_STATUSES) as [ProjectStatus, { label: string; color: string }][]).map(([s, meta]) => (
                  <button key={s} onClick={() => set('status', s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      draft.status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    }`}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <>
            <h3 className="text-sm font-semibold">Project details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Department</label>
                <select value={draft.department} onChange={e => set('department', e.target.value)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Select…</option>
                  {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Project lead</label>
                <Input value={draft.lead} onChange={e => set('lead', e.target.value)} placeholder="Name or email" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Due date</label>
                <Input type="date" value={draft.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Budget</label>
                <Input value={draft.budgetAmount} onChange={e => set('budgetAmount', e.target.value)} placeholder="e.g. $340,000" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                      draft.tags.includes(t) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional context, milestones, or links…" />
            </div>
          </>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <>
            <h3 className="text-sm font-semibold">Review &amp; save</h3>
            <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{draft.emoji}</span>
                <div>
                  <div className="font-semibold">{draft.name}</div>
                  {draft.description && <div className="text-xs text-muted-foreground mt-0.5">{draft.description}</div>}
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadge[PROJECT_STATUSES[draft.status].color]}`}>
                  {PROJECT_STATUSES[draft.status].label}
                </span>
              </div>
              {(draft.department || draft.lead) && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {draft.department && <span>📂 {draft.department}</span>}
                  {draft.lead && <span>👤 {draft.lead}</span>}
                </div>
              )}
              {(draft.dueDate || draft.budgetAmount) && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {draft.dueDate && <span>📅 {draft.dueDate}</span>}
                  {draft.budgetAmount && <span>💰 {draft.budgetAmount}</span>}
                </div>
              )}
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
              {draft.notes && <p className="text-xs text-muted-foreground border-t pt-2">{draft.notes}</p>}
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
        <Btn variant="ghost" onClick={step === 'basics' ? onCancel : () => setStep(step === 'review' ? 'details' : 'basics')}>
          <ArrowLeft size={13} />{step === 'basics' ? 'Cancel' : 'Back'}
        </Btn>
        {step !== 'review'
          ? <Btn disabled={step === 'basics' && !canAdvanceBasics} onClick={() => setStep(step === 'basics' ? 'details' : 'review')}>
              Next <ArrowRight size={13} />
            </Btn>
          : <Btn onClick={handleSave}>
              <Check size={13} /> {initial ? 'Save changes' : 'Create project'}
            </Btn>
        }
      </div>
    </div>
  )
}

// ─── List card ────────────────────────────────────────────────────────────────

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const meta = PROJECT_STATUSES[project.status]
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-muted-foreground/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{project.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{project.name}</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge[meta.color]}`}>
              {meta.label}
            </span>
          </div>
          {project.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.description}</p>}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
            {project.department && <span>📂 {project.department}</span>}
            {project.lead && <span>👤 {project.lead}</span>}
            {project.dueDate && <span>📅 {project.dueDate}</span>}
            {project.budgetAmount && <span>💰 {project.budgetAmount}</span>}
          </div>
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {project.tags.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ProjectsPanel({ environmentId }: { environmentId?: string }) {
  const storageKey = `builder-projects-${environmentId ?? 'global'}`
  const [projects, setProjects] = useKV<Project[]>(storageKey, [])
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing] = useState<Project | null>(null)

  function handleSave(p: Project) {
    setProjects(prev => {
      const list = prev ?? []
      const exists = list.find(x => x.id === p.id)
      return exists ? list.map(x => x.id === p.id ? p : x) : [...list, p]
    })
    setEditing(null)
    setView('list')
    toast.success(editing ? 'Project updated' : 'Project created')
  }

  function handleDelete(id: string) {
    setProjects(prev => (prev ?? []).filter(p => p.id !== id))
    toast.success('Project removed')
  }

  if (view !== 'list') {
    return (
      <ProjectWizard
        initial={editing ?? undefined}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setView('list') }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Projects</h2>
          <p className="text-xs text-muted-foreground">Track capital, infrastructure, and department projects.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setView('create') }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> New project
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {(projects ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-4xl">📋</span>
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <button onClick={() => setView('create')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors">
              <Plus size={13} /> Create your first project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(projects ?? []).map(p => (
              <ProjectCard key={p.id} project={p}
                onEdit={() => { setEditing(p); setView('edit') }}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
