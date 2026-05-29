import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ArrowRight, ArrowLeft, Check, Pencil, X, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetStatus = 'draft' | 'proposed' | 'approved' | 'active' | 'closed'

interface BudgetLine {
  id: string
  category: string
  description: string
  amount: string
}

interface Budget {
  id: string
  name: string
  emoji: string
  department: string
  fiscalYear: string
  status: BudgetStatus
  totalAmount: string
  lines: BudgetLine[]
  notes: string
  createdAt: number
  updatedAt: number
  environmentId?: string
}

// ─── Catalogs ─────────────────────────────────────────────────────────────────

const BUDGET_STATUSES: Record<BudgetStatus, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'slate'   },
  proposed: { label: 'Proposed', color: 'blue'    },
  approved: { label: 'Approved', color: 'emerald' },
  active:   { label: 'Active',   color: 'green'   },
  closed:   { label: 'Closed',   color: 'slate'   },
}

const BUDGET_EMOJI_OPTIONS = ['💵', '📊', '🏦', '🧾', '💼', '🏛️', '📈', '💳', '🔑', '🏗️', '🌿', '⚖️']

const DEPARTMENT_OPTIONS = [
  'Administration', 'Finance', 'Public Works', 'Planning',
  'Police', 'Fire', 'Health', 'IT', 'Parks & Recreation', 'Other',
]

const LINE_CATEGORIES = [
  'Personnel', 'Supplies', 'Equipment', 'Contracts', 'Capital',
  'Travel', 'Training', 'Utilities', 'Other',
]

const FISCAL_YEARS = (() => {
  const y = new Date().getFullYear()
  return [`FY${y - 1}`, `FY${y}`, `FY${y + 1}`, `FY${y + 2}`]
})()

// ─── Storage ──────────────────────────────────────────────────────────────────

const BUDGETS_KEY = 'builder-budgets'

