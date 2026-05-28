import { useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ArrowRight, ArrowLeft, Check, Pencil, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type BotType = 'compliance' | 'personal' | 'connector' | 'fun'
type BotTrigger = 'manual' | 'schedule' | 'webhook' | 'event'
type BotStatus = 'draft' | 'active' | 'paused'

interface LogicBot {
  id: string
  name: string
  emoji: string
  description: string
  type: BotType
  trigger: BotTrigger
  triggerConfig?: string
  connectors: string[]
  behavior: string
  status: BotStatus
  createdAt: number
  updatedAt: number
  environmentId?: string   // which environment this bot belongs to
}

// ─── Catalogs & Constants ─────────────────────────────────────────────────────

const BOT_TYPES: Record<BotType, { label: string; emoji: string; desc: string; color: string }> = {
  compliance: { label: 'Compliance', emoji: '🛡️', desc: 'VAULT-aware, governed, audit trail', color: 'emerald' },
  personal:   { label: 'Personal',   emoji: '🤖', desc: 'AI-powered personal assistant',      color: 'violet'  },
  connector:  { label: 'Connector',  emoji: '🔌', desc: 'Connect to external systems',        color: 'blue'    },
  fun:        { label: 'Fun',        emoji: '🎉', desc: 'Creative, playful, personality',     color: 'amber'   },
}

const BOT_CONNECTORS = [
  { id: 'vault',      label: 'VAULT',            emoji: '🔐', desc: 'Governed documents + records'       },
  { id: 'email',      label: 'Email',            emoji: '📧', desc: 'Send / receive emails'              },
  { id: 'slack',      label: 'Slack',            emoji: '💬', desc: 'Workspace messaging'                },
  { id: 'discord',    label: 'Discord',          emoji: '🎮', desc: 'Community + gaming'                 },
  { id: 'github',     label: 'GitHub',           emoji: '🐙', desc: 'Code + repos + issues'             },
  { id: 'google',     label: 'Google',           emoji: '🔍', desc: 'Sheets, Docs, Drive, Calendar'     },
  { id: 'microsoft',  label: 'Microsoft 365',    emoji: '📊', desc: 'Teams, SharePoint, Outlook'        },
  { id: 'airtable',   label: 'Airtable',         emoji: '📋', desc: 'Databases + bases'                 },
  { id: 'hubspot',    label: 'HubSpot',          emoji: '🏷️', desc: 'CRM + marketing'                   },
  { id: 'webhook',    label: 'Custom Webhook',   emoji: '🔗', desc: 'Any API endpoint'                  },
  { id: 'browser',    label: 'PJ Browser Ext',   emoji: '🌐', desc: 'Web pages + browser automation'    },
  { id: 'civicpulse', label: 'CivicPulse',       emoji: '📡', desc: 'Governance + public records'       },
  { id: 'sms',        label: 'SMS',              emoji: '📱', desc: 'Text messages (Twilio)'            },
  { id: 'openai',     label: 'OpenAI',           emoji: '✨', desc: 'GPT models + embeddings'           },
  { id: 'anthropic',  label: 'Anthropic',        emoji: '🧠', desc: 'Claude models'                     },
]

const BOT_EMOJI_OPTIONS = ['🤖', '🛡️', '🔌', '🎉', '🦾', '🧠', '🚀', '⚙️', '🔮', '🌟', '📡', '🎯']

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

// ─── Bot sub-components ───────────────────────────────────────────────────────

function BotListItem({ bot, isSelected, onClick, onDelete }: {
  bot: LogicBot; isSelected: boolean; onClick: () => void; onDelete: () => void
}) {
  const statusDot = bot.status === 'active' ? 'bg-green-400' : bot.status === 'paused' ? 'bg-amber-400' : 'bg-muted-foreground/40'
  const meta = BOT_TYPES[bot.type]
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-l-2
        ${isSelected ? 'border-primary bg-primary/10 text-foreground' : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
    >
      <span className="text-base">{bot.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{bot.name}</div>
        <div className="text-[10px] text-muted-foreground">{meta.label}</div>
      </div>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
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

function WelcomePanel({ onNewBot }: { onNewBot: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-3xl">🤖</div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Logic Bots</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
          Build automations with triggers, connectors, and AI — all governed by VAULT.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {[
          { emoji: '⏰', title: 'Scheduled', desc: 'Run on a cron schedule' },
          { emoji: '🔗', title: 'Webhooks', desc: 'Trigger from any endpoint' },
          { emoji: '🧠', title: 'AI-powered', desc: 'Use Claude or GPT' },
          { emoji: '🛡️', title: 'Governed', desc: 'VAULT audit trail built-in' },
        ].map(c => (
          <div key={c.title} className="rounded-xl border border-border bg-card/60 p-4 text-left">
            <div className="text-xl mb-1.5">{c.emoji}</div>
            <div className="text-xs font-semibold mb-0.5">{c.title}</div>
            <div className="text-[11px] text-muted-foreground">{c.desc}</div>
          </div>
        ))}
      </div>
      <Btn onClick={onNewBot}><Plus size={13} /> New Bot</Btn>
    </div>
  )
}

function BotDetail({ bot, onEdit, onDelete, onStatusChange }: {
  bot: LogicBot; onEdit: () => void; onDelete: () => void
  onStatusChange: (status: BotStatus) => void
}) {
  const meta = BOT_TYPES[bot.type]
  const statuses: BotStatus[] = ['draft', 'active', 'paused']
  const statusLabel: Record<BotStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused' }
  const statusCls: Record<BotStatus, string> = {
    draft:  'bg-muted text-muted-foreground',
    active: 'bg-green-500/15 text-green-400',
    paused: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{bot.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">{bot.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${svcColor[meta.color] ?? ''}`}>
                {meta.emoji} {meta.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{bot.description}</p>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onEdit}><Pencil size={13} /> Edit</Btn>
            <Btn variant="ghost" onClick={onDelete} className="hover:text-red-400"><X size={13} /> Delete</Btn>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] text-muted-foreground">Status:</span>
          <div className="flex gap-1">
            {statuses.map(s => (
              <button key={s} onClick={() => onStatusChange(s)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${bot.status === s ? statusCls[s] : 'text-muted-foreground hover:bg-muted'}`}>
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col gap-5">
        {bot.connectors.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Connectors</div>
            <div className="flex flex-wrap gap-2">
              {bot.connectors.map(cid => {
                const c = BOT_CONNECTORS.find(x => x.id === cid)
                return c ? (
                  <span key={cid} className="text-xs px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {c.emoji} {c.label}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trigger</div>
          <div className="text-sm">
            <span className="capitalize">{bot.trigger}</span>
            {bot.triggerConfig && <span className="text-muted-foreground ml-2 text-xs">· {bot.triggerConfig}</span>}
          </div>
        </div>
        {bot.behavior && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Behavior</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{bot.behavior}</p>
          </div>
        )}
        <div className="mt-auto pt-4 border-t border-border/60">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Run History</div>
          <div className="rounded-xl bg-muted/30 border border-border/60 p-4 text-center">
            <p className="text-xs text-muted-foreground">No runs yet. Deploy this bot to PuddleJumper to start executing.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">🔒 PJ Runtime · Governed · SEAL-signed</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BotWizard({ editingBot, onSave, onCancel }: {
  editingBot: LogicBot | null; onSave: (bot: LogicBot) => void; onCancel: () => void
}) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(editingBot?.name ?? '')
  const [emoji, setEmoji] = useState(editingBot?.emoji ?? '🤖')
  const [type, setType] = useState<BotType>(editingBot?.type ?? 'personal')
  const [connectors, setConnectors] = useState<string[]>(editingBot?.connectors ?? [])
  const [trigger, setTrigger] = useState<BotTrigger>(editingBot?.trigger ?? 'manual')
  const [triggerConfig, setTriggerConfig] = useState(editingBot?.triggerConfig ?? '')
  const [behavior, setBehavior] = useState(editingBot?.behavior ?? '')
  const [description, setDescription] = useState(editingBot?.description ?? '')

  const toggleConnector = (id: string) =>
    setConnectors(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const handleSave = () => {
    const now = Date.now()
    const bot: LogicBot = editingBot
      ? { ...editingBot, name: name.trim(), emoji, type, description: description.trim(), connectors, trigger, triggerConfig: triggerConfig || undefined, behavior, updatedAt: now }
      : { id: `bot-${now}-${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), emoji, type, description: description.trim(), connectors, trigger, triggerConfig: triggerConfig || undefined, behavior, status: 'draft', createdAt: now, updatedAt: now }
    onSave(bot)
  }

  const triggers: { id: BotTrigger; label: string; desc: string }[] = [
    { id: 'manual',   label: 'Manual',   desc: 'Run on demand'        },
    { id: 'schedule', label: 'Schedule', desc: 'Cron / time-based'    },
    { id: 'webhook',  label: 'Webhook',  desc: 'HTTP trigger'         },
    { id: 'event',    label: 'Event',    desc: 'LogicOS event stream' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 to-transparent">
        <Btn variant="ghost" onClick={onCancel}><ArrowLeft size={13} /> Cancel</Btn>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Step {step} of 3</span>
      </div>
      <div className="flex-1 p-6 flex items-start justify-center overflow-auto">
        <div className="w-full max-w-lg flex flex-col gap-5">
          {step === 1 && (
            <>
              <h3 className="font-bold text-base">Bot Identity</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {BOT_EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={`text-xl p-2 rounded-lg ${emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Bot name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Compliance Bot" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2) }} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Short description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this bot do in one line?" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(BOT_TYPES) as BotType[]).map(t => {
                    const meta = BOT_TYPES[t]
                    return (
                      <button key={t} onClick={() => setType(t)}
                        className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all
                          ${type === t ? `border-primary ${svcColor[meta.color] ?? ''}` : 'border-border hover:border-muted-foreground'}`}>
                        <span className="text-xl">{meta.emoji}</span>
                        <span className="text-xs font-semibold">{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground">{meta.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <Btn onClick={() => setStep(2)} disabled={!name.trim()}>Next <ArrowRight size={13} /></Btn>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="font-bold text-base">Connect & Trigger</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Connectors</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BOT_CONNECTORS.map(c => {
                    const sel = connectors.includes(c.id)
                    return (
                      <button key={c.id} onClick={() => toggleConnector(c.id)}
                        className={`relative flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all
                          ${sel ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'}`}>
                        <span>{c.emoji}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate">{c.label}</div>
                        </div>
                        {sel && <Check size={11} weight="bold" className="ml-auto shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Trigger</label>
                <div className="grid grid-cols-2 gap-2">
                  {triggers.map(t => (
                    <button key={t.id} onClick={() => setTrigger(t.id)}
                      className={`flex flex-col gap-0.5 p-3 rounded-lg border-2 text-left transition-all
                        ${trigger === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}>
                      <span className="text-xs font-semibold">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Btn variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={13} /> Back</Btn>
                <Btn onClick={() => setStep(3)}>Next <ArrowRight size={13} /></Btn>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h3 className="font-bold text-base">Behavior</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">What does this bot do?</label>
                <Textarea value={behavior} onChange={e => setBehavior(e.target.value)}
                  placeholder="Describe what this bot does, when it runs, and what it outputs..."
                  rows={5} className="resize-none" autoFocus />
              </div>
              {trigger !== 'manual' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {trigger === 'schedule' ? 'Cron expression' : trigger === 'webhook' ? 'Webhook path' : 'Event name'}
                  </label>
                  <Input value={triggerConfig} onChange={e => setTriggerConfig(e.target.value)}
                    placeholder={trigger === 'schedule' ? '0 9 * * 1' : trigger === 'webhook' ? '/hooks/my-bot' : 'document.created'} />
                </div>
              )}
              <div className="flex justify-between">
                <Btn variant="ghost" onClick={() => setStep(2)}><ArrowLeft size={13} /> Back</Btn>
                <Btn onClick={handleSave} disabled={!behavior.trim()}>
                  {editingBot ? 'Save Bot' : 'Create Bot'} →
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BotsPanel ────────────────────────────────────────────────────────────────

type BotsRightPanel = 'welcome' | 'bot-detail' | 'bot-wizard'

export function BotsPanel({ environmentId }: { environmentId?: string }) {
  const storageKey = `studio-bots-${environmentId ?? 'global'}`
  const [bots, setBots] = useKV<LogicBot[]>(storageKey, [])
  const [selectedBot, setSelectedBot] = useState<LogicBot | null>(null)
  const [rightPanel, setRightPanel] = useState<BotsRightPanel>('welcome')
  const [editingBot, setEditingBot] = useState<LogicBot | null>(null)

  const handleNewBot = useCallback(() => {
    setEditingBot(null); setSelectedBot(null); setRightPanel('bot-wizard')
  }, [])

  const handleEditBot = useCallback((bot: LogicBot) => {
    setEditingBot(bot); setSelectedBot(null); setRightPanel('bot-wizard')
  }, [])

  const handleSaveBot = useCallback((bot: LogicBot) => {
    setBots(prev => {
      const list = prev ?? []
      const exists = list.find(b => b.id === bot.id)
      return exists ? list.map(b => b.id === bot.id ? bot : b) : [...list, bot]
    })
    setSelectedBot(bot)
    setEditingBot(null); setRightPanel('bot-detail')
    toast.success(`"${bot.name}" saved!`)
  }, [setBots])

  const handleDeleteBot = useCallback((id: string) => {
    setBots(prev => (prev ?? []).filter(b => b.id !== id))
    if (selectedBot?.id === id) { setSelectedBot(null); setRightPanel('welcome') }
  }, [selectedBot, setBots])

  const handleBotStatusChange = useCallback((status: BotStatus) => {
    if (!selectedBot) return
    setBots(prev => (prev ?? []).map(b => b.id === selectedBot.id ? { ...b, status, updatedAt: Date.now() } : b))
    setSelectedBot(prev => prev ? { ...prev, status } : null)
  }, [selectedBot, setBots])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-border flex flex-col bg-card/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bots</span>
          <button onClick={handleNewBot}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
            <Plus size={11} /> New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(bots ?? []).length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <span className="text-3xl opacity-60">🤖</span>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">No bots yet</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Build automations that connect your tools</p>
              </div>
              <button onClick={handleNewBot} className="text-xs text-primary hover:underline font-medium">
                Build your first bot →
              </button>
            </div>
          )}
          {(bots ?? []).map(bot => (
            <BotListItem key={bot.id} bot={bot} isSelected={selectedBot?.id === bot.id}
              onClick={() => { setSelectedBot(bot); setRightPanel('bot-detail') }}
              onDelete={() => handleDeleteBot(bot.id)} />
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {rightPanel === 'welcome' && (
          <WelcomePanel onNewBot={handleNewBot} />
        )}
        {rightPanel === 'bot-detail' && selectedBot && (
          <BotDetail
            bot={selectedBot}
            onEdit={() => handleEditBot(selectedBot)}
            onDelete={() => handleDeleteBot(selectedBot.id)}
            onStatusChange={handleBotStatusChange}
          />
        )}
        {rightPanel === 'bot-wizard' && (
          <BotWizard
            editingBot={editingBot}
            onSave={handleSaveBot}
            onCancel={() => setRightPanel(selectedBot ? 'bot-detail' : 'welcome')}
          />
        )}
      </div>
    </div>
  )
}
