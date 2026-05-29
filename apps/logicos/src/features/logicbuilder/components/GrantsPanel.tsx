import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ArrowRight, ArrowLeft, Check, Pencil, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type GrantStatus = 'prospect' | 'applied' | 'awarded' | 'active' | 'closed' | 'denied'

interface Grant {
  id: string
  name: string
  emoji: string
  funder: string
  amount: string
  status: GrantStatus
  applicationDeadline: string
  awardDate: string
  manager: string
  department: string
  purpose: string
  notes: string
  createdAt: number
  updatedAt: number
  environmentId?: string
}

// ─── Catalogs ─────────────────────────────────────────────────────────────────

const GRANT_STATUSES: Record<GrantStatus, { label: string; color: string }> = {
  prospect: { label: 'Prospect',  color: 'slate'   },
  applied:  { label: 'Applied',   color: 'blue'    },
  awarded:  { label: 'Awarded',   color: 'emerald' },
  active:   { label: 'Active',    color: 'green'   },
  closed:   { label: 'Closed',    color: 'slate'   },
  denied:   { label: 'Denied',    color: 'rose'    },
}

const GRANT_EMOJI_OPTIONS = ['💰', '🏆', '📜', '🎯', '🤝', '🏛️', '🌿', '🚒', '🏫', '🌊', '🔬', '🛣️']

const DEPARTMENT_OPTIONS = [
  'Administration', 'Finance', 'Public Works', 'Planning',
  'Police', 'Fire', 'Health', 'IT', 'Parks & Recreation', 'Other',
]

const PURPOSE_OPTIONS = [
  'Infrastructure', 'Public Safety', 'Environment', 'Education',
  'Technology', 'Housing', 'Economic Development', 'Health', 'Arts & Culture',
]

// ─── Storage ──────────────────────────────────────────────────────────────────

const GRANTS_KEY = 'builder-grants'

