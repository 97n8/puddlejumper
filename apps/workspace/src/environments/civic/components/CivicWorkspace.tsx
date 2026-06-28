/**
 * CivicWorkspace — renders when a casespace has environment.town set.
 *
 * Framework chain:
 *   OrgManager (setup) → selects VAULT module IDs → stored in env.vaultModuleIds
 *   → CivicWorkspace reads vaultModuleIds → filters which module cards show in Dash
 *   → module cards in the Dash body navigate to their sub-page (records, procurement, etc.)
 *
 * To replicate for another environment (Health, Ops, etc.):
 *   1. Define VAULT_TO_CARDS for that env's module IDs
 *   2. Pass enabledCards to the Dash/Workbench component
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { civicApi } from '@/features/civic/api/civicApi'
import type { CivicActor } from '@/features/civic/api/civicApi'
import type { CaseSpace } from '@/lib/types'
import { CivicTownProvider } from '../context/CivicTownContext'
import { findMunicipalityByName } from '../context/CivicTownContext'
import { WorkbenchPage } from '@/features/civic/pages/WorkbenchPage'
import { PRRPage } from '@/features/civic/pages/PRRPage'
import { STRPage } from '@/features/civic/pages/STRPage'
import { OrgEditor } from './OrgEditor'
import { DocumentsHub } from './DocumentsHub'
import {
  Lightning, FileDoc, Buildings, ArrowLeft,
  Lock, Gear,
} from '@phosphor-icons/react'

type CivicPage =
  | 'workbench' | 'records' | 'documents' | 'org' | 'settings'
  | 'meetings' | 'procurement' | 'contracts' | 'grants' | 'permits' | 'str'

interface Props {
  environment: CaseSpace
  onBack: () => void
}

interface OrgStatus {
  complete?: boolean
  prefill?: {
    town?: Record<string, unknown>
    staff?: unknown[]
    bodies?: unknown[]
  }
}

type CivicWorkspaceLoadState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; message: string }
  | { status: 'unauthorized'; message: string }
  | { status: 'load_error'; message: string }
  | { status: 'ok'; actor: CivicActor; orgStatus: OrgStatus | null }

/**
 * Persistent nav tabs — always shown regardless of which modules were selected.
 * Governance modules appear as cards inside the Dash body (not as separate tabs).
 */
const NAV: { id: CivicPage; label: string; icon: React.ReactNode }[] = [
  { id: 'workbench',  label: 'Dash',        icon: <Lightning size={15} weight="duotone" /> },
  { id: 'org',        label: 'Org & Staff',  icon: <Buildings size={15} weight="duotone" /> },
  { id: 'documents',  label: 'Documents',    icon: <FileDoc size={15} weight="duotone" /> },
]

const COMING_SOON_META: Record<string, { statute: string; description: string }> = {
  meetings: {
    statute: 'M.G.L. c.30A §20',
    description: 'Meeting scheduling, 48-hour OML notice posting, minutes tracking, and vote recording — all statute-aware.',
  },
  procurement: {
    statute: 'M.G.L. c.30B',
    description: 'Competitive bidding workflow, vendor management, and public notice posting for goods and services procurement.',
  },
  contracts: {
    statute: 'M.G.L. c.30B',
    description: 'Contract lifecycle management: drafting, approval routing, execution, and expiration alerts.',
  },
  grants: {
    statute: 'M.G.L. c.44 §53A',
    description: 'Grant tracking, reporting deadlines, expenditure compliance, and closeout documentation.',
  },
  permits: {
    statute: 'M.G.L. c.40A',
    description: 'Permit intake, board review routing, public notice, decision recording, and appeal tracking.',
  },
}

/**
 * Maps VAULT module IDs (from OrgManager setup) → Dash card IDs shown in WorkbenchPage.
 * Governance modules appear as cards inside the Dash body — not as separate nav tabs.
 */
const VAULT_TO_CARDS: Record<string, string[]> = {
  VAULTPRR:     ['records'],
  VAULTMEET:    ['meetings'],
  VAULTPROCURE: ['procurement', 'contracts'],
  VAULTPERMIT:  ['permits'],
}

