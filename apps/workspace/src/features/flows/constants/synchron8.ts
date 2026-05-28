// SYNCHRON8 governance automation constants
// Mirrors vault-demo patterns, typed for Workspace

export interface FlowFieldDef {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: string[]
}

export interface TriggerTypeDef {
  id: string
  label: string
  desc: string
  app: string
  category: 'records' | 'approvals' | 'schedule' | 'integration'
  fields: FlowFieldDef[]
}

export interface StepTypeDef {
  id: string
  label: string
  desc: string
  icon: string
  app: string
  category: 'notify' | 'records' | 'governance' | 'integration'
  fields: FlowFieldDef[]
}

export interface AutomationBlueprint {
  id: string
  name: string
  description: string
  category: string
  moduleId?: string
  complianceProfile?: string
  trigger: {
    type: string
    [key: string]: string
  }
  steps: Array<Record<string, string>>
}

export const GOVERNANCE_TRIGGER_TYPES: TriggerTypeDef[] = [
  {
    id: 'deadline_approaching',
    label: 'Deadline Approaching',
    desc: 'Fires N days before a statutory record deadline',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g. VAULTPRR' },
      { key: 'days_before', label: 'Days Before', type: 'number', placeholder: '3' },
      { key: 'field', label: 'Deadline Field', type: 'text', placeholder: 'e.g. dueDate' },
    ],
  },
  {
    id: 'record_created',
    label: 'Record Created',
    desc: 'Fires when a new record is created in a module',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g. VAULTMEET' },
    ],
  },
  {
    id: 'status_changed',
    label: 'Status Changed',
    desc: 'Fires when a record status transitions',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g. VAULTPRR' },
      { key: 'from_status', label: 'From Status', type: 'text', placeholder: 'e.g. intake' },
      { key: 'to_status', label: 'To Status', type: 'text', placeholder: 'e.g. at_risk' },
    ],
  },
  {
    id: 'field_updated',
    label: 'Field Updated',
    desc: 'Fires when a specific field changes value',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g. VAULTFISCAL' },
      { key: 'field', label: 'Field', type: 'text', placeholder: 'e.g. approvedBy' },
      { key: 'new_value', label: 'New Value (optional)', type: 'text', placeholder: 'Leave blank for any change' },
    ],
  },
  {
    id: 'attestation_required',
    label: 'Attestation Required',
    desc: 'Fires when a record is waiting for a human sign-off',
    app: 'VAULT',
    category: 'approvals',
    fields: [
      { key: 'module', label: 'Module', type: 'text', placeholder: 'e.g. VAULTPROCURE' },
      { key: 'attest_role', label: 'Required Role', type: 'text', placeholder: 'e.g. finance-director' },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule (daily/weekly)',
    desc: 'Fires on a recurring schedule',
    app: 'SYNCHRON8',
    category: 'schedule',
    fields: [
      { key: 'cron_expression', label: 'Schedule', type: 'select', options: ['0 8 * * 1-5', '0 8 * * 1', '0 0 1 * *'], placeholder: 'Weekdays at 8am' },
    ],
  },
  {
    id: 'webhook_received',
    label: 'Webhook Received',
    desc: 'Starts a scenario from an inbound integration event',
    app: 'LOGICBRIDGE',
    category: 'integration',
    fields: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'e.g. permit-portal' },
      { key: 'path', label: 'Webhook Path', type: 'text', placeholder: '/permits/status' },
    ],
  },
]

