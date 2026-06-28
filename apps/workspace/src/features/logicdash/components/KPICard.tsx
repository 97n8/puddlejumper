import { cn } from '@/lib/utils'
import { TrendUp, TrendDown, Minus, Seal } from '@phosphor-icons/react'

export function KPICard({
  label, value, sub, trend, trendDir, Icon, accentClass, compact = false,
}: {
  label: string
  value: string
  sub?: string
  trend?: string
  trendDir?: 'up' | 'down' | 'flat'
  Icon: React.ElementType
  accentClass?: string
  compact?: boolean
}) {
  const TrendIcon = trendDir === 'up' ? TrendUp : trendDir === 'down' ? TrendDown : Minus
  const trendColor = trendDir === 'up' ? 'text-amber-500' : trendDir === 'down' ? 'text-red-500' : 'text-slate-400'
  return (
    <div className={cn('bg-card border rounded-xl flex flex-col', compact ? 'min-h-[84px] gap-1.5 px-3 py-2.5' : 'gap-2 p-3.5')}
      role="region" aria-label={`Metric: ${label}`}>
      <div className="flex items-center justify-between">
        <span className={cn('font-semibold text-muted-foreground uppercase tracking-wide', compact ? 'text-[10px]' : 'text-xs')}>{label}</span>
        <div className={cn('rounded-lg flex items-center justify-center', compact ? 'h-7 w-7' : 'h-8 w-8', accentClass ?? 'bg-primary/10')}>
          <Icon size={compact ? 14 : 16} className="text-primary" />
        </div>
      </div>
      <div className={cn('font-bold tracking-tight leading-none', compact ? 'text-[1.15rem]' : 'text-[1.65rem]')}>{value}</div>
      {(sub || trend) && (
        <div className={cn('mt-auto', compact ? 'space-y-1' : 'flex items-center gap-2')}>
          {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
          {trend && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', !compact && 'ml-auto', trendColor)}>
              <TrendIcon size={12} weight="bold" />
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function SealBadge({ hash }: { hash: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
      <Seal size={12} className="text-emerald-600" weight="fill" />
      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 truncate max-w-[140px]">{hash}</span>
    </div>
  )
}
