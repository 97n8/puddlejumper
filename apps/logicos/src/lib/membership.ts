import { MembershipTier, MembershipFeatures, MembershipPlan, UserSubscription } from './types'

export const MEMBERSHIP_PLANS: Record<MembershipTier, MembershipPlan> = {
  pj: {
    tier: 'pj',
    name: 'PJ',
    description: 'Perfect for personal use and trying out LogicOS',
    price: 0,
    billingCycle: 'monthly',
    features: {
      maxFiles: 50,
      maxTemplates: 5,
      maxCaseSpaces: 1,
      maxAPIEndpoints: 0,
      maxAutomations: 2,
      maxConcurrentAutomations: 1,
      maxFileSize: 10 * 1024 * 1024,
      maxUsers: 1,
      
      logicDocsEnabled: true,
      docDumpEnabled: true,
      logicCommonsEnabled: true,
      caseSpacesEnabled: false,
      automationsEnabled: true,
      logicBackendEnabled: false,
      
      m365Integration: false,
      googleIntegration: false,
      githubIntegration: false,
      webhookIntegration: false,
      customDomain: false,
      apiAccess: false,
      advancedAnalytics: false,
      prioritySupport: false,
      auditLogs: false,
      dataEncryption: false,
      ssoEnabled: false,
      advancedAutomations: false,
      aiFeatures: false,
      whiteLabel: false,
    },
  },
  pj_plus: {
    tier: 'pj_plus',
    name: 'PJ+',
    description: 'For individuals and small teams starting to build workflows',
    price: 12,
    billingCycle: 'monthly',
    features: {
      maxFiles: 500,
      maxTemplates: 25,
      maxCaseSpaces: 5,
      maxAPIEndpoints: 10,
      maxAutomations: 10,
      maxConcurrentAutomations: 3,
      maxFileSize: 50 * 1024 * 1024,
      maxUsers: 3,
      
      logicDocsEnabled: true,
      docDumpEnabled: true,
      logicCommonsEnabled: true,
      caseSpacesEnabled: true,
      automationsEnabled: true,
      logicBackendEnabled: true,
      
      m365Integration: true,
      googleIntegration: true,
      githubIntegration: true,
      webhookIntegration: false,
      customDomain: false,
      apiAccess: true,
      advancedAnalytics: false,
      prioritySupport: false,
      auditLogs: false,
      dataEncryption: false,
      ssoEnabled: false,
      advancedAutomations: false,
      aiFeatures: false,
      whiteLabel: false,
    },
  },
  pj_pro: {
    tier: 'pj_pro',
    name: 'PJ Pro',
    description: 'For growing teams with advanced automation and unlimited scale',
    price: 39,
    billingCycle: 'monthly',
    features: {
      maxFiles: -1,
      maxTemplates: -1,
      maxCaseSpaces: -1,
      maxAPIEndpoints: -1,
      maxAutomations: -1,
      maxConcurrentAutomations: -1,
      maxFileSize: 500 * 1024 * 1024,
      maxUsers: -1,
      
      logicDocsEnabled: true,
      docDumpEnabled: true,
      logicCommonsEnabled: true,
      caseSpacesEnabled: true,
      automationsEnabled: true,
      logicBackendEnabled: true,
      
      m365Integration: true,
      googleIntegration: true,
      githubIntegration: true,
      webhookIntegration: true,
      customDomain: true,
      apiAccess: true,
      advancedAnalytics: true,
      prioritySupport: true,
      auditLogs: true,
      dataEncryption: true,
      ssoEnabled: true,
      advancedAutomations: true,
      aiFeatures: true,
      whiteLabel: true,
    },
  },
}

export function getMembershipFeatures(subscription: UserSubscription): MembershipFeatures {
  const basePlan = MEMBERSHIP_PLANS[subscription.tier]
  
  if (subscription.customFeatureOverrides) {
    return {
      ...basePlan.features,
      ...subscription.customFeatureOverrides,
    }
  }
  
  return basePlan.features
}

