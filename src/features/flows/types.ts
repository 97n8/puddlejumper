import type { CivicFlowScenario } from '@/features/civic/api/civicApi'

export type TriggerType = 'manual' | 'vault_approved' | 'file_uploaded' | 'daily' | 'weekly' | 'civicplus_submission'

export interface ConfigField {
  key: string; label: string; placeholder: string
  required?: boolean; type?: 'text' | 'email' | 'textarea' | 'date' | 'number' | 'repo' | 'onedrive-file' | 'google-file' | 'contacts' | 'github-branch'; hint?: string
}

export type Connection = 'microsoft' | 'google' | 'github' | 'logicsuite' | 'civicplus'

export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived'
export type FlowRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'halted_for_review'
export type FrameworkId = string

export interface ScenarioLogicStep {
  id: string
  kind: 'if' | 'then'
  title: string
  detail: string
  humanReview?: boolean
}

export interface Recipe {
  id: string; name: string
  trigger: string; triggerType: TriggerType
  action: string; canRunNow: boolean
  connection?: Connection
  configFields: ConfigField[]
  run?: (cfg: Record<string, string>) => Promise<string>
}

export interface InstalledFlow {
  id: string; recipeId: string; name: string
  trigger: string; triggerType: TriggerType; action: string
  config: Record<string, string>
  connection?: Connection
  frameworkId?: FrameworkId
  frameworkLabel?: string
  frameworkChapter?: string
  logicSteps?: ScenarioLogicStep[]
  status?: FlowStatus
  backendTriggerSpec?: Record<string, unknown>
  backendScenario?: CivicFlowScenario
  enabled: boolean; installedAt: number
  lastRun?: number; lastStatus?: 'success' | 'error'; lastMessage?: string
  runCount: number; canRunNow: boolean
}
