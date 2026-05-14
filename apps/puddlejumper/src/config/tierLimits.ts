// ── Tier Limits Configuration ────────────────────────────────────
//
// Single source of truth for workspace tier limits.
// All enforcement points import from here — no magic numbers.
//

export const TIER_LIMITS = {
  free: {
    templates: -1,
    approvals: -1,
    members: -1,
    apiKey: true,
  },
  pro: {
    templates: -1,
    approvals: -1,
    members: -1,
    apiKey: true,
  },
} as const;

export type TierPlan = keyof typeof TIER_LIMITS;

export function getTierLimits(plan: string): typeof TIER_LIMITS.free | typeof TIER_LIMITS.pro {
  if (plan === "pro") return TIER_LIMITS.pro;
  return TIER_LIMITS.free;
}