function loadGrants(): Grant[] {
  try { return JSON.parse(localStorage.getItem(GRANTS_KEY) ?? '[]') } catch { return [] }
}
function saveGrants(grants: Grant[]) {
  localStorage.setItem(GRANTS_KEY, JSON.stringify(grants))
  window.dispatchEvent(new StorageEvent('storage', { key: GRANTS_KEY }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  green:   'bg-green-500/15 text-green-400 border-green-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  rose:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
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

// ─── Wizard ───────────────────────────────────────────────────────────────────

type WizardStep = 'basics' | 'details' | 'review'

const BLANK: Omit<Grant, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', emoji: '💰', funder: '', amount: '', status: 'prospect',
  applicationDeadline: '', awardDate: '', manager: '', department: '', purpose: '', notes: '',
}

function GrantWizard({ initial, onSave, onCancel }: {
  initial?: Grant
  onSave: (g: Grant) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<WizardStep>('basics')
  const [draft, setDraft] = useState<Omit<Grant, 'id' | 'createdAt' | 'updatedAt'>>(
    initial ? { ...initial } : { ...BLANK }
  )

  const set = (k: keyof typeof draft, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  function handleSave() {
    const now = Date.now()
    onSave({
      ...draft,
      id: initial?.id ?? `grant-${now}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    })
  }

  const canAdvanceBasics = draft.name.trim().length > 0 && draft.funder.trim().length > 0

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
        {/* Step 1 */}
        {step === 'basics' && (
          <>
            <h3 className="text-sm font-semibold">Grant basics</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {GRANT_EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => set('emoji', e)}
                    className={`text-xl w-9 h-9 rounded-lg border transition-colors ${draft.emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grant name <span className="text-destructive">*</span></label>
              <Input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. MassDOT Complete Streets Grant" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Funder <span className="text-destructive">*</span></label>
              <Input value={draft.funder} onChange={e => set('funder', e.target.value)} placeholder="e.g. MassDOT, EPA, FEMA, HUD…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grant amount</label>
                <Input value={draft.amount} onChange={e => set('amount', e.target.value)} placeholder="e.g. $250,000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <select value={draft.status} onChange={e => set('status', e.target.value as GrantStatus)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {(Object.entries(GRANT_STATUSES) as [GrantStatus, { label: string }][]).map(([s, m]) => (
                    <option key={s} value={s}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purpose</label>
              <div className="flex flex-wrap gap-2">
                {PURPOSE_OPTIONS.map(p => (
                  <button key={p} onClick={() => set('purpose', draft.purpose === p ? '' : p)}
                    className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                      draft.purpose === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 'details' && (
          <>
            <h3 className="text-sm font-semibold">Grant details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Application deadline</label>
                <Input type="date" value={draft.applicationDeadline} onChange={e => set('applicationDeadline', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Award date</label>
                <Input type="date" value={draft.awardDate} onChange={e => set('awardDate', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grant manager</label>
                <Input value={draft.manager} onChange={e => set('manager', e.target.value)} placeholder="Name or email" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Department</label>
                <select value={draft.department} onChange={e => set('department', e.target.value)}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Select…</option>
                  {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes / narrative</label>
              <Textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={4} placeholder="Grant requirements, match obligations, reporting cadence…" />
            </div>
          </>
        )}

        {/* Step 3 */}
        {step === 'review' && (
          <>
            <h3 className="text-sm font-semibold">Review &amp; save</h3>
            <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{draft.emoji}</span>
                <div>
                  <div className="font-semibold">{draft.name}</div>
                  <div className="text-xs text-muted-foreground">{draft.funder}</div>
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadge[GRANT_STATUSES[draft.status].color]}`}>
                  {GRANT_STATUSES[draft.status].label}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {draft.amount && <span>💰 {draft.amount}</span>}
                {draft.purpose && <span>🎯 {draft.purpose}</span>}
                {draft.department && <span>📂 {draft.department}</span>}
                {draft.manager && <span>👤 {draft.manager}</span>}
              </div>
              {(draft.applicationDeadline || draft.awardDate) && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {draft.applicationDeadline && <span>📅 Deadline: {draft.applicationDeadline}</span>}
                  {draft.awardDate && <span>🏆 Awarded: {draft.awardDate}</span>}
                </div>
              )}
              {draft.notes && <p className="text-xs text-muted-foreground border-t pt-2">{draft.notes}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
        <Btn variant="ghost" onClick={step === 'basics' ? onCancel : () => setStep(step === 'review' ? 'details' : 'basics')}>
          <ArrowLeft size={13} />{step === 'basics' ? 'Cancel' : 'Back'}
        </Btn>
        {step !== 'review'
          ? <Btn disabled={step === 'basics' && !canAdvanceBasics} onClick={() => setStep(step === 'basics' ? 'details' : 'review')}>
              Next <ArrowRight size={13} />
            </Btn>
          : <Btn onClick={handleSave}>
              <Check size={13} /> {initial ? 'Save changes' : 'Add grant'}
            </Btn>
        }
      </div>
    </div>
  )
}

// ─── List card ────────────────────────────────────────────────────────────────

function GrantCard({ grant, onEdit, onDelete }: { grant: Grant; onEdit: () => void; onDelete: () => void }) {
  const meta = GRANT_STATUSES[grant.status]
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-muted-foreground/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{grant.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{grant.name}</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadge[meta.color]}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{grant.funder}</p>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
            {grant.amount && <span>💰 {grant.amount}</span>}
            {grant.purpose && <span>🎯 {grant.purpose}</span>}
            {grant.department && <span>📂 {grant.department}</span>}
            {grant.manager && <span>👤 {grant.manager}</span>}
            {grant.applicationDeadline && <span>📅 Due {grant.applicationDeadline}</span>}
          </div>
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

export function GrantsPanel({ environmentId }: { environmentId?: string }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing] = useState<Grant | null>(null)

  const load = useCallback(() => {
    const all = loadGrants()
    setGrants(environmentId ? all.filter(g => g.environmentId === environmentId) : all)
  }, [environmentId])

  useEffect(() => {
    load()
    const handler = (e: StorageEvent) => { if (e.key === GRANTS_KEY) load() }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [load])

  function handleSave(g: Grant) {
    const tagged = environmentId ? { ...g, environmentId } : g
    const all = loadGrants()
    const updated = all.find(x => x.id === tagged.id)
      ? all.map(x => x.id === tagged.id ? tagged : x)
      : [...all, tagged]
    saveGrants(updated)
    setGrants(environmentId ? updated.filter(x => x.environmentId === environmentId) : updated)
    setEditing(null)
    setView('list')
    toast.success(editing ? 'Grant updated' : 'Grant added')
  }

  function handleDelete(id: string) {
    const all = loadGrants()
    const updated = all.filter(g => g.id !== id)
    saveGrants(updated)
    setGrants(environmentId ? updated.filter(g => g.environmentId === environmentId) : updated)
    toast.success('Grant removed')
  }

  if (view !== 'list') {
    return (
      <GrantWizard
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
          <h2 className="text-sm font-semibold">Grants</h2>
          <p className="text-xs text-muted-foreground">Track grant opportunities, applications, and active awards.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setView('create') }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> Add grant
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {grants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-4xl">💰</span>
            <p className="text-sm text-muted-foreground">No grants tracked yet.</p>
            <button onClick={() => setView('create')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors">
              <Plus size={13} /> Add your first grant
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {grants.map(g => (
              <GrantCard key={g.id} grant={g}
                onEdit={() => { setEditing(g); setView('edit') }}
                onDelete={() => handleDelete(g.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
