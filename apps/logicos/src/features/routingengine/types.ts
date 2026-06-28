export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_set' | 'is_empty'
export type ActionType = 'route_to' | 'notify' | 'set_status' | 'require_approval' | 'block'

export interface RuleCondition {
  field: string
  operator: ConditionOperator
  value: string
}

export interface RuleAction {
  type: ActionType
  target: string
  params?: Record<string, string>
}

export interface RoutingRule {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  triggerDomain: string
  conditions: RuleCondition[]
  actions: RuleAction[]
  hitCount: number
  lastTriggeredAt?: string
  createdAt: string
}
