/**
 * Synchron8AutomationsPanel
 *
 * Upgrades SYNCHRON8 from a basic rule form into an automation studio:
 * - blueprint-driven creation
 * - richer scenario metadata (module, compliance profile, conditions)
 * - per-automation run history and evidence inspection
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { pjApi, type Synchron8Automation, type Synchron8Run, type Synchron8Step } from '@/services/pjApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Lightning, Plus, Trash, Play, ArrowRight, CheckCircle,
  ArrowsClockwise, CaretDown, CaretUp, PencilSimple, X,
} from '@phosphor-icons/react'
import {
  AUTOMATION_BLUEPRINTS,
  CRON_LABELS,
  GOVERNANCE_STEP_TYPES,
  GOVERNANCE_TRIGGER_TYPES,
  type AutomationBlueprint,
  type FlowFieldDef,
  type TriggerTypeDef,
} from '../constants/synchron8'

interface Synchron8AutomationsPanelProps {
  envId?: string
}

type EditableStep = Synchron8Step & Record<string, unknown>

interface RunStatus {
  automationId: string
  running: boolean
  lastRunId?: string
}

interface EditorState {
  name: string
  moduleId: string
  complianceProfile: string
  triggerId: string
  triggerConfig: Record<string, string>
  steps: EditableStep[]
  enabled: boolean
}

const STATUS_META = {
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-300',
  skipped: 'bg-muted text-muted-foreground',
} as const

function toStringRecord(value: Record<string, unknown> | undefined, skipKeys: string[] = []): Record<string, string> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !skipKeys.includes(key))
      .map(([key, fieldValue]) => [key, fieldValue == null ? '' : String(fieldValue)])
  )
}

function compactRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, fieldValue]) => [key, fieldValue == null ? '' : String(fieldValue).trim()] as const)
      .filter(([, fieldValue]) => fieldValue.length > 0)
  )
}

function automationModule(automation: Partial<Synchron8Automation>): string {
  return String(automation.moduleId ?? automation.trigger?.module ?? '')
}

function toEditableStep(step: Synchron8Step): EditableStep {
  return { type: step.type, ...toStringRecord(step, ['type']) }
}

function toEditorState(source?: Partial<Synchron8Automation>): Partial<EditorState> {
  if (!source) return {}
  return {
    name: source.name ?? '',
    moduleId: automationModule(source),
    complianceProfile: source.complianceProfile ?? '',
    triggerId: source.trigger?.type ?? GOVERNANCE_TRIGGER_TYPES[0].id,
    triggerConfig: toStringRecord(source.trigger, ['type']),
    steps: (source.steps ?? []).map(toEditableStep),
    enabled: source.enabled ?? true,
  }
}

function blueprintToEditorState(blueprint: AutomationBlueprint): Partial<EditorState> {
  return {
    name: blueprint.name,
    moduleId: blueprint.moduleId ?? blueprint.trigger.module ?? '',
    complianceProfile: blueprint.complianceProfile ?? '',
    triggerId: blueprint.trigger.type,
    triggerConfig: toStringRecord(blueprint.trigger, ['type']),
    steps: blueprint.steps.map(step => ({ type: step.type, ...step })),
    enabled: true,
  }
}

function summarizeTrigger(trigger: Synchron8Automation['trigger'] | undefined): string {
  if (!trigger) return 'No trigger configured'
  const def = GOVERNANCE_TRIGGER_TYPES.find(item => item.id === trigger.type)
  const config = Object.entries(trigger)
    .filter(([key, value]) => key !== 'type' && value != null && String(value).trim().length > 0)
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${CRON_LABELS[String(value)] ?? String(value)}`)
    .join(' · ')
  return [def?.label ?? trigger.type, config].filter(Boolean).join(' · ')
}

function summarizeStep(step: Synchron8Step): string {
  const def = GOVERNANCE_STEP_TYPES.find(item => item.id === step.type)
  const firstDetail = Object.entries(step)
    .find(([key, value]) => key !== 'type' && value != null && String(value).trim().length > 0)
  return firstDetail
    ? `${def?.label ?? step.type} · ${String(firstDetail[1])}`
    : (def?.label ?? step.type)
}

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString()
}

function flowMetrics(steps: Synchron8Step[]): Array<{ label: string; value: number }> {
  return [
    { label: 'Actions', value: steps.length },
    { label: 'Approvals', value: steps.filter(step => step.type === 'require_attestation').length },
    { label: 'Integrations', value: steps.filter(step => step.type === 'call_webhook').length },
  ]
}

function FieldInput({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: FlowFieldDef
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  const className = compact ? 'h-8 text-xs' : 'h-9 text-sm'
  if (field.type === 'select' && field.options) {
    return (
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className={cn(
          'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <option value="">Select...</option>
        {field.options.map(option => (
          <option key={option} value={option}>
            {CRON_LABELS[option] ?? option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={compact ? 2 : 3}
        className={cn(
          'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}
      />
    )
  }

  return (
    <Input
      value={value}
      type={field.type === 'number' ? 'number' : 'text'}
      onChange={event => onChange(event.target.value)}
      placeholder={field.placeholder}
      className={className}
    />
  )
}

function TriggerConfigFields({
  def,
  value,
  onChange,
}: {
  def: TriggerTypeDef
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
}) {
  if (!def.fields.length) return null
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {def.fields.map(field => (
        <div key={field.key}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {field.label}
          </label>
          <FieldInput
            field={field}
            value={value[field.key] ?? ''}
            onChange={nextValue => onChange({ ...value, [field.key]: nextValue })}
          />
        </div>
      ))}
    </div>
  )
}

function StepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  step: EditableStep
  index: number
  total: number
  onChange: (step: EditableStep) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const def = GOVERNANCE_STEP_TYPES.find(item => item.id === step.type) ?? GOVERNANCE_STEP_TYPES[0]

  const update = (patch: Record<string, unknown>) => onChange({ ...step, ...patch })

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-base">{def.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={String(step.type)}
              onChange={event => update({ type: event.target.value })}
              className="min-w-[13rem] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium text-foreground"
            >
              {GOVERNANCE_STEP_TYPES.map(typeDef => (
                <option key={typeDef.id} value={typeDef.id}>
                  {typeDef.icon} {typeDef.label}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {def.app}
            </span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              {def.category}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{def.desc}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {index > 0 && (
            <button onClick={() => onMove(-1)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move step up">
              <CaretUp size={12} />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(1)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move step down">
              <CaretDown size={12} />
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/30"
            aria-label="Remove step"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step label</label>
          <Input
            value={String(step.label ?? '')}
            onChange={event => update({ label: event.target.value })}
            placeholder="e.g. Notify records officer"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Run only if</label>
          <Input
            value={String(step.condition ?? '')}
            onChange={event => update({ condition: event.target.value })}
            placeholder="e.g. severity = high"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {def.fields.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {def.fields.map(field => (
            <div key={field.key}>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {field.label}
              </label>
              <FieldInput
                field={field}
                value={String(step[field.key] ?? '')}
                onChange={nextValue => update({ [field.key]: nextValue })}
                compact
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Operator note</label>
        <textarea
          value={String(step.note ?? '')}
          onChange={event => update({ note: event.target.value })}
          rows={2}
          placeholder="Document intent, handoff rules, or rollback notes..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
        />
      </div>
    </div>
  )
}

function RunsPanel({
  runs,
  loading,
  evidenceByRun,
  evidenceLoadingRunId,
  onLoadEvidence,
}: {
  runs: Synchron8Run[] | undefined
  loading: boolean
  evidenceByRun: Record<string, string>
  evidenceLoadingRunId: string | null
  onLoadEvidence: (runId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        <ArrowsClockwise size={13} className="animate-spin" /> Loading recent runs...
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        No recent runs yet. Trigger the scenario to populate execution history.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {runs.map(run => (
        <div key={run.runId} className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', STATUS_META[run.status])}>
              {run.status}
            </span>
            <span className="text-xs font-medium text-foreground">{run.runId}</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(run.startedAt)}
              {run.completedAt ? ` -> ${formatTimestamp(run.completedAt)}` : ''}
            </span>
            <button
              onClick={() => onLoadEvidence(run.runId)}
              className="ml-auto text-xs font-semibold text-primary hover:underline"
              disabled={evidenceLoadingRunId === run.runId}
            >
              {evidenceLoadingRunId === run.runId ? 'Loading evidence...' : 'Inspect evidence'}
            </button>
          </div>
          {run.steps && run.steps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {run.steps.map(step => (
                <span key={`${run.runId}-${step.stepIndex}`} className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  Step {step.stepIndex + 1}: {step.status}
                </span>
              ))}
            </div>
          )}
          {evidenceByRun[run.runId] && (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-[11px] text-muted-foreground">
              {evidenceByRun[run.runId]}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

function AutomationCard({
  automation,
  runStatus,
  runs,
  runsExpanded,
  runsLoading,
  evidenceByRun,
  evidenceLoadingRunId,
  onEdit,
  onDelete,
  onTrigger,
  onDuplicate,
  onToggleRuns,
  onLoadEvidence,
}: {
  automation: Synchron8Automation
  runStatus?: RunStatus
  runs?: Synchron8Run[]
  runsExpanded: boolean
  runsLoading: boolean
  evidenceByRun: Record<string, string>
  evidenceLoadingRunId: string | null
  onEdit: () => void
  onDelete: () => void
  onTrigger: () => void
  onDuplicate: () => void
  onToggleRuns: () => void
  onLoadEvidence: (runId: string) => void
}) {
  const metrics = flowMetrics(automation.steps)
  const moduleLabel = automationModule(automation)

  return (
    <div className={cn(
      'rounded-2xl border bg-card p-4 transition-colors',
      automation.enabled ? 'border-border' : 'border-border/40 opacity-70'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          automation.enabled ? 'bg-amber-500/10' : 'bg-muted'
        )}>
          <Lightning size={15} weight="duotone" className={automation.enabled ? 'text-amber-500' : 'text-muted-foreground'} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{automation.name}</span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              automation.enabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}>
              {automation.enabled ? 'Active' : 'Paused'}
            </span>
            {moduleLabel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {moduleLabel}
              </span>
            )}
            {automation.complianceProfile && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                {automation.complianceProfile}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">{summarizeTrigger(automation.trigger)}</p>

          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[1.5fr,1fr]">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Flow</div>
              <div className="flex flex-wrap gap-2">
                {automation.steps.map((step, index) => (
                  <span key={`${automation.id}-${index}`} className="rounded-full bg-background px-2 py-1 text-[11px] text-foreground">
                    {index + 1}. {summarizeStep(step)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scenario stats</div>
              <div className="grid grid-cols-3 gap-2">
                {metrics.map(metric => (
                  <div key={metric.label} className="rounded-lg bg-background px-2 py-2 text-center">
                    <div className="text-sm font-bold text-foreground">{metric.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{metric.label}</div>
                  </div>
                ))}
              </div>
              {runStatus?.lastRunId && (
                <p className="mt-2 text-[11px] text-muted-foreground">Latest trigger: {runStatus.lastRunId}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <button
            onClick={onTrigger}
            disabled={runStatus?.running}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Run automation"
          >
            {runStatus?.running ? <ArrowsClockwise size={13} className="animate-spin" /> : <Play size={13} />}
          </button>
          <button onClick={onToggleRuns} className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {runsExpanded ? 'Hide runs' : 'Runs'}
          </button>
          <button onClick={onEdit} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Edit automation">
            <PencilSimple size={13} />
          </button>
          <button onClick={onDuplicate} className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Clone
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/30"
            aria-label="Delete automation"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      {runsExpanded && (
        <div className="mt-4 border-t border-border pt-4">
          <RunsPanel
            runs={runs}
            loading={runsLoading}
            evidenceByRun={evidenceByRun}
            evidenceLoadingRunId={evidenceLoadingRunId}
            onLoadEvidence={onLoadEvidence}
          />
        </div>
      )}
    </div>
  )
}

function AutomationEditor({
  initial,
  isEditing,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Partial<EditorState>
  isEditing: boolean
  saving: boolean
  onSave: (state: EditorState) => void
  onCancel: () => void
}) {
  const [state, setState] = useState<EditorState>({
    name: initial?.name ?? '',
    moduleId: initial?.moduleId ?? '',
    complianceProfile: initial?.complianceProfile ?? '',
    triggerId: initial?.triggerId ?? GOVERNANCE_TRIGGER_TYPES[0].id,
    triggerConfig: initial?.triggerConfig ?? {},
    steps: initial?.steps ?? [],
    enabled: initial?.enabled ?? true,
  })

  const triggerDef = GOVERNANCE_TRIGGER_TYPES.find(item => item.id === state.triggerId) ?? GOVERNANCE_TRIGGER_TYPES[0]

  const addStep = () => setState(current => ({
    ...current,
    steps: [...current.steps, { type: GOVERNANCE_STEP_TYPES[0].id, label: '' }],
  }))

  const updateStep = (index: number, nextStep: EditableStep) => {
    setState(current => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? nextStep : step),
    }))
  }

  const removeStep = (index: number) => {
    setState(current => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }))
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    setState(current => {
      const steps = [...current.steps]
      ;[steps[index], steps[nextIndex]] = [steps[nextIndex], steps[index]]
      return { ...current, steps }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">{isEditing ? 'Automation studio' : 'New scenario'}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Blueprint the trigger, route the actions, and keep the operator context with the scenario.
          </p>
        </div>
        <button onClick={onCancel} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Cancel">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenario name</label>
          <Input
            value={state.name}
            onChange={event => setState(current => ({ ...current, name: event.target.value }))}
            placeholder="e.g. PRR deadline escalation lane"
            className="h-9 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module / lane</label>
          <Input
            value={state.moduleId}
            onChange={event => setState(current => ({ ...current, moduleId: event.target.value }))}
            placeholder="e.g. VAULTPRR"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger app</label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {GOVERNANCE_TRIGGER_TYPES.map(typeDef => (
              <button
                key={typeDef.id}
                onClick={() => setState(current => ({ ...current, triggerId: typeDef.id, triggerConfig: {} }))}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  state.triggerId === typeDef.id
                    ? 'border-amber-400/60 bg-amber-500/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <Lightning size={12} weight="duotone" className={state.triggerId === typeDef.id ? 'text-amber-500' : ''} />
                  <span className="text-xs font-semibold">{typeDef.label}</span>
                </div>
                <div className="mt-1 text-[11px] opacity-80">{typeDef.desc}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {typeDef.app}
                  </span>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {typeDef.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <TriggerConfigFields
            def={triggerDef}
            value={state.triggerConfig}
            onChange={nextValue => setState(current => ({ ...current, triggerConfig: nextValue }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compliance profile</label>
          <Input
            value={state.complianceProfile}
            onChange={event => setState(current => ({ ...current, complianceProfile: event.target.value }))}
            placeholder="e.g. prr-10-day"
            className="h-9 text-sm"
          />
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scenario summary</div>
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">{triggerDef.label}</span> starts the scenario.</p>
              <p><span className="font-semibold text-foreground">{state.steps.length}</span> step{state.steps.length !== 1 ? 's' : ''} will execute in order.</p>
              <p>{state.enabled ? 'Scenario is armed and ready to run.' : 'Scenario is saved as paused.'}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flow steps</label>
          <button onClick={addStep} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Plus size={11} /> Add step
          </button>
        </div>

        {state.steps.length === 0 ? (
          <button onClick={addStep} className="w-full rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
            + Add first step
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            {state.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex shrink-0 flex-col items-center gap-1 pt-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {index + 1}
                  </div>
                  {index < state.steps.length - 1 && <div className="h-3 w-px bg-border" />}
                </div>
                <div className="flex-1">
                  <StepCard
                    step={step}
                    index={index}
                    total={state.steps.length}
                    onChange={nextStep => updateStep(index, nextStep)}
                    onRemove={() => removeStep(index)}
                    onMove={direction => moveStep(index, direction)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={() => onSave(state)}
          disabled={saving || !state.name.trim() || state.steps.length === 0}
          size="sm"
          className="gap-1.5"
        >
          {saving ? <ArrowsClockwise size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {isEditing ? 'Save scenario' : 'Create scenario'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Active</label>
          <button
            role="switch"
            aria-checked={state.enabled}
            onClick={() => setState(current => ({ ...current, enabled: !current.enabled }))}
            className={cn('h-4 w-8 rounded-full transition-colors', state.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
          >
            <span className={cn(
              'mx-0.5 block h-3 w-3 rounded-full bg-white shadow transition-transform',
              state.enabled ? 'translate-x-4' : 'translate-x-0'
            )} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Synchron8AutomationsPanel({ envId }: Synchron8AutomationsPanelProps) {
  const [automations, setAutomations] = useState<Synchron8Automation[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({})
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [editorInitial, setEditorInitial] = useState<Partial<EditorState> | null>(null)
  const [editingAutomation, setEditingAutomation] = useState<Synchron8Automation | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [expandedRunsAutomationId, setExpandedRunsAutomationId] = useState<string | null>(null)
  const [runsByAutomation, setRunsByAutomation] = useState<Record<string, Synchron8Run[]>>({})
  const [runsLoadingId, setRunsLoadingId] = useState<string | null>(null)
  const [evidenceByRun, setEvidenceByRun] = useState<Record<string, string>>({})
  const [evidenceLoadingRunId, setEvidenceLoadingRunId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!envId) return
    setLoading(true)
    try {
      const data = await pjApi.synchron8.list(envId)
      setAutomations(data.automations ?? [])
    } catch {
      // API may not be live yet — show the studio empty state gracefully.
    } finally {
      setLoading(false)
    }
  }, [envId])

  useEffect(() => {
    load()
  }, [load])

  const moduleOptions = useMemo(() => {
    const modules = new Set<string>()
    automations.forEach(automation => {
      const moduleId = automationModule(automation)
      if (moduleId) modules.add(moduleId)
    })
    AUTOMATION_BLUEPRINTS.forEach(blueprint => {
      const moduleId = blueprint.moduleId ?? blueprint.trigger.module
      if (moduleId) modules.add(moduleId)
    })
    return ['all', ...Array.from(modules).sort()]
  }, [automations])

  const visibleAutomations = useMemo(() => {
    return automations.filter(automation => {
      const searchable = `${automation.name} ${automation.complianceProfile ?? ''} ${automationModule(automation)} ${summarizeTrigger(automation.trigger)}`.toLowerCase()
      const matchesQuery = query.trim().length === 0 || searchable.includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && automation.enabled)
        || (statusFilter === 'paused' && !automation.enabled)
      const matchesModule = moduleFilter === 'all' || automationModule(automation) === moduleFilter
      return matchesQuery && matchesStatus && matchesModule
    })
  }, [automations, moduleFilter, query, statusFilter])

  const totals = useMemo(() => ({
    active: automations.filter(automation => automation.enabled).length,
    paused: automations.filter(automation => !automation.enabled).length,
    governed: automations.filter(automation => automation.steps.some(step => ['require_attestation', 'seal_record'].includes(step.type))).length,
  }), [automations])

  const openEditor = (initial: Partial<EditorState>, automation: Synchron8Automation | null) => {
    setEditorInitial(initial)
    setEditingAutomation(automation)
    setEditorKey(current => current + 1)
  }

  const closeEditor = () => {
    setEditorInitial(null)
    setEditingAutomation(null)
  }

  const handleSave = async (state: EditorState) => {
    if (!envId) return
    setSaving(true)
    const base = editingAutomation ?? {}
    const payload: Partial<Synchron8Automation> = {
      ...base,
      name: state.name.trim(),
      envId,
      moduleId: state.moduleId.trim() || undefined,
      complianceProfile: state.complianceProfile.trim() || undefined,
      trigger: { type: state.triggerId, ...compactRecord(state.triggerConfig) },
      steps: state.steps.map(step => {
        const { type, ...rest } = step
        return { type: String(type), ...compactRecord(rest) }
      }),
      enabled: state.enabled,
    }

    try {
      if (editingAutomation) {
        const updated = await pjApi.synchron8.update(editingAutomation.id, payload)
        setAutomations(current => current.map(automation => automation.id === editingAutomation.id ? updated.automation : automation))
        toast.success('Scenario updated')
      } else {
        const created = await pjApi.synchron8.create(payload)
        setAutomations(current => [...current, created.automation])
        toast.success('Scenario created')
      }
      closeEditor()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save automation')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (automationId: string) => {
    setDeletingId(automationId)
    try {
      await pjApi.synchron8.delete(automationId)
      setAutomations(current => current.filter(automation => automation.id !== automationId))
      if (expandedRunsAutomationId === automationId) setExpandedRunsAutomationId(null)
      toast.success('Scenario deleted')
    } catch {
      toast.error('Failed to delete automation')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTrigger = async (automation: Synchron8Automation) => {
    setRunStatuses(current => ({ ...current, [automation.id]: { automationId: automation.id, running: true } }))
    try {
      const result = await pjApi.synchron8.trigger(automation.id)
      setRunStatuses(current => ({ ...current, [automation.id]: { automationId: automation.id, running: false, lastRunId: result.runId } }))
      if (expandedRunsAutomationId === automation.id) {
        const runs = await pjApi.synchron8.listRuns(automation.id)
        setRunsByAutomation(current => ({ ...current, [automation.id]: runs.runs ?? [] }))
      }
      toast.success('Scenario triggered', { description: `Run ID: ${result.runId}` })
    } catch (error: unknown) {
      setRunStatuses(current => ({ ...current, [automation.id]: { automationId: automation.id, running: false } }))
      toast.error(error instanceof Error ? error.message : 'Trigger failed')
    }
  }

  const loadRuns = useCallback(async (automationId: string) => {
    setRunsLoadingId(automationId)
    try {
      const result = await pjApi.synchron8.listRuns(automationId)
      setRunsByAutomation(current => ({ ...current, [automationId]: result.runs ?? [] }))
    } catch {
      toast.error('Failed to load run history')
    } finally {
      setRunsLoadingId(null)
    }
  }, [])

  const toggleRuns = async (automationId: string) => {
    if (expandedRunsAutomationId === automationId) {
      setExpandedRunsAutomationId(null)
      return
    }
    setExpandedRunsAutomationId(automationId)
    if (!runsByAutomation[automationId]) {
      await loadRuns(automationId)
    }
  }

  const handleLoadEvidence = async (runId: string) => {
    if (evidenceByRun[runId]) {
      return
    }
    setEvidenceLoadingRunId(runId)
    try {
      const result = await pjApi.synchron8.getRunEvidence(runId)
      setEvidenceByRun(current => ({ ...current, [runId]: JSON.stringify(result.evidence, null, 2) }))
    } catch {
      toast.error('Failed to load run evidence')
    } finally {
      setEvidenceLoadingRunId(null)
    }
  }

  if (!envId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <Lightning size={32} weight="duotone" className="text-muted-foreground/30" />
        <div>
          <p className="text-sm font-semibold">No environment selected</p>
          <p className="mt-1 text-xs text-muted-foreground">Open a governance environment to manage SYNCHRON8 automations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Automation Studio</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Build governed scenarios with blueprints, execution history, and operator context baked into every run.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => openEditor({}, null)}>
            <Plus size={12} /> New scenario
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            { label: 'Active scenarios', value: totals.active, tone: 'text-emerald-500' },
            { label: 'Paused scenarios', value: totals.paused, tone: 'text-muted-foreground' },
            { label: 'Governed scenarios', value: totals.governed, tone: 'text-amber-500' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className={cn('text-lg font-bold', card.tone)}>{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr,2fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Blueprints</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Start from high-leverage scenarios instead of blank forms.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {AUTOMATION_BLUEPRINTS.map(blueprint => (
                <button
                  key={blueprint.id}
                  onClick={() => openEditor(blueprintToEditorState(blueprint), null)}
                  className="flex items-start gap-3 rounded-xl border border-dashed border-amber-400/40 bg-amber-500/5 px-4 py-3 text-left transition-colors hover:border-amber-400/70 hover:bg-amber-500/10"
                >
                  <Lightning size={13} weight="duotone" className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{blueprint.name}</span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {blueprint.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{blueprint.description}</p>
                  </div>
                  <ArrowRight size={12} className="ml-auto shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
                <Input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search by scenario, module, profile, or trigger..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="w-full lg:w-40">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as 'all' | 'active' | 'paused')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div className="w-full lg:w-48">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module</label>
                <select
                  value={moduleFilter}
                  onChange={event => setModuleFilter(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {moduleOptions.map(option => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All modules' : option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {visibleAutomations.length} of {automations.length} scenario{automations.length !== 1 ? 's' : ''} visible.
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {editorInitial !== null && (
          <AutomationEditor
            key={editorKey}
            initial={editorInitial}
            isEditing={!!editingAutomation}
            saving={saving}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <ArrowsClockwise size={13} className="animate-spin" /> Loading automations...
          </div>
        ) : visibleAutomations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Lightning size={36} weight="duotone" className="text-muted-foreground/20" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {automations.length === 0 ? 'No automation scenarios yet' : 'No scenarios match these filters'}
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {automations.length === 0
                  ? 'Start from a blueprint and wire a governed trigger to real operator actions.'
                  : 'Adjust search or filters to surface the scenario you want to edit.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAutomations.map(automation => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                runStatus={runStatuses[automation.id]}
                runs={runsByAutomation[automation.id]}
                runsExpanded={expandedRunsAutomationId === automation.id}
                runsLoading={runsLoadingId === automation.id}
                evidenceByRun={evidenceByRun}
                evidenceLoadingRunId={evidenceLoadingRunId}
                onEdit={() => openEditor(toEditorState(automation), automation)}
                onDelete={() => {
                  if (!deletingId) void handleDelete(automation.id)
                }}
                onTrigger={() => void handleTrigger(automation)}
                onDuplicate={() => openEditor({
                  ...toEditorState(automation),
                  name: `${automation.name} Copy`,
                }, null)}
                onToggleRuns={() => void toggleRuns(automation.id)}
                onLoadEvidence={handleLoadEvidence}
              />
            ))}
          </div>
        )}

        {automations.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <CheckCircle size={13} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>SYNCHRON8 executes these scenarios server-side, so governance actions continue even when the browser is closed.</span>
          </div>
        )}
      </div>
    </div>
  )
}
