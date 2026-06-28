interface StageRailProps {
  stage: number   // 1-based current stage
  total: number   // total stages
  size?: 'sm' | 'md'
}

/**
 * Dot-connector progress indicator for multi-stage workflows.
 *   ●——●——●——○——○   stage=3, total=5
 * Current node pulses to indicate active work.
 */
export function StageRail({ stage, total, size = 'sm' }: StageRailProps) {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const line = size === 'sm' ? 'w-3 h-px' : 'w-4 h-px'

  return (
    <>
      <style>{`
        @keyframes srPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 0 5px rgba(59,130,246,0); }
        }
        .sr-curr { animation: srPulse 2s infinite; }
      `}</style>
      <div className="flex items-center gap-0">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          const done = n < stage
          const curr = n === stage
          return (
            <div key={n} className="flex items-center">
              <div className={`${dot} rounded-full shrink-0 ${
                done ? 'bg-emerald-500' :
                curr ? 'bg-blue-500 sr-curr' :
                'bg-muted-foreground/20'
              }`} />
              {n < total && (
                <div className={`${line} shrink-0 ${done ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
