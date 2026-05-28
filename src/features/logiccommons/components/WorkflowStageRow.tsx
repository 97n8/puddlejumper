import { Check, Circle, AlertTriangle } from 'lucide-react'
import type { WorkflowStage } from '../types'

interface Props {
  stage: WorkflowStage
  currentStage: number
}

export function WorkflowStageRow({ stage }: Props) {
  const iconMap = {
    complete: <Check size={14} className="text-teal-600" />,
    active:   <Circle size={14} className="text-blue-500 fill-blue-100" />,
    pending:  <Circle size={14} className="text-muted-foreground" />,
    blocked:  <AlertTriangle size={14} className="text-amber-500" />,
  }

  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="mt-0.5 shrink-0">{iconMap[stage.status]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${
            stage.status === 'complete'
              ? 'text-muted-foreground line-through'
              : stage.status === 'active'
                ? 'text-foreground'
                : 'text-muted-foreground'
          }`}>
            {stage.label}
          </span>
          {stage.assignee && (
            <span className="text-xs text-muted-foreground">{stage.assignee}</span>
          )}
        </div>
        {stage.completed_at && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(stage.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
