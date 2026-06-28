import { Buildings, Wrench, SealCheck, ShieldCheck, WindowsLogo, GoogleLogo } from '@phosphor-icons/react'
import type { ActiveStep, Step, MakerState, ConnectorStatus } from '../types'
import { normalizeStep, stepIndex } from '../utils/makerUtils'

const STEP_META = [
  { id: 'town' as ActiveStep,      label: 'Town + Modules',    icon: <Buildings size={15} /> },
  { id: 'configure' as ActiveStep, label: 'Configure',         icon: <Wrench size={15} /> },
  { id: 'review' as ActiveStep,    label: 'Review & Activate', icon: <SealCheck size={15} /> },
]

export function Stepper({
  step, state, connectors, onGo,
}: {
  step: Step
  state: MakerState
  connectors: Record<string, ConnectorStatus>
  onGo: (s: ActiveStep) => void
}) {
  const msConnected = connectors['microsoft']?.connected
  const gConnected  = connectors['google']?.connected
  const currentStep = normalizeStep(step)

  return (
    <div className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck size={14} weight="fill" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              {state.town || 'New Environment Setup'}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {state.selectedIds.length} module{state.selectedIds.length !== 1 ? 's' : ''}
              {state.workflowTeamSize ? ` · team ${state.workflowTeamSize}` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
        {STEP_META.map((meta, i) => {
          const current = meta.id === currentStep
          const done = stepIndex(meta.id) < stepIndex(currentStep)
          const clickable = done || (meta.id === 'configure' && !!state.town && state.selectedIds.length > 0)

          return (
            <button
              key={meta.id}
              disabled={!done && !current && !clickable}
              onClick={() => (done || clickable) && onGo(meta.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[11px] transition ${
                current
                  ? 'border-primary bg-primary/10 text-primary'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-muted/15 text-muted-foreground'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                current
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {done ? '✓' : i + 1}
              </span>
              <span className="font-medium">{meta.label}</span>
            </button>
          )
        })}
        </div>

        <div className="flex items-center gap-1.5">
          <div className={`flex h-7 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${msConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/20 text-muted-foreground'}`}>
            <WindowsLogo size={11} className={msConnected ? 'text-[#0078D4]' : 'text-muted-foreground'} weight="fill" />
            <span>{msConnected ? 'Microsoft' : 'MS'}</span>
          </div>
          <div className={`flex h-7 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${gConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/20 text-muted-foreground'}`}>
            <GoogleLogo size={11} className={gConnected ? 'text-[#4285F4]' : 'text-muted-foreground'} weight="fill" />
            <span>{gConnected ? 'Google' : 'G'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
