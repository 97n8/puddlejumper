import { Check, AlertTriangle } from 'lucide-react'

const DEFAULT_STAGE_LABELS = [
  'Context', 'Intake', 'Access', 'Evidence', 'Normalize',
  'FORMKEY', 'Module', 'Workflow', 'SEAL', 'Outputs',
  'Delivery', 'Placement', 'Reconcile', 'Closeout',
]

interface Props {
  currentStage: number
  blockedStages?: number[]
  stageLabels?: string[]
}

export function PipelineStageTracker({ currentStage, blockedStages = [], stageLabels = DEFAULT_STAGE_LABELS }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max py-2">
        {Array.from({ length: 14 }, (_, i) => {
          const stageNum = i + 1
          const isComplete = currentStage > 0 && stageNum < currentStage
          const isActive = currentStage > 0 && stageNum === currentStage
          const isBlocked = blockedStages.includes(stageNum)
          const label = stageLabels[i] ?? `Stage ${stageNum}`

          return (
            <div key={stageNum} className="flex items-center">
              <div
                title={label}
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-default select-none',
                  isBlocked
                    ? 'bg-amber-400 text-white'
                    : isComplete
                      ? 'bg-teal-600 text-white'
                      : isActive
                        ? 'bg-teal-600 text-white ring-2 ring-teal-400 ring-offset-1 animate-pulse'
                        : 'border-2 border-muted bg-background text-muted-foreground',
                ].join(' ')}
              >
                {isBlocked ? (
                  <AlertTriangle size={12} />
                ) : isComplete ? (
                  <Check size={12} />
                ) : (
                  stageNum
                )}
              </div>
              {stageNum < 14 && (
                <div className={`w-3 h-px mx-0.5 ${isComplete ? 'bg-teal-600' : 'bg-muted'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
