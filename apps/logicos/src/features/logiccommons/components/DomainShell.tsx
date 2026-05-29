import { PipelineStageTracker } from './PipelineStageTracker'

interface DomainShellProps {
  moduleKey: string
  displayName: string
  primaryStatute: string
  workflowStageCount: number
}

export function DomainShell({ moduleKey, displayName, primaryStatute, workflowStageCount }: DomainShellProps) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{displayName}</h2>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5">{moduleKey}</span>
            <span className="text-xs text-muted-foreground">{primaryStatute}</span>
          </div>
        </div>
        <span className="text-xs font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 shrink-0">
          Backend pending
        </span>
      </div>

      <PipelineStageTracker currentStage={0} />

      <div className="rounded-lg border bg-card/50 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">{workflowStageCount}-stage governed workflow</p>
        <p>
          This domain is defined in the module registry and governed by {primaryStatute}.
          Live data activates when PuddleJumper /api/v1/commons/* routes ship for this module key.
        </p>
      </div>
    </div>
  )
}