export const GOVERNANCE_STEP_TYPES: StepTypeDef[] = [
  {
    id: 'send_alert',
    label: 'Send Alert',
    desc: 'Notify a role or email address',
    icon: '🔔',
    app: 'Notify',
    category: 'notify',
    fields: [
      { key: 'role', label: 'Recipient Role', type: 'text', placeholder: 'e.g. records-access-officer' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Alert text…' },
    ],
  },
  {
    id: 'update_status',
    label: 'Update Status',
    desc: 'Change a record status field',
    icon: '🔄',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'new_status', label: 'New Status', type: 'text', placeholder: 'e.g. at_risk' },
    ],
  },
  {
    id: 'require_attestation',
    label: 'Require Attestation',
    desc: 'Gate on a human sign-off before proceeding',
    icon: '✍️',
    app: 'Approvals',
    category: 'governance',
    fields: [
      { key: 'role', label: 'Attesting Role', type: 'text', placeholder: 'e.g. town-administrator' },
      { key: 'prompt', label: 'Attestation Prompt', type: 'textarea', placeholder: 'Please confirm…' },
    ],
  },
  {
    id: 'escalate',
    label: 'Escalate',
    desc: 'Notify the escalation role with urgency flag',
    icon: '⬆️',
    app: 'Notify',
    category: 'notify',
    fields: [
      { key: 'escalation_role', label: 'Escalation Role', type: 'text', placeholder: 'e.g. town-administrator' },
      { key: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Why escalating…' },
    ],
  },
  {
    id: 'create_record',
    label: 'Create Record',
    desc: 'Spawn a new record in another module',
    icon: '📄',
    app: 'VAULT',
    category: 'records',
    fields: [
      { key: 'target_module', label: 'Target Module', type: 'text', placeholder: 'e.g. VAULTPRR' },
      { key: 'template', label: 'Template (optional)', type: 'text', placeholder: '' },
    ],
  },
  {
    id: 'seal_record',
    label: 'Seal Record',
    desc: 'Cryptographically seal and archive the record',
    icon: '🔒',
    app: 'ARCHIEVE',
    category: 'governance',
    fields: [],
  },
  {
    id: 'call_webhook',
    label: 'Call Webhook',
    desc: 'POST to an external endpoint via LOGICBRIDGE',
    icon: '🔗',
    app: 'LOGICBRIDGE',
    category: 'integration',
    fields: [
      { key: 'webhook_url', label: 'Endpoint URL', type: 'text', placeholder: 'https://…' },
    ],
  },
]

export const AUTOMATION_BLUEPRINTS: AutomationBlueprint[] = [
  {
    id: 'prr-escalation-lane',
    name: 'PRR escalation lane',
    description: 'Escalate public records requests before the statutory deadline slips.',
    category: 'Compliance',
    moduleId: 'VAULTPRR',
    complianceProfile: 'prr-10-day',
    trigger: { type: 'deadline_approaching', module: 'VAULTPRR', days_before: '3', field: 'dueDate' },
    steps: [
      { type: 'send_alert', role: 'records-access-officer', message: 'PRR deadline in 3 days. Triage and assign owner now.' },
      { type: 'require_attestation', role: 'town-administrator', prompt: 'Confirm the request has an owner, legal basis, and response draft.' },
      { type: 'escalate', escalation_role: 'town-counsel', reason: 'Deadline risk remains after attestation gate.' },
    ],
  },
  {
    id: 'intake-triage-pack',
    name: 'Intake triage pack',
    description: 'Create downstream records and notify the owning team on intake.',
    category: 'Operations',
    moduleId: 'VAULTPROCURE',
    complianceProfile: 'intake-triage',
    trigger: { type: 'record_created', module: 'VAULTPROCURE' },
    steps: [
      { type: 'create_record', target_module: 'VAULTTASK', template: 'triage-checklist-v1' },
      { type: 'send_alert', role: 'operations-desk', message: 'New intake received. Checklist generated and awaiting assignment.' },
      { type: 'call_webhook', webhook_url: 'https://bridge.publiclogic.org/intake/notify' },
    ],
  },
  {
    id: 'approval-router',
    name: 'Approval router',
    description: 'Push approvals into a governed lane with visible sign-off steps.',
    category: 'Governance',
    moduleId: 'VAULTMEET',
    complianceProfile: 'meeting-posting',
    trigger: { type: 'attestation_required', module: 'VAULTMEET', attest_role: 'town-clerk' },
    steps: [
      { type: 'send_alert', role: 'town-clerk', message: 'A meeting packet is waiting for attestation.' },
      { type: 'require_attestation', role: 'town-clerk', prompt: 'Confirm notice, agenda, and packet are complete before publishing.' },
      { type: 'update_status', new_status: 'approved' },
    ],
  },
  {
    id: 'cross-system-sync',
    name: 'Cross-system sync',
    description: 'Mirror a governed status change out to an external service and seal the record.',
    category: 'Integrations',
    moduleId: 'VAULTFISCAL',
    complianceProfile: 'fiscal-sync',
    trigger: { type: 'status_changed', module: 'VAULTFISCAL', from_status: 'review', to_status: 'approved' },
    steps: [
      { type: 'call_webhook', webhook_url: 'https://bridge.publiclogic.org/fiscal/sync' },
      { type: 'send_alert', role: 'finance-director', message: 'Approved fiscal item synced to the external system.' },
      { type: 'seal_record' },
    ],
  },
]

export const CRON_LABELS: Record<string, string> = {
  '0 8 * * 1-5': 'Weekdays at 8am',
  '0 8 * * 1':   'Mondays at 8am',
  '0 0 1 * *':   '1st of each month',
}
