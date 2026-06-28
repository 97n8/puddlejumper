import { useKV } from '@/hooks/useKV'
import { UserSubscription, MembershipFeatures, MembershipTier } from '@/lib/types'
import {
  getMembershipFeatures,
  hasFeatureAccess,
  canAddMore,
  getUsagePercentage,
  getUpgradePromptMessage,
  getFeatureGateLabel,
  canAccessTier,
} from '@/lib/membership'

export function useSubscription() {
  const [subscription, setSubscription] = useKV<UserSubscription>('logicworkspace-subscription', {
    tier: 'pj',
    startDate: Date.now(),
    status: 'active',
    billingCycle: 'monthly',
    autoRenew: false,
    enabledAutomations: [],
  })

  const currentSubscription = subscription || {
    tier: 'pj' as const,
    startDate: Date.now(),
    status: 'active' as const,
    billingCycle: 'monthly' as const,
    autoRenew: false,
    enabledAutomations: [],
  }

  const features = getMembershipFeatures(currentSubscription)

  const hasAccess = (feature: keyof MembershipFeatures) => {
    return hasFeatureAccess(currentSubscription, feature)
  }

  const canAdd = (
    feature: 'files' | 'templates' | 'caseSpaces' | 'apiEndpoints' | 'automations' | 'users',
    currentCount: number
  ) => {
    return canAddMore(currentSubscription, feature, currentCount)
  }

  const getUsage = (
    feature: 'files' | 'templates' | 'caseSpaces' | 'apiEndpoints' | 'automations' | 'users',
    currentCount: number
  ) => {
    return getUsagePercentage(currentSubscription, feature, currentCount)
  }

  const getUpgradeMessage = (feature: string) => {
    return getUpgradePromptMessage(currentSubscription, feature)
  }

  const getGateLabel = (feature: keyof MembershipFeatures) => {
    return getFeatureGateLabel(currentSubscription, feature)
  }

  const hasAccessToTier = (requiredTier: MembershipTier) => {
    return canAccessTier(currentSubscription.tier, requiredTier)
  }

  return {
    subscription: currentSubscription,
    setSubscription,
    features,
    hasAccess,
    canAdd,
    getUsage,
    getUpgradeMessage,
    getGateLabel,
    hasAccessToTier,
  }
}
