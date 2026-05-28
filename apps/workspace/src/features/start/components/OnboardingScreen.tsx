// ── OnboardingScreen ─────────────────────────────────────────────────────
//
// Shown to new members after they accept a workspace invite.
// Step-by-step guided setup: welcome → connect accounts → launch.
// Can be skipped — shown once per invite acceptance.
//
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { WindowsLogo, GoogleLogo, GithubLogo, CheckCircle, ArrowRight, Folder, Envelope, Calendar, Cloud, CaretRight } from '@phosphor-icons/react'
import { pjApi } from '@/services/pjApi'

interface OnboardingScreenProps {
  onDone: () => void
  workspaceName?: string
}

const PROVIDERS = [
  {
    key: 'microsoft',
    label: 'Microsoft 365',
    tagline: 'Recommended for most towns',
    description: 'Sync SharePoint folders, read Outlook email, access Teams and OneDrive.',
    unlocks: ['SharePoint document sync', 'Outlook / calendar integration', 'Teams notifications'],
    icon: WindowsLogo,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    recommended: true,
  },
  {
    key: 'google',
    label: 'Google Workspace',
    tagline: 'For towns using Google',
    description: 'Access Google Drive, Gmail, and Google Calendar inside LogicOS.',
    unlocks: ['Google Drive file access', 'Gmail inbox integration', 'Google Calendar sync'],
    icon: GoogleLogo,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    recommended: false,
  },
  {
    key: 'github',
    label: 'GitHub',
    tagline: 'Optional — for technical teams',
    description: 'Access code repositories and automation scripts. Not needed for day-to-day municipal work.',
    unlocks: ['Code repository access', 'Automated workflow scripts', 'LogicSuite developer tools'],
    icon: GithubLogo,
    color: 'text-foreground',
    bg: 'bg-muted/60',
    border: 'border-border',
    recommended: false,
  },
] as const

const UNLOCK_ICONS = [Folder, Envelope, Calendar, Cloud]

export function OnboardingScreen({ onDone, workspaceName }: OnboardingScreenProps) {
  const [step, setStep] = useState<'welcome' | 'connect'>('welcome')
  const [connectorStatus, setConnectorStatus] = useState<Record<string, boolean>>({})
  const [connecting, setConnecting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>('microsoft')

  useEffect(() => {
    pjApi.connectors.status().then((data: unknown) => {
      const raw = (data as Record<string, unknown>)?.connectors ?? {}
      const status: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        status[k] = !!((v as Record<string, unknown>)?.connected)
      }
      setConnectorStatus(status)
    }).catch((err: unknown) => { console.error('[onboarding] failed to load connector status:', err) })
  }, [])

  const handleConnect = async (providerKey: string) => {
    setConnecting(providerKey)
    try {
      await pjApi.connectors.connect(providerKey as 'github' | 'microsoft' | 'google')
    } catch {
      setConnecting(null)
    }
  }

  const connectedCount = PROVIDERS.filter(p => connectorStatus[p.key]).length

  if (step === 'welcome') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-3">
            Welcome to {workspaceName ?? 'LogicOS'}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-2">
            Your municipal operating system — built for records, deadlines, public intake, and internal workflows.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-10">
            Setup takes about 2 minutes. You'll connect your existing email and file systems so everything works together automatically.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-10 text-left">
            {[
              { icon: '📋', title: 'Public Records', desc: 'Intake forms, FOIA requests, and permit tracking with automatic deadlines.' },
              { icon: '🗂️', title: 'Governed Files', desc: 'Every document timestamped, version-controlled, and audit-logged.' },
              { icon: '⚡', title: 'Auto-Workflows', desc: 'Deadline alerts, routing, and approvals that run without staff intervention.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-muted/40 rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-2xl">{icon}</span>
                <p className="text-xs font-bold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={() => setStep('connect')} className="gap-2 w-full">
              Connect accounts and get started
              <ArrowRight size={16} weight="bold" />
            </Button>
            <button onClick={onDone} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Skip — I'll connect accounts later from Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-6 overflow-auto">
      <div className="w-full max-w-lg py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Step 2 of 2 — Connect Accounts</p>
          <h1 className="text-2xl font-black tracking-tight mb-1">Link your existing systems</h1>
          <p className="text-sm text-muted-foreground">
            LogicOS works with the tools your team already uses. Connect at least one to enable file sync, email, and automation.
          </p>
        </div>

        {/* Provider cards — accordion style */}
        <div className="space-y-2 mb-6">
          {PROVIDERS.map((p) => {
            const connected = connectorStatus[p.key]
            const isExpanded = expanded === p.key
            const Icon = p.icon
            return (
              <div
                key={p.key}
                className={`rounded-xl border transition-all ${connected ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20' : isExpanded ? `${p.border} ${p.bg}` : 'border-border bg-card'}`}
              >
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : p.key)}
                  aria-expanded={isExpanded}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-background border ${p.border} shrink-0`}>
                    <Icon size={20} weight="duotone" className={connected ? 'text-emerald-500' : p.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{p.label}</span>
                      {p.recommended && !connected && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">Recommended</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  </div>
                  {connected ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle size={15} weight="fill" /> Connected
                    </div>
                  ) : (
                    <CaretRight size={14} className={`text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {isExpanded && !connected && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {p.unlocks.map((u, i) => {
                        const UIcon = UNLOCK_ICONS[i % UNLOCK_ICONS.length]
                        return (
                          <span key={u} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-1">
                            <UIcon size={11} /> {u}
                          </span>
                        )
                      })}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConnect(p.key)}
                      disabled={connecting === p.key}
                      className="w-full"
                    >
                      {connecting === p.key ? 'Opening sign-in window…' : `Connect ${p.label}`}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress indicator */}
        {connectedCount > 0 && (
          <div className="flex items-center gap-2 mb-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle size={16} weight="fill" />
            {connectedCount} of {PROVIDERS.length} connected — you&apos;re ready to go!
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button onClick={onDone} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {connectedCount > 0 ? 'Finish and go to dashboard' : 'Skip for now'}
          </button>
          {connectedCount > 0 && (
            <Button onClick={onDone} className="gap-2">
              Go to Dashboard
              <ArrowRight size={16} weight="bold" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          You can always manage connections later from <strong>Settings → Connections</strong>.
        </p>
      </div>
    </div>
  )
}