function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem(BUDGETS_KEY) ?? '[]') } catch { return [] }
}
function saveBudgets(budgets: Budget[]) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets))
  window.dispatchEvent(new StorageEvent('storage', { key: BUDGETS_KEY }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  green:   'bg-green-500/15 text-green-400 border-green-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function parseDollar(s: string): number {
  return parseFloat(s.replace(/[$,\s]/g, '')) || 0
}

function formatDollar(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
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

function newLine(): BudgetLine {
  return { id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, category: '', description: '', amount: '' }
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

type WizardStep = 'basics' | 'lines' | 'review'

const BLANK: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', emoji: '💵', department: '', fiscalYear: FISCAL_YEARS[1],
  status: 'draft', totalAmount: '', lines: [], notes: '',
}

function BudgetWizard({ initial, onSave, onCancel }: {
  initial?: Budget
  onSave: (b: Budget) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<WizardStep>('basics')
  const [draft, setDraft] = useState<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>(
    initial ? { ...initial } : { ...BLANK }
  )

  const set = (k: keyof typeof draft, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  function addLine() { set('lines', [...draft.lines, newLine()]) }

  function updateLine(id: string, field: keyof BudgetLine, val: string) {
    set('lines', draft.lines.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  function removeLine(id: string) {
    set('lines', draft.lines.filter(l => l.id !== id))
  }

  const linesTotal = draft.lines.reduce((sum, l) => sum + parseDollar(l.amount), 0)

  function handleSave() {
    const now = Date.now()
    const totalAmount = draft.totalAmount || (linesTotal > 0 ? formatDollar(linesTotal) : '')
    onSave({
      ...draft,
      totalAmount,
      id: initial?.id ?? `budget-${now}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    })
  }

  const canAdvanceBasics = draft.name.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
        {(['basics', 'lines', 'review'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === s ? 'bg-primary text-primary-foreground' :
              (['basics', 'lines', 'review'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
              'bg-muted text-muted-foreground'
            }`}>
              {(['basics', 'lines', 'review'].indexOf(step) > i) ? <Check size={11} /> : i + 1}
            </div>
            <span className={`text-xs capitalize hidden sm:inline ${step === s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {s === 'lines' ? 'Line items' : s}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Step 1: Basics */}
        {step === 'basics' && (
          <>
            <h3 className="text-sm font-semibold">Budget basics</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {BUDGET_EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => set('emoji', e)}
                    className={`text-xl w-9 h-9 rounded-lg border transition-colors ${draft.emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Budget name <span className="text-destructive">*</span></label>
              <Input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Public Works FY2026 Operating Budget" />
            </div>
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
                <label className="text-xs text-muted-foreground mb-1 block">Fiscal year</label>
                <select value={draft.fiscalYear} onChange={e => set('fiscalYear', e.target.value)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {FISCAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Total amount</label>
                <Input value={draft.totalAmount} onChange={e => set('totalAmount', e.target.value)} placeholder="e.g. $1,200,000 (or set per line)" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <select value={draft.status} onChange={e => set('status', e.target.value as BudgetStatus)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {(Object.entries(BUDGET_STATUSES) as [BudgetStatus, { label: string }][]).map(([s, m]) => (
                    <option key={s} value={s}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Assumptions, constraints, or links to board votes…" />
            </div>
          </>
        )}

        {/* Step 2: Line items */}
        {step === 'lines' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line items <span className="text-muted-foreground font-normal">(optional)</span></h3>
              <Btn variant="outline" onClick={addLine}><Plus size={12} /> Add line</Btn>
            </div>
            {draft.lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">No line items yet.</p>
                <Btn variant="outline" onClick={addLine}><Plus size={12} /> Add first line</Btn>
              </div>
            ) : (
              <div className="space-y-2">
                {draft.lines.map(line => (
                  <div key={line.id} className="grid grid-cols-[110px_1fr_100px_28px] gap-2 items-center">
                    <select value={line.category} onChange={e => updateLine(line.id, 'category', e.target.value)}
                      className="text-xs rounded-md border border-input bg-background px-2 py-1.5 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Category</option>
                      {LINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Input className="h-8 text-xs" value={line.description} onChange={e => updateLine(line.id, 'description', e.target.value)} placeholder="Description" />
                    <Input className="h-8 text-xs" value={line.amount} onChange={e => updateLine(line.id, 'amount', e.target.value)} placeholder="$0" />
                    <button onClick={() => removeLine(line.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {linesTotal > 0 && (
              <div className="flex justify-end text-sm font-semibold text-foreground pt-2 border-t border-border">
                Lines total: {formatDollar(linesTotal)}
              </div>
            )}
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
                  <div className="text-xs text-muted-foreground">{draft.fiscalYear}{draft.department ? ` · ${draft.department}` : ''}</div>
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadge[BUDGET_STATUSES[draft.status].color]}`}>
                  {BUDGET_STATUSES[draft.status].label}
                </span>
              </div>
              {(draft.totalAmount || linesTotal > 0) && (
                <div className="text-sm font-semibold">
                  Total: {draft.totalAmount || formatDollar(linesTotal)}
                </div>
              )}
              {draft.lines.length > 0 && (
                <div className="space-y-1 border-t pt-2">
                  {draft.lines.map(l => (
                    <div key={l.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{l.category ? `[${l.category}] ` : ''}{l.description || '—'}</span>
                      <span>{l.amount || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {draft.notes && <p className="text-xs text-muted-foreground border-t pt-2">{draft.notes}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
        <Btn variant="ghost" onClick={step === 'basics' ? onCancel : () => setStep(step === 'review' ? 'lines' : 'basics')}>
          <ArrowLeft size={13} />{step === 'basics' ? 'Cancel' : 'Back'}
        </Btn>
        {step !== 'review'
          ? <Btn disabled={step === 'basics' && !canAdvanceBasics} onClick={() => setStep(step === 'basics' ? 'lines' : 'review')}>
              Next <ArrowRight size={13} />
            </Btn>
          : <Btn onClick={handleSave}>
              <Check size={13} /> {initial ? 'Save changes' : 'Create budget'}
            </Btn>
        }
      </div>
    </div>
  )
}

// ─── List card ────────────────────────────────────────────────────────────────

function BudgetCard({ budget, onEdit, onDelete }: { budget: Budget; onEdit: () => void; onDelete: () => void }) {
  const meta = BUDGET_STATUSES[budget.status]
  const linesTotal = budget.lines.reduce((sum, l) => sum + parseDollar(l.amount), 0)
  const displayTotal = budget.totalAmount || (linesTotal > 0 ? formatDollar(linesTotal) : null)
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-muted-foreground/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{budget.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{budget.name}</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge[meta.color]}`}>
              {meta.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            <span>📅 {budget.fiscalYear}</span>
            {budget.department && <span>📂 {budget.department}</span>}
            {displayTotal && <span className="font-medium text-foreground">💵 {displayTotal}</span>}
          </div>
          {budget.lines.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{budget.lines.length} line item{budget.lines.length !== 1 ? 's' : ''}</p>
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

export function BudgetsPanel({ environmentId }: { environmentId?: string }) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing] = useState<Budget | null>(null)

  const load = useCallback(() => {
    const all = loadBudgets()
    setBudgets(environmentId ? all.filter(b => b.environmentId === environmentId) : all)
  }, [environmentId])

  useEffect(() => {
    load()
    const handler = (e: StorageEvent) => { if (e.key === BUDGETS_KEY) load() }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [load])

  function handleSave(b: Budget) {
    const tagged = environmentId ? { ...b, environmentId } : b
    const all = loadBudgets()
    const updated = all.find(x => x.id === tagged.id)
      ? all.map(x => x.id === tagged.id ? tagged : x)
      : [...all, tagged]
    saveBudgets(updated)
    setBudgets(environmentId ? updated.filter(x => x.environmentId === environmentId) : updated)
    setEditing(null)
    setView('list')
    toast.success(editing ? 'Budget updated' : 'Budget created')
  }

  function handleDelete(id: string) {
    const all = loadBudgets()
    const updated = all.filter(b => b.id !== id)
    saveBudgets(updated)
    setBudgets(environmentId ? updated.filter(b => b.environmentId === environmentId) : updated)
    toast.success('Budget removed')
  }

  if (view !== 'list') {
    return (
      <BudgetWizard
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
          <h2 className="text-sm font-semibold">Budgets</h2>
          <p className="text-xs text-muted-foreground">Track department budgets, fiscal years, and line-item breakdowns.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setView('create') }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> New budget
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-4xl">💵</span>
            <p className="text-sm text-muted-foreground">No budgets tracked yet.</p>
            <button onClick={() => setView('create')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors">
              <Plus size={13} /> Create your first budget
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.map(b => (
              <BudgetCard key={b.id} budget={b}
                onEdit={() => { setEditing(b); setView('edit') }}
                onDelete={() => handleDelete(b.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
