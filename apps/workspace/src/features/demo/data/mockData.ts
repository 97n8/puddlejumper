// Workspace V1 Mock Data — simulates PuddleJumper responses
// Full V1: all 7 process types, 15+ cases, meetings, boards, notes, activity

export interface Org {
  id: string;
  name: string;
  municipality: string;
  plan: string;
  modules: string[];
  active: boolean;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
  roleDisplay: string;
  department: string;
  authority: Record<string, boolean>;
  active: boolean;
  lastActive: string;
}

export interface OrgRole {
  id: string;
  orgId: string;
  name: string;
  display: string;
  permissions: string[];
  canApprove: string[];
}

export interface Case {
  id: string;
  procId: string;
  procName: string;
  orgId: string;
  currentStage: number;
  totalStages: number;
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED' | 'WITHDRAWN';
  risk: 'low' | 'medium' | 'high';
  subject: string;
  source: 'public' | 'staff' | 'api';
  openedBy: string | null;
  openedAt: string;
  dueAt: string;
  blockedSince: string | null;
  blockedReason: string | null;
  closedAt: string | null;
  seal: string | null;
  handler: string;
  department: string;
  fields: Record<string, string>;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  category: string;
  authority: string;
  stageCount: number;
  sealAtStage: number;
  defaultDueDays: number;
  active: boolean;
  description: string;
}

export interface ProcessStage {
  id: string;
  procId: string;
  seq: number;
  name: string;
  displayLabel: string;
  requiredRole: string | null;
  isHardStop: boolean;
  mglCitation: string | null;
  archieveOnEnter: boolean;
}

export interface StageRule {
  id: string;
  stageId: string;
  ruleType: string;
  ruleKey: string;
  ruleValue: string | null;
  errorMessage: string;
  mglCitation: string | null;
  isHardStop: boolean;
}

export interface ArchieveEntry {
  id: string;
  caseId: string;
  stage: number;
  actorId: string | null;
  actorRole: string;
  timestamp: string;
  payloadHash: string;
  ruleRef: string[];
  seal: string | null;
}

export interface CaseTransition {
  id: string;
  caseId: string;
  fromStage: number;
  toStage: number;
  actorId: string;
  actorRole: string;
  timestamp: string;
  rulesSatisfied: string[];
  archieveRef: string;
  seal: string | null;
}

export interface HardStopEvent {
  id: string;
  stageRuleId: string;
  caseId: string;
  triggeredAt: string;
  triggeredBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  archieveRef: string;
  ruleName: string;
  mglCitation: string;
  errorMessage: string;
}

export interface WatchFlag {
  id: string;
  caseId: string | null;
  orgId: string;
  flagType: string;
  level: 'critical' | 'urgent' | 'warn' | 'info';
  title: string;
  body: string;
  action: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  timestamp: string;
  isSystem: boolean;
}

export interface Meeting {
  id: string;
  orgId: string;
  board: string;
  date: string;
  time: string;
  location: string;
  posted: boolean;
  agendaItems: string[];
}

export interface Board {
  id: string;
  orgId: string;
  name: string;
  vacancies: number;
  commitment: string;
  meetings: string;
  description: string;
}

export interface ActivityItem {
  id: string;
  type: 'case_opened' | 'stage_advanced' | 'hard_stop' | 'case_closed' | 'member_added' | 'seal_generated' | 'case_blocked' | 'note_added';
  title: string;
  description: string;
  timestamp: string;
  caseId?: string;
  actorName?: string;
}

// --- CURRENT USER ---

export const CURRENT_USER = {
  id: 'user_nate',
  name: 'Nate Sullivan',
  email: 'nate@publiclogic.org',
  role: 'admin',
  roleDisplay: 'Administrator',
  orgId: 'org_phillipston',
};

// --- ORG ---

export const MOCK_ORG: Org = {
  id: 'org_phillipston',
  name: 'Town of Phillipston',
  municipality: 'Phillipston, MA',
  plan: 'full',
  modules: ['prr', 'procurement', 'oml', 'boards', 'ap_warrant', 'dog_license', 'dpw'],
  active: true,
  createdAt: '2026-01-15T09:00:00Z',
};

// --- ROLES ---

export const MOCK_ROLES: OrgRole[] = [
  { id: 'role_1', orgId: 'org_phillipston', name: 'admin', display: 'Administrator', permissions: ['*'], canApprove: ['*'] },
  { id: 'role_2', orgId: 'org_phillipston', name: 'governance_operator', display: 'Governance Operator', permissions: ['cases:read','cases:advance','cases:assign'], canApprove: ['*'] },
  { id: 'role_3', orgId: 'org_phillipston', name: 'clerk', display: 'Town Clerk', permissions: ['cases:read','cases:advance','records:write','licenses:write'], canApprove: ['proc_prr','proc_oml_agenda','proc_board_appt','proc_dog_license'] },
  { id: 'role_4', orgId: 'org_phillipston', name: 'dept_head', display: 'Department Head', permissions: ['cases:read','cases:advance:own_dept','vouchers:approve'], canApprove: ['proc_ap_warrant'] },
  { id: 'role_5', orgId: 'org_phillipston', name: 'accountant', display: 'Town Accountant', permissions: ['cases:read','cases:advance','budget:read','warrants:certify'], canApprove: ['proc_ap_warrant','proc_budget_transfer'] },
  { id: 'role_6', orgId: 'org_phillipston', name: 'procurement_officer', display: 'Procurement Officer', permissions: ['cases:read','cases:advance','procurement:write'], canApprove: ['proc_proc_bid','proc_proc_rfp'] },
  { id: 'role_7', orgId: 'org_phillipston', name: 'staff', display: 'Staff', permissions: ['cases:read:own','cases:submit'], canApprove: [] },
];

// --- MEMBERS ---

export const MOCK_MEMBERS: OrgMember[] = [
  { id: 'mem_1', orgId: 'org_phillipston', userId: 'user_nate', userName: 'Nate Sullivan', email: 'nate@publiclogic.org', role: 'admin', roleDisplay: 'Administrator', department: 'Administration', authority: {}, active: true, lastActive: '2026-04-05T10:30:00Z' },
  { id: 'mem_2', orgId: 'org_phillipston', userId: 'user_sarah', userName: 'Sarah Mitchell', email: 'smitchell@phillipston.gov', role: 'clerk', roleDisplay: 'Town Clerk', department: "Clerk's Office", authority: {}, active: true, lastActive: '2026-04-05T09:15:00Z' },
  { id: 'mem_3', orgId: 'org_phillipston', userId: 'user_mike', userName: 'Mike Torres', email: 'mtorres@phillipston.gov', role: 'dept_head', roleDisplay: 'Department Head', department: 'DPW', authority: {}, active: true, lastActive: '2026-04-04T16:45:00Z' },
  { id: 'mem_4', orgId: 'org_phillipston', userId: 'user_janet', userName: 'Janet Chen', email: 'jchen@phillipston.gov', role: 'accountant', roleDisplay: 'Town Accountant', department: 'Finance', authority: {}, active: true, lastActive: '2026-04-05T08:00:00Z' },
  { id: 'mem_5', orgId: 'org_phillipston', userId: 'user_tom', userName: 'Tom Briggs', email: 'tbriggs@phillipston.gov', role: 'procurement_officer', roleDisplay: 'Procurement Officer', department: 'Finance', authority: {}, active: true, lastActive: '2026-04-03T14:20:00Z' },
  { id: 'mem_6', orgId: 'org_phillipston', userId: 'user_lisa', userName: 'Lisa Novak', email: 'lnovak@phillipston.gov', role: 'governance_operator', roleDisplay: 'Governance Operator', department: 'Administration', authority: {}, active: true, lastActive: '2026-04-05T11:00:00Z' },
  { id: 'mem_7', orgId: 'org_phillipston', userId: 'user_dan', userName: 'Dan Kowalski', email: 'dkowalski@phillipston.gov', role: 'staff', roleDisplay: 'Staff', department: 'DPW', authority: {}, active: false, lastActive: '2026-03-15T10:00:00Z' },
  { id: 'mem_8', orgId: 'org_phillipston', userId: 'user_maria', userName: 'Maria Santos', email: 'msantos@phillipston.gov', role: 'staff', roleDisplay: 'Staff', department: 'DPW', authority: {}, active: true, lastActive: '2026-04-04T15:30:00Z' },
  { id: 'mem_9', orgId: 'org_phillipston', userId: 'user_kevin', userName: 'Kevin O\'Brien', email: 'kobrien@phillipston.gov', role: 'dept_head', roleDisplay: 'Department Head', department: 'Police', authority: {}, active: true, lastActive: '2026-04-05T07:45:00Z' },
];

