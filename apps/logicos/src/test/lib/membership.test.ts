import { describe, it, expect } from 'vitest'
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLANS_ARRAY,
  getMembershipFeatures,
  hasFeatureAccess,
  canAddMore,
  getUsagePercentage,
  getUpgradePromptMessage,
  getTierPriority,
  canAccessTier,
  getFeatureGateLabel,
  formatFileSize,
  formatLimit,
  getTierBadgeColor,
} from '@/lib/membership'
import type { UserSubscription } from '@/lib/types'

const activeSub = (tier: UserSubscription['tier']): UserSubscription => ({
  tier,
  status: 'active',
  startDate: Date.now(),
  billingCycle: 'monthly',
  autoRenew: true,
  enabledAutomations: [],
})

const trialSub = (tier: UserSubscription['tier']): UserSubscription => ({
  tier,
  status: 'trial',
  startDate: Date.now(),
  billingCycle: 'monthly',
  autoRenew: false,
  enabledAutomations: [],
})

const expiredSub = (tier: UserSubscription['tier']): UserSubscription => ({
  tier,
  status: 'expired',
  startDate: Date.now(),
  billingCycle: 'monthly',
  autoRenew: false,
  enabledAutomations: [],
})

describe('MEMBERSHIP_PLANS', () => {
  it('defines pj, pj_plus, pj_pro tiers', () => {
    expect(MEMBERSHIP_PLANS.pj.tier).toBe('pj')
    expect(MEMBERSHIP_PLANS.pj_plus.tier).toBe('pj_plus')
    expect(MEMBERSHIP_PLANS.pj_pro.tier).toBe('pj_pro')
  })

  it('pj is free', () => {
    expect(MEMBERSHIP_PLANS.pj.price).toBe(0)
  })

  it('pj_pro has unlimited files (-1)', () => {
    expect(MEMBERSHIP_PLANS.pj_pro.features.maxFiles).toBe(-1)
  })

  it('pj has limited files', () => {
    expect(MEMBERSHIP_PLANS.pj.features.maxFiles).toBe(50)
  })

  it('MEMBERSHIP_PLANS_ARRAY has 3 entries', () => {
    expect(MEMBERSHIP_PLANS_ARRAY).toHaveLength(3)
  })
})

describe('getMembershipFeatures', () => {
  it('returns base plan features for active sub', () => {
    const features = getMembershipFeatures(activeSub('pj'))
    expect(features.maxFiles).toBe(50)
    expect(features.logicDocsEnabled).toBe(true)
  })

  it('merges custom overrides', () => {
    const sub: UserSubscription = {
      ...activeSub('pj'),
      customFeatureOverrides: { maxFiles: 999 },
    }
    const features = getMembershipFeatures(sub)
    expect(features.maxFiles).toBe(999)
    expect(features.logicDocsEnabled).toBe(true) // preserved from base
  })

  it('pj_pro features include advancedAnalytics', () => {
    const features = getMembershipFeatures(activeSub('pj_pro'))
    expect(features.advancedAnalytics).toBe(true)
  })
})

describe('hasFeatureAccess', () => {
  it('returns true for active sub with supported feature', () => {
    expect(hasFeatureAccess(activeSub('pj_pro'), 'advancedAnalytics')).toBe(true)
  })

  it('returns false for active pj sub without caseSpaces', () => {
    expect(hasFeatureAccess(activeSub('pj'), 'caseSpacesEnabled')).toBe(false)
  })

  it('returns true for trial sub', () => {
    expect(hasFeatureAccess(trialSub('pj_plus'), 'm365Integration')).toBe(true)
  })

  it('returns false for expired sub regardless of tier', () => {
    expect(hasFeatureAccess(expiredSub('pj_pro'), 'advancedAnalytics')).toBe(false)
  })
})

describe('canAddMore', () => {
  it('allows adding when under limit', () => {
    expect(canAddMore(activeSub('pj'), 'files', 10)).toBe(true)
  })

  it('blocks adding when at limit', () => {
    expect(canAddMore(activeSub('pj'), 'files', 50)).toBe(false)
  })

  it('always allows adding for unlimited tier (-1)', () => {
    expect(canAddMore(activeSub('pj_pro'), 'files', 99999)).toBe(true)
  })

  it('blocks adding for expired sub', () => {
    expect(canAddMore(expiredSub('pj_pro'), 'files', 0)).toBe(false)
  })

  it('blocks adding for cancelled sub', () => {
    const cancelled: UserSubscription = {
      ...activeSub('pj_pro'),
      status: 'cancelled',
    }
    expect(canAddMore(cancelled, 'files', 0)).toBe(false)
  })
})

