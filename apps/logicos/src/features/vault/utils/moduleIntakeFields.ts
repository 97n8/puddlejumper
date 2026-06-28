/**
 * Per-module intake field definitions and state machines
 * Source: 97N8-Drafts module charters
 */
import type { ModuleDef, FieldDef, DeadlineDef } from '../types'

// ── Deadline helpers ──────────────────────────────────────────────────────────

export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate)
  let added = 0
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1)
    const dow = result.getUTCDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

export function addCalendarDays(startDate: Date, days: number): Date {
  const result = new Date(startDate)
  result.setDate(result.getDate() + days)
  return result
}

export function computeDeadlines(
  defs: DeadlineDef[],
  createdAt: number,
  closedAt?: number
): Record<string, { dueDate: string; status: 'OPEN' | 'MET' | 'MISSED' | 'N/A' }> {
  const result: Record<string, { dueDate: string; status: 'OPEN' | 'MET' | 'MISSED' | 'N/A' }> = {}
  const now = new Date()
  for (const def of defs) {
    if (def.triggersOn === 'closure' && !closedAt) {
      result[def.key] = { dueDate: '', status: 'N/A' }
      continue
    }
    const base = new Date(def.triggersOn === 'closure' ? closedAt! : createdAt)
    const due = def.type === 'business' ? addBusinessDays(base, def.days) : addCalendarDays(base, def.days)
    const dueStr = due.toISOString().split('T')[0]
    const isPast = due < now
    result[def.key] = { dueDate: dueStr, status: isPast ? 'MISSED' : 'OPEN' }
  }
  return result
}