// --- PROCESS DEFINITIONS ---

export const MOCK_PROCESS_DEFS: ProcessDefinition[] = [
  { id: 'proc_prr', name: 'Public Records Request', category: 'Records', authority: 'MGL c.66 §10', stageCount: 10, sealAtStage: 9, defaultDueDays: 10, active: true, description: 'Handles public records requests under Massachusetts public records law. 10-day statutory response deadline with fee calculation and exemption review.' },
  { id: 'proc_proc_bid', name: 'Competitive Bid Procurement', category: 'Procurement', authority: 'MGL c.30B §5', stageCount: 9, sealAtStage: 8, defaultDueDays: 45, active: true, description: 'Governs competitive bidding for goods and services over $50,000. Includes IFB publication, bid opening, evaluation, and award.' },
  { id: 'proc_oml_agenda', name: 'Meeting Agenda Posting', category: 'Open Meeting Law', authority: 'MGL c.30A §20', stageCount: 6, sealAtStage: 6, defaultDueDays: 7, active: true, description: '48-hour agenda posting requirement for public meetings. Tracks draft, review, posting, and meeting completion.' },
  { id: 'proc_board_appt', name: 'Board Appointment', category: 'Boards & Committees', authority: 'MGL c.41 §1, c.268 §1', stageCount: 8, sealAtStage: 7, defaultDueDays: 60, active: true, description: 'Full appointment lifecycle from application through conflict disclosure, interview, vote, and swearing in.' },
  { id: 'proc_ap_warrant', name: 'AP Warrant Approval', category: 'Finance', authority: 'MGL c.41 §52', stageCount: 7, sealAtStage: 7, defaultDueDays: 14, active: true, description: 'Accounts payable warrant certification flow. Department head approval, accountant review, and treasurer disbursement.' },
  { id: 'proc_dog_license', name: 'Dog License', category: 'Licenses', authority: 'MGL c.140 §137', stageCount: 5, sealAtStage: 5, defaultDueDays: 7, active: true, description: 'Dog licensing with rabies certificate verification. Mandatory under Massachusetts General Law.' },
  { id: 'proc_dpw_report', name: 'DPW Service Request', category: 'Public Works', authority: 'Internal', stageCount: 4, sealAtStage: 4, defaultDueDays: 5, active: true, description: 'Citizen-reported public works issues: potholes, streetlights, trees, drainage. Tracked from report to resolution.' },
];

// --- STAGE DEFINITIONS (all 7 processes) ---

