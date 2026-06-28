export interface CommonsAlert {
  id: string
  domain: 'data_freshness' | 'organizational' | 'workflow' | 'financial' | 'compliance' | 'access' | 'ai_activity' | 'environment_health'
  severity: 'info' | 'warning' | 'high' | 'critical'
  title: string
  detail: string
  affected_object_type: string
  affected_object_id: string
  suggested_action: string
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  created_at: string
  owner_id: string | null
}

export interface MunicipalityContext {
  tenant_id: string
  environment_id: string
  municipality_name: string
  fiscal_year_start: number
  org_chart: {
    departments: Department[]
    positions: Position[]
  }
  active_connectors: string[]
  output_destinations: Record<string, string[]>
}

export interface Department {
  id: string
  name: string
  head_position_id: string
}

export interface Position {
  id: string
  title: string
  authority_level: number
  is_vacant: boolean
}

export interface PRRRecord {
  id: string
  requester_name: string | null
  requester_email: string | null
  request_description: string
  pipeline_stage: number
  status: 'open' | 'in_progress' | 'closed'
  sla_due_at: string | null
  intake_channel: string
  department_id: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  // Joined from module_instances
  instance_id: string | null
  current_step: number | null
  workflow_stages: string | null // JSON string from JOIN
}

export interface ModuleInstance {
  id: string
  record_id: string
  module_key: string
  current_step: number
  workflow_stages: WorkflowStage[]
  role_assignments: Record<string, string>
  stop_rules: StopRule[]
  can_advance: boolean
  blocking_fields: string[]
}

export interface WorkflowStage {
  id: string
  order: number
  label: string
  status: 'complete' | 'active' | 'pending' | 'blocked'
  completed_at?: string
  assignee?: string
}

export interface StopRule {
  field: string
  met: boolean
}

export interface Artifact {
  id: string
  artifact_type: string
  output_format: 'html' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'json' | 'zip'
  artifact_hash: string
  rendered_at: string
}

export interface PlacementConfirmation {
  id: string
  artifact_id: string
  destination_type: 'civicplus' | 'm365' | 'google' | 'logicdocs' | 'email' | 'download'
  destination_object_id?: string
  destination_url?: string
  placed_at?: string
  confirmed_at?: string
  confirmation_status: 'pending' | 'confirmed' | 'failed' | 'misplaced'
}
