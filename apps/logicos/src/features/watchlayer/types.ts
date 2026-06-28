export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical'
export type AlertDomain = 'data_freshness' | 'organizational' | 'workflow' | 'financial' | 'compliance' | 'access' | 'ai_activity' | 'environment_health'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed'

export interface WatchAlert {
  id: string
  domain: AlertDomain
  severity: AlertSeverity
  status: AlertStatus
  title: string
  detail: string
  affectedObjectType: string | null
  affectedObjectId: string | null
  suggestedAction: string | null
  firstOccurredAt: string
  lastOccurredAt: string
  occurenceCount: number
  resolvedAt: string | null
}

export interface DigestSummary {
  totalOpen: number
  bySeverity: Record<AlertSeverity, number>
  byDomain: Record<AlertDomain, number>
  generatedAt: string
  recentCritical: WatchAlert[]
}
