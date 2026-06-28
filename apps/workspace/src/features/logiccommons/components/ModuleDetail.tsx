import { useIntakeRecord } from '../hooks/useIntakeRecord'
import { useModuleInstance } from '../hooks/useModuleInstance'
import { useOutputs } from '../hooks/useOutputs'
import { usePlacements } from '../hooks/usePlacements'
import { useWorkflow } from '../hooks/useWorkflow'
import { PipelineStageTracker } from './PipelineStageTracker'
import { WorkflowStageRow } from './WorkflowStageRow'
import { OutputBundleCard } from './OutputBundleCard'
import { ArrowLeft } from 'lucide-react'
// WorkflowStage used in JSX below via s.status only — no type import needed

interface Props {
  recordId: string
  displayName: string
  onBack: () => void
}

export function ModuleDetail({ recordId, displayName, onBack }: Props) {
  const recordState = useIntakeRecord(recordId)
  const { data: instance, isLoading: iLoading } = useModuleInstance(recordId)
  const { data: outputs } = useOutputs(instance?.id)
  const { data: placements } = usePlacements(instance?.id)
  const { advance, isLoading: advancing } = useWorkflow(instance?.id)

  if (recordState.status === 'loading' || (recordState.status === 'ok' && iLoading)) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  if (recordState.status === 'unauthenticated') {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
        <p className="text-sm font-semibold">Authentication required</p>
        <p className="text-xs text-muted-foreground">{recordState.message}</p>
        <button onClick={onBack} className="text-xs text-primary hover:underline">
          ← Back to {displayName}
        </button>
      </div>
    )
  }

  if (recordState.status === 'unauthorized') {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
        <p className="text-sm font-semibold">Access denied</p>
        <p className="text-xs text-muted-foreground">{recordState.message}</p>
        <button onClick={onBack} className="text-xs text-primary hover:underline">
          ← Back to {displayName}
        </button>
      </div>
    )
  }

  if (recordState.status === 'load_error') {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
        <p className="text-sm font-semibold">Couldn&apos;t load record</p>
        <p className="text-xs text-muted-foreground">{recordState.message}</p>
        <div className="flex items-center gap-3">
          <button onClick={() => void recordState.retry()} className="text-xs text-primary hover:underline">
            Retry
          </button>
          <button onClick={onBack} className="text-xs text-primary hover:underline">
            ← Back to {displayName}
          </button>
        </div>
      </div>
    )
  }

  if (recordState.status === 'not_found') {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
        <p className="text-sm font-semibold">Record not found</p>
        <button onClick={onBack} className="text-xs text-primary hover:underline">
          ← Back to {displayName}
        </button>
      </div>
    )
  }

  const record = recordState.record

  return (
    <div className="flex flex-col h-full">
      {/* Subheader */}
      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          {displayName}
        </button>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-xs font-mono text-muted-foreground truncate">{recordId.slice(-12)}</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full capitalize
          ${record.status === 'open' ? 'bg-slate-100 text-slate-700' :
            record.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
            'bg-green-50 text-green-700'}`}>
          {record.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline</h3>
            <PipelineStageTracker currentStage={record.pipeline_stage} />
          </div>

          {instance && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Workflow</h3>
              <div className="rounded-lg border bg-card/50 p-4 space-y-1">
                {instance.workflow_stages.map((stage: import("../types").WorkflowStage) => (
                  <WorkflowStageRow key={stage.id} stage={stage} currentStage={instance.current_step} />
                ))}
              </div>
              {instance.can_advance && (
                <button
                  onClick={() => advance()}
                  disabled={advancing}
                  className="mt-3 text-xs font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {advancing ? 'Advancing…' : 'Advance to next stage'}
                </button>
              )}
            </div>
          )}

          {outputs && outputs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Output Bundle</h3>
              <div className="space-y-2">
                {outputs.map((artifact: import("../types").Artifact) => {
                  const placement = placements?.find((p: import("../types").PlacementConfirmation) => p.artifact_id === artifact.id)
                  return <OutputBundleCard key={artifact.id} artifact={artifact} placement={placement} />
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Record Details</h3>
            <dl className="text-sm space-y-1.5">
              {record.requester_name && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-24 shrink-0 text-xs">Requester</dt>
                  <dd className="text-xs font-medium">{record.requester_name}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0 text-xs">Received</dt>
                <dd className="text-xs">{new Date(record.created_at).toLocaleDateString()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0 text-xs">Channel</dt>
                <dd className="text-xs capitalize">{record.intake_channel?.replace(/_/g, ' ') ?? '—'}</dd>
              </div>
              {record.sla_due_at && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-24 shrink-0 text-xs">SLA Due</dt>
                  <dd className={`text-xs ${new Date(record.sla_due_at) < new Date() ? 'text-red-600 font-semibold' : ''}`}>
                    {new Date(record.sla_due_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0 text-xs">Status</dt>
                <dd className="text-xs capitalize">{record.status.replace(/_/g, ' ')}</dd>
              </div>
            </dl>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-xs leading-relaxed">{record.request_description}</p>
            </div>
          </div>

          {/* Workflow audit trail */}
          {instance && (
            <div className="rounded-lg border bg-card/50 p-4">
              <h3 className="text-sm font-semibold mb-2">Activity</h3>
              <div className="space-y-2">
                {[...instance.workflow_stages]
                  .filter(s => s.status === 'complete' || s.status === 'active')
                  .map((s) => (
                    <div key={s.id} className="flex gap-2 text-xs">
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${s.status === 'active' ? 'bg-primary' : 'bg-green-500'}`} />
                      <div>
                        <span className="font-medium">{s.label}</span>
                        {s.completed_at && (
                          <span className="text-muted-foreground ml-1">
                            — {new Date(s.completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {s.status === 'active' && (
                          <span className="text-primary ml-1 font-medium">← current</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