describe('getUsagePercentage', () => {
  it('returns 0% for unlimited', () => {
    expect(getUsagePercentage(activeSub('pj_pro'), 'files', 9999)).toBe(0)
  })

  it('returns 50% at half limit', () => {
    expect(getUsagePercentage(activeSub('pj'), 'files', 25)).toBe(50)
  })

  it('caps at 100% when over limit', () => {
    expect(getUsagePercentage(activeSub('pj'), 'files', 100)).toBe(100)
  })

  it('returns 0% when no usage', () => {
    expect(getUsagePercentage(activeSub('pj'), 'files', 0)).toBe(0)
  })
})

describe('getTierPriority', () => {
  it('pj has lowest priority (0)', () => expect(getTierPriority('pj')).toBe(0))
  it('pj_plus has priority 1', () => expect(getTierPriority('pj_plus')).toBe(1))
  it('pj_pro has highest priority (2)', () => expect(getTierPriority('pj_pro')).toBe(2))
})

describe('canAccessTier', () => {
  it('pj_pro can access pj tier', () => expect(canAccessTier('pj_pro', 'pj')).toBe(true))
  it('pj_pro can access its own tier', () => expect(canAccessTier('pj_pro', 'pj_pro')).toBe(true))
  it('pj cannot access pj_plus tier', () => expect(canAccessTier('pj', 'pj_plus')).toBe(false))
  it('pj cannot access pj_pro tier', () => expect(canAccessTier('pj', 'pj_pro')).toBe(false))
})

describe('getUpgradePromptMessage', () => {
  it('suggests pj_plus when on pj', () => {
    const msg = getUpgradePromptMessage(activeSub('pj'), 'case spaces')
    expect(msg).toContain('PJ+')
    expect(msg).toContain('case spaces')
  })

  it('suggests pj_pro when on pj_plus', () => {
    const msg = getUpgradePromptMessage(activeSub('pj_plus'), 'SSO')
    expect(msg).toContain('PJ Pro')
  })

  it('suggests contact support when already on pj_pro', () => {
    const msg = getUpgradePromptMessage(activeSub('pj_pro'), 'custom feature')
    expect(msg).toContain('Contact support')
  })
})

describe('getFeatureGateLabel', () => {
  it('returns null when user has access', () => {
    expect(getFeatureGateLabel(activeSub('pj_pro'), 'advancedAnalytics')).toBeNull()
  })

  it('returns tier name needed when user lacks access', () => {
    const label = getFeatureGateLabel(activeSub('pj'), 'caseSpacesEnabled')
    expect(label).toBe('PJ+')
  })

  it('returns PJ Pro label for pro-only features', () => {
    const label = getFeatureGateLabel(activeSub('pj'), 'advancedAnalytics')
    expect(label).toBe('PJ Pro')
  })
})

describe('formatFileSize (membership)', () => {
  it('returns 0 B for 0', () => expect(formatFileSize(0)).toBe('0 B'))
  it('returns Unlimited for -1', () => expect(formatFileSize(-1)).toBe('Unlimited'))
  it('formats bytes', () => expect(formatFileSize(512)).toBe('512.0 B'))
  it('formats MB', () => expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB'))
})

describe('formatLimit', () => {
  it('returns Unlimited for -1', () => expect(formatLimit(-1)).toBe('Unlimited'))
  it('returns string for normal number', () => expect(formatLimit(50)).toBe('50'))
  it('formats thousands as K', () => expect(formatLimit(1000)).toBe('1K'))
  it('formats large number', () => expect(formatLimit(5000)).toBe('5K'))
})

describe('getTierBadgeColor', () => {
  it('returns a CSS string for each tier', () => {
    expect(getTierBadgeColor('pj')).toBeTruthy()
    expect(getTierBadgeColor('pj_plus')).toBeTruthy()
    expect(getTierBadgeColor('pj_pro')).toBeTruthy()
  })

  it('different tiers have different colors', () => {
    expect(getTierBadgeColor('pj')).not.toBe(getTierBadgeColor('pj_pro'))
  })
})
