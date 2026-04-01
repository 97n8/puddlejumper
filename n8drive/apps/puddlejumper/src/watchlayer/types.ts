export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical'
export type AlertDomain = 'data_freshness' | 'organizational' | 'workflow' | 'financial' | 'compliance' | 'access' | 'ai_activity' | 'environment_health'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed'

export interface WatchAlert {
  id: string
  tenantId: string
  domain: AlertDomain
  severity: AlertSeverity
  status: AlertStatus
  title: string
  detail: string
  affectedObjectType: string | null  // e.g. 'prr_request', 'org_position', 'feed'
  affectedObjectId: string | null
  suggestedAction: string | null
  deduplicationKey: string  // prevents duplicate alerts for same condition
  firstOccurredAt: string
  lastOccurredAt: string
  occurenceCount: number
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionNote: string | null
  createdAt: string
}

export interface WatchRule {
  id: string
  tenantId: string
  domain: AlertDomain
  name: string
  enabled: boolean
  checkIntervalMinutes: number
  config: Record<string, unknown>  // rule-specific config stored as JSON
  lastRunAt: string | null
  lastRunStatus: 'ok' | 'error' | 'skipped' | null
  createdAt: string
}

export interface DigestSummary {
  tenantId: string
  generatedAt: string
  totalOpen: number
  bySeverity: Record<AlertSeverity, number>
  byDomain: Record<AlertDomain, number>
  oldestOpenAlert: WatchAlert | null
  recentCritical: WatchAlert[]
}