export function calendarDaysRemaining(isoDate: string): number {
  if (!isoDate) return 0
  const due = new Date(isoDate)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

// ── Shared field sets ─────────────────────────────────────────────────────────

const requesterFields: FieldDef[] = [
  { key: 'requesterName', label: 'Your Name', type: 'text', required: true, placeholder: 'Full legal name' },
  { key: 'requesterEmail', label: 'Email Address', type: 'email', required: true, placeholder: 'you@example.com' },
  { key: 'requesterPhone', label: 'Phone Number', type: 'phone', placeholder: '(555) 000-0000' },
  { key: 'requesterOrg', label: 'Organization', type: 'text', placeholder: 'If representing an organization' },
]

const MGL_EXEMPTIONS = [
  'a — Trade secrets / proprietary info',
  'b — Personnel / medical',
  'c — Investigatory (ongoing)',
  'd — Inter-agency deliberative',
  'e — Attorney-client privilege',
  'f — Library records',
  'g — Security procedures',
  'other — Other (note in review notes)',
]

// ── Module definitions ────────────────────────────────────────────────────────

export const MODULE_DEFS: Record<string, ModuleDef> = {

  VAULTPRR: {
    moduleId: 'VAULTPRR',
    casePrefix: 'PRR',
    defaultRetentionYears: 6,
    stages: ['INTAKE', 'ASSESSMENT', 'GATHERING', 'REVIEW', 'RESPONSE', 'CLOSED'],
    closureReasons: ['Delivered', 'Withheld — Exempt', 'Partially Delivered', 'Withdrawn by Requester', 'Transferred to Custodian', 'No Responsive Records'],
    deadlineDefs: [
      { key: 'T10', label: 'T10 Initial Response', days: 10, type: 'business', triggersOn: 'creation', feeProhibitionIfMissed: true },
      { key: 'T25', label: 'T25 Production Limit', days: 25, type: 'business', triggersOn: 'creation' },
      { key: 'T90', label: 'T90 Appeal Window', days: 90, type: 'calendar', triggersOn: 'closure' },
    ],
    intakeFields: [
      ...requesterFields,
      { key: 'preferredContact', label: 'Preferred Response Method', type: 'select', required: true,
        options: ['Email', 'Mail', 'In-Person Pickup', 'Electronic Download'] },
      { key: 'requestText', label: 'Description of Records Requested', type: 'textarea', required: true,
        placeholder: 'Please describe the specific records you are seeking (what they are, the topic, date range, departments involved, etc.)',
        hint: 'Be as specific as possible. The more detail you provide, the faster we can respond.' },
      { key: 'dateRangeFrom', label: 'Records Date Range — From', type: 'date' },
      { key: 'dateRangeTo', label: 'Records Date Range — To', type: 'date' },
      { key: 'intakeNotes', label: 'Additional Notes', type: 'textarea', placeholder: 'Anything else we should know?' },
    ],
    stageFields: {
      ASSESSMENT: {
        stage: 'ASSESSMENT', label: 'Assessment',
        fields: [
          { key: 'responsiveness', label: 'Responsiveness Determination', type: 'select', required: true,
            options: ['Responsive', 'Not Responsive', 'Partially Responsive', 'Needs Clarification'] },
          { key: 'scopeNotes', label: 'Scope Definition', type: 'textarea', required: true,
            placeholder: 'Define precisely what records are within scope of this request' },
          { key: 'estimatedCompletionDate', label: 'Estimated Completion Date', type: 'date', required: true },
          { key: 'clarificationNeeded', label: 'Clarification Needed From Requester?', type: 'radio',
            options: ['No', 'Yes — sent clarification request'] },
        ],
        gateChecks: ['Responsiveness determined', 'Scope defined', 'T25 forecast evaluated'],
      },
      GATHERING: {
        stage: 'GATHERING', label: 'Gathering',
        fields: [
          { key: 'searchLocations', label: 'Locations Searched', type: 'textarea', required: true,
            placeholder: 'List all systems, files, and departments searched' },
          { key: 'recordsFoundCount', label: 'Responsive Records Found (count/est.)', type: 'text', required: true },
          { key: 'gatheringNotes', label: 'Gathering Notes', type: 'textarea' },
        ],
        gateChecks: ['All likely locations searched and documented', 'Records located or absence documented'],
      },
      REVIEW: {
        stage: 'REVIEW', label: 'Review & Exemptions',
        fields: [
          { key: 'exemptionsApplied', label: 'Exemptions Applied', type: 'select',
            options: MGL_EXEMPTIONS, hint: 'List all M.G.L. c. 4 §7(26) exemptions that apply' },
          { key: 'redactionNotes', label: 'Redaction Notes', type: 'textarea',
            placeholder: 'Describe what was redacted and why' },
          { key: 'feesAllowed', label: 'Fees Permitted?', type: 'radio',
            options: ['Yes — T10 met', 'No — T10 was missed (fee prohibition applies)'],
            hint: 'If T10 deadline was missed, fees are prohibited for this case.' },
          { key: 'feeAmount', label: 'Fee Amount (if applicable)', type: 'number', placeholder: '0.00' },
        ],
        gateChecks: ['Exemption analysis documented', 'Redactions applied and recorded', 'Fee eligibility confirmed'],
      },
      RESPONSE: {
        stage: 'RESPONSE', label: 'Response / Delivery',
        fields: [
          { key: 'deliveryMethod', label: 'Delivery Method Used', type: 'select', required: true,
            options: ['Email', 'Mail', 'In-Person Pickup', 'Electronic Download Link'] },
          { key: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
          { key: 'deliveryNotes', label: 'Delivery Notes', type: 'textarea',
            placeholder: 'Confirmation details, tracking number, or link used' },
          { key: 'responseLetterSent', label: 'Response Letter Sent?', type: 'radio',
            required: true, options: ['Yes', 'No — withholding only'] },
        ],
        requiredToAdvance: ['deliveryMethod', 'deliveryDate'],
        gateChecks: ['Records delivered (or withholding letter issued)', 'Delivery confirmed and documented'],
      },
    },
  },

  VAULTCLERK: {
    moduleId: 'VAULTCLERK',
    casePrefix: 'CLK',
    defaultRetentionYears: 10,
    stages: ['INTAKE', 'COMPLETENESS', 'INSPECTION', 'DECISION', 'ISSUANCE', 'CLOSED'],
    closureReasons: ['License Issued', 'Permit Issued', 'Denied', 'Withdrawn by Applicant', 'Deemed Approved (deadline lapsed)', 'Transferred'],
    deadlineDefs: [
      { key: 'T10', label: 'T10 Completeness Review', days: 10, type: 'business', triggersOn: 'creation' },
      { key: 'T30', label: 'T30 Decision Deadline', days: 30, type: 'business', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'applicantName', label: 'Applicant Name', type: 'text', required: true },
      { key: 'applicantEmail', label: 'Email Address', type: 'email', required: true },
      { key: 'applicantPhone', label: 'Phone Number', type: 'phone', required: true },
      { key: 'businessName', label: 'Business / Organization Name', type: 'text' },
      { key: 'licenseType', label: 'License / Permit Type', type: 'select', required: true,
        options: ['Business Certificate (DBA)', 'Dog License', 'Marriage License', 'Vital Records (Certified Copy)',
          'Plumbing Permit', 'Electrical Permit', 'Gas Fitting Permit', 'Food Service Permit',
          'Building Permit', 'Contractor Registration', 'Transient Vendor / Hawker', 'Raffle / Bazaar Permit',
          'Alcohol License (intake only)', 'Other'] },
      { key: 'propertyAddress', label: 'Property / Business Address', type: 'text' },
      { key: 'applicationNotes', label: 'Additional Details', type: 'textarea' },
    ],
    stageFields: {
      COMPLETENESS: {
        stage: 'COMPLETENESS', label: 'Completeness Review',
        fields: [
          { key: 'isComplete', label: 'Application Complete?', type: 'radio', required: true,
            options: ['Yes — all required documents received', 'No — deficiency notice sent'] },
          { key: 'missingDocs', label: 'Missing / Deficient Items', type: 'textarea',
            placeholder: 'List any documents or information still required' },
          { key: 'feeCollected', label: 'Application Fee', type: 'text', placeholder: 'Amount collected or N/A' },
        ],
        gateChecks: ['Completeness determination made', 'Deficiency notice issued if applicable'],
      },
      INSPECTION: {
        stage: 'INSPECTION', label: 'Inspection',
        fields: [
          { key: 'inspectionRequired', label: 'Inspection Required?', type: 'radio',
            options: ['Yes', 'No — not required for this type'] },
          { key: 'inspectorName', label: 'Inspector Name / Title', type: 'text' },
          { key: 'inspectionDate', label: 'Inspection Date', type: 'date' },
          { key: 'inspectionResult', label: 'Inspection Result', type: 'radio',
            options: ['Passed', 'Failed — re-inspection required', 'Conditionally Passed'] },
          { key: 'inspectionNotes', label: 'Inspection Notes', type: 'textarea' },
        ],
        gateChecks: ['Inspection completed (or confirmed not required)', 'Result documented'],
      },
      DECISION: {
        stage: 'DECISION', label: 'Decision',
        fields: [
          { key: 'decision', label: 'Decision', type: 'radio', required: true,
            options: ['Approved', 'Denied', 'Approved with Conditions'] },
          { key: 'decisionDate', label: 'Decision Date', type: 'date', required: true },
          { key: 'decidedBy', label: 'Decided By (Name / Title)', type: 'text', required: true },
          { key: 'conditions', label: 'Conditions (if any)', type: 'textarea' },
          { key: 'denialReason', label: 'Denial Reason (if denied)', type: 'textarea' },
        ],
        requiredToAdvance: ['decision', 'decisionDate', 'decidedBy'],
        gateChecks: ['Decision made and documented', 'Conditions recorded if applicable'],
      },
      ISSUANCE: {
        stage: 'ISSUANCE', label: 'Issuance',
        fields: [
          { key: 'licenseNumber', label: 'License / Permit Number', type: 'text', required: true },
          { key: 'issuanceDate', label: 'Date Issued', type: 'date', required: true },
          { key: 'expiryDate', label: 'Expiration Date', type: 'date' },
          { key: 'issuanceNotes', label: 'Issuance Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['licenseNumber', 'issuanceDate'],
        gateChecks: ['License/permit number assigned', 'Document issued to applicant'],
      },
    },
  },

  VAULTFISCAL: {
    moduleId: 'VAULTFISCAL',
    casePrefix: 'FSC',
    defaultRetentionYears: 10,
    stages: ['INTAKE', 'MATCH', 'BUDGET', 'APPROVAL', 'PAYMENT', 'CLOSED'],
    closureReasons: ['Paid', 'Rejected — Fraudulent', 'Rejected — Insufficient Docs', 'Void / Cancelled', 'Transferred'],
    deadlineDefs: [
      { key: 'T30', label: 'T30 Payment Due', days: 30, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'vendorName', label: 'Vendor Name', type: 'text', required: true },
      { key: 'vendorAddress', label: 'Vendor Address', type: 'text' },
      { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: true },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true },
      { key: 'invoiceAmount', label: 'Invoice Amount ($)', type: 'number', required: true },
      { key: 'glCode', label: 'GL Account Code', type: 'text', required: true, placeholder: 'e.g. 4100.001' },
      { key: 'poNumber', label: 'Purchase Order Number', type: 'text' },
      { key: 'serviceDescription', label: 'Description of Goods / Services', type: 'textarea', required: true },
      { key: 'periodCovered', label: 'Period Covered', type: 'text', placeholder: 'e.g. Jan 1–Jan 31, 2026' },
      { key: 'department', label: 'Department', type: 'text', required: true },
    ],
    stageFields: {
      MATCH: {
        stage: 'MATCH', label: '3-Way Match',
        fields: [
          { key: 'poVerified', label: 'Purchase Order Verified?', type: 'radio', required: true,
            options: ['Yes — PO on file and amounts match', 'No PO required (under threshold)', 'Mismatch — see notes'] },
          { key: 'receiptVerified', label: 'Receipt / Delivery Confirmed?', type: 'radio', required: true,
            options: ['Yes — goods/services received and documented', 'Partial — see notes', 'Not verified'] },
          { key: 'amountMatch', label: 'Invoice Amount Matches PO?', type: 'radio', required: true,
            options: ['Yes', 'No — variance noted below'] },
          { key: 'matchNotes', label: 'Match Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['poVerified', 'receiptVerified', 'amountMatch'],
        gateChecks: ['PO verified', 'Receipt confirmed', 'Amounts match (or variance documented)'],
      },
      BUDGET: {
        stage: 'BUDGET', label: 'Budget Availability',
        fields: [
          { key: 'budgetAvailable', label: 'Budget Available?', type: 'radio', required: true,
            options: ['Yes — sufficient funds confirmed', 'No — insufficient funds', 'Requires supplemental appropriation'] },
          { key: 'budgetNotes', label: 'Budget Notes', type: 'textarea' },
          { key: 'encumbranceNumber', label: 'Encumbrance Number', type: 'text' },
        ],
        requiredToAdvance: ['budgetAvailable'],
        gateChecks: ['Budget availability checked and documented'],
      },
      APPROVAL: {
        stage: 'APPROVAL', label: 'Approval Chain',
        fields: [
          { key: 'deptHeadApproval', label: 'Department Head Approval', type: 'radio', required: true,
            options: ['Approved', 'Rejected — returned to intake'] },
          { key: 'deptHeadName', label: 'Department Head Name', type: 'text', required: true },
          { key: 'accountantReview', label: 'Town Accountant Review (M.G.L. c.41 §56)', type: 'radio', required: true,
            options: ['Approved — warrant drawn', 'Disallowed — see notes'] },
          { key: 'accountantName', label: 'Town Accountant Name', type: 'text' },
          { key: 'approvalNotes', label: 'Approval Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['deptHeadApproval', 'accountantReview'],
        gateChecks: ['Department head approved', 'Town accountant reviewed and warrant drawn'],
      },
      PAYMENT: {
        stage: 'PAYMENT', label: 'Payment',
        fields: [
          { key: 'checkNumber', label: 'Check / ACH Number', type: 'text', required: true },
          { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true },
          { key: 'paymentAmount', label: 'Amount Paid ($)', type: 'number', required: true },
          { key: 'paymentMethod', label: 'Payment Method', type: 'select',
            options: ['Check', 'ACH / Direct Deposit', 'Wire Transfer', 'Credit Card'] },
          { key: 'paymentNotes', label: 'Payment Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['checkNumber', 'paymentDate', 'paymentAmount'],
        gateChecks: ['Payment issued and recorded', 'GL posted'],
      },
    },
  },

  VAULTFIX: {
    moduleId: 'VAULTFIX',
    casePrefix: 'FIX',
    defaultRetentionYears: 5,
    stages: ['INTAKE', 'PRIORITY', 'ASSIGNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED'],
    closureReasons: ['Completed', 'Deferred — Budgetary', 'Unable to Reproduce', 'Transferred to Contractor', 'Cancelled by Requestor'],
    deadlineDefs: [
      { key: 'SLA_CRITICAL', label: 'Critical SLA (1 business day)', days: 1, type: 'business', triggersOn: 'creation' },
      { key: 'SLA_HIGH', label: 'High Priority SLA (3 business days)', days: 3, type: 'business', triggersOn: 'creation' },
      { key: 'SLA_NORMAL', label: 'Normal SLA (10 business days)', days: 10, type: 'business', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'reporterName', label: 'Your Name', type: 'text', required: true },
      { key: 'reporterEmail', label: 'Email Address', type: 'email', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'requestType', label: 'Request Type', type: 'select', required: true,
        options: ['Facility Maintenance', 'IT Help Desk', 'Vehicle / Fleet', 'Grounds / Landscaping', 'Plumbing', 'HVAC', 'Electrical', 'Safety Hazard', 'Other'] },
      { key: 'location', label: 'Location (Building / Room / Asset)', type: 'text', required: true,
        placeholder: 'e.g. Town Hall, Room 201, or Vehicle #12' },
      { key: 'issueDescription', label: 'Description of Issue', type: 'textarea', required: true },
      { key: 'priority', label: 'Reported Priority', type: 'select', required: true,
        options: ['Critical — Safety / Service Impact', 'High — Operations Affected', 'Normal — Routine', 'Low — Cosmetic'] },
    ],
    stageFields: {
      PRIORITY: {
        stage: 'PRIORITY', label: 'Priority Assessment',
        fields: [
          { key: 'confirmedPriority', label: 'Confirmed Priority Level', type: 'select', required: true,
            options: ['Critical', 'High', 'Normal', 'Low'] },
          { key: 'activeSLA', label: 'Applicable SLA', type: 'radio',
            options: ['Critical (1 business day)', 'High (3 business days)', 'Normal (10 business days)'] },
          { key: 'priorityNotes', label: 'Priority Assessment Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['confirmedPriority'],
      },
      ASSIGNED: {
        stage: 'ASSIGNED', label: 'Assignment',
        fields: [
          { key: 'assignedTo', label: 'Assigned To (Name / Title)', type: 'text', required: true },
          { key: 'skillRequired', label: 'Skill / Trade Required', type: 'text' },
          { key: 'estimatedHours', label: 'Estimated Hours', type: 'number' },
          { key: 'materialsNeeded', label: 'Materials / Parts Needed', type: 'textarea' },
          { key: 'scheduledDate', label: 'Scheduled Work Date', type: 'date' },
        ],
        requiredToAdvance: ['assignedTo'],
        gateChecks: ['Work assigned to qualified person'],
      },
      IN_PROGRESS: {
        stage: 'IN_PROGRESS', label: 'Work in Progress',
        fields: [
          { key: 'workStartDate', label: 'Work Started Date', type: 'date', required: true },
          { key: 'workNotes', label: 'Work Log Notes', type: 'textarea' },
          { key: 'hoursActual', label: 'Actual Hours', type: 'number' },
          { key: 'materialsCost', label: 'Materials Cost ($)', type: 'number' },
        ],
      },
      VERIFICATION: {
        stage: 'VERIFICATION', label: 'Verification',
        fields: [
          { key: 'workCompletedDate', label: 'Work Completed Date', type: 'date', required: true },
          { key: 'verifiedBy', label: 'Verified By (Name / Title)', type: 'text', required: true },
          { key: 'verificationResult', label: 'Verification Result', type: 'radio',
            options: ['Passed — issue resolved', 'Partial — follow-up needed', 'Failed — back to In Progress'] },
          { key: 'verificationNotes', label: 'Verification Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['workCompletedDate', 'verifiedBy'],
        gateChecks: ['Work verified by supervisor or requestor'],
      },
    },
  },

  VAULTONBOARD: {
    moduleId: 'VAULTONBOARD',
    casePrefix: 'OBD',
    defaultRetentionYears: 5,
    stages: ['INTAKE', 'BACKGROUND', 'SETUP', 'TRAINING', 'SIGNOFF', 'CLOSED'],
    closureReasons: ['Onboarding Complete', 'Employee Did Not Start', 'Withdrawn / Rescinded', 'Transferred Process'],
    deadlineDefs: [
      { key: 'DAY1', label: 'Day 1 Setup Deadline', days: 1, type: 'calendar', triggersOn: 'creation' },
      { key: 'WEEK2', label: 'Training Complete (2 weeks)', days: 14, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
      { key: 'employeeEmail', label: 'Work Email Address', type: 'email', required: true },
      { key: 'personalEmail', label: 'Personal Email (for pre-start comms)', type: 'email' },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'position', label: 'Position / Title', type: 'text', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'supervisor', label: 'Direct Supervisor', type: 'text', required: true },
      { key: 'employeeType', label: 'Employment Type', type: 'select', required: true,
        options: ['Full-Time', 'Part-Time', 'Seasonal', 'Temporary', 'Contractor / Vendor'] },
    ],
    stageFields: {
      BACKGROUND: {
        stage: 'BACKGROUND', label: 'Background Check',
        fields: [
          { key: 'bgCheckRequired', label: 'Background Check Required?', type: 'radio',
            options: ['Yes', 'No — position exempt'] },
          { key: 'bgCheckStatus', label: 'Background Check Status', type: 'radio',
            options: ['Cleared', 'In Progress', 'Pending Review', 'Not Required'] },
          { key: 'bgCheckDate', label: 'Background Check Cleared Date', type: 'date' },
          { key: 'bgNotes', label: 'Notes', type: 'textarea' },
        ],
        gateChecks: ['Background check cleared or confirmed not required'],
      },
      SETUP: {
        stage: 'SETUP', label: 'Pre-Start Setup',
        fields: [
          { key: 'itAccountCreated', label: 'IT Accounts Created', type: 'radio',
            options: ['Yes', 'No — pending'] },
          { key: 'badgeIssued', label: 'Building Access / Badge Issued', type: 'radio',
            options: ['Yes', 'No — pending'] },
          { key: 'equipmentAssigned', label: 'Equipment Assigned', type: 'radio',
            options: ['Yes', 'No — pending'] },
          { key: 'payrollSetup', label: 'Payroll / Direct Deposit Setup', type: 'radio',
            options: ['Yes', 'No — pending'] },
          { key: 'setupNotes', label: 'Setup Notes', type: 'textarea' },
        ],
        gateChecks: ['IT accounts created', 'Building access issued', 'Payroll configured'],
      },
      TRAINING: {
        stage: 'TRAINING', label: 'Training',
        fields: [
          { key: 'orientationComplete', label: 'General Orientation Complete', type: 'radio', required: true,
            options: ['Yes', 'No — pending'] },
          { key: 'policiesAcknowledged', label: 'Policies Acknowledged', type: 'radio', required: true,
            options: ['Yes — signed', 'No — pending'] },
          { key: 'systemTrainingComplete', label: 'System / Software Training', type: 'radio',
            options: ['Yes', 'No — pending', 'Not Required'] },
          { key: 'deptTrainingComplete', label: 'Department-Specific Training', type: 'radio',
            options: ['Yes', 'No — pending'] },
          { key: 'trainingNotes', label: 'Training Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['orientationComplete', 'policiesAcknowledged'],
        gateChecks: ['Orientation and policy acknowledgment complete'],
      },
      SIGNOFF: {
        stage: 'SIGNOFF', label: 'Manager Sign-Off',
        fields: [
          { key: 'supervisorSignoff', label: 'Supervisor Sign-Off', type: 'radio', required: true,
            options: ['Complete', 'Pending'] },
          { key: 'supervisorName', label: 'Supervisor Name', type: 'text', required: true },
          { key: 'signoffDate', label: 'Sign-Off Date', type: 'date', required: true },
          { key: 'signoffNotes', label: 'Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['supervisorSignoff', 'supervisorName', 'signoffDate'],
        gateChecks: ['Manager sign-off complete'],
      },
    },
  },

  VAULTTIME: {
    moduleId: 'VAULTTIME',
    casePrefix: 'TIM',
    defaultRetentionYears: 7,
    stages: ['INTAKE', 'SUPERVISOR_REVIEW', 'OVERTIME_REVIEW', 'PAYROLL', 'POSTED'],
    closureReasons: ['Posted to Payroll', 'Corrected and Resubmitted', 'Void — Error'],
    deadlineDefs: [
      { key: 'SUBMIT', label: 'Submission Deadline (Friday EOD)', days: 5, type: 'business', triggersOn: 'creation' },
      { key: 'APPROVE', label: 'Supervisor Approval (Monday EOD)', days: 7, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'employeeName', label: 'Employee Name', type: 'text', required: true },
      { key: 'employeeId', label: 'Employee ID', type: 'text' },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'payPeriodStart', label: 'Pay Period Start Date', type: 'date', required: true },
      { key: 'payPeriodEnd', label: 'Pay Period End Date', type: 'date', required: true },
      { key: 'regularHours', label: 'Regular Hours', type: 'number', required: true },
      { key: 'overtimeHours', label: 'Overtime Hours (if any)', type: 'number' },
      { key: 'projectCode', label: 'Project / Cost Center Code', type: 'text' },
      { key: 'timesheetNotes', label: 'Notes', type: 'textarea' },
    ],
    stageFields: {
      SUPERVISOR_REVIEW: {
        stage: 'SUPERVISOR_REVIEW', label: 'Supervisor Review',
        fields: [
          { key: 'supervisorDecision', label: 'Supervisor Decision', type: 'radio', required: true,
            options: ['Approved', 'Returned — corrections needed'] },
          { key: 'supervisorName', label: 'Supervisor Name', type: 'text', required: true },
          { key: 'reviewDate', label: 'Review Date', type: 'date', required: true },
          { key: 'corrections', label: 'Corrections Required (if any)', type: 'textarea' },
        ],
        requiredToAdvance: ['supervisorDecision', 'supervisorName'],
        gateChecks: ['Supervisor has reviewed and approved (or returned)'],
      },
      OVERTIME_REVIEW: {
        stage: 'OVERTIME_REVIEW', label: 'Overtime Authorization',
        fields: [
          { key: 'overtimeAuthorized', label: 'Overtime Authorized?', type: 'radio', required: true,
            options: ['Yes — pre-authorized', 'Yes — retroactively authorized', 'No — not authorized (see notes)'] },
          { key: 'authorizedBy', label: 'Authorized By', type: 'text' },
          { key: 'overtimeReason', label: 'Reason for Overtime', type: 'textarea' },
        ],
      },
      PAYROLL: {
        stage: 'PAYROLL', label: 'Payroll Submission',
        fields: [
          { key: 'submittedToPayroll', label: 'Submitted to Payroll?', type: 'radio', required: true,
            options: ['Yes', 'No — pending'] },
          { key: 'payrollSubmissionDate', label: 'Payroll Submission Date', type: 'date' },
          { key: 'payrollNotes', label: 'Payroll Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['submittedToPayroll'],
        gateChecks: ['Submitted to payroll system'],
      },
    },
  },
  VAULTPERMIT: {
    moduleId: 'VAULTPERMIT',
    casePrefix: 'PRM',
    defaultRetentionYears: 7,
    stages: ['INTAKE', 'VERIFICATION', 'CONDITIONS', 'FEES', 'ISSUANCE', 'COMPLIANCE', 'CLOSED'],
    closureReasons: ['Permit Issued', 'Certificate of Occupancy Issued', 'Denied', 'Withdrawn by Applicant', 'Expired — Not Exercised', 'Transferred to Inspector'],
    deadlineDefs: [
      { key: 'T7', label: 'T7 Completeness Review', days: 7, type: 'business', triggersOn: 'creation' },
      { key: 'T30', label: 'T30 Decision Deadline (M.G.L. c.40A §9)', days: 30, type: 'business', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'applicantName', label: 'Applicant / Owner Name', type: 'text', required: true },
      { key: 'applicantEmail', label: 'Email Address', type: 'email', required: true },
      { key: 'applicantPhone', label: 'Phone Number', type: 'phone', required: true },
      { key: 'propertyAddress', label: 'Property Address', type: 'text', required: true,
        placeholder: '123 Main St, Logicville, MA 01600' },
      { key: 'parcelId', label: 'Assessor Parcel ID (Map/Block/Lot)', type: 'text', required: true,
        placeholder: 'e.g. 0023-0004-0007' },
      { key: 'permitType', label: 'Permit Type', type: 'select', required: true,
        options: ['Building Permit — New Construction', 'Building Permit — Addition/Alteration', 'Building Permit — Demolition',
          'Electrical Permit', 'Plumbing Permit', 'Gas Fitting Permit', 'Mechanical / HVAC Permit',
          'Sign Permit', 'Fence Permit', 'Pool / Hot Tub Permit', 'Accessory Structure', 'Foundation Permit',
          'Zoning Variance (ZBA)', 'Zoning Special Permit (ZBA)', 'Comprehensive Permit (40B)', 'Other'] },
      { key: 'projectDescription', label: 'Project Description', type: 'textarea', required: true,
        placeholder: 'Describe the scope of work — what is being built, altered, or demolished?' },
      { key: 'estimatedCost', label: 'Estimated Project Cost ($)', type: 'number', required: true },
      { key: 'contractorName', label: 'Contractor Name / Company', type: 'text' },
      { key: 'contractorLicense', label: 'Contractor License Number (CSL or HIC)', type: 'text' },
      { key: 'contractorPhone', label: 'Contractor Phone', type: 'phone' },
      { key: 'workerCompPolicy', label: "Workers' Comp Policy Number", type: 'text' },
      { key: 'plansAttached', label: 'Plans / Drawings Submitted?', type: 'radio',
        options: ['Yes — attached with this application', 'No — to be submitted separately'] },
    ],
    stageFields: {
      VERIFICATION: {
        stage: 'VERIFICATION', label: 'Application Verification',
        fields: [
          { key: 'plansVerified', label: 'Plans / Drawings Verified (stamped by PE/RA if req.)?', type: 'radio', required: true,
            options: ['Yes — stamped plans on file', 'Yes — no PE stamp required for this scope', 'No — deficiency notice sent'] },
          { key: 'parcelVerified', label: 'Parcel Data Confirmed (zoning, setbacks, use)?', type: 'radio', required: true,
            options: ['Yes — conforms to zoning', 'No — ZBA referral required', 'Needs further review'] },
          { key: 'contractorLicenseVerified', label: 'Contractor License Verified (MA OCABR)?', type: 'radio',
            options: ['Yes', 'No — unlicensed contractor (owner/builder noted)', 'N/A'] },
          { key: 'workerCompVerified', label: "Workers' Comp Certificate on File?", type: 'radio', required: true,
            options: ["Yes — certificate on file", "No — applicant exempt (owner)", "Outstanding — application on hold"] },
          { key: 'verificationNotes', label: 'Verification Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['plansVerified', 'parcelVerified', 'workerCompVerified'],
        gateChecks: ['Plans verified', 'Zoning compliance confirmed', "Workers' comp certificate on file"],
      },
      CONDITIONS: {
        stage: 'CONDITIONS', label: 'Conditions Review',
        fields: [
          { key: 'boardApprovalRequired', label: 'Board Approval Required?', type: 'radio',
            options: ['No — Building Commissioner has authority', 'ZBA Variance Required', 'ZBA Special Permit Required',
              'Planning Board Site Plan Required', 'Conservation Commission Order Required'] },
          { key: 'boardDecisionNumber', label: 'Board Decision / Case Number (if applicable)', type: 'text' },
          { key: 'boardDecisionDate', label: 'Board Decision Date', type: 'date' },
          { key: 'conditions', label: 'Conditions Imposed', type: 'textarea',
            placeholder: 'List all conditions attached to the approval (setbacks, landscaping, inspections, etc.)' },
          { key: 'conditionsNotes', label: 'Conditions Review Notes', type: 'textarea' },
        ],
        gateChecks: ['Board approval confirmed or confirmed not required', 'All conditions documented'],
      },
      FEES: {
        stage: 'FEES', label: 'Fee Collection',
        fields: [
          { key: 'feeScheduleApplied', label: 'Fee Schedule Applied', type: 'select', required: true,
            options: ['Standard Building Fee Schedule', 'Flat Fee — Minor Work', 'ZBA Application Fee', 'Waiver Requested'] },
          { key: 'feeAmount', label: 'Fee Amount ($)', type: 'number', required: true },
          { key: 'feePaidDate', label: 'Date Fee Paid', type: 'date', required: true },
          { key: 'receiptNumber', label: 'Receipt Number', type: 'text', required: true },
          { key: 'feeNotes', label: 'Fee Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['feeAmount', 'feePaidDate', 'receiptNumber'],
        gateChecks: ['Fee calculated per schedule', 'Payment received and receipted'],
      },
      ISSUANCE: {
        stage: 'ISSUANCE', label: 'Permit Issuance',
        fields: [
          { key: 'permitNumber', label: 'Permit Number', type: 'text', required: true,
            placeholder: 'e.g. PRM-2026-0042' },
          { key: 'issueDate', label: 'Date Issued', type: 'date', required: true },
          { key: 'expirationDate', label: 'Permit Expiration Date (1 year from issue)', type: 'date', required: true },
          { key: 'issuedBy', label: 'Issued By (Building Commissioner / Inspector)', type: 'text', required: true },
          { key: 'postedOnSite', label: 'Permit Posted at Job Site?', type: 'radio',
            options: ['Yes — applicant advised', 'Not yet — notice given'] },
          { key: 'issuanceNotes', label: 'Issuance Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['permitNumber', 'issueDate', 'expirationDate', 'issuedBy'],
        gateChecks: ['Permit number assigned', 'Issued date and expiration set', 'Permit in applicant hands'],
      },
      COMPLIANCE: {
        stage: 'COMPLIANCE', label: 'Final Inspection & Compliance',
        fields: [
          { key: 'finalInspectionDate', label: 'Final Inspection Date', type: 'date', required: true },
          { key: 'inspectorName', label: 'Inspector Name / Title', type: 'text', required: true },
          { key: 'inspectionResult', label: 'Inspection Result', type: 'radio', required: true,
            options: ['Passed — work complete and compliant', 'Failed — see notes', 'Partial — follow-up required'] },
          { key: 'coIssued', label: 'Certificate of Occupancy / Use Issued?', type: 'radio',
            options: ['Yes — CO issued', 'No — CO not required for this permit type', 'No — pending re-inspection'] },
          { key: 'coNumber', label: 'CO Number (if issued)', type: 'text' },
          { key: 'coDate', label: 'CO Issue Date', type: 'date' },
          { key: 'complianceNotes', label: 'Compliance Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['finalInspectionDate', 'inspectorName', 'inspectionResult'],
        gateChecks: ['Final inspection passed', 'CO issued or confirmed not required'],
      },
    },
  },

  VAULTHR: {
    moduleId: 'VAULTHR',
    casePrefix: 'HRP',
    defaultRetentionYears: 10,
    stages: ['INTAKE', 'HR_REVIEW', 'DEPT_HEAD', 'TOWN_MANAGER', 'EXECUTION', 'CLOSED'],
    closureReasons: ['Action Executed', 'Withdrawn', 'Denied', 'Grievance Settled', 'Transferred to MCAD/EEOC', 'Arbitration Initiated'],
    deadlineDefs: [
      { key: 'T15', label: 'T15 HR Initial Review', days: 15, type: 'business', triggersOn: 'creation' },
      { key: 'T30', label: 'T30 Resolution Target', days: 30, type: 'business', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
      { key: 'employeeId', label: 'Employee ID', type: 'text' },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'supervisor', label: 'Direct Supervisor', type: 'text', required: true },
      { key: 'actionType', label: 'Action / Request Type', type: 'select', required: true,
        options: ['New Hire — Personnel File Setup', 'Promotion / Reclassification', 'Demotion', 'Termination',
          'Voluntary Resignation', 'Retirement', 'Leave of Absence Request', 'FMLA Request',
          'Performance Improvement Plan', 'Written Warning / Discipline', 'Suspension',
          'Formal Grievance Filing', 'ADA / Reasonable Accommodation', 'Annual Evaluation',
          'Salary Step Increase', 'Title / Position Change', 'Other Personnel Action'] },
      { key: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
      { key: 'unionMember', label: 'Union Member?', type: 'radio',
        options: ['Yes', 'No — non-union', 'Unknown'] },
      { key: 'cbaReference', label: 'CBA Article / Section (if union)', type: 'text',
        placeholder: 'e.g. Article XII, Section 3' },
      { key: 'actionDescription', label: 'Description of Action / Request', type: 'textarea', required: true,
        placeholder: 'Provide full factual context. This is a personnel record — be precise and objective.' },
      { key: 'confidentialFlag', label: 'Contains Sensitive / Medical Information?', type: 'radio',
        options: ['No', 'Yes — restrict access per HIPAA / M.G.L. c.111 §70E'] },
    ],
    stageFields: {
      HR_REVIEW: {
        stage: 'HR_REVIEW', label: 'HR Review',
        fields: [
          { key: 'hrDetermination', label: 'HR Initial Determination', type: 'radio', required: true,
            options: ['Proceed — properly documented', 'Return — additional information needed', 'Escalate — legal review required'] },
          { key: 'coriRequired', label: 'CORI / Background Check Required?', type: 'radio',
            options: ['No', 'Yes — CORI cleared', 'Yes — pending'] },
          { key: 'unionNotificationRequired', label: 'Union Notification Required?', type: 'radio',
            options: ['No', 'Yes — notice sent', 'Yes — pending'] },
          { key: 'unionNotificationDate', label: 'Union Notification Date (if req.)', type: 'date' },
          { key: 'grievanceProcedureApplied', label: 'Grievance Procedure Applicable?', type: 'radio',
            options: ['No', 'Yes — Step 1 initiated', 'Yes — Step 2', 'Yes — Step 3 (arbitration request)'] },
          { key: 'hrNotes', label: 'HR Review Notes', type: 'textarea', required: true,
            placeholder: 'Document HR findings, legal authority, and recommended action with specificity.' },
        ],
        requiredToAdvance: ['hrDetermination', 'hrNotes'],
        gateChecks: ['HR review completed and documented', 'Union obligations confirmed'],
      },
      DEPT_HEAD: {
        stage: 'DEPT_HEAD', label: 'Department Head Review',
        fields: [
          { key: 'deptHeadDecision', label: 'Department Head Decision', type: 'radio', required: true,
            options: ['Approved — proceed to Town Manager', 'Return to HR — modification needed', 'Withdrawn by Department'] },
          { key: 'deptHeadName', label: 'Department Head Name', type: 'text', required: true },
          { key: 'deptHeadDate', label: 'Decision Date', type: 'date', required: true },
          { key: 'deptHeadNotes', label: 'Department Head Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['deptHeadDecision', 'deptHeadName', 'deptHeadDate'],
        gateChecks: ['Department head has reviewed and signed off'],
      },
      TOWN_MANAGER: {
        stage: 'TOWN_MANAGER', label: 'Town Manager / Select Board',
        fields: [
          { key: 'tmDecision', label: 'Town Manager Decision', type: 'radio', required: true,
            options: ['Approved — proceed to execution', 'Return — modifications required', 'Denied', 'Referred to Select Board'] },
          { key: 'tmName', label: 'Town Manager / Authorized Official', type: 'text', required: true },
          { key: 'tmDate', label: 'Decision Date', type: 'date', required: true },
          { key: 'selectBoardVote', label: 'Select Board Vote # (if required)', type: 'text' },
          { key: 'tmNotes', label: 'Town Manager Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['tmDecision', 'tmName', 'tmDate'],
        gateChecks: ['Town Manager has authorized the action'],
      },
      EXECUTION: {
        stage: 'EXECUTION', label: 'Execution & Records',
        fields: [
          { key: 'actionExecutedDate', label: 'Action Executed Date', type: 'date', required: true },
          { key: 'personnelFileUpdated', label: 'Personnel File Updated?', type: 'radio', required: true,
            options: ['Yes', 'No — pending'] },
          { key: 'payrollNotified', label: 'Payroll Notified?', type: 'radio',
            options: ['Yes', 'No — not required', 'No — pending'] },
          { key: 'unionFinalNotice', label: 'Final Union Notice Sent?', type: 'radio',
            options: ['Yes', 'No — not required'] },
          { key: 'employeeNotified', label: 'Employee Notified in Writing?', type: 'radio', required: true,
            options: ['Yes — written notice provided', 'No — verbal only (document reason)'] },
          { key: 'executionNotes', label: 'Execution Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['actionExecutedDate', 'personnelFileUpdated', 'employeeNotified'],
        gateChecks: ['Action executed', 'Personnel file updated', 'Employee notified in writing'],
      },
    },
  },

  VAULTPROCURE: {
    moduleId: 'VAULTPROCURE',
    casePrefix: 'PCR',
    defaultRetentionYears: 10,
    stages: ['SPEC', 'SOLICITATION', 'BID_EVAL', 'AWARD', 'CONTRACT', 'MONITORING', 'CLOSED'],
    closureReasons: ['Contract Closed — All Obligations Met', 'Contract Terminated for Convenience', 'Contract Terminated for Default', 'No Award — Cancelled', 'Emergency Procurement — Closed', 'Transferred'],
    deadlineDefs: [
      { key: 'IFB_T14', label: 'IFB Notice — 14 calendar days before opening (c.30B §5)', days: 14, type: 'calendar', triggersOn: 'creation' },
      { key: 'RFP_T30', label: 'RFP Notice — 30 calendar days before opening (c.30B §6)', days: 30, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'projectTitle', label: 'Project / Procurement Title', type: 'text', required: true,
        placeholder: 'e.g. FY2026 Road Maintenance Services' },
      { key: 'department', label: 'Requesting Department', type: 'text', required: true },
      { key: 'procurementOfficer', label: 'Chief Procurement Officer', type: 'text', required: true },
      { key: 'procurementMethod', label: 'Procurement Method (M.G.L. c.30B)', type: 'select', required: true,
        options: ['IFB — Invitation for Bids (>$50,000, c.30B §5)', 'RFP — Request for Proposals (>$50,000, c.30B §6)',
          'Quotes — Written Quotes ($10,000–$50,000, c.30B §4)', 'Sole Source (c.30B §7)',
          'Emergency Procurement (c.30B §8)', 'Cooperative Purchasing (c.30B §22)',
          'Designer Services (M.G.L. c.7C §44)', 'Construction (M.G.L. c.149 §44A)',
          'Professional Services (<$10,000)', 'Direct Purchase (<$10,000)'] },
      { key: 'estimatedValue', label: 'Estimated Contract Value ($)', type: 'number', required: true },
      { key: 'projectDescription', label: 'Scope of Work / Services Description', type: 'textarea', required: true },
      { key: 'fundingSource', label: 'Funding Source / Account', type: 'text', required: true,
        placeholder: 'e.g. General Fund 4100.001, Chapter 90 Grant, ARPA' },
      { key: 'requiredByDate', label: 'Goods/Services Required By', type: 'date' },
      { key: 'priorContractNumber', label: 'Prior Contract / Reference Number', type: 'text' },
    ],
    stageFields: {
      SPEC: {
        stage: 'SPEC', label: 'Specification & Planning',
        fields: [
          { key: 'specComplete', label: 'Specifications / Scope Complete?', type: 'radio', required: true,
            options: ['Yes — approved by dept head', 'No — in progress'] },
          { key: 'evaluationCriteria', label: 'Evaluation Criteria Defined', type: 'textarea', required: true,
            placeholder: 'List criteria and weights (e.g. Price 40%, Experience 30%, References 30%)' },
          { key: 'legalReviewRequired', label: 'Legal / Town Counsel Review Required?', type: 'radio',
            options: ['No', 'Yes — approved', 'Yes — pending'] },
          { key: 'bondRequired', label: 'Performance / Bid Bond Required?', type: 'radio',
            options: ['No', 'Bid Bond Required', 'Performance Bond Required', 'Both Required'] },
          { key: 'insuranceRequirements', label: 'Insurance Requirements', type: 'textarea',
            placeholder: 'CGL $1M/$2M, Auto, WC, umbrella — per town insurance schedule' },
          { key: 'specNotes', label: 'Specification Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['specComplete', 'evaluationCriteria'],
        gateChecks: ['Specifications complete and approved', 'Evaluation criteria documented'],
      },
      SOLICITATION: {
        stage: 'SOLICITATION', label: 'Solicitation',
        fields: [
          { key: 'noticePublishedDate', label: 'Public Notice Published Date', type: 'date', required: true },
          { key: 'publicationSources', label: 'Publication Sources', type: 'textarea', required: true,
            placeholder: 'COMMBUYS (required), Central Register, local newspaper, town website' },
          { key: 'bidOpeningDate', label: 'Bid / Proposal Opening Date', type: 'date', required: true },
          { key: 'addendaCount', label: 'Number of Addenda Issued', type: 'number' },
          { key: 'addendaNotes', label: 'Addenda Summary', type: 'textarea',
            placeholder: 'Summarize any addenda issued and confirm all bidders notified' },
          { key: 'prebidMeeting', label: 'Pre-Bid Meeting Held?', type: 'radio',
            options: ['No', 'Yes — optional', 'Yes — mandatory'] },
        ],
        requiredToAdvance: ['noticePublishedDate', 'bidOpeningDate', 'publicationSources'],
        gateChecks: ['Notice published on COMMBUYS', 'Statutory notice period satisfied', 'Bid opening scheduled'],
      },
      BID_EVAL: {
        stage: 'BID_EVAL', label: 'Bid / Proposal Evaluation',
        fields: [
          { key: 'bidsReceivedCount', label: 'Bids / Proposals Received (count)', type: 'number', required: true },
          { key: 'lowestResponsiveBid', label: 'Lowest Responsive Bid Amount ($)', type: 'number' },
          { key: 'lowestBidderName', label: 'Lowest Responsive Bidder / Proposer Name', type: 'text', required: true },
          { key: 'evaluationSummary', label: 'Evaluation Summary', type: 'textarea', required: true,
            placeholder: 'Document how each bid/proposal was evaluated against criteria. Note any non-responsive bids and reason.' },
          { key: 'protestReceived', label: 'Protest / Bid Challenge Received?', type: 'radio',
            options: ['No', 'Yes — resolved', 'Yes — pending resolution'] },
          { key: 'evalNotes', label: 'Evaluation Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['bidsReceivedCount', 'lowestBidderName', 'evaluationSummary'],
        gateChecks: ['All bids evaluated against documented criteria', 'Responsiveness and responsibility determined'],
      },
      AWARD: {
        stage: 'AWARD', label: 'Award',
        fields: [
          { key: 'awardedTo', label: 'Awarded To (Vendor Name)', type: 'text', required: true },
          { key: 'awardAmount', label: 'Award Amount ($)', type: 'number', required: true },
          { key: 'boardVoteRequired', label: 'Select Board / Committee Vote Required?', type: 'radio',
            options: ['No — within CPO authority', 'Yes — vote obtained'] },
          { key: 'boardVoteNumber', label: 'Vote Reference (meeting date / motion #)', type: 'text' },
          { key: 'boardVoteDate', label: 'Vote Date', type: 'date' },
          { key: 'awardNoticeSent', label: 'Award / Non-Award Notices Sent?', type: 'radio', required: true,
            options: ['Yes — all bidders notified', 'No — pending'] },
          { key: 'awardNotes', label: 'Award Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['awardedTo', 'awardAmount', 'awardNoticeSent'],
        gateChecks: ['Award made to lowest responsive responsible bidder', 'Board vote obtained if required', 'All bidders notified'],
      },
      CONTRACT: {
        stage: 'CONTRACT', label: 'Contract Execution',
        fields: [
          { key: 'contractSignedDate', label: 'Contract Signed Date', type: 'date', required: true },
          { key: 'contractTerm', label: 'Contract Term', type: 'text', required: true,
            placeholder: 'e.g. July 1, 2026 – June 30, 2027' },
          { key: 'performanceBondOnFile', label: 'Performance Bond on File?', type: 'radio',
            options: ['Yes', 'No — not required', 'No — outstanding'] },
          { key: 'insuranceCertsOnFile', label: 'Insurance Certificates on File?', type: 'radio', required: true,
            options: ['Yes', 'No — outstanding'] },
          { key: 'contractNumber', label: 'Contract Number', type: 'text', required: true },
          { key: 'townCounselApproval', label: 'Town Counsel Approved Contract?', type: 'radio',
            options: ['Yes', 'No — waived for standard form', 'No — pending'] },
          { key: 'contractNotes', label: 'Contract Execution Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['contractSignedDate', 'contractTerm', 'contractNumber', 'insuranceCertsOnFile'],
        gateChecks: ['Contract fully executed', 'Insurance certificates on file', 'Performance bond on file (if required)'],
      },
      MONITORING: {
        stage: 'MONITORING', label: 'Contract Monitoring',
        fields: [
          { key: 'milestoneMet', label: 'Current Milestone Status', type: 'select',
            options: ['On Track', 'Delayed — vendor notified', 'Delayed — cure notice issued', 'Default — termination initiated'] },
          { key: 'changeOrdersIssued', label: 'Change Orders Issued (count)', type: 'number' },
          { key: 'changeOrderTotal', label: 'Total Change Order Value ($)', type: 'number' },
          { key: 'finalCost', label: 'Final Contract Cost ($)', type: 'number' },
          { key: 'closeoutDate', label: 'Contract Closeout Date', type: 'date' },
          { key: 'vendorPerformanceRating', label: 'Vendor Performance Rating', type: 'select',
            options: ['Excellent', 'Satisfactory', 'Below Expectations', 'Unsatisfactory'] },
          { key: 'monitoringNotes', label: 'Monitoring Notes', type: 'textarea' },
        ],
        gateChecks: ['All deliverables accepted', 'Final payment authorized', 'Vendor performance documented'],
      },
    },
  },

  VAULTRECS: {
    moduleId: 'VAULTRECS',
    casePrefix: 'REC',
    defaultRetentionYears: 6,
    stages: ['CLASSIFICATION', 'SCHEDULE', 'ACTIVE', 'REVIEW', 'DISPOSITION', 'CLOSED'],
    closureReasons: ['Destroyed per Approved Schedule', 'Transferred to State Archives', 'Transferred to Supervisor of Public Records', 'Permanently Retained', 'Litigation Hold — Active', 'Transferred to Another Custodian'],
    deadlineDefs: [
      { key: 'MATURITY', label: 'Retention Maturity Review', days: 0, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'recordSeriesName', label: 'Record Series Name', type: 'text', required: true,
        placeholder: 'e.g. "Annual Town Meeting Warrants" or "DPW Work Orders — FY2018"' },
      { key: 'department', label: 'Custodial Department', type: 'text', required: true },
      { key: 'custodialOfficer', label: 'Records Custodian Name / Title', type: 'text', required: true },
      { key: 'dateRangeStart', label: 'Records Date Range — Start', type: 'date', required: true },
      { key: 'dateRangeEnd', label: 'Records Date Range — End', type: 'date', required: true },
      { key: 'estimatedVolume', label: 'Estimated Volume', type: 'text', required: true,
        placeholder: 'e.g. 4 boxes, 12 file folders, 2.3 GB' },
      { key: 'format', label: 'Record Format', type: 'select', required: true,
        options: ['Paper Only', 'Electronic Only', 'Mixed (Paper + Electronic)', 'Microfilm / Microfiche', 'Photographs / Maps'] },
      { key: 'storageLocation', label: 'Current Storage Location', type: 'text', required: true,
        placeholder: 'e.g. Town Hall, Basement Room B-4, Shelf 3; or network path' },
      { key: 'confidentialityLevel', label: 'Confidentiality Level', type: 'select', required: true,
        options: ['Public — unrestricted', 'Confidential — personnel records (M.G.L. c.41 §97A)', 'Confidential — medical (HIPAA)', 'Restricted — ongoing investigation', 'Restricted — attorney-client privilege'] },
    ],
    stageFields: {
      CLASSIFICATION: {
        stage: 'CLASSIFICATION', label: 'Classification',
        fields: [
          { key: 'recordType', label: 'Record Classification Type', type: 'select', required: true,
            options: ['Administrative / Operational', 'Financial / Fiscal', 'Personnel / HR', 'Legal / Litigation',
              'Vital Records (birth/death/marriage)', 'Land / Property Records', 'Meeting / Legislative Records',
              'Grant / Federal Records', 'Environmental / Engineering', 'General Correspondence'] },
          { key: 'seriesCode', label: 'SPR Record Series Code (from MA Retention Schedule)', type: 'text', required: true,
            placeholder: 'e.g. GS-2 (General Correspondence) or MU-6 (Financial Records)' },
          { key: 'departmentConfirmed', label: 'Custodial Department Confirmed Ownership?', type: 'radio', required: true,
            options: ['Yes', 'No — disputed, see notes'] },
          { key: 'classificationNotes', label: 'Classification Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['recordType', 'seriesCode', 'departmentConfirmed'],
        gateChecks: ['Record type classified', 'SPR series code assigned', 'Custodial ownership confirmed'],
      },
      SCHEDULE: {
        stage: 'SCHEDULE', label: 'Retention Schedule Assignment',
        fields: [
          { key: 'scheduleReference', label: 'Retention Schedule Reference', type: 'text', required: true,
            placeholder: 'e.g. "Massachusetts Municipal Records Retention Schedule, Series GS-2 — 7 years"' },
          { key: 'retentionYears', label: 'Retention Period (years)', type: 'number', required: true },
          { key: 'dispositionAction', label: 'Disposition Action at Maturity', type: 'select', required: true,
            options: ['Destroy — certified shredding / secure deletion', 'Transfer to State Archives', 'Transfer to Supervisor of Public Records', 'Retain Permanently', 'Review Again at Maturity'] },
          { key: 'maturityDate', label: 'Retention Maturity Date', type: 'date', required: true },
          { key: 'scheduleNotes', label: 'Schedule Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['scheduleReference', 'retentionYears', 'dispositionAction', 'maturityDate'],
        gateChecks: ['Retention schedule applied and maturity date set', 'Disposition action documented'],
      },
      ACTIVE: {
        stage: 'ACTIVE', label: 'Active Retention',
        fields: [
          { key: 'storageConfirmed', label: 'Storage Location Confirmed / Updated?', type: 'radio', required: true,
            options: ['Yes', 'No — location changed, updated below'] },
          { key: 'currentStorageLocation', label: 'Current Storage Location (confirm or update)', type: 'text' },
          { key: 'accessRestrictions', label: 'Access Restrictions Applied?', type: 'radio',
            options: ['No restrictions — public', 'Yes — restricted to custodial dept', 'Yes — HR/legal hold only'] },
          { key: 'findingAidCreated', label: 'Finding Aid / Index Created?', type: 'radio',
            options: ['Yes — on file', 'No — not required for this series', 'No — pending'] },
          { key: 'activeNotes', label: 'Active Retention Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['storageConfirmed'],
        gateChecks: ['Storage location verified', 'Access restrictions applied'],
      },
      REVIEW: {
        stage: 'REVIEW', label: 'Maturity Review',
        fields: [
          { key: 'litigationHoldCheck', label: 'Litigation Hold Check — Any Active Cases?', type: 'radio', required: true,
            options: ['No — no known litigation holds', 'Yes — HOLD REQUIRED, do not destroy', 'Unknown — checking with town counsel'] },
          { key: 'prrImpact', label: 'Outstanding Public Records Request Impact?', type: 'radio', required: true,
            options: ['No active PRR on this series', 'Yes — PRR pending, defer disposition'] },
          { key: 'destructionAuthRequested', label: 'Destruction Authorization Requested from SPR?', type: 'radio',
            options: ['No — SPR auth not required for this series', 'Yes — SPR Form submitted', 'Yes — SPR Form approved'] },
          { key: 'reviewNotes', label: 'Review Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['litigationHoldCheck', 'prrImpact'],
        gateChecks: ['Litigation hold check complete', 'No outstanding PRR on these records', 'SPR authorization obtained (if required)'],
      },
      DISPOSITION: {
        stage: 'DISPOSITION', label: 'Disposition Execution',
        fields: [
          { key: 'sprFormNumber', label: 'SPR Authorization Form Number (if applicable)', type: 'text' },
          { key: 'supervisorAuthorizationName', label: 'Authorizing Official Name', type: 'text', required: true },
          { key: 'destructionMethod', label: 'Destruction / Disposition Method', type: 'select', required: true,
            options: ['Certified On-Site Shredding', 'Iron Mountain / Vendor Shredding', 'Municipal DPW Shredder', 'Secure Electronic Deletion', 'Permanent Transfer to State Archives', 'Permanent Transfer to Town Vault'] },
          { key: 'dispositionDate', label: 'Disposition Date', type: 'date', required: true },
          { key: 'certificateNumber', label: 'Certificate of Destruction Number', type: 'text' },
          { key: 'dispositionNotes', label: 'Disposition Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['supervisorAuthorizationName', 'destructionMethod', 'dispositionDate'],
        gateChecks: ['Disposition authorized in writing', 'Records destroyed or transferred', 'Certificate of destruction on file'],
      },
    },
  },

  VAULTMEET: {
    moduleId: 'VAULTMEET',
    casePrefix: 'MTG',
    defaultRetentionYears: 7,
    stages: ['NOTICE', 'AGENDA', 'IN_MEETING', 'DRAFT_MINUTES', 'APPROVED', 'POSTED', 'CLOSED'],
    closureReasons: ['Minutes Approved and Posted', 'Meeting Cancelled', 'Meeting Rescheduled — New Case Created', 'Executive Session Only — Minutes Sealed'],
    deadlineDefs: [
      { key: 'NOTICE_48H', label: 'T48H Notice Deadline (M.G.L. c.30A §20)', days: 2, type: 'calendar', triggersOn: 'creation' },
      { key: 'MINUTES_T30', label: 'T30 Minutes Approval (M.G.L. c.30A §22)', days: 30, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      { key: 'publicBodyName', label: 'Public Body / Board Name', type: 'select', required: true,
        options: ['Select Board', 'Planning Board', 'Zoning Board of Appeals (ZBA)', 'Conservation Commission',
          'Board of Health', 'School Committee', 'Finance Committee', 'Capital Improvement Committee',
          'Council on Aging', 'Historical Commission', 'Library Trustees', 'Recreation Committee',
          'Open Space Committee', 'Affordable Housing Trust', 'Other Board / Committee / Commission'] },
      { key: 'meetingType', label: 'Meeting Type', type: 'select', required: true,
        options: ['Regular / Scheduled Meeting', 'Special Meeting', 'Emergency Meeting (c.30A §20(d))', 'Executive Session Only', 'Joint Meeting (multi-board)', 'Annual Town Meeting', 'Special Town Meeting'] },
      { key: 'meetingDate', label: 'Meeting Date', type: 'date', required: true },
      { key: 'meetingTime', label: 'Meeting Start Time', type: 'text', required: true,
        placeholder: 'e.g. 6:30 PM' },
      { key: 'meetingLocation', label: 'Meeting Location', type: 'text', required: true,
        placeholder: 'e.g. Logicville Town Hall, 1 Logicville Common, Room 201' },
      { key: 'remoteParticipation', label: 'Remote Participation Authorized?', type: 'radio',
        options: ['No — in-person only', 'Yes — hybrid (Zoom/Teams + in person)', 'Yes — fully remote (emergency only)'] },
      { key: 'executiveSessionAnticipated', label: 'Executive Session Anticipated?', type: 'radio',
        options: ['No', 'Yes — purpose stated below', 'Unknown at time of notice'] },
      { key: 'executiveSessionPurpose', label: 'Executive Session Purpose (M.G.L. c.30A §21)', type: 'select',
        options: ['N/A', '(1) Personnel — review, discipline, dismissal of public officer/employee',
          '(2) Collective bargaining / CBA strategy', '(3) Real property acquisition / disposition',
          '(4) Litigation / attorney-client privilege', '(5) Investigations — criminal / regulatory',
          '(6) Competitive sealed bidding', '(7) Records or data classified by state/federal law',
          '(8) Security plans / procedures', '(9) Board of Library Trustees — gifts',
          '(10) Athletic scholarship applications'] },
    ],
    stageFields: {
      NOTICE: {
        stage: 'NOTICE', label: 'Public Notice',
        fields: [
          { key: 'noticePostedDate', label: 'Notice Posted Date', type: 'date', required: true },
          { key: 'noticePostedTime', label: 'Notice Posted Time', type: 'text', required: true,
            placeholder: 'e.g. 4:15 PM (must be 48 hours before meeting)' },
          { key: 'postingLocations', label: 'Posting Locations Confirmed', type: 'textarea', required: true,
            placeholder: 'Town website (required), Town Hall bulletin board (required), Town Clerk office, additional as required by bylaw' },
          { key: 'fortyEightHoursMet', label: '48-Hour Requirement Met?', type: 'radio', required: true,
            options: ['Yes — 48 hours confirmed', 'No — emergency exception invoked (c.30A §20(d))', 'No — irregularity (document reason)'] },
          { key: 'emergencyBasisDocumented', label: 'Emergency Basis Documented? (if exception invoked)', type: 'textarea' },
          { key: 'noticeNotes', label: 'Notice Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['noticePostedDate', 'noticePostedTime', 'postingLocations', 'fortyEightHoursMet'],
        gateChecks: ['Notice posted with ≥48 hours (or emergency documented)', 'All required posting locations confirmed'],
      },
      AGENDA: {
        stage: 'AGENDA', label: 'Agenda',
        fields: [
          { key: 'agendaItems', label: 'Agenda Items', type: 'textarea', required: true,
            placeholder: 'List all agenda items in order:\n1. Call to Order\n2. Public Comment\n3. Old Business — [item]\n4. New Business — [item]\n5. Adjournment' },
          { key: 'executiveSessionItem', label: 'Executive Session on Agenda?', type: 'radio',
            options: ['No', 'Yes — listed with statutory purpose'] },
          { key: 'chairpersonName', label: 'Chairperson Name', type: 'text', required: true },
          { key: 'agendaNotes', label: 'Agenda Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['agendaItems', 'chairpersonName'],
        gateChecks: ['Agenda finalized', 'Chairperson identified'],
      },
      IN_MEETING: {
        stage: 'IN_MEETING', label: 'Meeting in Progress',
        fields: [
          { key: 'quorumPresent', label: 'Quorum Present?', type: 'radio', required: true,
            options: ['Yes', 'No — meeting cannot proceed'] },
          { key: 'membersPresent', label: 'Members Present', type: 'textarea', required: true,
            placeholder: 'List names of all members present' },
          { key: 'membersAbsent', label: 'Members Absent', type: 'textarea' },
          { key: 'actualStartTime', label: 'Meeting Called to Order At', type: 'text' },
          { key: 'actualEndTime', label: 'Meeting Adjourned At', type: 'text' },
          { key: 'executiveSessionEntered', label: 'Executive Session Entered?', type: 'radio',
            options: ['No', 'Yes — returned to open session', 'Yes — adjourned from executive session'] },
          { key: 'executiveSessionMinutesKept', label: 'Executive Session Minutes Kept Separately?', type: 'radio',
            options: ['N/A', 'Yes — sealed per c.30A §22', 'No — error (document)'] },
          { key: 'votesRecorded', label: 'Votes / Actions Taken (summary)', type: 'textarea',
            placeholder: 'e.g. "Voted 4–0 to approve the FY2026 budget as presented. Voted 3–1 to table item 5."' },
          { key: 'inMeetingNotes', label: 'Additional Meeting Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['quorumPresent', 'membersPresent'],
        gateChecks: ['Quorum confirmed', 'Attendance recorded', 'Votes documented'],
      },
      DRAFT_MINUTES: {
        stage: 'DRAFT_MINUTES', label: 'Draft Minutes',
        fields: [
          { key: 'minutesDraftedBy', label: 'Minutes Drafted By', type: 'text', required: true },
          { key: 'draftCompletedDate', label: 'Draft Completed Date', type: 'date', required: true },
          { key: 'draftCirculatedDate', label: 'Draft Circulated to Members Date', type: 'date', required: true },
          { key: 'minutesSummary', label: 'Minutes Summary', type: 'textarea', required: true,
            placeholder: 'Provide a complete summary of discussions, decisions, and votes in chronological order. Votes must include each member\'s vote or "unanimous".' },
          { key: 'memberCorrections', label: 'Member Corrections Received?', type: 'radio',
            options: ['No corrections received', 'Yes — corrections noted and incorporated'] },
          { key: 'draftNotes', label: 'Draft Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['minutesDraftedBy', 'draftCompletedDate', 'draftCirculatedDate', 'minutesSummary'],
        gateChecks: ['Draft minutes complete', 'Circulated to members for review', 'Corrections incorporated'],
      },
      APPROVED: {
        stage: 'APPROVED', label: 'Minutes Approval',
        fields: [
          { key: 'approvalVoteDate', label: 'Minutes Approval Vote Date', type: 'date', required: true },
          { key: 'approvalResult', label: 'Approval Result', type: 'radio', required: true,
            options: ['Approved Unanimously', 'Approved — Majority Vote', 'Approved with Amendments', 'Tabled — continued to next meeting'] },
          { key: 'approvingMembersList', label: 'Approving Members', type: 'textarea' },
          { key: 'amendmentsSummary', label: 'Amendments Made (if any)', type: 'textarea' },
          { key: 'approvalNotes', label: 'Approval Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['approvalVoteDate', 'approvalResult'],
        gateChecks: ['Minutes formally approved by vote', 'Final version ready for public posting'],
      },
      POSTED: {
        stage: 'POSTED', label: 'Public Posting',
        fields: [
          { key: 'minutesPostedDate', label: 'Minutes Posted Date', type: 'date', required: true },
          { key: 'postingLocationsMinutes', label: 'Posting Locations', type: 'textarea', required: true,
            placeholder: 'Town website (required), Town Clerk office (required), additional locations per bylaw' },
          { key: 'publicAccessConfirmed', label: 'Accessible to Public Within 10 Days of Approval?', type: 'radio', required: true,
            options: ['Yes — posted within 10 days', 'No — delayed (document reason)'] },
          { key: 'executiveSessionReview', label: 'Executive Session Minutes Reviewed for Release?', type: 'radio',
            options: ['N/A — no executive session', 'Yes — reviewed, remain sealed', 'Yes — reviewed, released (redacted)'] },
          { key: 'postingNotes', label: 'Posting Notes', type: 'textarea' },
        ],
        requiredToAdvance: ['minutesPostedDate', 'postingLocationsMinutes', 'publicAccessConfirmed'],
        gateChecks: ['Minutes publicly posted', 'Town website and Clerk office updated'],
      },
    },
  },

  // ── VAULTDOG — Animal Control & Dog Licensing ─────────────────────────────
  VAULTDOG: {
    moduleId: 'VAULTDOG',
    casePrefix: 'DOG',
    defaultRetentionYears: 3,
    stages: ['APPLIED', 'VERIFIED', 'LICENSED', 'EXPIRED'],
    closureReasons: ['Licensed & Tag Issued', 'Application Withdrawn', 'Rabies Cert Expired — Denied', 'Owner Moved Out of Town'],
    deadlineDefs: [
      { key: 'RAB', label: 'Rabies Certificate Expiry', days: 365, type: 'calendar', triggersOn: 'creation' },
    ],
    intakeFields: [
      // Owner
      { key: 'ownerName',    label: 'Owner Full Name',   type: 'text',  required: true, placeholder: 'Jane Smith' },
      { key: 'ownerAddress', label: 'Street Address',    type: 'text',  required: true, placeholder: '123 Main St, Phillipston MA 01331' },
      { key: 'ownerPhone',   label: 'Phone Number',      type: 'phone', required: true, placeholder: '(978) 555-0100' },
      { key: 'ownerEmail',   label: 'Email Address',     type: 'email', placeholder: 'jane@example.com' },
      // Dog
      { key: 'dogName',   label: "Dog's Name",    type: 'text',   required: true, placeholder: 'Biscuit' },
      { key: 'dogBreed',  label: 'Breed',         type: 'text',   required: true, placeholder: 'Labrador Retriever' },
      { key: 'dogColor',  label: 'Color / Markings', type: 'text', placeholder: 'Yellow with white chest' },
      { key: 'dogSex',    label: 'Sex',           type: 'select', required: true, options: ['Female', 'Male'] },
      { key: 'dogAltered', label: 'Spayed / Neutered?', type: 'select', required: true,
        options: ['Yes — Spayed/Neutered ($5.00)', 'No — Intact ($10.00)'],
        hint: 'Fee: $5.00 if spayed/neutered · $10.00 if intact (M.G.L. c.140 §139)' },
      { key: 'dogDob', label: "Dog's Date of Birth (approx.)", type: 'date' },
      // Rabies
      { key: 'rabiesCert', label: 'Rabies Certificate #', type: 'text', required: true, placeholder: 'RC-2025-XXXXX' },
      { key: 'rabiesVaccinationDate', label: 'Vaccination Date', type: 'date', required: true },
      { key: 'rabiesExp',  label: 'Certificate Expiry Date', type: 'date', required: true },
      { key: 'veterinarian', label: 'Veterinarian / Clinic', type: 'text', placeholder: 'Gardner Animal Hospital' },
      // Admin
      { key: 'priorLicenseNumber', label: 'Prior License # (if renewal)', type: 'text', placeholder: 'DOG-2025-001' },
      { key: 'intakeNotes', label: 'Notes', type: 'textarea', placeholder: 'Any additional information' },
    ],
    stageFields: {
      VERIFIED: {
        stage: 'VERIFIED', label: 'Verification',
        fields: [
          { key: 'rabiesVerified',  label: 'Rabies Certificate Verified?', type: 'select', required: true, options: ['Yes', 'No — Expired', 'No — Missing'] },
          { key: 'feeCollected',    label: 'License Fee Collected?',        type: 'select', required: true, options: ['Yes — $5.00', 'Yes — $10.00', 'Waived', 'Pending'] },
          { key: 'feeReceiptNumber', label: 'Receipt / Transaction #',      type: 'text' },
          { key: 'verificationNotes', label: 'Notes', type: 'textarea' },
        ],
        gateChecks: ['Rabies cert current', 'Fee collected or waived'],
      },
      LICENSED: {
        stage: 'LICENSED', label: 'License Issued',
        fields: [
          { key: 'tagNumber',    label: 'License Tag #',        type: 'text',  required: true, placeholder: '2026-0042' },
          { key: 'licensedDate', label: 'Date of Issuance',     type: 'date',  required: true },
          { key: 'expiresDate',  label: 'Expiry Date',          type: 'date',  required: true },
          { key: 'issuedBy',     label: 'Issued By',            type: 'text',  required: true, placeholder: 'Dog Officer name' },
        ],
        gateChecks: ['Tag # assigned', 'Issuance date recorded'],
      },
      EXPIRED: {
        stage: 'EXPIRED', label: 'Expired / Lapsed',
        fields: [
          { key: 'renewalNoticeSent', label: 'Renewal Notice Sent?', type: 'select', options: ['Yes', 'No'] },
          { key: 'renewalNoticeDate', label: 'Notice Date',           type: 'date' },
          { key: 'expiredNotes',      label: 'Notes',                 type: 'textarea' },
        ],
        gateChecks: [],
      },
    },
  },

}

export function getModuleDef(moduleId: string): ModuleDef {
  // Direct match
  if (MODULE_DEFS[moduleId]) return MODULE_DEFS[moduleId]
  // Town-branded IDs: LOGICVILLEPRR → VAULTPRR, SUTTONCLERK → VAULTCLERK, etc.
  const knownSuffixes = ['PRR','CLERK','FISCAL','TIME','FIX','ONBOARD','PERMIT','HR','PROCURE','RECS','MEET']
  for (const suffix of knownSuffixes) {
    if (moduleId.endsWith(suffix)) {
      const vaultId = `VAULT${suffix}`
      if (MODULE_DEFS[vaultId]) return { ...MODULE_DEFS[vaultId], moduleId }
    }
  }
  return {
    moduleId,
    casePrefix: moduleId.replace('VAULT', '').slice(0, 4),
    defaultRetentionYears: 7,
    stages: ['INTAKE', 'IN_PROGRESS', 'REVIEW', 'CLOSED'],
    closureReasons: ['Complete', 'Cancelled', 'Transferred'],
    deadlineDefs: [],
    intakeFields: [
      { key: 'requesterName', label: 'Your Name', type: 'text', required: true },
      { key: 'requesterEmail', label: 'Email', type: 'email', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
    ],
    stageFields: {},
  }
}
