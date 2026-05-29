export type ProcurementStatus = 'draft' | 'advertised' | 'bid_open' | 'awarded' | 'closed' | 'cancelled'
export type ProcurementMethod = 'ifw' | 'rfp' | 'rfq' | 'sole_source' | 'emergency' | 'cooperative'

export interface ProcurementItem {
  id: string
  title: string
  description: string
  estimatedValue: number
  method: ProcurementMethod
  status: ProcurementStatus
  departmentId: string
  departmentName: string
  advertisedAt?: string
  bidOpenAt?: string
  awardedAt?: string
  awardedTo?: string
  awardedAmount?: number
  mglCompliant: boolean
  notes?: string
  createdAt: string
}
