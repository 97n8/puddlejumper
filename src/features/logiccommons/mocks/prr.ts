import type { PRRRecord, ModuleInstance, Artifact, PlacementConfirmation } from '../types'

export const MOCK_PRRS: PRRRecord[] = [
  {
    id: 'prr-001', requester_name: 'James Whitfield', requester_email: 'jwhitfield@example.com',
    request_description: 'All Select Board meeting minutes from FY2024.',
    pipeline_stage: 6, sla_due_at: '2026-04-10T17:00:00Z',
    status: 'in_progress', created_at: '2026-03-31T09:00:00Z', updated_at: '2026-04-01T09:00:00Z', closed_at: null,
    intake_channel: 'form', department_id: 'dept-clerk',
    instance_id: 'mi-001', current_step: 3, workflow_stages: '[]',
  },
  {
    id: 'prr-002', requester_name: 'Diane Kowalski', requester_email: 'dkowalski@example.com',
    request_description: 'Vendor contracts awarded in FY2023 over $10,000.',
    pipeline_stage: 8, sla_due_at: '2026-04-15T17:00:00Z',
    status: 'in_progress', created_at: '2026-04-02T10:30:00Z', updated_at: '2026-04-03T10:30:00Z', closed_at: null,
    intake_channel: 'email', department_id: 'dept-finance',
    instance_id: 'mi-002', current_step: 4, workflow_stages: '[]',
  },
  {
    id: 'prr-003', requester_name: 'Maria Hernandez', requester_email: 'mhernandez@example.com',
    request_description: 'Building permit applications for 44 Main St, 2022-2024.',
    pipeline_stage: 2, sla_due_at: '2026-04-03T17:00:00Z',
    status: 'open', created_at: '2026-03-26T08:00:00Z', updated_at: '2026-03-26T08:00:00Z', closed_at: null,
    intake_channel: 'form', department_id: 'dept-clerk',
    instance_id: 'mi-003', current_step: 1, workflow_stages: '[]',
  },
  {
    id: 'prr-004', requester_name: 'Tom Garfield', requester_email: 'tgarfield@example.com',
    request_description: 'All DPW work orders for Route 9 bridge repair, 2024.',
    pipeline_stage: 10, sla_due_at: '2026-04-20T17:00:00Z',
    status: 'in_progress', created_at: '2026-04-01T14:00:00Z', updated_at: '2026-04-02T14:00:00Z', closed_at: null,
    intake_channel: 'manual', department_id: 'dept-dpw',
    instance_id: 'mi-004', current_step: 5, workflow_stages: '[]',
  },
  {
    id: 'prr-005', requester_name: 'Angela Reyes', requester_email: 'areyes@example.com',
    request_description: 'Personnel records for former employee John Smith.',
    pipeline_stage: 13, sla_due_at: '2026-04-08T17:00:00Z',
    status: 'in_progress', created_at: '2026-03-29T09:00:00Z', updated_at: '2026-03-30T09:00:00Z', closed_at: null,
    intake_channel: 'email', department_id: 'dept-clerk',
    instance_id: 'mi-005', current_step: 6, workflow_stages: '[]',
  },
  {
    id: 'prr-006', requester_name: 'Harold Fitch', requester_email: 'hfitch@example.com',
    request_description: 'Tax assessment records for 12 Elm Street, 2020-2024.',
    pipeline_stage: 14, sla_due_at: '2026-03-25T17:00:00Z',
    status: 'closed', created_at: '2026-03-15T11:00:00Z', updated_at: '2026-03-25T17:00:00Z', closed_at: '2026-03-25T17:00:00Z',
    intake_channel: 'form', department_id: 'dept-finance',
    instance_id: 'mi-006', current_step: 7, workflow_stages: '[]',
  },
]

export const MOCK_MODULE_INSTANCES: Record<string, ModuleInstance> = {
  'prr-001': {
    id: 'mi-prr-001', record_id: 'prr-001', module_key: 'VAULTCLERK.PublicRecords',
    current_step: 3,
    workflow_stages: [
      { id: 's1', label: 'Received', order: 1, status: 'complete' },
      { id: 's2', label: 'Acknowledged', order: 2, status: 'complete' },
      { id: 's3', label: 'Scope Review', order: 3, status: 'active' },
      { id: 's4', label: 'Fulfillment', order: 4, status: 'pending' },
      { id: 's5', label: 'Redaction Review', order: 5, status: 'pending' },
      { id: 's6', label: 'Release', order: 6, status: 'pending' },
    ],
    role_assignments: {}, stop_rules: [], can_advance: true, blocking_fields: [],
    tenant_id: 'logicville', created_at: '2026-03-31T09:00:00Z', updated_at: '2026-04-01T10:00:00Z',
  } as unknown as ModuleInstance,
}

export const MOCK_ARTIFACTS: Artifact[] = []
export const MOCK_PLACEMENTS: PlacementConfirmation[] = []