export function CivicWorkspace({ environment, onBack }: Props) {
  const { user } = useAuth()
  const [page, setPage] = useState<CivicPage>('workbench')
  const [loadState, setLoadState] = useState<CivicWorkspaceLoadState>({ status: 'loading' })

  const townName = environment.town ?? environment.name
  const municipality = findMunicipalityByName(townName)

  // Derive which governance module cards to show in the Dash body.
  // null = show all (old envs with no vaultModuleIds recorded).
  const enabledCards = (() => {
    const ids = environment.vaultModuleIds
    if (!ids || ids.length === 0) return null
    const cards = new Set<string>()
    for (const mid of ids) {
      for (const c of VAULT_TO_CARDS[mid] ?? []) cards.add(c)
    }
    return cards
  })()

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      setLoadState({
        status: 'unauthenticated',
        message: 'Sign in required to open this civic workspace.',
      })
      return
    }

    setLoadState({ status: 'loading' })

    try {
      const [me, status] = await Promise.all([
        civicApi.me(),
        civicApi.get<OrgStatus>('/org-manager/status'),
      ])

      setLoadState({
        status: 'ok',
        actor: {
          id: me.actor.id,
          object_id: (me.actor as unknown as Record<string, string>).object_id ?? me.actor.id,
          email: me.actor.email ?? user.email ?? '',
          display_name: user.name ?? me.actor.display_name ?? user.email ?? 'User',
          role: me.actor.role ?? 'staff',
          pj_user_id: me.actor.pj_user_id ?? null,
        },
        orgStatus: status ?? null,
      })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401) {
        setLoadState({
          status: 'unauthenticated',
          message: 'Sign in required to open this civic workspace.',
        })
        return
      }
      if (status === 403) {
        setLoadState({
          status: 'unauthorized',
          message: 'Your account is not authorized for this civic workspace.',
        })
        return
      }
      setLoadState({
        status: 'load_error',
        message: error instanceof Error && error.message
          ? error.message
          : 'Could not load civic workspace data. Please try again.',
      })
    }
  }, [user])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (!user) {
          if (alive) {
            setLoadState({
              status: 'unauthenticated',
              message: 'Sign in required to open this civic workspace.',
            })
          }
          return
        }

        if (alive) setLoadState({ status: 'loading' })

        const [me, status] = await Promise.all([
          civicApi.me(),
          civicApi.get<OrgStatus>('/org-manager/status'),
        ])
        if (!alive) return

        setLoadState({
          status: 'ok',
          actor: {
            id: me.actor.id,
            object_id: (me.actor as unknown as Record<string, string>).object_id ?? me.actor.id,
            email: me.actor.email ?? user.email ?? '',
            display_name: user.name ?? me.actor.display_name ?? user.email ?? 'User',
            role: me.actor.role ?? 'staff',
            pj_user_id: me.actor.pj_user_id ?? null,
          },
          orgStatus: status ?? null,
        })
      } catch (error) {
        if (!alive) return
        const status = (error as { status?: number }).status
        if (status === 401) {
          setLoadState({
            status: 'unauthenticated',
            message: 'Sign in required to open this civic workspace.',
          })
          return
        }
        if (status === 403) {
          setLoadState({
            status: 'unauthorized',
            message: 'Your account is not authorized for this civic workspace.',
          })
          return
        }
        setLoadState({
          status: 'load_error',
          message: error instanceof Error && error.message
            ? error.message
            : 'Could not load civic workspace data. Please try again.',
        })
      }
    })()
    return () => { alive = false }
  }, [user])

  const townProfile = loadState.status === 'ok' ? (loadState.orgStatus?.prefill?.town ?? {}) : {}
  const initialTown = municipality ?? null

  if (loadState.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading {townName}…</p>
        </div>
      </div>
    )
  }

  if (loadState.status === 'unauthenticated') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock size={18} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Authentication required</h2>
          <p className="mb-4 text-sm text-muted-foreground">{loadState.message}</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/80"
          >
            ← Back to Workspaces
          </button>
        </div>
      </div>
    )
  }

  if (loadState.status === 'unauthorized') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock size={18} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mb-4 text-sm text-muted-foreground">{loadState.message}</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/80"
          >
            ← Back to Workspaces
          </button>
        </div>
      </div>
    )
  }

  if (loadState.status === 'load_error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Gear size={18} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Couldn&apos;t load civic workspace</h2>
          <p className="mb-4 text-sm text-muted-foreground">{loadState.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/80"
            >
              ← Back to Workspaces
            </button>
          </div>
        </div>
      </div>
    )
  }

  const actor = loadState.actor

  return (
    <CivicTownProvider
      initialTown={initialTown}
      initialProfile={townProfile as Record<string, unknown>}
      actor={actor ? {
        id: actor.id,
        object_id: actor.object_id,
        display_name: actor.display_name,
        email: actor.email,
        civic_role: actor.role,
        town: (townProfile as Record<string, unknown>),
      } : null}
    >
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background/95 backdrop-blur">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition shrink-0"
          >
            <ArrowLeft size={13} />
            Workspaces
          </button>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded bg-red-900/60 border border-red-800/50 flex items-center justify-center text-[10px]">⚖</div>
            <span className="font-semibold text-foreground text-sm truncate">{townName}</span>
            <span className="text-muted-foreground/40 text-xs hidden sm:inline">
              {(townProfile as Record<string,string>).governance_form
                ? ` · ${formatGovernance((townProfile as Record<string,string>).governance_form)}`
                : ''}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 text-[10px] font-medium">Live</span>
            </div>
            <button
              onClick={() => setPage('settings')}
              className={`p-1.5 rounded-lg transition ${page === 'settings' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Environment settings"
            >
              <Gear size={15} />
            </button>
          </div>
        </div>

        {/* ── Nav tabs ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-0 px-4 border-b border-border overflow-x-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                page === item.id
                  ? 'border-red-700 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Page content ──────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {page === 'workbench' && actor && (
            <WorkbenchPage actor={actor} enabledCards={enabledCards} onNavigate={(p) => setPage(p as CivicPage)} />
          )}
          {page === 'records' && (
            <PRRPage />
          )}
          {page === 'documents' && (
            <DocumentsHub onBack={() => setPage('workbench')} />
          )}
          {page === 'org' && (
            <OrgEditor onBack={() => setPage('workbench')} />
          )}
          {page === 'settings' && (
            <EnvironmentSettings environment={environment} onBack={() => setPage('workbench')} />
          )}
          {page === 'str' && (
            <STRPage onBack={() => setPage('workbench')} />
          )}
          {(page === 'meetings' || page === 'procurement' || page === 'contracts' || page === 'grants' || page === 'permits') && (
            <CivicComingSoonPage
              page={page}
              meta={COMING_SOON_META[page]}
              onBack={() => setPage('workbench')}
            />
          )}
        </div>
      </div>
    </CivicTownProvider>
  )
}

function CivicComingSoonPage({
  page,
  meta,
  onBack,
}: {
  page: string
  meta?: { statute: string; description: string }
  onBack: () => void
}) {
  const label = page.charAt(0).toUpperCase() + page.slice(1)
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center">
        <Lock size={22} className="text-muted-foreground/50" />
      </div>
      <div>
        <h2 className="text-foreground font-bold text-base mb-1">{label} — Coming Soon</h2>
        {meta && (
          <p className="text-muted-foreground/60 text-[10px] font-mono mb-2">{meta.statute}</p>
        )}
        {meta && (
          <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">{meta.description}</p>
        )}
      </div>
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition"
      >
        ← Back to Workbench
      </button>
    </div>
  )
}

function formatGovernance(raw: string): string {
  const map: Record<string, string> = {
    open_town_meeting: 'Open Town Meeting',
    representative_town_meeting: 'Rep. Town Meeting',
    city_council: 'City Council',
    mayor_council: 'Mayor-Council',
    town_council: 'Town Council',
  }
  return map[raw] ?? raw.replace(/_/g, ' ')
}

function EnvironmentSettings({ environment, onBack }: { environment: CaseSpace; onBack: () => void }) {
  const moduleIds = environment.vaultModuleIds ?? []

  // Show which cards each module unlocks in the Dash body
  const moduleChain = moduleIds.map(id => ({
    id,
    cards: VAULT_TO_CARDS[id] ?? [],
  }))

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm transition">← Workbench</button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-bold text-sm">Environment Settings</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground/80 mb-3">Environment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Municipality</span>
                <span className="text-foreground font-medium">{environment.town ?? environment.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment ID</span>
                <span className="text-foreground font-mono text-xs">{environment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active modules</span>
                <span className="text-foreground">{moduleIds.length > 0 ? moduleIds.length : 'All (legacy)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audit trail</span>
                <span className={environment.auditEnabled ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}>
                  {environment.auditEnabled ? 'Enabled' : 'Off'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retention policy</span>
                <span className={environment.retentionEnabled ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}>
                  {environment.retentionEnabled ? 'Enabled' : 'Off'}
                </span>
              </div>
            </div>
          </div>

          {/* Module → workspace tab chain */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground/80 mb-1">Module Chain</h3>
            <p className="text-muted-foreground text-xs mb-3">
              Modules selected during setup appear as cards in the Dash body.
              Clicking a card opens that module's workflow inline.
            </p>
            {moduleIds.length === 0 ? (
              <p className="text-muted-foreground text-xs">No modules configured — all cards visible (legacy mode).</p>
            ) : (
              <div className="space-y-1.5">
                {moduleChain.map(({ id, cards }) => (
                  <div key={id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-foreground/70 bg-muted px-2 py-0.5 rounded text-[10px] min-w-[110px]">{id}</span>
                    {cards.length > 0 ? (
                      <span className="text-muted-foreground">→ {cards.join(', ')}</span>
                    ) : (
                      <span className="text-muted-foreground/40">→ no Dash card yet</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-muted-foreground/50 text-xs">
            To add or remove modules, re-run setup from <strong>Toolbar → Modules → Civic</strong>.<br />
            To edit org structure and staff, use the <button onClick={onBack} className="underline">Org & Staff</button> tab.
          </p>
        </div>
      </div>
    </div>
  )
}
