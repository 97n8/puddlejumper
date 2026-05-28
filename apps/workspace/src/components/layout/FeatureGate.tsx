import { ReactNode } from 'react'
import { Lock, ArrowUpRight } from '@phosphor-icons/react'
import { useSubscription } from '@/hooks/use-subscription'
import { MembershipFeatures, MembershipTier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FeatureGateProps {
  feature: keyof MembershipFeatures
  children: ReactNode
  fallback?: ReactNode
  showUpgrade?: boolean
  silent?: boolean
}

export function FeatureGate({ feature, children, fallback, showUpgrade = true, silent = false }: FeatureGateProps) {
  const { hasAccess, getGateLabel, getUpgradeMessage } = useSubscription()

  const hasFeatureAccess = hasAccess(feature)

  if (hasFeatureAccess) {
    return <>{children}</>
  }

  if (silent) {
    return null
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (showUpgrade) {
    const requiredTier = getGateLabel(feature)
    const message = getUpgradeMessage(String(feature))

    return (
      <Card className="p-8 text-center border-dashed">
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="text-muted-foreground" size={32} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-lg font-semibold">Feature Locked</h3>
              {requiredTier && (
                <Badge variant="secondary" className="font-semibold">
                  {requiredTier}+
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <Button className="gap-2">
            Upgrade Now
            <ArrowUpRight weight="bold" />
          </Button>
        </div>
      </Card>
    )
  }

  return null
}

interface TierBadgeProps {
  tier: MembershipTier
  className?: string
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const colors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground border-border',
    starter: 'bg-blue-500/10 text-blue-600 border-blue-200',
    pro: 'bg-primary/10 text-primary border-primary/20',
    enterprise: 'bg-purple-500/10 text-purple-600 border-purple-200',
  }

  const labels: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  return (
    <Badge variant="outline" className={cn('font-semibold uppercase text-[10px] px-2 py-0.5', colors[tier], className)}>
      {labels[tier]}
    </Badge>
  )
}

interface UsageBadgeProps {
  current: number
  max: number
  label: string
  className?: string
}

export function UsageBadge({ current, max, label, className }: UsageBadgeProps) {
  const percentage = max === -1 ? 0 : (current / max) * 100
  const isNearLimit = percentage >= 80
  const isAtLimit = percentage >= 100

  if (max === -1) {
    return (
      <Badge variant="outline" className={cn('gap-1.5', className)}>
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-semibold">{current}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">∞</span>
      </Badge>
    )
  }

  return (
    <Badge
      variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'outline'}
      className={cn('gap-1.5', className)}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{current}</span>
      <span className="text-muted-foreground">/</span>
      <span className="font-semibold">{max}</span>
    </Badge>
  )
}

interface FeatureLockOverlayProps {
  feature: keyof MembershipFeatures
  className?: string
  children: ReactNode
}

export function FeatureLockOverlay({ feature, className, children }: FeatureLockOverlayProps) {
  const { hasAccess, getGateLabel } = useSubscription()

  const hasFeatureAccess = hasAccess(feature)

  if (hasFeatureAccess) {
    return <>{children}</>
  }

  const requiredTier = getGateLabel(feature)

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none opacity-50 blur-[2px] select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border shadow-lg">
          <Lock className="text-muted-foreground" size={28} />
          <div className="text-center">
            <p className="font-semibold mb-1">Premium Feature</p>
            {requiredTier && (
              <Badge variant="secondary" className="font-semibold">
                {requiredTier}+
              </Badge>
            )}
          </div>
          <Button size="sm" className="gap-2">
            Upgrade
            <ArrowUpRight weight="bold" size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
