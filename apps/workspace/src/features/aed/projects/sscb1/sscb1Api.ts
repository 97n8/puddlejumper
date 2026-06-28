const BASE = `${import.meta.env.VITE_PJ_API_URL ?? ''}/api/v1/sscb1`

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error ?? 'Request failed'), { status: res.status })
  }
  return res.json()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SSCB1Case {
  id: string; case_name: string; case_number: string; description: string
  state: 'active' | 'at_close' | 'handoff' | 'closed'; phase: string
  primary_party_pl: string; primary_party_aed: string
  control_version: string; last_updated: string; created_at: string
}

export interface SSCB1Actor {
  id: string; object_id: string; display_name: string; email: string
  role: 'pl_admin' | 'aed_executive' | 'editor' | 'reviewer' | 'readonly'
}

export interface Source {
  id: string; source_id_label: string; source_type: string; title: string
  originating_party: string; date_received: string; effective_date: string
  uploaded_by: string; attributed_owner: string
  confidence_level: 'high' | 'medium' | 'low' | 'unverified'
  normalization_status: 'raw' | 'normalized' | 'superseded'
  citation_note: string; document_url: string; case_id: string; created_at: string; seal_hash: string
}

export interface Assumption {
  id: string; assumption_id_label: string; statement: string; category: string
  source_ref: string; confidence: 'firm' | 'working' | 'estimate'
  owner: string; impact_area: string
  validation_due: string; validation_status: 'unvalidated' | 'in_review' | 'validated' | 'invalidated'
  status_notes: string; last_reviewed: string
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface StackItem {
  id: string; stack_item_id_label: string; layer_name: string; layer_type: string
  amount: number; currency: string; expected_timing: string
  status: 'conceptual' | 'assembling' | 'structured' | 'pending_agreement' | 'pending_counsel' | 'pending_verification' | 'accepted' | 'blocked' | 'closed'
  owner: string; counterparties: string; dependency: string
  next_action: string; next_action_due: string
  risk_watch_point: string; current_blocker: string
  confidence_status: string; gate_linked: number
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface Risk {
  id: string; risk_id_label: string; title: string; description: string
  category: string; severity: 'critical' | 'high' | 'watch' | 'low'
  sequence_impact: string; likelihood: string
  owner: string; trigger_condition: string; mitigation_plan: string
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
  linked_assumptions: string; linked_stack_item: string
  date_opened: string; last_reviewed: string; escalation_level: string
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface ITCItem {
  id: string; itc_item_id_label: string; eligible_equipment: string
  estimated_basis: number; final_basis: number; placed_in_service_date: string
  itc_amount: number; itc_rate: number
  recapture_yr1: number; recapture_yr2: number; recapture_yr3: number
  recapture_yr4: number; recapture_yr5: number
  counsel_engaged: number; tax_opinion_status: string
  ownership_entity: string; exposure_notes: string
  recapture_risk_flag: number; itc_basis_finalized: number
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface OpenItem {
  id: string; open_item_id_label: string; title: string
  item_type: string; linked_record: string
  owner: string; requested_from: string; requested_date: string
  target_resolution_date: string
  blocker_severity: 'critical' | 'high' | 'medium' | 'low'
  close_condition: string; current_note: string; escalation_state: string
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk'
  resolved_date: string; resolution_note: string
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface Decision {
  id: string; decision_id_label: string; decision_statement: string
  option_set: string; requesting_party: string
  decision_owner: string; due_date: string; source_basis: string
  impacted_records: string; chosen_option: string
  decision_date: string; rationale: string; unresolved_dependencies: string
  status: 'pending' | 'decided' | 'deferred' | 'cancelled'
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface StopRule {
  id: string; rule_id_label: string; rule_statement: string
  trigger_condition: string; prohibited_actions: string
  evidence_required: string; owner: string; active: number
  cleared_date: string; cleared_by: string; clearance_evidence: string
  linked_risks: string; case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface CadenceEvent {
  id: string; cadence_id_label: string
  meeting_type: 'weekly_stack' | 'biweekly_aed' | 'monthly_alignment' | 'exception' | 'gate_review' | 'handoff_review'
  frequency: string; required_attendees: string
  scheduled_date: string; completed_date: string
  agenda_source: string; action_count: number; decisions_made: string
  notes: string; status: 'scheduled' | 'completed' | 'cancelled'
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface Milestone {
  id: string; milestone_id_label: string; title: string; description: string
  milestone_type: string; target_date: string; completed_date: string
  owner: string; dependencies: string
  status: 'pending' | 'in_progress' | 'complete' | 'blocked' | 'at_risk'
  case_id: string; created_at: string; updated_at: string; seal_hash: string
}

export interface SSCB1Dashboard {
  case: SSCB1Case
  actor: SSCB1Actor
  stop_rules_active: StopRule[]
  summary: {
    critical_risks: number; high_risks: number
    unverified_assumptions: number; total_assumptions: number; firm_assumptions: number
    open_items_critical: number; total_open_items: number
    stack_layers_total: number; stack_layers_blocked: number
    itc_exposure_estimate: number
  }
  next_decision: Decision | null
  next_milestone: Milestone | null
  cadence_next: CadenceEvent | null
  top_risks: Risk[]
  open_assumptions_needing_validation: Assumption[]
  open_items_due_soon: OpenItem[]
  recent_decisions: Decision[]
  stack_preview: StackItem[]
}

// ─── API client ────────────────────────────────────────────────────────────────

export const sscb1Api = {
  me: ()                              => req<{ actor: SSCB1Actor; case: SSCB1Case }>('GET', '/me'),
  dashboard: ()                       => req<SSCB1Dashboard>('GET', '/dashboard'),

  sources: {
    list: ()                          => req<{ sources: Source[] }>('GET', '/sources'),
    create: (data: Partial<Source>)   => req<{ source: Source }>('POST', '/sources', data),
  },

  assumptions: {
    list: ()                                    => req<{ assumptions: Assumption[] }>('GET', '/assumptions'),
    create: (data: Partial<Assumption>)         => req<{ assumption: Assumption }>('POST', '/assumptions', data),
    update: (id: string, data: Partial<Assumption>) => req<{ assumption: Assumption }>('PUT', `/assumptions/${id}`, data),
  },

  stack: {
    list: ()                                    => req<{ items: StackItem[] }>('GET', '/stack'),
    create: (data: Partial<StackItem>)          => req<{ item: StackItem }>('POST', '/stack', data),
    update: (id: string, data: Partial<StackItem>) => req<{ item: StackItem }>('PUT', `/stack/${id}`, data),
  },

  risks: {
    list: ()                                    => req<{ risks: Risk[] }>('GET', '/risks'),
    create: (data: Partial<Risk>)               => req<{ risk: Risk }>('POST', '/risks', data),
    update: (id: string, data: Partial<Risk>)   => req<{ risk: Risk }>('PUT', `/risks/${id}`, data),
  },

  itc: {
    list: ()                                    => req<{ items: ITCItem[] }>('GET', '/itc'),
    update: (id: string, data: Partial<ITCItem>) => req<{ item: ITCItem }>('PUT', `/itc/${id}`, data),
  },

  openItems: {
    list: ()                                      => req<{ items: OpenItem[] }>('GET', '/open-items'),
    create: (data: Partial<OpenItem>)             => req<{ item: OpenItem }>('POST', '/open-items', data),
    resolve: (id: string, data: { resolution_note: string }) => req<{ item: OpenItem }>('PUT', `/open-items/${id}/resolve`, data),
  },

  decisions: {
    list: ()                                        => req<{ decisions: Decision[] }>('GET', '/decisions'),
    create: (data: Partial<Decision>)               => req<{ decision: Decision }>('POST', '/decisions', data),
    decide: (id: string, data: { chosen_option: string; rationale: string }) => req<{ decision: Decision }>('PUT', `/decisions/${id}/decide`, data),
  },

  stopRules: {
    list: ()                                          => req<{ rules: StopRule[] }>('GET', '/stop-rules'),
    clear: (id: string, data: { clearance_evidence: string }) => req<{ rule: StopRule }>('PUT', `/stop-rules/${id}/clear`, data),
  },

  cadence: {
    list: ()                                        => req<{ events: CadenceEvent[] }>('GET', '/cadence'),
    create: (data: Partial<CadenceEvent>)           => req<{ event: CadenceEvent }>('POST', '/cadence', data),
    complete: (id: string, data: { notes: string; action_count: number }) => req<{ event: CadenceEvent }>('PUT', `/cadence/${id}/complete`, data),
  },

  milestones: {
    list: ()                                         => req<{ milestones: Milestone[] }>('GET', '/milestones'),
    update: (id: string, data: Partial<Milestone>)  => req<{ milestone: Milestone }>('PUT', `/milestones/${id}`, data),
  },

  audit: {
    list: ()                                         => req<{ entries: unknown[] }>('GET', '/audit'),
  },

  exportDashboard: ()                                => req<{ export: unknown }>('POST', '/export/dashboard'),
}
