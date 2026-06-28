import { cn } from '@/lib/utils'
import type { RiskFlag, Severity } from '../types'
import { SEV_CFG } from '../utils'

export function RiskFlagsTab({ flags }: { flags: RiskFlag[] }) {
  const ordered = [...flags].sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2, passing: 3 }
    return order[a.severity] - order[b.severity]
  })
  const counts = { critical: 0, warning: 0, info: 0, passing: 0 } as Record<Severity, number>
  flags.forEach(f => counts[f.severity]++)

  return (
    <div className="p-5 space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(counts) as [Severity, number][]).map(([sev, n]) => {
          const cfg = SEV_CFG[sev]
          return (
            <div key={sev} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold', cfg.bg, cfg.border, cfg.color)}>
              <cfg.Icon size={13} weight="bold" />
              {n} {cfg.label}
            </div>
          )
        })}
      </div>

      {/* Flag cards */}
      <div className="space-y-2">
        {ordered.map(flag => {
          const cfg = SEV_CFG[flag.severity]
          return (
            <div key={flag.flag} className={cn('flex items-start gap-3 p-4 rounded-xl border', cfg.bg, cfg.border)}>
              <cfg.Icon size={18} className={cn('shrink-0 mt-0.5', cfg.color)} weight="fill" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm font-bold', cfg.color)}>{flag.flag}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-semibold', cfg.bg, cfg.color, 'border', cfg.border)}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-1 leading-relaxed">{flag.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Metric: <code className="font-mono bg-background px-1 rounded">{flag.metric}</code></span>
                  <span>Value: <strong className="text-foreground">{flag.value ?? 'not reported'}</strong></span>
                  <span>Threshold: <strong className="text-foreground">{flag.threshold ?? 'framework pattern'}</strong></span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