export const PRR_STAGES: ProcessStage[] = [
  { id: 'proc_prr_s1', procId: 'proc_prr', seq: 1, name: 'intake', displayLabel: 'Request Received', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_prr_s2', procId: 'proc_prr', seq: 2, name: 'acknowledge', displayLabel: 'Acknowledgment Sent', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_prr_s3', procId: 'proc_prr', seq: 3, name: 'search', displayLabel: 'Records Search', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_prr_s4', procId: 'proc_prr', seq: 4, name: 'review', displayLabel: 'Review & Redaction', requiredRole: 'clerk', isHardStop: true, mglCitation: 'MGL c.66 §10(d)', archieveOnEnter: true },
  { id: 'proc_prr_s5', procId: 'proc_prr', seq: 5, name: 'fee_calc', displayLabel: 'Fee Calculation', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_prr_s6', procId: 'proc_prr', seq: 6, name: 'fee_notify', displayLabel: 'Fee Notification', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_prr_s7', procId: 'proc_prr', seq: 7, name: 'payment', displayLabel: 'Payment Received', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_prr_s8', procId: 'proc_prr', seq: 8, name: 'fulfill', displayLabel: 'Records Delivered', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_prr_s9', procId: 'proc_prr', seq: 9, name: 'seal', displayLabel: 'SEAL Generated', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_prr_s10', procId: 'proc_prr', seq: 10, name: 'closed', displayLabel: 'Closed', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const BID_STAGES: ProcessStage[] = [
  { id: 'proc_bid_s1', procId: 'proc_proc_bid', seq: 1, name: 'requisition', displayLabel: 'Requisition Filed', requiredRole: 'dept_head', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_bid_s2', procId: 'proc_proc_bid', seq: 2, name: 'spec_draft', displayLabel: 'Specifications Drafted', requiredRole: 'procurement_officer', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_bid_s3', procId: 'proc_proc_bid', seq: 3, name: 'legal_review', displayLabel: 'Legal Review', requiredRole: null, isHardStop: true, mglCitation: 'MGL c.30B §5', archieveOnEnter: true },
  { id: 'proc_bid_s4', procId: 'proc_proc_bid', seq: 4, name: 'advertise', displayLabel: 'IFB Published', requiredRole: 'procurement_officer', isHardStop: false, mglCitation: 'MGL c.30B §5(c)', archieveOnEnter: true },
  { id: 'proc_bid_s5', procId: 'proc_proc_bid', seq: 5, name: 'bid_period', displayLabel: 'Bid Period Open', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_bid_s6', procId: 'proc_proc_bid', seq: 6, name: 'bid_open', displayLabel: 'Bids Opened', requiredRole: 'procurement_officer', isHardStop: true, mglCitation: 'MGL c.30B §5(e)', archieveOnEnter: true },
  { id: 'proc_bid_s7', procId: 'proc_proc_bid', seq: 7, name: 'evaluate', displayLabel: 'Evaluation Complete', requiredRole: 'procurement_officer', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_bid_s8', procId: 'proc_proc_bid', seq: 8, name: 'seal', displayLabel: 'SEAL & Award', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_bid_s9', procId: 'proc_proc_bid', seq: 9, name: 'closed', displayLabel: 'Contract Executed', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const OML_STAGES: ProcessStage[] = [
  { id: 'proc_oml_s1', procId: 'proc_oml_agenda', seq: 1, name: 'draft', displayLabel: 'Agenda Drafted', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_oml_s2', procId: 'proc_oml_agenda', seq: 2, name: 'review', displayLabel: 'Chair Review', requiredRole: 'dept_head', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_oml_s3', procId: 'proc_oml_agenda', seq: 3, name: 'post_check', displayLabel: '48-Hour Check', requiredRole: null, isHardStop: true, mglCitation: 'MGL c.30A §20', archieveOnEnter: true },
  { id: 'proc_oml_s4', procId: 'proc_oml_agenda', seq: 4, name: 'post', displayLabel: 'Agenda Posted', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_oml_s5', procId: 'proc_oml_agenda', seq: 5, name: 'meeting', displayLabel: 'Meeting Held', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_oml_s6', procId: 'proc_oml_agenda', seq: 6, name: 'sealed', displayLabel: 'SEAL & Close', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const BOARD_STAGES: ProcessStage[] = [
  { id: 'proc_board_s1', procId: 'proc_board_appt', seq: 1, name: 'application', displayLabel: 'Application Received', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_board_s2', procId: 'proc_board_appt', seq: 2, name: 'eligibility', displayLabel: 'Eligibility Check', requiredRole: 'clerk', isHardStop: true, mglCitation: 'MGL c.41 §1', archieveOnEnter: true },
  { id: 'proc_board_s3', procId: 'proc_board_appt', seq: 3, name: 'conflict', displayLabel: 'Conflict Disclosure', requiredRole: null, isHardStop: true, mglCitation: 'MGL c.268 §1', archieveOnEnter: true },
  { id: 'proc_board_s4', procId: 'proc_board_appt', seq: 4, name: 'interview', displayLabel: 'Interview Scheduled', requiredRole: 'dept_head', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_board_s5', procId: 'proc_board_appt', seq: 5, name: 'vote', displayLabel: 'Board Vote', requiredRole: 'dept_head', isHardStop: true, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_board_s6', procId: 'proc_board_appt', seq: 6, name: 'swear', displayLabel: 'Oath of Office', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_board_s7', procId: 'proc_board_appt', seq: 7, name: 'seal', displayLabel: 'SEAL Generated', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_board_s8', procId: 'proc_board_appt', seq: 8, name: 'closed', displayLabel: 'Appointed', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const AP_STAGES: ProcessStage[] = [
  { id: 'proc_ap_s1', procId: 'proc_ap_warrant', seq: 1, name: 'submit', displayLabel: 'Warrant Submitted', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_ap_s2', procId: 'proc_ap_warrant', seq: 2, name: 'dept_approve', displayLabel: 'Dept Head Approval', requiredRole: 'dept_head', isHardStop: true, mglCitation: 'MGL c.41 §52', archieveOnEnter: true },
  { id: 'proc_ap_s3', procId: 'proc_ap_warrant', seq: 3, name: 'acct_review', displayLabel: 'Accountant Review', requiredRole: 'accountant', isHardStop: true, mglCitation: 'MGL c.41 §52', archieveOnEnter: true },
  { id: 'proc_ap_s4', procId: 'proc_ap_warrant', seq: 4, name: 'board_approve', displayLabel: 'Select Board Approval', requiredRole: 'admin', isHardStop: true, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_ap_s5', procId: 'proc_ap_warrant', seq: 5, name: 'certify', displayLabel: 'Certification', requiredRole: 'accountant', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_ap_s6', procId: 'proc_ap_warrant', seq: 6, name: 'disburse', displayLabel: 'Disbursement', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_ap_s7', procId: 'proc_ap_warrant', seq: 7, name: 'sealed', displayLabel: 'SEAL & Close', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const DOG_STAGES: ProcessStage[] = [
  { id: 'proc_dog_s1', procId: 'proc_dog_license', seq: 1, name: 'intake', displayLabel: 'Application Received', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_dog_s2', procId: 'proc_dog_license', seq: 2, name: 'verify', displayLabel: 'Rabies Verification', requiredRole: 'clerk', isHardStop: true, mglCitation: 'MGL c.140 §137', archieveOnEnter: true },
  { id: 'proc_dog_s3', procId: 'proc_dog_license', seq: 3, name: 'fee', displayLabel: 'Fee Collection', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_dog_s4', procId: 'proc_dog_license', seq: 4, name: 'issue', displayLabel: 'License Issued', requiredRole: 'clerk', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_dog_s5', procId: 'proc_dog_license', seq: 5, name: 'sealed', displayLabel: 'SEAL & Close', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const DPW_STAGES: ProcessStage[] = [
  { id: 'proc_dpw_s1', procId: 'proc_dpw_report', seq: 1, name: 'intake', displayLabel: 'Report Received', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_dpw_s2', procId: 'proc_dpw_report', seq: 2, name: 'assign', displayLabel: 'Assigned to Crew', requiredRole: 'dept_head', isHardStop: false, mglCitation: null, archieveOnEnter: true },
  { id: 'proc_dpw_s3', procId: 'proc_dpw_report', seq: 3, name: 'resolve', displayLabel: 'Work Completed', requiredRole: 'staff', isHardStop: false, mglCitation: null, archieveOnEnter: false },
  { id: 'proc_dpw_s4', procId: 'proc_dpw_report', seq: 4, name: 'closed', displayLabel: 'Closed', requiredRole: null, isHardStop: false, mglCitation: null, archieveOnEnter: true },
];

export const PROCESS_STAGES: Record<string, ProcessStage[]> = {
  proc_prr: PRR_STAGES,
  proc_proc_bid: BID_STAGES,
  proc_oml_agenda: OML_STAGES,
  proc_board_appt: BOARD_STAGES,
  proc_ap_warrant: AP_STAGES,
  proc_dog_license: DOG_STAGES,
  proc_dpw_report: DPW_STAGES,
};

// --- STAGE RULES (sample) ---

export const MOCK_STAGE_RULES: StageRule[] = [
  { id: 'sr_1', stageId: 'proc_prr_s4', ruleType: 'required_field', ruleKey: 'exemption_review_complete', ruleValue: 'true', errorMessage: 'Exemption review must be completed before advancing.', mglCitation: 'MGL c.4 §7(26)', isHardStop: true },
  { id: 'sr_2', stageId: 'proc_prr_s4', ruleType: 'role_check', ruleKey: 'clerk', ruleValue: null, errorMessage: 'Only the Town Clerk can advance past review.', mglCitation: 'MGL c.66 §10', isHardStop: true },
  { id: 'sr_3', stageId: 'proc_dog_s2', ruleType: 'required_field', ruleKey: 'rabies_cert_valid', ruleValue: 'true', errorMessage: 'Valid rabies certificate required.', mglCitation: 'MGL c.140 §137', isHardStop: true },
  { id: 'sr_4', stageId: 'proc_oml_s3', ruleType: 'time_elapsed', ruleKey: 'hours_before_meeting', ruleValue: '48', errorMessage: 'Agenda must be posted at least 48 hours before meeting (excluding Sundays and legal holidays).', mglCitation: 'MGL c.30A §20', isHardStop: true },
  { id: 'sr_5', stageId: 'proc_board_s2', ruleType: 'required_field', ruleKey: 'residency_verified', ruleValue: 'true', errorMessage: 'Applicant must be a verified resident of the town.', mglCitation: 'MGL c.41 §1', isHardStop: true },
  { id: 'sr_6', stageId: 'proc_board_s3', ruleType: 'required_field', ruleKey: 'conflict_disclosure_filed', ruleValue: 'true', errorMessage: 'Conflict of interest disclosure must be filed.', mglCitation: 'MGL c.268 §1', isHardStop: true },
  { id: 'sr_7', stageId: 'proc_ap_s2', ruleType: 'role_check', ruleKey: 'dept_head', ruleValue: null, errorMessage: 'Department head must approve the warrant.', mglCitation: 'MGL c.41 §52', isHardStop: true },
  { id: 'sr_8', stageId: 'proc_ap_s3', ruleType: 'threshold', ruleKey: 'warrant_amount', ruleValue: '50000', errorMessage: 'Warrants over $50,000 require additional review.', mglCitation: 'MGL c.41 §52', isHardStop: false },
  { id: 'sr_9', stageId: 'proc_proc_bid_s3', ruleType: 'document_required', ruleKey: 'legal_opinion', ruleValue: null, errorMessage: 'Legal opinion must be attached before advertising.', mglCitation: 'MGL c.30B §5', isHardStop: true },
  { id: 'sr_10', stageId: 'proc_proc_bid_s6', ruleType: 'required_field', ruleKey: 'min_bidders', ruleValue: '3', errorMessage: 'Minimum 3 responsive bids required for valid opening.', mglCitation: 'MGL c.30B §5(e)', isHardStop: true },
];

// --- CASES (15 total, all 7 process types) ---

export const MOCK_CASES: Case[] = [
  {
    id: 'CASE-2026-0001', procId: 'proc_prr', procName: 'Public Records Request', orgId: 'org_phillipston',
    currentStage: 4, totalStages: 10, status: 'BLOCKED', risk: 'high', subject: 'Building permits Jan-Mar 2026',
    source: 'public', openedBy: null, openedAt: '2026-03-25T14:00:00Z', dueAt: '2026-04-06T14:00:00Z',
    blockedSince: '2026-04-03T09:00:00Z', blockedReason: 'Exemption review required — records may contain personnel information exempt under MGL c.4 §7(26)(c). Clerk must review and redact before release.',
    closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { requestor_name: 'Jane Doe', contact_email: 'jane@example.com', records_description: 'All building permits issued from January through March 2026', preferred_format: 'Electronic', fee_waiver_request: 'false' },
  },
  {
    id: 'CASE-2026-0002', procId: 'proc_dog_license', procName: 'Dog License', orgId: 'org_phillipston',
    currentStage: 2, totalStages: 5, status: 'BLOCKED', risk: 'medium', subject: 'Dog license — Rex (Golden Retriever)',
    source: 'public', openedBy: null, openedAt: '2026-04-01T10:00:00Z', dueAt: '2026-04-08T10:00:00Z',
    blockedSince: '2026-04-02T11:00:00Z', blockedReason: 'Rabies certificate expired. MGL c.140 §137 requires valid rabies vaccination. Owner must provide current certificate.',
    closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { owner_name: 'Bob Smith', owner_address: '42 Main St, Phillipston', owner_email: 'bob@example.com', dog_name: 'Rex', breed: 'Golden Retriever', sex: 'Male', spayed_neutered: 'Yes', rabies_cert_number: 'RC-2024-551', rabies_vet: 'Dr. Patel', rabies_expiry: '2026-03-15' },
  },
  {
    id: 'CASE-2026-0003', procId: 'proc_dpw_report', procName: 'DPW Service Request', orgId: 'org_phillipston',
    currentStage: 2, totalStages: 4, status: 'ACTIVE', risk: 'low', subject: 'Pothole on Elm Street near fire station',
    source: 'public', openedBy: null, openedAt: '2026-04-02T08:30:00Z', dueAt: '2026-04-09T08:30:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Mike Torres', department: 'DPW',
    fields: { issue_type: 'Pothole', location: 'Elm Street, near fire station', description: 'Large pothole approximately 2 feet wide, getting deeper with rain.', email: 'resident@example.com' },
  },
  {
    id: 'CASE-2026-0004', procId: 'proc_oml_agenda', procName: 'Meeting Agenda Posting', orgId: 'org_phillipston',
    currentStage: 3, totalStages: 6, status: 'ACTIVE', risk: 'high', subject: 'Select Board — April 7 Meeting Agenda',
    source: 'staff', openedBy: 'user_sarah', openedAt: '2026-04-03T09:00:00Z', dueAt: '2026-04-05T17:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { board_name: 'Select Board', meeting_datetime: '2026-04-07T18:30:00Z', meeting_location: 'Town Hall, 50 The Common', agenda_items: '1. Call to Order\n2. Approve Minutes\n3. DPW Update\n4. Budget Discussion\n5. New Business\n6. Adjournment' },
  },
  {
    id: 'CASE-2026-0005', procId: 'proc_prr', procName: 'Public Records Request', orgId: 'org_phillipston',
    currentStage: 7, totalStages: 10, status: 'ACTIVE', risk: 'low', subject: 'Town meeting minutes 2025',
    source: 'public', openedBy: null, openedAt: '2026-03-15T11:00:00Z', dueAt: '2026-03-27T11:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { requestor_name: 'Al Briggs', contact_email: 'al@example.com', records_description: 'All town meeting minutes from fiscal year 2025', preferred_format: 'Electronic', fee_waiver_request: 'true' },
  },
  {
    id: 'CASE-2026-0006', procId: 'proc_prr', procName: 'Public Records Request', orgId: 'org_phillipston',
    currentStage: 10, totalStages: 10, status: 'CLOSED', risk: 'low', subject: 'Dog license records 2024',
    source: 'public', openedBy: null, openedAt: '2026-02-10T09:00:00Z', dueAt: '2026-02-24T09:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: '2026-02-20T15:30:00Z', seal: 'SL-A3F8C12B', handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { requestor_name: 'Carol Nguyen', contact_email: 'carol@example.com', records_description: 'Dog license issuance records for calendar year 2024', preferred_format: 'Paper', fee_waiver_request: 'false' },
  },
  {
    id: 'CASE-2026-0007', procId: 'proc_dpw_report', procName: 'DPW Service Request', orgId: 'org_phillipston',
    currentStage: 1, totalStages: 4, status: 'ACTIVE', risk: 'low', subject: 'Streetlight out on Royalston Road',
    source: 'public', openedBy: null, openedAt: '2026-04-04T16:00:00Z', dueAt: '2026-04-11T16:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Unassigned', department: 'DPW',
    fields: { issue_type: 'Streetlight', location: 'Royalston Road, near intersection with Templeton Rd', description: 'Streetlight has been out for about a week.' },
  },
  {
    id: 'CASE-2026-0008', procId: 'proc_dog_license', procName: 'Dog License', orgId: 'org_phillipston',
    currentStage: 4, totalStages: 5, status: 'ACTIVE', risk: 'low', subject: 'Dog license — Bella (Labrador)',
    source: 'public', openedBy: null, openedAt: '2026-03-28T09:00:00Z', dueAt: '2026-04-04T09:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { owner_name: 'Emily Hart', owner_address: '15 State Road, Phillipston', owner_email: 'emily@example.com', dog_name: 'Bella', breed: 'Labrador Retriever', sex: 'Female', spayed_neutered: 'Yes', rabies_cert_number: 'RC-2026-102', rabies_vet: 'Dr. Kim', rabies_expiry: '2028-06-01' },
  },
  {
    id: 'CASE-2026-0009', procId: 'proc_board_appt', procName: 'Board Appointment', orgId: 'org_phillipston',
    currentStage: 3, totalStages: 8, status: 'ACTIVE', risk: 'medium', subject: 'Conservation Commission — Martha Reid application',
    source: 'public', openedBy: null, openedAt: '2026-03-20T10:00:00Z', dueAt: '2026-05-19T10:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { full_name: 'Martha Reid', email: 'mreid@example.com', address_in_town: '88 Baldwinville Rd, Phillipston', board_choice: 'Conservation Commission', qualifications: 'Environmental science degree, 15 years local conservation volunteer, wetlands mapping experience', why_serve: 'I want to help protect our local watersheds and ensure responsible land use.', conflict_disclosure: 'No' },
  },
  {
    id: 'CASE-2026-0010', procId: 'proc_ap_warrant', procName: 'AP Warrant Approval', orgId: 'org_phillipston',
    currentStage: 3, totalStages: 7, status: 'ACTIVE', risk: 'low', subject: 'AP Warrant #2026-W14 — $28,450.00',
    source: 'staff', openedBy: 'user_janet', openedAt: '2026-04-01T08:00:00Z', dueAt: '2026-04-15T08:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Janet Chen', department: 'Finance',
    fields: { warrant_number: '2026-W14', warrant_amount: '28450.00', vendor_count: '12', period: 'March 16-31, 2026', dept_approver: 'Mike Torres', largest_item: 'Elm Street repair materials — $8,200' },
  },
  {
    id: 'CASE-2026-0011', procId: 'proc_proc_bid', procName: 'Competitive Bid Procurement', orgId: 'org_phillipston',
    currentStage: 4, totalStages: 9, status: 'ACTIVE', risk: 'medium', subject: 'Town Hall HVAC Replacement — IFB #2026-003',
    source: 'staff', openedBy: 'user_tom', openedAt: '2026-02-15T09:00:00Z', dueAt: '2026-04-30T09:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Tom Briggs', department: 'Finance',
    fields: { ifb_number: 'IFB-2026-003', project_title: 'Town Hall HVAC System Replacement', estimated_cost: '185000', funding_source: 'Capital Improvement Fund', bid_opening_date: '2026-04-20T14:00:00Z', min_bidders: '3' },
  },
  {
    id: 'CASE-2026-0012', procId: 'proc_dpw_report', procName: 'DPW Service Request', orgId: 'org_phillipston',
    currentStage: 4, totalStages: 4, status: 'CLOSED', risk: 'low', subject: 'Fallen tree blocking Templeton Road',
    source: 'public', openedBy: null, openedAt: '2026-03-10T07:00:00Z', dueAt: '2026-03-17T07:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: '2026-03-11T16:00:00Z', seal: 'SL-7F2E9B4A', handler: 'Mike Torres', department: 'DPW',
    fields: { issue_type: 'Tree', location: 'Templeton Road, 0.5 miles north of town center', description: 'Large oak tree fell across road overnight, completely blocking both lanes.', email: 'dpw@phillipston.gov' },
  },
  {
    id: 'CASE-2026-0013', procId: 'proc_oml_agenda', procName: 'Meeting Agenda Posting', orgId: 'org_phillipston',
    currentStage: 6, totalStages: 6, status: 'CLOSED', risk: 'low', subject: 'Planning Board — March 24 Meeting',
    source: 'staff', openedBy: 'user_sarah', openedAt: '2026-03-18T09:00:00Z', dueAt: '2026-03-22T17:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: '2026-03-25T09:00:00Z', seal: 'SL-D4C1A87E', handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { board_name: 'Planning Board', meeting_datetime: '2026-03-24T19:00:00Z', meeting_location: 'Town Hall, 50 The Common' },
  },
  {
    id: 'CASE-2026-0014', procId: 'proc_dog_license', procName: 'Dog License', orgId: 'org_phillipston',
    currentStage: 5, totalStages: 5, status: 'CLOSED', risk: 'low', subject: 'Dog license — Max (Beagle)',
    source: 'public', openedBy: null, openedAt: '2026-03-05T10:00:00Z', dueAt: '2026-03-12T10:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: '2026-03-08T14:00:00Z', seal: 'SL-B9E3F52C', handler: 'Sarah Mitchell', department: "Clerk's Office",
    fields: { owner_name: 'Frank Miller', owner_address: '7 School St, Phillipston', owner_email: 'frank@example.com', dog_name: 'Max', breed: 'Beagle', sex: 'Male', spayed_neutered: 'Yes', rabies_cert_number: 'RC-2026-044', rabies_vet: 'Dr. Kim', rabies_expiry: '2029-01-15' },
  },
  {
    id: 'CASE-2026-0015', procId: 'proc_dpw_report', procName: 'DPW Service Request', orgId: 'org_phillipston',
    currentStage: 3, totalStages: 4, status: 'ACTIVE', risk: 'low', subject: 'Drainage issue on State Road',
    source: 'public', openedBy: null, openedAt: '2026-03-30T11:00:00Z', dueAt: '2026-04-06T11:00:00Z',
    blockedSince: null, blockedReason: null, closedAt: null, seal: null, handler: 'Maria Santos', department: 'DPW',
    fields: { issue_type: 'Drainage', location: 'State Road, near #25', description: 'Water pooling on road after every rain, getting worse. Drain appears clogged.', email: 'neighbor@example.com' },
  },
];

// --- ARCHIEVE ENTRIES ---

export const MOCK_ARCHIEVE: ArchieveEntry[] = [
  // CASE-0001 (PRR - blocked at stage 4)
  { id: 'ARC-2026-001', caseId: 'CASE-2026-0001', stage: 1, actorId: null, actorRole: 'public_intake', timestamp: '2026-03-25T14:00:00Z', payloadHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', ruleRef: [], seal: null },
  { id: 'ARC-2026-002', caseId: 'CASE-2026-0001', stage: 2, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-03-26T09:15:00Z', payloadHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', ruleRef: ['rule_ack_sent'], seal: null },
  { id: 'ARC-2026-003', caseId: 'CASE-2026-0001', stage: 3, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-03-28T14:30:00Z', payloadHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', ruleRef: ['rule_search_complete'], seal: null },
  { id: 'ARC-2026-004', caseId: 'CASE-2026-0001', stage: 4, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-03T09:00:00Z', payloadHash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', ruleRef: ['rule_exemption_check'], seal: null },
  { id: 'ARC-2026-005', caseId: 'CASE-2026-0001', stage: -1, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-03T09:00:01Z', payloadHash: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', ruleRef: ['hard_stop_exemption'], seal: null },
  // CASE-0006 (PRR - closed with SEAL)
  { id: 'ARC-2026-010', caseId: 'CASE-2026-0006', stage: 1, actorId: null, actorRole: 'public_intake', timestamp: '2026-02-10T09:00:00Z', payloadHash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', ruleRef: [], seal: null },
  { id: 'ARC-2026-011', caseId: 'CASE-2026-0006', stage: 5, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-02-14T10:00:00Z', payloadHash: '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', ruleRef: ['rule_fee_calc'], seal: null },
  { id: 'ARC-2026-012', caseId: 'CASE-2026-0006', stage: 8, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-02-19T15:00:00Z', payloadHash: '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d', ruleRef: ['rule_delivered'], seal: null },
  { id: 'ARC-2026-013', caseId: 'CASE-2026-0006', stage: 9, actorId: null, actorRole: 'system', timestamp: '2026-02-20T15:30:00Z', payloadHash: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1', ruleRef: ['rule_all_stages'], seal: 'SL-A3F8C12B' },
  { id: 'ARC-2026-014', caseId: 'CASE-2026-0006', stage: 10, actorId: null, actorRole: 'system', timestamp: '2026-02-20T15:30:01Z', payloadHash: '4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e', ruleRef: [], seal: null },
  // CASE-0012 (DPW - closed with SEAL)
  { id: 'ARC-2026-020', caseId: 'CASE-2026-0012', stage: 1, actorId: null, actorRole: 'public_intake', timestamp: '2026-03-10T07:00:00Z', payloadHash: '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', ruleRef: [], seal: null },
  { id: 'ARC-2026-021', caseId: 'CASE-2026-0012', stage: 2, actorId: 'user_mike', actorRole: 'dept_head', timestamp: '2026-03-10T08:30:00Z', payloadHash: '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a', ruleRef: ['rule_assigned'], seal: null },
  { id: 'ARC-2026-022', caseId: 'CASE-2026-0012', stage: 4, actorId: null, actorRole: 'system', timestamp: '2026-03-11T16:00:00Z', payloadHash: '7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8b', ruleRef: ['rule_all_stages'], seal: 'SL-7F2E9B4A' },
  // CASE-0002 (Dog - blocked)
  { id: 'ARC-2026-030', caseId: 'CASE-2026-0002', stage: 1, actorId: null, actorRole: 'public_intake', timestamp: '2026-04-01T10:00:00Z', payloadHash: '8b9c0d1e2f3a8b9c0d1e2f3a8b9c0d1e2f3a8b9c0d1e2f3a8b9c0d1e2f3a8b9c', ruleRef: [], seal: null },
  { id: 'ARC-2026-031', caseId: 'CASE-2026-0002', stage: -1, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-02T11:00:00Z', payloadHash: '9c0d1e2f3a4b9c0d1e2f3a4b9c0d1e2f3a4b9c0d1e2f3a4b9c0d1e2f3a4b9c0d', ruleRef: ['hard_stop_rabies'], seal: null },
  // CASE-0004 (OML)
  { id: 'ARC-2026-040', caseId: 'CASE-2026-0004', stage: 1, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-03T09:00:00Z', payloadHash: '0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1e', ruleRef: [], seal: null },
  { id: 'ARC-2026-041', caseId: 'CASE-2026-0004', stage: 2, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-03T14:00:00Z', payloadHash: '1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f', ruleRef: ['rule_chair_reviewed'], seal: null },
  { id: 'ARC-2026-042', caseId: 'CASE-2026-0004', stage: 3, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-04T10:00:00Z', payloadHash: '2f3a4b5c6d7e2f3a4b5c6d7e2f3a4b5c6d7e2f3a4b5c6d7e2f3a4b5c6d7e2f3a', ruleRef: ['rule_48hr_check'], seal: null },
];

// --- TRANSITIONS ---

export const MOCK_TRANSITIONS: CaseTransition[] = [
  { id: 'tr_1', caseId: 'CASE-2026-0001', fromStage: 1, toStage: 2, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-03-26T09:15:00Z', rulesSatisfied: ['rule_ack_sent'], archieveRef: 'ARC-2026-002', seal: null },
  { id: 'tr_2', caseId: 'CASE-2026-0001', fromStage: 2, toStage: 3, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-03-28T14:30:00Z', rulesSatisfied: ['rule_search_complete'], archieveRef: 'ARC-2026-003', seal: null },
  { id: 'tr_3', caseId: 'CASE-2026-0001', fromStage: 3, toStage: 4, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-04-03T09:00:00Z', rulesSatisfied: ['rule_exemption_check'], archieveRef: 'ARC-2026-004', seal: null },
  { id: 'tr_4', caseId: 'CASE-2026-0006', fromStage: 1, toStage: 5, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-02-14T10:00:00Z', rulesSatisfied: ['rule_no_exemptions'], archieveRef: 'ARC-2026-011', seal: null },
  { id: 'tr_5', caseId: 'CASE-2026-0006', fromStage: 5, toStage: 8, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-02-19T15:00:00Z', rulesSatisfied: ['rule_fee_paid','rule_delivered'], archieveRef: 'ARC-2026-012', seal: null },
  { id: 'tr_6', caseId: 'CASE-2026-0006', fromStage: 8, toStage: 10, actorId: 'user_sarah', actorRole: 'clerk', timestamp: '2026-02-20T15:30:00Z', rulesSatisfied: ['rule_all_stages'], archieveRef: 'ARC-2026-013', seal: 'SL-A3F8C12B' },
  { id: 'tr_7', caseId: 'CASE-2026-0012', fromStage: 1, toStage: 2, actorId: 'user_mike', actorRole: 'dept_head', timestamp: '2026-03-10T08:30:00Z', rulesSatisfied: ['rule_assigned'], archieveRef: 'ARC-2026-021', seal: null },
  { id: 'tr_8', caseId: 'CASE-2026-0012', fromStage: 2, toStage: 4, actorId: 'user_maria', actorRole: 'staff', timestamp: '2026-03-11T16:00:00Z', rulesSatisfied: ['rule_work_done'], archieveRef: 'ARC-2026-022', seal: 'SL-7F2E9B4A' },
];

// --- HARD STOPS ---

export const MOCK_HARD_STOPS: HardStopEvent[] = [
  {
    id: 'hs_1', stageRuleId: 'rule_exemption_review', caseId: 'CASE-2026-0001',
    triggeredAt: '2026-04-03T09:00:00Z', triggeredBy: 'user_sarah',
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
    archieveRef: 'ARC-2026-005',
    ruleName: 'Exemption Review Required',
    mglCitation: 'MGL c.4 §7(26)(c)',
    errorMessage: 'Records may contain personnel information exempt under MGL c.4 §7(26)(c). Clerk must review each record and redact exempt portions before release. Cannot advance until review is documented.',
  },
  {
    id: 'hs_2', stageRuleId: 'rule_rabies_valid', caseId: 'CASE-2026-0002',
    triggeredAt: '2026-04-02T11:00:00Z', triggeredBy: 'user_sarah',
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
    archieveRef: 'ARC-2026-031',
    ruleName: 'Rabies Certificate Validation',
    mglCitation: 'MGL c.140 §137',
    errorMessage: 'Rabies certificate (RC-2024-551) expired 2026-03-15. MGL c.140 §137 requires a valid rabies vaccination certificate. Owner must provide updated certificate from licensed veterinarian.',
  },
];

// --- WATCH FLAGS ---

export const MOCK_WATCH_FLAGS: WatchFlag[] = [
  {
    id: 'wf_1', caseId: 'CASE-2026-0004', orgId: 'org_phillipston', flagType: 'oml_clock',
    level: 'critical', title: 'OML Clock: Select Board Agenda',
    body: '~53 hours until April 7 meeting. 48-hour posting rule (MGL c.30A §20) requires agenda to be posted now. Case is at stage 3 (48-Hour Check).',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_2', caseId: 'CASE-2026-0001', orgId: 'org_phillipston', flagType: 'prr_deadline',
    level: 'urgent', title: 'PRR Deadline: 1 Business Day Remaining',
    body: 'CASE-2026-0001 due April 6. Currently BLOCKED at Review & Redaction (stage 4). Hard stop must be resolved and case advanced before 10-day deadline.',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_3', caseId: 'CASE-2026-0001', orgId: 'org_phillipston', flagType: 'blocked_case',
    level: 'urgent', title: 'Blocked Case: 48+ Hours',
    body: 'CASE-2026-0001 has been BLOCKED since April 3. Exemption review hard stop unresolved for over 48 hours.',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_4', caseId: 'CASE-2026-0005', orgId: 'org_phillipston', flagType: 'prr_deadline',
    level: 'warn', title: 'PRR Overdue: Town Meeting Minutes',
    body: 'CASE-2026-0005 was due March 27. Currently at Payment Received (stage 7). 9 days overdue.',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_5', caseId: null, orgId: 'org_phillipston', flagType: 'board_vacancy',
    level: 'info', title: 'Board Vacancy: Conservation Commission',
    body: 'Conservation Commission has 2 vacancies with no pending applications. Consider outreach.',
    action: 'View Boards', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_6', caseId: 'CASE-2026-0015', orgId: 'org_phillipston', flagType: 'due_soon',
    level: 'warn', title: 'DPW Case Due Tomorrow',
    body: 'CASE-2026-0015 (Drainage issue on State Road) due April 6. Currently at stage 3 (Work Completed). Close out to meet deadline.',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
  {
    id: 'wf_7', caseId: 'CASE-2026-0011', orgId: 'org_phillipston', flagType: 'procurement_deadline',
    level: 'info', title: 'Bid Opening in 15 Days',
    body: 'IFB-2026-003 (Town Hall HVAC) bid opening scheduled April 20. Ensure advertisement meets minimum publication period.',
    action: 'Open Case', createdAt: '2026-04-05T10:00:00Z', resolvedAt: null,
  },
];

// --- CASE NOTES ---

export const MOCK_NOTES: CaseNote[] = [
  { id: 'note_1', caseId: 'CASE-2026-0001', authorId: 'system', authorName: 'System', authorRole: 'system', content: 'Case opened via public intake form. Reference number assigned.', timestamp: '2026-03-25T14:00:00Z', isSystem: true },
  { id: 'note_2', caseId: 'CASE-2026-0001', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Acknowledgment email sent to requestor. 10-day clock started.', timestamp: '2026-03-26T09:15:00Z', isSystem: false },
  { id: 'note_3', caseId: 'CASE-2026-0001', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Records search complete. Found 47 building permits in the requested period. Some contain employee home addresses which may be exempt under personnel exemption.', timestamp: '2026-03-28T14:30:00Z', isSystem: false },
  { id: 'note_4', caseId: 'CASE-2026-0001', authorId: 'system', authorName: 'System', authorRole: 'system', content: 'HARD STOP triggered: Exemption review required (MGL c.4 §7(26)(c)). Case status changed to BLOCKED.', timestamp: '2026-04-03T09:00:00Z', isSystem: true },
  { id: 'note_5', caseId: 'CASE-2026-0001', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Beginning review of 47 permits for exempt information. Will need to redact employee home addresses from 12 permits that list contractor personal addresses.', timestamp: '2026-04-03T10:00:00Z', isSystem: false },
  { id: 'note_6', caseId: 'CASE-2026-0002', authorId: 'system', authorName: 'System', authorRole: 'system', content: 'Case opened via public intake form. Dog license application for Rex (Golden Retriever).', timestamp: '2026-04-01T10:00:00Z', isSystem: true },
  { id: 'note_7', caseId: 'CASE-2026-0002', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Rabies certificate RC-2024-551 expired on 3/15/2026. Contacted owner by email to request updated certificate.', timestamp: '2026-04-02T11:00:00Z', isSystem: false },
  { id: 'note_8', caseId: 'CASE-2026-0003', authorId: 'user_mike', authorName: 'Mike Torres', authorRole: 'dept_head', content: 'Assigned to Crew B. Should be patched by end of week weather permitting.', timestamp: '2026-04-02T10:00:00Z', isSystem: false },
  { id: 'note_9', caseId: 'CASE-2026-0004', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Agenda drafted. Waiting on DPW update language from Mike before finalizing.', timestamp: '2026-04-03T11:00:00Z', isSystem: false },
  { id: 'note_10', caseId: 'CASE-2026-0010', authorId: 'user_janet', authorName: 'Janet Chen', authorRole: 'accountant', content: 'Warrant W14 reviewed. All invoices verified. 12 vendors, largest single item is Elm St materials at $8,200. Recommending approval.', timestamp: '2026-04-03T14:00:00Z', isSystem: false },
  { id: 'note_11', caseId: 'CASE-2026-0011', authorId: 'user_tom', authorName: 'Tom Briggs', authorRole: 'procurement_officer', content: 'IFB published in Central Register and local paper. Bid period opens today, closes April 20 at 2:00 PM.', timestamp: '2026-04-01T09:00:00Z', isSystem: false },
  { id: 'note_12', caseId: 'CASE-2026-0009', authorId: 'user_sarah', authorName: 'Sarah Mitchell', authorRole: 'clerk', content: 'Residency verified via voter rolls. Conflict disclosure form received — no conflicts reported. Ready for interview scheduling.', timestamp: '2026-03-25T10:00:00Z', isSystem: false },
];

// --- MEETINGS ---

export const MOCK_MEETINGS: Meeting[] = [
  { id: 'mtg_1', orgId: 'org_phillipston', board: 'Select Board', date: '2026-04-07', time: '6:30 PM', location: 'Town Hall, 50 The Common', posted: false, agendaItems: ['Call to Order', 'Approve Minutes of March 24', 'DPW Update — Spring Paving', 'FY27 Budget Discussion', 'New Business', 'Adjournment'] },
  { id: 'mtg_2', orgId: 'org_phillipston', board: 'Planning Board', date: '2026-04-14', time: '7:00 PM', location: 'Town Hall, 50 The Common', posted: false, agendaItems: ['Call to Order', 'Approve Minutes', 'Site Plan Review — 45 State Rd', 'Zoning Bylaw Amendment Discussion', 'Adjournment'] },
  { id: 'mtg_3', orgId: 'org_phillipston', board: 'Conservation Commission', date: '2026-04-10', time: '7:00 PM', location: 'Town Hall, 50 The Common', posted: true, agendaItems: ['Call to Order', 'Wetlands Hearing — 12 Pond St', 'Review of Open NOIs', 'Member Updates', 'Adjournment'] },
  { id: 'mtg_4', orgId: 'org_phillipston', board: 'Board of Health', date: '2026-04-21', time: '6:00 PM', location: 'Town Hall, 50 The Common', posted: false, agendaItems: ['Call to Order', 'Title 5 Variance Request', 'Annual Report Review', 'Adjournment'] },
];

// --- BOARDS ---

export const MOCK_BOARDS: Board[] = [
  { id: 'brd_1', orgId: 'org_phillipston', name: 'Conservation Commission', vacancies: 2, commitment: '2-3 hours/month', meetings: '2nd Thursday, 7 PM', description: 'Administers Wetlands Protection Act and Conservation Commission Act.' },
  { id: 'brd_2', orgId: 'org_phillipston', name: 'Planning Board', vacancies: 0, commitment: '3-4 hours/month', meetings: '2nd Tuesday, 7 PM', description: 'Reviews site plans, subdivisions, and zoning amendments.' },
  { id: 'brd_3', orgId: 'org_phillipston', name: 'Zoning Board of Appeals', vacancies: 1, commitment: '2 hours/month', meetings: 'As needed', description: 'Hears variance requests and special permit applications.' },
  { id: 'brd_4', orgId: 'org_phillipston', name: 'Finance Committee', vacancies: 0, commitment: '4-6 hours/month (more during budget season)', meetings: 'Wednesdays, 7 PM', description: 'Reviews town budget and makes recommendations to Town Meeting.' },
  { id: 'brd_5', orgId: 'org_phillipston', name: 'Historical Commission', vacancies: 3, commitment: '2 hours/month', meetings: '1st Monday, 6 PM', description: 'Preserves and protects the historical assets of the town.' },
];

// --- ACTIVITY FEED ---

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'act_1', type: 'case_blocked', title: 'Case Blocked', description: 'CASE-2026-0001 blocked at Review & Redaction — exemption review required', timestamp: '2026-04-03T09:00:00Z', caseId: 'CASE-2026-0001', actorName: 'Sarah Mitchell' },
  { id: 'act_2', type: 'hard_stop', title: 'Hard Stop Triggered', description: 'Rabies certificate expired for CASE-2026-0002 (MGL c.140 §137)', timestamp: '2026-04-02T11:00:00Z', caseId: 'CASE-2026-0002', actorName: 'Sarah Mitchell' },
  { id: 'act_3', type: 'stage_advanced', title: 'Stage Advanced', description: 'CASE-2026-0003 advanced to Assigned to Crew', timestamp: '2026-04-02T10:00:00Z', caseId: 'CASE-2026-0003', actorName: 'Mike Torres' },
  { id: 'act_4', type: 'case_opened', title: 'New Case', description: 'CASE-2026-0007 — Streetlight out on Royalston Road (DPW Service Request)', timestamp: '2026-04-04T16:00:00Z', caseId: 'CASE-2026-0007' },
  { id: 'act_5', type: 'case_opened', title: 'New Case', description: 'CASE-2026-0004 — Select Board April 7 Meeting Agenda (OML)', timestamp: '2026-04-03T09:00:00Z', caseId: 'CASE-2026-0004', actorName: 'Sarah Mitchell' },
  { id: 'act_6', type: 'stage_advanced', title: 'Stage Advanced', description: 'CASE-2026-0004 advanced to 48-Hour Check', timestamp: '2026-04-04T10:00:00Z', caseId: 'CASE-2026-0004', actorName: 'Sarah Mitchell' },
  { id: 'act_7', type: 'note_added', title: 'Note Added', description: 'Janet Chen added note on CASE-2026-0010 (AP Warrant)', timestamp: '2026-04-03T14:00:00Z', caseId: 'CASE-2026-0010', actorName: 'Janet Chen' },
  { id: 'act_8', type: 'stage_advanced', title: 'Stage Advanced', description: 'CASE-2026-0011 IFB published — bid period open', timestamp: '2026-04-01T09:00:00Z', caseId: 'CASE-2026-0011', actorName: 'Tom Briggs' },
  { id: 'act_9', type: 'seal_generated', title: 'SEAL Generated', description: 'CASE-2026-0012 sealed as SL-7F2E9B4A — fallen tree resolved', timestamp: '2026-03-11T16:00:00Z', caseId: 'CASE-2026-0012' },
  { id: 'act_10', type: 'case_closed', title: 'Case Closed', description: 'CASE-2026-0014 — Dog license issued for Max (Beagle) — SL-B9E3F52C', timestamp: '2026-03-08T14:00:00Z', caseId: 'CASE-2026-0014' },
];

// --- PUBLIC FORM DEFINITIONS ---

export interface PublicForm {
  id: string;
  filename: string;
  title: string;
  endpoint: string;
  method: string;
  fields: string[];
  description: string;
}

export const MOCK_PUBLIC_FORMS: PublicForm[] = [
  { id: 'form_prr', filename: 'intake-prr.html', title: 'Request Town Records', endpoint: '/api/intake/prr', method: 'POST', fields: ['name*', 'email*', 'records_description*', 'preferred_format', 'fee_waiver_request'], description: 'Public records request under MGL c.66 §10. 10-day response deadline.' },
  { id: 'form_report', filename: 'intake-report.html', title: 'Report an Issue', endpoint: '/api/intake/report', method: 'POST', fields: ['issue_type*', 'location*', 'description', 'email', 'photo_description'], description: 'Citizen-reported DPW issues: potholes, streetlights, trees, drainage.' },
  { id: 'form_board', filename: 'intake-board.html', title: 'Apply to Serve on a Board', endpoint: '/api/intake/board-application', method: 'POST', fields: ['full_name*', 'email*', 'address_in_town*', 'board_choice*', 'qualifications*', 'why_serve*', 'conflict_disclosure*'], description: 'Board and committee appointment application with conflict disclosure.' },
  { id: 'form_permit', filename: 'intake-permit.html', title: 'Request a Permit', endpoint: '/api/intake/permit', method: 'POST', fields: ['permit_type*', 'property_address*', 'parcel_id', 'project_description*', 'estimated_cost*', 'owner_name*', 'contractor_name', 'email*'], description: 'Building, electrical, plumbing, gas, demolition, and sign permits.' },
  { id: 'form_license', filename: 'intake-license.html', title: 'Apply for a License', endpoint: '/api/intake/license', method: 'POST', fields: ['license_type*', 'business_name*', 'owner_name*', 'address*', 'email*', 'phone*'], description: 'Business, food service, tobacco, junk dealer, and raffle licenses.' },
  { id: 'form_dog', filename: 'intake-dog.html', title: 'Register or Renew a Dog License', endpoint: '/api/intake/dog-license', method: 'POST', fields: ['owner_name*', 'owner_address*', 'owner_email*', 'dog_name*', 'breed*', 'sex*', 'spayed_neutered*', 'rabies_cert_number*', 'rabies_vet*', 'rabies_expiry*'], description: 'Dog licensing with rabies certificate verification (MGL c.140 §137).' },
  { id: 'form_meeting', filename: 'intake-meeting.html', title: 'Meeting Calendar & Agendas', endpoint: '/api/public/meetings', method: 'GET', fields: [], description: 'Read-only public meeting schedule with posted agendas.' },
  { id: 'form_status', filename: 'intake-status.html', title: 'Check My Request Status', endpoint: '/api/public/status', method: 'GET', fields: ['ref_number*'], description: 'Public status lookup by reference number. Shows current stage only — no internal data.' },
];

// --- HELPERS ---

export function getStagesForCase(procId: string): ProcessStage[] {
  return PROCESS_STAGES[procId] || PRR_STAGES;
}

export function getProcessDef(procId: string): ProcessDefinition | undefined {
  return MOCK_PROCESS_DEFS.find(p => p.id === procId);
}

export function getCasesByStatus(status?: string): Case[] {
  if (!status || status === 'ALL') return MOCK_CASES;
  return MOCK_CASES.filter(c => c.status === status);
}

export function getNotesForCase(caseId: string): CaseNote[] {
  return MOCK_NOTES.filter(n => n.caseId === caseId);
}

export function getTransitionsForCase(caseId: string): CaseTransition[] {
  return MOCK_TRANSITIONS.filter(t => t.caseId === caseId);
}

export function getArchieveForCase(caseId: string): ArchieveEntry[] {
  return MOCK_ARCHIEVE.filter(a => a.caseId === caseId);
}

export function getHardStopsForCase(caseId: string): HardStopEvent[] {
  return MOCK_HARD_STOPS.filter(h => h.caseId === caseId);
}
