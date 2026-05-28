export interface PRRRequest {
  id: string
  caseNumber: string
  requesterName: string
  requesterEmail: string
  description: string
  status: 'new' | 'acknowledged' | 'in_review' | 'response_ready' | 'closed' | 'denied'
  createdAt: string
  acknowledgedAt: string | null
  dueAt: string | null
  daysSinceCreation: number
  isSlaBreached: boolean
}