export function hasFeatureAccess(
  subscription: UserSubscription,
  feature: keyof MembershipFeatures
): boolean {
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false
  }
  
  const features = getMembershipFeatures(subscription)
  return Boolean(features[feature])
}

export function canAddMore(
  subscription: UserSubscription,
  feature: 'files' | 'templates' | 'caseSpaces' | 'apiEndpoints' | 'automations' | 'users',
  currentCount: number
): boolean {
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false
  }
  
  const features = getMembershipFeatures(subscription)
  const limits: Record<typeof feature, number> = {
    files: features.maxFiles,
    templates: features.maxTemplates,
    caseSpaces: features.maxCaseSpaces,
    apiEndpoints: features.maxAPIEndpoints,
    automations: features.maxAutomations,
    users: features.maxUsers,
  }
  
  const limit = limits[feature]
  
  if (limit === -1) return true
  
  return currentCount < limit
}

export function getUsagePercentage(
  subscription: UserSubscription,
  feature: 'files' | 'templates' | 'caseSpaces' | 'apiEndpoints' | 'automations' | 'users',
  currentCount: number
): number {
  const features = getMembershipFeatures(subscription)
  const limits: Record<typeof feature, number> = {
    files: features.maxFiles,
    templates: features.maxTemplates,
    caseSpaces: features.maxCaseSpaces,
    apiEndpoints: features.maxAPIEndpoints,
    automations: features.maxAutomations,
    users: features.maxUsers,
  }
  
  const limit = limits[feature]
  
  if (limit === -1) return 0
  
  return Math.min(100, (currentCount / limit) * 100)
}

export function getUpgradePromptMessage(
  subscription: UserSubscription,
  feature: string
): string {
  const tierNames: Record<MembershipTier, string> = {
    pj: 'PJ',
    pj_plus: 'PJ+',
    pj_pro: 'PJ Pro',
  }
  
  const tierOrder: MembershipTier[] = ['pj', 'pj_plus', 'pj_pro']
  const currentIndex = tierOrder.indexOf(subscription.tier)
  
  if (currentIndex === tierOrder.length - 1) {
    return `This feature requires custom configuration. Contact support.`
  }
  
  const nextTier = tierOrder[currentIndex + 1]
  return `Upgrade to ${tierNames[nextTier]} to unlock ${feature}`
}

export function getTierPriority(tier: MembershipTier): number {
  const priority: Record<MembershipTier, number> = {
    pj: 0,
    pj_plus: 1,
    pj_pro: 2,
  }
  return priority[tier]
}

export function canAccessTier(userTier: MembershipTier, requiredTier: MembershipTier): boolean {
  return getTierPriority(userTier) >= getTierPriority(requiredTier)
}

export function getFeatureGateLabel(
  subscription: UserSubscription,
  feature: keyof MembershipFeatures
): string | null {
  if (hasFeatureAccess(subscription, feature)) {
    return null
  }
  
  const tierNames: Record<MembershipTier, string> = {
    pj: 'PJ',
    pj_plus: 'PJ+',
    pj_pro: 'PJ Pro',
  }
  
  const tierOrder: MembershipTier[] = ['pj', 'pj_plus', 'pj_pro']
  
  for (const tier of tierOrder) {
    const plan = MEMBERSHIP_PLANS[tier]
    if (plan.features[feature]) {
      return tierNames[tier]
    }
  }
  
  return 'Enterprise'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes === -1) return 'Unlimited'
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

export function formatLimit(limit: number): string {
  if (limit === -1) return 'Unlimited'
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`
  return limit.toString()
}

export function getTierBadgeColor(tier: MembershipTier): string {
  const colors: Record<MembershipTier, string> = {
    pj: 'bg-muted text-muted-foreground',
    pj_plus: 'bg-blue-500/10 text-blue-600 border-blue-200',
    pj_pro: 'bg-primary/10 text-primary border-primary/20',
  }
  return colors[tier]
}

export const MEMBERSHIP_PLANS_ARRAY = [
  MEMBERSHIP_PLANS.pj,
  MEMBERSHIP_PLANS.pj_plus,
  MEMBERSHIP_PLANS.pj_pro,
]
