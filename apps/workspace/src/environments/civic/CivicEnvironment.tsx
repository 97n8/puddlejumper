import { useEffect, useState } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { civicApi } from '../../features/civic/api/civicApi'
import type { EnvironmentActor } from '../../framework/types'
import type { Municipality } from '@/data/maMunicipalities'
import { findMunicipalityByName } from './context/CivicTownContext'
import { CivicTownSelector } from './components/CivicTownSelector'
import { OrgManager } from '../../features/civic/pages/OrgManager'
import { createCaseSpace } from '@/services/casespaceApi'
import type { CaseSpace } from '@/lib/types'
import { ArrowSquareOut, ArrowCounterClockwise, Gavel, Buildings, UsersThree, Shield } from '@phosphor-icons/react'

type Phase = 'loading' | 'town_select' | 'setup' | 'done'

interface CivicEnvironmentProps {
  onBack: () => void
  onLaunch?: (envId: string) => void
}

export function CivicEnvironment({ onBack, onLaunch }: CivicEnvironmentProps) {
  const { user, loading: authLoading, logout } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [actor, setActor] = useState<EnvironmentActor | null>(null)
  const [selectedTown, setSelectedTown] = useState<Municipality | null>(null)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [selectLoading, setSelectLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [launchedEnvId, setLaunchedEnvId] = useState<string | null>(null)

  // Handle session expiry dispatched by civicApi on 401 responses
  useEffect(() => {
    const handle = () => { logout(); onBack() }
    window.addEventListener('civic:session-expired', handle)
    return () => window.removeEventListener('civic:session-expired', handle)
  }, [logout, onBack])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setPhase('town_select'); setLoadError('Log in to LogicOS to access Civic.'); return }

    civicApi.me()
      .then(async me => {
        const actorData: EnvironmentActor = {
          id: me.actor.id,
          object_id: me.actor.object_id,
          display_name: user.name || me.actor.display_name || user.email || 'User',
          email: user.email || me.actor.email || '',
          civic_role: me.actor.role ?? 'staff',
          town: me.town as Record<string, unknown>,
        }
        setActor(actorData)
        // Always show town selector — user may want to switch municipalities
        setPhase('town_select')
      })
      .catch(() => {
        setActor({
          id: 'session', object_id: 'session',
          display_name: user.name ?? user.email ?? 'User',
          email: user.email ?? '',
          civic_role: 'staff',
          town: {},
        })
        setPhase('town_select')
      })
  }, [authLoading, user])

  const handleTownSelect = async (town: Municipality) => {
    setSelectedTown(town)
    setSelectLoading(true)
    try {
      const status = await civicApi.get<{ complete?: boolean; prefill?: Record<string, unknown>; env_id?: string }>('/org-manager/status')
      if (status?.prefill) setPrefill(status.prefill)
      const registeredName = ((status?.prefill as { town?: { town_name?: string } })?.town?.town_name ?? '').toLowerCase().trim()
      const isSameTown = registeredName !== '' && registeredName === town.name.toLowerCase().trim()
      if (status?.complete && isSameTown) {
        if (status.env_id) setLaunchedEnvId(status.env_id)
        setPhase('done')
      } else {
        setPhase('setup')
      }
    } catch {
      setPhase('setup')
      // Non-fatal: phase check failed, defaulting to setup flow
    } finally {
      setSelectLoading(false)
    }
  }

  const setupPrefill = {
    ...prefill,
    town: {
      ...((prefill as { town?: Record<string, unknown> }).town ?? {}),
      town_name: selectedTown?.name,
      county: selectedTown?.county,
      population: selectedTown?.population,
    },
  }

  // Launch — create a real Vault workspace with the chosen modules, then navigate into it
  const handleSetupComplete = async (selectedModuleIds: string[]) => {
    if (!selectedTown || !actor) return
    const slug = selectedTown.name.toLowerCase().replace(/\s+/g, '-')
    const envId = `civic-${slug}-${Date.now()}`
    const env: CaseSpace = {
      id: envId,
      name: selectedTown.name,
      description: `Municipal governance environment for ${selectedTown.name}, MA`,
      color: '#8B1A1A',
      type: 'vault',
      town: selectedTown.name,
      owner: actor.email,
      visibility: 'organization',
      members: [actor.email],
      vaultModuleIds: selectedModuleIds,
      createdAt: Date.now(),
      fileCount: 0, folderCount: 0, templateCount: 0,
      connectionIds: [],
      auditEnabled: true,
      retentionEnabled: true,
    }
    try {
      const created = await createCaseSpace(env)
      const id = created?.id ?? envId
      setLaunchedEnvId(id)
      setPhase('done')
      onLaunch?.(id)
    } catch (e) {
      console.warn('[Civic] casespace creation failed:', e)
      setPhase('done')
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading' || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading your environment…</p>
        </div>
      </div>
    )
  }

  // ── TOWN SELECT ───────────────────────────────────────────────────────────
  if (phase === 'town_select') {
    if (loadError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm text-center">
            <div className="text-3xl mb-3">⚠</div>
            <h2 className="text-foreground font-bold mb-2">Connection Error</h2>
            <p className="text-muted-foreground text-sm mb-4">{loadError}</p>
            <button onClick={onBack} className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-xl transition">
              ← Back to LogicOS
            </button>
          </div>
        </div>
      )
    }
    const autoTown = actor?.town?.town_name
      ? findMunicipalityByName(actor.town.town_name as string)
      : null
    return (
      <CivicTownSelector
        actorName={actor?.display_name ?? ''}
        autoTown={autoTown ?? null}
        onSelect={handleTownSelect}
        loading={selectLoading}
      />
    )
  }

  // ── SETUP WIZARD ──────────────────────────────────────────────────────────
  if (phase === 'setup' && actor) {
    return (
      <div className="flex-1 overflow-y-auto">
        <OrgManager
          actor={{ display_name: actor.display_name, email: actor.email }}
          prefill={setupPrefill}
          onComplete={handleSetupComplete}
        />
      </div>
    )
  }

  // ── DONE — environment lives in Workspaces ────────────────────────────────
  if (phase === 'done' && selectedTown) {
    const formOfGovt = (prefill as { town?: { form_of_govt?: string } })?.town?.form_of_govt as string | undefined
    const chiefTitle = (prefill as { town?: { chief_official_title?: string } })?.town?.chief_official_title as string | undefined

    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg space-y-4">

          {/* Town hero card — mirrors /dev dashboard style */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header stripe */}
            <div className="h-1.5 bg-gradient-to-r from-red-800 via-red-700 to-red-900" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-900/40 border border-red-800/40 flex items-center justify-center">
                    <Gavel size={20} weight="duotone" className="text-red-400" />
                  </div>
                  <div>
                    <h1 className="text-foreground font-black text-xl leading-tight">{selectedTown.name}</h1>
                    <p className="text-muted-foreground text-xs mt-0.5">{selectedTown.county} County, Massachusetts</p>
                  </div>
                </div>
                {/* Live status dot */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 text-[10px] font-semibold tracking-wide">ACTIVE</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <UsersThree size={12} className="text-muted-foreground/70" />
                    <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Population</span>
                  </div>
                  <div className="text-sm font-bold text-foreground">{selectedTown.population?.toLocaleString() ?? '—'}</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Buildings size={12} className="text-muted-foreground/70" />
                    <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Government</span>
                  </div>
                  <div className="text-sm font-bold text-foreground leading-tight">{formOfGovt ?? 'Town Meeting'}</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield size={12} className="text-muted-foreground/70" />
                    <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Chief Official</span>
                  </div>
                  <div className="text-sm font-bold text-foreground leading-tight">{chiefTitle ?? 'Town Manager'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {launchedEnvId && (
              <button
                onClick={() => onLaunch?.(launchedEnvId)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition"
              >
                <ArrowSquareOut size={16} weight="bold" />
                Open in Workspaces
              </button>
            )}
            <button
              onClick={() => setPhase('setup')}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition"
            >
              <ArrowCounterClockwise size={14} />
              Reconfigure modules &amp; permissions
            </button>
            <button onClick={onBack} className="text-muted-foreground/50 hover:text-muted-foreground text-xs transition text-center w-full py-1">
              ← Back to LogicOS
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
