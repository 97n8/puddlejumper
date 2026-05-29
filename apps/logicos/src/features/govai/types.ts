export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-sonnet' | 'claude-haiku'
export type AIInteractionStatus = 'pending' | 'completed' | 'flagged' | 'rejected'

export interface AIInteraction {
  id: string
  model: AIModel
  prompt: string
  response: string
  status: AIInteractionStatus
  usageTokens: number
  flagReason?: string
  reviewedBy?: string
  createdAt: string
}

export interface AIUsageSummary {
  totalInteractions: number
  totalTokens: number
  flaggedCount: number
  byModel: Record<AIModel, number>
}
