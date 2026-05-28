import { useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import type { ToolKey } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ArrowRight, ArrowLeft, Check, Pencil, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

type AppService = typeof SERVICE_CATALOG[number]['id']
interface PersonalApp {
  id: string
  name: string
  description: string
  emoji: string
  color: string
  services: AppService[]
  createdAt: number
  updatedAt?: number
  launchedAt?: number
  environmentId?: string
}

// ─── Catalogs & Constants ─────────────────────────────────────────────────────

const SERVICE_CATALOG = [
  { id: 'formkey',     label: 'Vault Forms', emoji: '🔐', description: 'Governed intake forms & consent', color: 'purple'  },
  { id: 'vault',       label: 'VAULT',       emoji: '🏛️', description: 'Governed data storage',      color: 'emerald' },
  { id: 'syncronate',  label: 'Syncronate',  emoji: '⚡', description: 'Data connections & feeds',   color: 'violet'  },
  { id: 'automations', label: 'Automations', emoji: '🔄', description: 'Triggers & workflows',       color: 'orange'  },
  { id: 'civicpulse',  label: 'CivicPulse',  emoji: '📢', description: 'Engagement & transparency', color: 'cyan'    },
] as const

const APP_EMOJI_OPTIONS  = ['🚀', '🎯', '📊', '💡', '🛠️', '🎨', '🔬', '📱', '🏆', '🌟']
const APP_COLOR_OPTIONS  = ['blue', 'green', 'purple', 'orange', 'rose']
const APP_COLOR_SWATCHES: Record<string, string> = {
  blue: 'bg-blue-400', green: 'bg-green-400', purple: 'bg-purple-400',
  orange: 'bg-orange-400', rose: 'bg-rose-400',
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const svcColor: Record<string, string> = {
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  green:   'bg-green-500/15 text-green-400 border-green-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  orange:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  rose:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  violet:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  cyan:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
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

// ─── App sub-components ───────────────────────────────────────────────────────

function AppListItem({ app, isSelected, onClick, onDelete }: {
  app: PersonalApp; isSelected: boolean; onClick: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-l-2
        ${isSelected ? 'border-primary bg-primary/10 text-foreground' : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
    >
      <span className="text-base">{app.emoji}</span>
      <span className="flex-1 text-xs font-medium truncate">{app.name}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        {app.services.length}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        aria-label="Delete"
        className="opacity-40 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function WelcomePanel({ onNewApp }: { onNewApp: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-3xl">📱</div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Personal Apps</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
          Compose Workspace services into a focused workspace built around your role.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
        {[
          { emoji: '📝', title: 'Pick your tools',  desc: 'LogicDocs, VAULT, FormKey, and more' },
          { emoji: '⚡', title: 'One-click access', desc: 'Jump directly to any service' },
          { emoji: '🔄', title: 'Stay synced',      desc: 'Syncronate keeps your data fresh' },
        ].map(c => (
          <div key={c.title} className="rounded-xl border border-border bg-card/60 p-4 text-left">
            <div className="text-2xl mb-2">{c.emoji}</div>
            <div className="text-xs font-semibold mb-1">{c.title}</div>
            <div className="text-[11px] text-muted-foreground">{c.desc}</div>
          </div>
        ))}
      </div>
      <Btn onClick={onNewApp}><Plus size={13} /> New App</Btn>
    </div>
  )
}

function AppDetail({ app, onEdit, onDelete, onOpenTool }: {
  app: PersonalApp; onEdit: () => void; onDelete: () => void; onOpenTool: (t: ToolKey) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{app.emoji}</span>
          <div className="flex-1">
            <h2 className="font-bold text-lg">{app.name}</h2>
            {app.description && <p className="text-xs text-muted-foreground mt-0.5">{app.description}</p>}
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onEdit}><Pencil size={13} /> Edit</Btn>
            <Btn variant="ghost" onClick={onDelete} className="hover:text-red-400"><X size={13} /> Delete</Btn>
          </div>
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Services</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {app.services.map(serviceId => {
            const svc = SERVICE_CATALOG.find(s => s.id === serviceId)
            if (!svc) return null
            const cls = svcColor[svc.color] ?? svcColor.blue
            return (
              <div key={serviceId} className={`rounded-xl border p-4 flex flex-col gap-2 ${cls}`}>
                <div className="text-2xl">{svc.emoji}</div>
                <div className="text-xs font-semibold">{svc.label}</div>
                <div className="text-[11px] opacity-70">{svc.description}</div>
                <button
                  onClick={() => onOpenTool(serviceId)}
                  className="self-start text-[11px] font-medium hover:underline mt-auto"
                >
                  Open →
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AppWizard({ editingApp, onSave, onCancel }: {
  editingApp: PersonalApp | null;
  onSave: (app: PersonalApp) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(editingApp?.name ?? '')
  const [description, setDescription] = useState(editingApp?.description ?? '')
  const [emoji, setEmoji] = useState(editingApp?.emoji ?? '🚀')
  const [color, setColor] = useState(editingApp?.color ?? 'blue')
  const [services, setServices] = useState<AppService[]>(editingApp?.services ?? [])

  const toggleSvc = (id: AppService) =>
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleSave = () => {
    const now = Date.now()
    const app: PersonalApp = editingApp
      ? { ...editingApp, name: name.trim(), description: description.trim(), emoji, color, services, updatedAt: now }
      : { id: `app-${now}-${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), description: description.trim(), emoji, color, services, createdAt: now, updatedAt: now, launchedAt: now }
    onSave(app)
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 to-transparent">
        <Btn variant="ghost" onClick={onCancel}><ArrowLeft size={13} /> Cancel</Btn>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Step {step} of 2</span>
      </div>
      <div className="flex-1 p-6 flex items-start justify-center">
        <div className="w-full max-w-md flex flex-col gap-5">
          {step === 1 ? (
            <>
              <h3 className="font-bold text-base">{editingApp ? 'Edit App' : 'Name your app'}</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {APP_EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={`text-xl p-2 rounded-lg ${emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Color</label>
                <div className="flex gap-3">
                  {APP_COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full ${APP_COLOR_SWATCHES[c]} transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">App name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome App"
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2) }} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description <span className="opacity-60">(optional)</span></label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What does this app do?" rows={2} className="resize-none" />
              </div>
              <div className="flex justify-end">
                <Btn onClick={() => setStep(2)} disabled={!name.trim()}>Next <ArrowRight size={13} /></Btn>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xl">{emoji}</span>
                <h3 className="font-bold text-base">{name} — Pick services</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_CATALOG.map(svc => {
                  const sel = services.includes(svc.id as AppService)
                  const cls = svcColor[svc.color] ?? svcColor.blue
                  return (
                    <button key={svc.id} onClick={() => toggleSvc(svc.id as AppService)}
                      className={`relative flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all
                        ${sel ? `border-primary ${cls}` : 'border-border hover:border-muted-foreground'}`}>
                      {sel && <span className="absolute top-2 right-2 text-primary"><Check size={12} weight="bold" /></span>}
                      <span className="text-lg">{svc.emoji}</span>
                      <span className="text-xs font-semibold">{svc.label}</span>
                      <span className="text-[11px] text-muted-foreground">{svc.description}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between items-center">
                <Btn variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={13} /> Back</Btn>
                <Btn onClick={handleSave} disabled={services.length === 0}>
                  {editingApp ? 'Save App' : 'Create App'} →
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AppsPanel ────────────────────────────────────────────────────────────────

type AppsRightPanel = 'welcome' | 'app-detail' | 'app-wizard'

interface AppsPanelProps {
  onOpenTool: (tool: ToolKey) => void
  environmentId?: string
}

export function AppsPanel({ onOpenTool, environmentId }: AppsPanelProps) {
  const storageKey = `appforge-apps-${environmentId ?? 'global'}`
  const [apps, setApps] = useKV<PersonalApp[]>(storageKey, [])
  const [selectedApp, setSelectedApp] = useState<PersonalApp | null>(null)
  const [rightPanel, setRightPanel] = useState<AppsRightPanel>('welcome')
  const [editingApp, setEditingApp] = useState<PersonalApp | null>(null)

  const handleNewApp = useCallback(() => {
    setEditingApp(null); setSelectedApp(null); setRightPanel('app-wizard')
  }, [])

  const handleEditApp = useCallback((app: PersonalApp) => {
    setEditingApp(app); setSelectedApp(null); setRightPanel('app-wizard')
  }, [])

  const handleSaveApp = useCallback((app: PersonalApp) => {
    setApps(prev => {
      const exists = (prev ?? []).find(a => a.id === app.id)
      return exists ? (prev ?? []).map(a => a.id === app.id ? app : a) : [...(prev ?? []), app]
    })
    setSelectedApp(app)
    setEditingApp(null); setRightPanel('app-detail')
    toast.success(`"${app.name}" saved!`)
  }, [setApps])

  const handleDeleteApp = useCallback((id: string) => {
    setApps(prev => (prev ?? []).filter(a => a.id !== id))
    if (selectedApp?.id === id) { setSelectedApp(null); setRightPanel('welcome') }
  }, [selectedApp, setApps])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-border flex flex-col bg-card/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apps</span>
          <button onClick={handleNewApp}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
            <Plus size={11} /> New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(apps ?? []).length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <span className="text-3xl opacity-60">📱</span>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">No apps yet</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Compose your tools into a personal workspace</p>
              </div>
              <button onClick={handleNewApp} className="text-xs text-primary hover:underline font-medium">
                Create your first app →
              </button>
            </div>
          )}
          {(apps ?? []).map(app => (
            <AppListItem key={app.id} app={app} isSelected={selectedApp?.id === app.id}
              onClick={() => { setSelectedApp(app); setRightPanel('app-detail') }}
              onDelete={() => handleDeleteApp(app.id)} />
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {rightPanel === 'welcome' && (
          <WelcomePanel onNewApp={handleNewApp} />
        )}
        {rightPanel === 'app-detail' && selectedApp && (
          <AppDetail
            app={selectedApp}
            onEdit={() => handleEditApp(selectedApp)}
            onDelete={() => handleDeleteApp(selectedApp.id)}
            onOpenTool={onOpenTool}
          />
        )}
        {rightPanel === 'app-wizard' && (
          <AppWizard
            editingApp={editingApp}
            onSave={handleSaveApp}
            onCancel={() => setRightPanel(selectedApp ? 'app-detail' : 'welcome')}
          />
        )}
      </div>
    </div>
  )
}
