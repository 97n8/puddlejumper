/**
 * VaultModuleMaker — VAULT Compliance Module Setup
 *
 * Immersive setup wizard for any governed organization.
 * Inline connections, folder routing, editable workflows — everything
 * an implementer can do, in one screen, no separate dialogs.
 */
import { useState, useMemo, useEffect } from 'react'
import {
  ArrowLeft, ArrowRight, Trash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useKV } from '@/hooks/useKV'
import {
  type BuilderSession,
  getBuilderSession,
  saveBuilderSession,
  newBuilderSession,
} from '@/lib/vault-modules'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import { useAuth } from '@/services/auth/AuthContext'
import { getDemoUserScope, isDemoRestrictedUser } from '@/lib/environmentAccess'
import { CaseSpaceApiError, createCaseSpace } from '@/services/casespaceApi'
import { builderSessionToEnvironment } from '@/features/environments/lib/environmentResolution'
import { notifyEnvironmentCreated } from '@/features/environments/utils/notifyEnvironmentCreated'

import type { MakerState, MunicipalContext, StaffDirectoryContact, Step, ActiveStep } from '../types'
import {
  BLANK_STATE, STEP_ORDER, normalizeStep,
  buildDraftState, buildSessionConfigsFromState,
  hydrateStateFromSession,
} from '../utils/makerUtils'
import { useConnectors } from '../hooks/useConnectors'
import { Stepper } from './Stepper'
import { TownStep } from './TownStep'
import { ConfigureStep } from './ConfigureStep'
import { ReviewStep, DoneStep } from './ReviewStep'

type ActivationState =
  | { status: 'idle' }
  | { status: 'local_draft_created'; sessionId: string; message: string }
  | { status: 'server_persisted'; sessionId: string; message: string }
  | { status: 'auth_required'; sessionId: string; message: string }
  | { status: 'unauthorized'; sessionId: string; message: string }
  | { status: 'persist_failed'; sessionId: string | null; message: string }

function getActivationFailureState(error: unknown, sessionId: string | null): Exclude<ActivationState, { status: 'idle' } | { status: 'local_draft_created'; sessionId: string; message: string } | { status: 'server_persisted'; sessionId: string; message: string }> {
  if (!sessionId) {
    return {
      status: 'persist_failed',
      sessionId: null,
      message: 'Activation failed before server persistence. Please try again.',
    }
  }

  if (error instanceof CaseSpaceApiError && error.status === 401) {
    return {
      status: 'auth_required',
      sessionId,
      message: 'Saved locally, but not synced. Sign in to finish activation.',
    }
  }

  if (error instanceof CaseSpaceApiError && error.status === 403) {
    return {
      status: 'unauthorized',
      sessionId,
      message: 'Saved locally, but not synced. You do not have permission to activate this casespace.',
    }
  }

  const detail = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'The server could not persist this activation.'

  return {
    status: 'persist_failed',
    sessionId,
    message: `Saved locally, but not synced. ${detail}`,
  }
}

function getActivationNotice(state: ActivationState): null | {
  tone: 'info' | 'amber' | 'red'
  title: string
  message: string
  retryLabel?: string
} {
  switch (state.status) {
    case 'idle':
    case 'server_persisted':
      return null
    case 'local_draft_created':
      return {
        tone: 'info',
        title: 'Saving local draft',
        message: state.message,
      }
    case 'auth_required':
      return {
        tone: 'amber',
        title: 'Authentication required',
        message: state.message,
        retryLabel: 'Retry sync',
      }
    case 'unauthorized':
      return {
        tone: 'amber',
        title: 'Not authorized to activate',
        message: state.message,
        retryLabel: 'Retry sync',
      }
    case 'persist_failed':
      return {
        tone: 'red',
        title: 'Sync failed',
        message: state.message,
        retryLabel: state.sessionId ? 'Retry sync' : 'Try again',
      }
    default:
      return null
  }
}


// ── Main ──────────────────────────────────────────────────────────────────────

