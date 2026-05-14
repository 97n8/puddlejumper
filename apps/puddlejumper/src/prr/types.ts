export type PRRStatus = 'new' | 'acknowledged' | 'in_review' | 'response_ready' | 'closed' | 'denied'

export interface PRRRequest {
  id: string
  requesterName: string
  requesterEmail: string
  requestDescription: string
  status: PRRStatus
  receivedAt: string
  acknowledgedAt?: string
  closedAt?: string
  closingNotes?: string
  daysOpen: number
  slaDue: string
  slaBreached: boolean
}
