import { useIntakeRecord } from '../../hooks/useIntakeRecord'
import { useModuleInstance } from '../../hooks/useModuleInstance'
import { useOutputs } from '../../hooks/useOutputs'
import { usePlacements } from '../../hooks/usePlacements'
import { useWorkflow } from '../../hooks/useWorkflow'
import { PipelineStageTracker } from '../../components/PipelineStageTracker'
import { WorkflowStageRow } from '../../components/WorkflowStageRow'
import { OutputBundleCard } from '../../components/OutputBundleCard'
import type { WorkflowStage } from '../../types'

interface Props {
  recordId: string
}

export function PRRDetail({ recordId }: Props) {
  const recordState = useIntakeRecord(recordId)
  const { data: instance, isLoading: iLoading } = useModuleInstance(recordId)
  const { data: outputs } = useOutputs(instance?.id)
  const { data: placements } = usePlacements(instance?.id)
  const { advance, isLoading: advancing } = useWorkflow(instance?.id)

  if (recordState.status === 'loading' || (recordState.status === 'ok' && iLoading)) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  }
  if (recordState.status === 'unauthenticated') {
    return <div className="p-6 text-sm text-muted-foreground">Authentication required. {recordState.message}</div>
  }
  if (recordState.status === 'unauthorized') {
    return <div className="p-6 text-sm text-muted-foreground">Access denied. {recordState.message}</div>
  }
  if (recordState.status === 'load_error') {
    return (
      <div className="p-6 text-sm text-muted-foreground space-y-2">
        <p>Couldn&apos;t load record. {recordState.message}</p>
        <button
          type="button"
          onClick={() => void recordState.retry()}
          className="text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }
  if (recordState.status === 'not_found') {
    return <div className="p-6 text-sm text-muted-foreground">Record not found.</div>
  }

  const record = recordState.record

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Left column */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Pipeline</h3>
          <PipelineStageTracker currentStage={record.pipeline_stage} />
        </div>

        {instance && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Workflow</h3>
            <div className="rounded-lg border bg-card/50 p-4 space-y-1">
              {instance.workflow_stages.map((stage: import("../../types").WorkflowStage) => (
                <WorkflowStageRow key={stage.id} stage={stage} currentStage={instance.current_step} />
              ))}
            </div>
            {instance.can_advance && (
              <button
                onClick={() => advance()}
                disabled={advancing}
                className="mt-3 text-xs font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {advancing ? 'Advancing...' : 'Advance to next stage'}
              </button>
            )}
          </div>
        )}

        {outputs && outputs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Output Bundle</h3>
            <div className="space-y-2">
              {outputs.map((artifact: import("../../types").Artifact) => {
                const placement = placements?.find((p: import("../../types").PlacementConfirmation) => p.artifact_id === artifact.id)
                return <OutputBundleCard key={artifact.id} artifact={artifact} placement={placement} />
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="rounded-lg border bg-card/50 p-4 space-y-2">
          <h3 className="text-sm font-semibold">Record Details</h3>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Requester</dt>
              <dd className="font-medium">{record.requester_name ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Received</dt>
              <dd>{new Date(record.created_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Channel</dt>
              <dd className="capitalize">{record.intake_channel?.replace(/_/g, ' ') ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Department</dt>
              <dd>{record.department_id ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">SLA Due</dt>
              <dd className={record.sla_due_at && new Date(record.sla_due_at) < new Date() ? 'text-red-600 font-semibold' : ''}>
                {record.sla_due_at ? new Date(record.sla_due_at).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Status</dt>
              <dd className="capitalize">{record.status.replace(/_/g, ' ')}</dd>
            </div>
          </dl>
          <div className="pt-2 border-t">
            <dt className="text-xs text-muted-foreground mb-1">Request description</dt>
            <dd className="text-sm">{record.request_description}</dd>
          </div>
        </div>

        <div className="rounded-lg border bg-card/50 p-4">
          <h3 className="text-sm font-semibold mb-2">Activity Trail</h3>
          <div className="space-y-2">
            <div className="text-xs">
              <span className="text-muted-foreground">{new Date(record.created_at).toLocaleString()}</span>
              <p className="text-foreground">Request received via {record.intake_channel === 'manual' ? 'in-person' : record.intake_channel}</p>
            </div>
            {instance?.workflow_stages
              .filter((s: WorkflowStage) => s.status === 'complete' && s.completed_at)
              .map((s: WorkflowStage) => (
                <div key={s.id} className="text-xs">
                  <span className="text-muted-foreground">{new Date(s.completed_at!).toLocaleString()}</span>
                  <p className="text-foreground">{s.label} completed{s.assignee ? ` — ${s.assignee}` : ''}</p>
                </div>
              ))}
            {record.updated_at && record.updated_at !== record.created_at && (
              <div className="text-xs">
                <span className="text-muted-foreground">{new Date(record.updated_at).toLocaleString()}</span>
                <p className="text-foreground">Record last updated</p>
              </div>
            )}
            {record.closed_at && (
              <div className="text-xs">
                <span className="text-muted-foreground">{new Date(record.closed_at).toLocaleString()}</span>
                <p className="text-foreground font-medium text-green-700">Request closed</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
