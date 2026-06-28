import type { CommonsAlert } from '../types'

export const MOCK_ALERTS: CommonsAlert[] = [
  {
    id: 'alert-001', domain: 'compliance', severity: 'critical',
    title: 'PRR acknowledgement overdue — Maria Hernandez',
    detail: 'MGL c.66 requires acknowledgement within 10 business days. Day 9 reached.',
    affected_object_type: 'prr_request', affected_object_id: 'prr-003',
    suggested_action: 'Acknowledge immediately and assign responsive records search.',
    status: 'open', created_at: '2026-03-26T08:00:00Z', owner_id: 'pos-clerk-head',
  },
  {
    id: 'alert-002', domain: 'organizational', severity: 'high',
    title: 'Vacant critical role: DPW Director',
    detail: 'This position is in the authority chain for procurement approvals over $10,000.',
    affected_object_type: 'position', affected_object_id: 'pos-dpw-head',
    suggested_action: 'Assign acting coverage or begin recruitment.',
    status: 'open', created_at: '2026-03-28T09:15:00Z', owner_id: null,
  },
  {
    id: 'alert-003', domain: 'compliance', severity: 'high',
    title: 'Open meeting minutes not posted — March 18 Select Board meeting',
    detail: 'MGL c.30A requires posting within 10 days. Day 15 reached.',
    affected_object_type: 'meeting_record', affected_object_id: 'meet-002',
    suggested_action: 'Draft, approve, and post minutes immediately.',
    status: 'open', created_at: '2026-03-28T10:00:00Z', owner_id: 'pos-clerk-head',
  },
  {
    id: 'alert-004', domain: 'financial', severity: 'high',
    title: 'Stabilization fund below policy floor',
    detail: 'Balance $182,400 is below adopted policy floor of $200,000.',
    affected_object_type: 'capital_fund', affected_object_id: 'fund-stab',
    suggested_action: 'Review with Finance Director. Consider supplemental appropriation.',
    status: 'open', created_at: '2026-03-29T14:00:00Z', owner_id: 'pos-finance-head',
  },
  {
    id: 'alert-005', domain: 'workflow', severity: 'warning',
    title: 'Procurement request stalled — Parks equipment, day 12',
    detail: 'Request awaiting threshold classification for 12 days.',
    affected_object_type: 'procurement_request', affected_object_id: 'proc-007',
    suggested_action: 'Classify and route before 30B threshold window expires.',
    status: 'open', created_at: '2026-03-20T11:00:00Z', owner_id: 'pos-finance-head',
  },
  {
    id: 'alert-006', domain: 'data_freshness', severity: 'warning',
    title: 'CivicPlus feed stale — last sync 26 hours ago',
    detail: 'Expected sync interval is 15 minutes. Last successful sync was 26 hours ago.',
    affected_object_type: 'connector', affected_object_id: 'connector-civicplus',
    suggested_action: 'Check CivicPlus connector credentials in LogicSuite.',
    status: 'acknowledged', created_at: '2026-04-01T06:00:00Z', owner_id: null,
  },
  {
    id: 'alert-007', domain: 'compliance', severity: 'warning',
    title: 'Annual ethics disclosure due in 9 days — 3 board members',
    detail: 'MGL c.268A annual disclosure deadline: April 13.',
    affected_object_type: 'compliance_deadline', affected_object_id: 'ethics-fy2026',
    suggested_action: 'Send reminder to board members. Confirm submission before deadline.',
    status: 'open', created_at: '2026-04-04T08:00:00Z', owner_id: null,
  },
  {
    id: 'alert-008', domain: 'organizational', severity: 'info',
    title: 'Acting assignment expires in 5 days — Finance Director',
    detail: 'Current acting assignment for Finance Director expires April 9.',
    affected_object_type: 'delegation', affected_object_id: 'deleg-003',
    suggested_action: 'Extend delegation or confirm permanent appointment before expiry.',
    status: 'open', created_at: '2026-04-04T09:00:00Z', owner_id: 'pos-admin-head',
  },
]

export function mockAlerts(params?: { severity?: string; domain?: string }): CommonsAlert[] {
  return MOCK_ALERTS.filter(a =>
    (!params?.severity || params.severity === 'all' || a.severity === params.severity) &&
    (!params?.domain   || params.domain   === 'all' || a.domain   === params.domain)
  )
}