export function VaultModuleMaker({
  onActivated,
  initialTownCode = null,
  initialSessionId = null,
}: {
  onActivated?: () => void
  initialTownCode?: number | null
  initialSessionId?: string | null
} = {}) {
  const { user } = useAuth()
  const demoRestricted = isDemoRestrictedUser(user)
  const demoScope = getDemoUserScope(user)
  const stateStorageKey = demoScope ? `vault-module-maker-state:${demoScope}` : 'vault-module-maker-state'
  const stepStorageKey = demoScope ? `vault-module-maker-step:${demoScope}` : 'vault-module-maker-step'
  const draftSessionStorageKey = demoScope ? `vault-module-maker-session:${demoScope}` : 'vault-module-maker-session'
  const [persisted, setPersisted] = useKV<MakerState>(stateStorageKey, BLANK_STATE)
  const [step, setStep] = useKV<Step>(stepStorageKey, 'town')
  const [draftSessionId, setDraftSessionId] = useKV<string | null>(draftSessionStorageKey, null)
  const [activating, setActivating] = useState(false)
  const [activationState, setActivationState] = useState<ActivationState>({ status: 'idle' })
  const [municipalContext, setMunicipalContext] = useState<MunicipalContext | null>(null)
  const [loadingMunicipalContext, setLoadingMunicipalContext] = useState(false)
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryContact[]>([])
  const [loadingStaffDirectory, setLoadingStaffDirectory] = useState(false)
  const [staffDirectoryNotice, setStaffDirectoryNotice] = useState<string | null>(null)
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null)
  const { connectors, connecting, connect } = useConnectors()

  const state = persisted ?? BLANK_STATE
  const currentStep = normalizeStep(step as Step)
  const selectedMunicipality = useMemo(
    () => MA_MUNICIPALITIES.find(item => item.name.toLowerCase() === state.town.trim().toLowerCase()) ?? null,
    [state.town],
  )

  function update(next: MakerState) { setPersisted(next) }
  function advance() {
    const next = STEP_ORDER[STEP_ORDER.indexOf(currentStep) + 1]
    if (next) setStep(next)
  }
  function back() {
    const prev = STEP_ORDER[STEP_ORDER.indexOf(currentStep) - 1]
    if (prev) setStep(prev)
  }

  async function activate() {
    setActivating(true)
    setActivationState({ status: 'idle' })
    let localDraftSessionId: string | null = null
    try {
      const existingSession = draftSessionId ? getBuilderSession(draftSessionId, demoScope) : undefined
      const session = existingSession ?? newBuilderSession(state.town, demoScope, {
        source: demoRestricted ? 'town-demo' : 'builder',
      })
      session.town = state.town
      session.selectedModuleIds = state.selectedIds
      for (const id of state.selectedIds) {
        const s = state.setups[id]
        if (s) {
          const noteLines = [
            s.notes,
            state.workflowTeamSize ? `Workflow team size: ${state.workflowTeamSize} employees` : '',
            ...(s.workflowAssignments && Object.values(s.workflowAssignments).some(Boolean)
              ? [
                  '',
                  'Workflow owners:',
                  ...s.workflowSteps.map(stepName => {
                    const assignedId = s.workflowAssignments?.[stepName]
                    const assigned = assignedId === '__module_owner__'
                      ? s.officerName
                      : staffDirectory.find(contact => contact.id === assignedId)?.name
                    return assigned ? `- ${stepName}: ${assigned}` : `- ${stepName}: unassigned`
                  }),
                ]
              : []),
          ].filter(Boolean)

          session.configs[id] = {
            moduleId: id,
            enforcementMode: 'core',
            primaryApprover: s.officerName,
            statutoryBasis: '',
            retentionYears: s.retentionYears,
            workflowSteps: s.workflowSteps,
            connectorRoutes: s.routing as Record<string, any>,
            notes: noteLines.join('\n'),
            raos: [],
            trainingLinks: [],
            customFields: [],
            sealOnArchive: false,
            legalHoldEligible: false,
            namingPattern: '',
            moduleCode: id,
            track: 'municipal',
            vaultGate: 'foundations',
            encodingPartner: 'none',
            slaDefaultDays: 10,
            slaWarningDays: 7,
            slaExtensionDays: null,
            slaEscalationRoles: [],
            statusLabels: {
              open: 'Open', in_progress: 'In Progress',
              pending_approval: 'Pending Approval', approved: 'Approved',
              closed: 'Closed', archived: 'Archived',
            },
            views: [],
          }
        }
      }
      session.source = demoRestricted ? 'town-demo' : (session.source ?? 'builder')
      session.draftState = buildDraftState(state, 'review')
      const localSession = saveBuilderSession({
        ...session,
        status: demoRestricted ? 'activated' : 'review',
      }, demoScope)
      localDraftSessionId = localSession.id
      setDraftSessionId(localSession.id)
      if (!demoRestricted) {
        setActivationState({
          status: 'local_draft_created',
          sessionId: localSession.id,
          message: 'Saved locally, syncing to server…',
        })
      }
      // Persist to server so the environment survives across browsers/devices
      if (!demoRestricted) {
        const env = builderSessionToEnvironment(localSession)
        await createCaseSpace(env)
        saveBuilderSession({ ...localSession, status: 'activated' }, demoScope)
        notifyEnvironmentCreated({
          envName: env.name,
          envId: env.id,
          moduleIds: env.vaultModuleIds ?? [],
          userEmail: user?.email,
          userName: user?.name,
        })
      }
      setActivationState({
        status: 'server_persisted',
        sessionId: localDraftSessionId,
        message: `${state.town} activated on VAULT!`,
      })
      await new Promise(r => setTimeout(r, 1000))
      setStep('done')
      toast.success(`${state.town} activated on VAULT!`)
    } catch (error) {
      const failureState = getActivationFailureState(error, localDraftSessionId)
      setActivationState(failureState)
      toast.error(failureState.message)
    } finally {
      setActivating(false)
    }
  }

  function reset() {
    setPersisted(BLANK_STATE)
    setStep('town')
    setDraftSessionId(null)
    setActivationState({ status: 'idle' })
  }

  useEffect(() => {
    if (step === 'modules') setStep('town')
  }, [step, setStep])

  useEffect(() => {
    if (!initialSessionId || initialSessionId === loadedSessionId) return
    const session = getBuilderSession(initialSessionId, demoScope)
    if (!session) return
    const hydrated = hydrateStateFromSession(session)
    setPersisted(hydrated.state)
    setStep(hydrated.step)
    setDraftSessionId(session.id)
    setLoadedSessionId(session.id)
  }, [demoScope, initialSessionId, loadedSessionId, setDraftSessionId, setPersisted, setStep])

  useEffect(() => {
    if (!initialTownCode) return
    const municipality = MA_MUNICIPALITIES.find(item => item.dor_code === initialTownCode)
    if (municipality && municipality.name !== state.town) {
      setPersisted({ ...state, town: municipality.name })
    }
  }, [initialTownCode, setPersisted, state])

  useEffect(() => {
    if (!selectedMunicipality) {
      setMunicipalContext(null)
      return
    }

    let cancelled = false
    setLoadingMunicipalContext(true)

    fetch('/api/fiscal/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedMunicipality.name }),
    })
      .then(async response => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { error?: string; detail?: string }
          throw new Error(error.detail ?? error.error ?? `HTTP ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        if (cancelled) return
        const riskFlags = Array.isArray(data?.riskFlags) ? data.riskFlags : []
        const firstMeaningfulFlag = riskFlags.find((flag: Record<string,unknown>) => flag?.severity && flag.severity !== 'passing')
        setMunicipalContext({
          municipality: selectedMunicipality,
          fiscalYear: data?.fiscalYear ?? new Date().getFullYear(),
          operatingBudget: data?.metrics?.operatingBudget ?? null,
          totalEmployees: data?.metrics?.totalEmployees ?? null,
          totalSalariesWages: data?.metrics?.totalSalariesWages ?? null,
          salariesPctBudget: data?.metrics?.salariesPctBudget ?? null,
          certifiedFreeCash: data?.metrics?.certifiedFreeCash ?? null,
          pressure: firstMeaningfulFlag?.label ?? 'No acute pressure signal from the current public state pull.',
        })
      })
      .catch(() => {
        if (!cancelled) setMunicipalContext(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalContext(false)
      })

    return () => { cancelled = true }
  }, [selectedMunicipality])

  useEffect(() => {
    if (!state.town.trim()) {
      setStaffDirectory([])
      setStaffDirectoryNotice(null)
      return
    }

    let cancelled = false
    setLoadingStaffDirectory(true)

    fetch('/api/civic/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.town }),
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({})) as {
          employees?: StaffDirectoryContact[]
          notice?: string
          error?: string
        }
        if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
        return payload
      })
      .then(payload => {
        if (cancelled) return
        setStaffDirectory(Array.isArray(payload.employees) ? payload.employees : [])
        setStaffDirectoryNotice(payload.notice ?? null)
      })
      .catch(error => {
        if (cancelled) return
        setStaffDirectory([])
        setStaffDirectoryNotice(error instanceof Error ? error.message : 'Could not pull a public staff directory for this town yet.')
      })
      .finally(() => {
        if (!cancelled) setLoadingStaffDirectory(false)
      })

    return () => { cancelled = true }
  }, [state.town])

  useEffect(() => {
    if (!demoRestricted || !demoScope) return
    const hasWork = !!state.town.trim() || state.selectedIds.length > 0
    if (!hasWork) return

    const existingSession = draftSessionId ? getBuilderSession(draftSessionId, demoScope) : undefined
    const ensuredId = existingSession?.id ?? newBuilderSession(state.town || 'Demo module build', demoScope, {
      source: 'town-demo',
      status: currentStep === 'review' ? 'review' : 'draft',
      brandConfig: {
        displayName: `${state.town || 'Town'} Demo Modules`,
        color: '#2f7c65',
        icon: '🏛️',
      },
    }).id

    const session: BuilderSession = {
      ...(existingSession ?? {
        id: ensuredId,
        town: state.town || 'Demo module build',
        selectedModuleIds: [],
        configs: {},
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        brandConfig: {
          displayName: `${state.town || 'Town'} Demo Modules`,
          color: '#2f7c65',
          icon: '🏛️',
        },
        connectConfig: { connectors: [], folders: [], templates: [] },
      }),
      id: ensuredId,
      town: state.town || existingSession?.town || 'Demo module build',
      selectedModuleIds: state.selectedIds,
      configs: buildSessionConfigsFromState(state),
      status: currentStep === 'review' ? 'review' : existingSession?.status === 'activated' ? 'activated' : 'draft',
      brandConfig: existingSession?.brandConfig ?? {
        displayName: `${state.town || 'Town'} Demo Modules`,
        color: '#2f7c65',
        icon: '🏛️',
      },
      connectConfig: existingSession?.connectConfig ?? { connectors: [], folders: [], templates: [] },
      source: 'town-demo',
      draftState: buildDraftState(state, currentStep),
    }

    saveBuilderSession(session, demoScope)
    if (draftSessionId !== ensuredId) setDraftSessionId(ensuredId)
  }, [currentStep, demoRestricted, demoScope, draftSessionId, setDraftSessionId, state])

  const canNext: Record<ActiveStep, boolean> = {
    town:      !!state.town && state.selectedIds.length > 0,
    configure: state.selectedIds.length > 0,
    review:    false,
    done:      false,
  }
  const activationNotice = getActivationNotice(activationState)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {currentStep !== 'done' && (
        <Stepper step={currentStep} state={state} connectors={connectors} onGo={s => setStep(s)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {currentStep === 'review' && activationNotice && (
            <div className="border-b border-border bg-background px-6 py-4">
              <div
                className={[
                  'mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
                  activationNotice.tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-900',
                  activationNotice.tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-900',
                  activationNotice.tone === 'red' && 'border-red-200 bg-red-50 text-red-900',
                ].filter(Boolean).join(' ')}
              >
                <div>
                  <p className="font-semibold">{activationNotice.title}</p>
                  <p>{activationNotice.message}</p>
                </div>
                {activationNotice.retryLabel && !activating && (
                  <Button variant="outline" size="sm" onClick={activate}>
                    {activationNotice.retryLabel}
                  </Button>
                )}
              </div>
            </div>
          )}
          {(currentStep === 'town' || step === 'modules') && (
            <TownStep
              state={state}
              onUpdate={update}
              municipality={selectedMunicipality}
              municipalContext={municipalContext}
              loadingMunicipalContext={loadingMunicipalContext}
            />
          )}
          {currentStep === 'configure' && (
            <ConfigureStep
              state={state} onUpdate={update}
              connectors={connectors} connecting={connecting} onConnect={connect}
              staffDirectory={staffDirectory}
              loadingStaffDirectory={loadingStaffDirectory}
              staffDirectoryNotice={staffDirectoryNotice}
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep state={state} connectors={connectors} onActivate={activate} activating={activating} />
          )}
          {currentStep === 'done' && <DoneStep state={state} onReset={reset} onViewEnvironments={onActivated} />}
        </div>

        {/* Bottom nav */}
        {currentStep !== 'done' && currentStep !== 'review' && (
          <div className="border-t border-border bg-background/95 px-4 py-2.5 shrink-0">
            <div className="mx-auto flex w-full max-w-[1520px] items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {state.town && <span className="font-medium text-foreground">{state.town}</span>}
              {state.selectedIds.length > 0 && (
                <span>· {state.selectedIds.length} module{state.selectedIds.length !== 1 ? 's' : ''} selected</span>
              )}
              {state.workflowTeamSize && <span>· {state.workflowTeamSize} in workflow</span>}
            </div>
            <div className="flex items-center gap-2">
              {currentStep !== 'town' && (
                <Button variant="outline" size="sm" onClick={back}>
                  <ArrowLeft size={14} className="mr-1" /> Back
                </Button>
              )}
              <Button size="sm" onClick={advance} disabled={!canNext[currentStep]}>
                {currentStep === 'configure' ? 'Review' : 'Continue to setup'}
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
            </div>
          </div>
        )}
        {currentStep === 'review' && (
          <div className="border-t border-border bg-card px-6 py-3 shrink-0">
            <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between">
              <Button variant="outline" size="sm" onClick={back}>
                <ArrowLeft size={14} className="mr-1" /> Back to Configure
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
                <Trash size={14} className="mr-1" /> Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
