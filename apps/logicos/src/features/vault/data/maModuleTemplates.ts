/**
 * Massachusetts VAULT Module Templates
 *
 * Pre-configured, legally-correct module templates for Massachusetts municipalities.
 * Each template bundles statutory citations, workflow stages, SLA deadlines, and
 * email templates so a municipality can be fully compliant in one click.
 */

import type { VaultModuleSettings } from '../types'

export type TemplateCategory =
  | 'public-records'
  | 'permitting'
  | 'licensing'
  | 'compliance'
  | 'governance'
  | 'administration'

export interface MAModuleTemplate {
  id: string
  moduleId: string                          // references VAULT_MODULES[].id
  name: string
  subtitle: string                          // e.g. "M.G.L. c.66 §10"
  description: string
  category: TemplateCategory
  color: string                             // Tailwind bg class
  textColor: string                         // Tailwind text class
  stages: string[]
  slaBusinessDays: number
  features: string[]
  presetSettings: Partial<VaultModuleSettings>
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const MA_MODULE_TEMPLATES: MAModuleTemplate[] = [
  {
    id: 'ma-prr-standard',
    moduleId: 'VAULTPRR',
    name: 'Public Records Requests',
    subtitle: 'M.G.L. c.66 §10',
    description:
      'Full PRR lifecycle with T10 statutory deadline enforcement, exemption logging (A–N), fee waiver automation, tolling, and T25 fee-cap rule. Built for MA Records Access Officers.',
    category: 'public-records',
    color: 'bg-indigo-600',
    textColor: 'text-indigo-600',
    stages: ['Intake', 'Assessment', 'Gathering', 'Review', 'Response', 'Closure'],
    slaBusinessDays: 10,
    features: [
      '10-business-day statutory deadline (T10) pre-wired',
      'Fee prohibition if T10 missed — auto-enforced',
      'T25 fee cap rule applied at assessment',
      'Exemptions A–N with M.G.L. c.4 §7(26) citations',
      'Requester acknowledgment email on intake',
      'RAO escalation email at 7 business days',
      '6-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T10',
            name: 'Statutory Response Deadline',
            businessDays: 10,
            statutory: true,
            statutorycitation: 'M.G.L. c.66, §10(a)',
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
          {
            id: 'T25',
            name: 'Fee Cap Threshold',
            businessDays: 25,
            statutory: true,
            statutorycitation: 'M.G.L. c.66, §10(b)',
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-prr-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Public Records Request Received — {{town}}',
            body: `Dear {{requesterName}},\n\nThank you for submitting a public records request to {{town}}. Your request has been received and assigned case number {{caseNumber}}.\n\nWe are required to respond within 10 business days under M.G.L. c.66, §10. Your estimated response date is {{deadline}}.\n\nYou may track the status of your request online using your case number.\n\nIf you have questions, please contact:\n{{raoName}}\nRecords Access Officer\n{{town}}`,
            enabled: true,
          },
          {
            id: 'et-prr-t7-warning',
            trigger: 'T10_WARNING',
            toRecipient: 'RAO',
            subject: '⚠ [{{caseNumber}}] 3-Day Deadline Warning — Action Required',
            body: `This is an automated reminder.\n\nCase {{caseNumber}} is due in 3 business days ({{deadline}}).\n\nImmediate action is required to avoid a statutory violation under M.G.L. c.66, §10.\n\nCase: {{caseNumber}}\nStage: {{stage}}\nDeadline: {{deadline}}`,
            enabled: true,
          },
          {
            id: 'et-prr-approval',
            trigger: 'APPROVAL_ISSUED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Decision on Your Public Records Request',
            body: `Dear {{requesterName}},\n\nA decision has been issued on your public records request ({{caseNumber}}).\n\nPlease contact {{raoName}} at {{town}} to receive the responsive records or for further information.\n\nRecords Access Officer\n{{town}}`,
            enabled: true,
          },
          {
            id: 'et-prr-close',
            trigger: 'CASE_CLOSED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Your Request Has Been Closed',
            body: `Dear {{requesterName}},\n\nYour public records request ({{caseNumber}}) has been closed.\n\nIf you have questions or wish to appeal, please contact the Supervisor of Records at the Secretary of State's Office.\n\nRecords Access Officer\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-building-permit',
    moduleId: 'VAULTPERMIT',
    name: 'Building Permits',
    subtitle: 'M.G.L. c.40A §9',
    description:
      'Building permit issuance from application through inspection, decision, and compliance tracking. Deemed-approval rule enforced at 30 days. Tied to State Building Code (780 CMR).',
    category: 'permitting',
    color: 'bg-amber-600',
    textColor: 'text-amber-600',
    stages: ['Application', 'Completeness Review', 'Plan Review', 'Fee Collection', 'Issuance', 'Inspections', 'Certificate of Occupancy'],
    slaBusinessDays: 30,
    features: [
      '30-day deemed-approval deadline enforced',
      '780 CMR (State Building Code) citation pre-loaded',
      'Inspection milestone tracking with sign-offs',
      'Fee collection stage with amount recording',
      'Certificate of Occupancy issuance gate',
      'Applicant status update emails at key stages',
      '7-year retention per state schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T30',
            name: 'Deemed-Approval Deadline',
            businessDays: 30,
            statutory: true,
            statutorycitation: 'M.G.L. c.40A, §9',
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-bp-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Building Permit Application Received — {{town}}',
            body: `Dear {{requesterName}},\n\nYour building permit application ({{caseNumber}}) has been received by {{town}}.\n\nWe will complete a completeness review and contact you if additional information is required. A decision will be issued within 30 business days.\n\nBuilding Department\n{{town}}`,
            enabled: true,
          },
          {
            id: 'et-bp-approval',
            trigger: 'APPROVAL_ISSUED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Building Permit Decision Issued',
            body: `Dear {{requesterName}},\n\nA decision has been issued on your building permit application ({{caseNumber}}).\n\nPlease contact the Building Department at {{town}} to arrange pickup or to schedule your first inspection.\n\nBuilding Department\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-clerk-licensing',
    moduleId: 'VAULTCLERK',
    name: 'Town Clerk Licensing',
    subtitle: 'M.G.L. c.101 · c.41 §15',
    description:
      'Business certificates, marriage licenses, death records, and miscellaneous clerk licensing through application, review, and issuance. Renewal tracking built in.',
    category: 'licensing',
    color: 'bg-emerald-600',
    textColor: 'text-emerald-600',
    stages: ['Application Intake', 'Completeness Review', 'Approval / Denial', 'Issuance', 'Filing'],
    slaBusinessDays: 10,
    features: [
      'Business certificate 4-year renewal tracking (M.G.L. c.110 §5)',
      'Marriage license 3-day waiting period gate',
      'Vital records access controls per privacy law',
      'Renewal notice emails 60 and 30 days before expiry',
      'Applicant receipt email on submission',
      '10-year retention for business records',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T10-clerk',
            name: 'Response Deadline',
            businessDays: 10,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-clerk-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Application Received — {{town}} Town Clerk',
            body: `Dear {{requesterName}},\n\nYour application ({{caseNumber}}) has been received by the {{town}} Town Clerk's Office.\n\nYou will be contacted when a decision is ready or if additional information is required.\n\nTown Clerk\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-dog-license',
    moduleId: 'VAULTDOG',
    name: 'Animal Control & Dog Licensing',
    subtitle: 'M.G.L. c.140 §§137–141',
    description:
      'Annual dog license registration with rabies certificate verification, fee collection, and license tag issuance. Late fees apply after April 1 per statute.',
    category: 'licensing',
    color: 'bg-amber-500',
    textColor: 'text-amber-600',
    stages: ['Application', 'Rabies Verification', 'Fee Collection', 'Issuance', 'Renewal / Expiry'],
    slaBusinessDays: 5,
    features: [
      'Rabies certificate expiry validation',
      'Spay/neuter status fee differential',
      'Late fee trigger after April 1 deadline',
      'Annual renewal tracking with notice emails',
      'License tag number recording',
      '3-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T5-dog',
            name: 'Processing Target',
            businessDays: 5,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-dog-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Dog License Application Received — {{town}}',
            body: `Dear {{requesterName}},\n\nYour dog license application ({{caseNumber}}) has been received. We will verify your rabies certificate and contact you regarding payment.\n\nAnimal Control\n{{town}}`,
            enabled: true,
          },
          {
            id: 'et-dog-issued',
            trigger: 'APPROVAL_ISSUED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Dog License Issued — {{town}}',
            body: `Dear {{requesterName}},\n\nYour dog license ({{caseNumber}}) has been issued. Please pick up your tag at Town Hall or it will be mailed within 5 business days.\n\nAnimal Control\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-code-enforcement',
    moduleId: 'VAULTPERMIT',
    name: 'Code Enforcement',
    subtitle: 'M.G.L. c.40 §21',
    description:
      'Zoning and bylaw violation complaints from intake through investigation, notice of violation, compliance deadline, and closure. Tracks re-inspection status and enforcement escalation.',
    category: 'compliance',
    color: 'bg-red-600',
    textColor: 'text-red-600',
    stages: ['Complaint Intake', 'Initial Investigation', 'Notice of Violation', 'Compliance Period', 'Re-Inspection', 'Closure / Escalation'],
    slaBusinessDays: 30,
    features: [
      'Complaint acknowledgment within 5 business days',
      'Notice of Violation template with cure deadline',
      'Compliance period tracking (default 30 days)',
      'Re-inspection milestone with result recording',
      'Automatic escalation to Building Official at deadline',
      'Anonymous complaint option with privacy controls',
      '5-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T5-ack',
            name: 'Acknowledgment Target',
            businessDays: 5,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
          {
            id: 'T30-compliance',
            name: 'Compliance Period',
            businessDays: 30,
            statutory: false,
            startEvent: 'STAGE_ENTERED',
            startStage: 'Notice of Violation',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-ce-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Complaint Received — {{town}}',
            body: `Dear {{requesterName}},\n\nYour complaint ({{caseNumber}}) has been received by {{town}}. An inspector will review the matter and you will be notified of the outcome.\n\nBuilding/Zoning Department\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-fiscal-ap',
    moduleId: 'VAULTFISCAL',
    name: 'Fiscal Controls & AP',
    subtitle: 'M.G.L. c.41 §56 · c.30B',
    description:
      '3-way match enforcement for invoices against POs and receipts. Budget availability gating before approval. Department head → Town Accountant → Treasurer chain with warrant-equivalent records.',
    category: 'administration',
    color: 'bg-blue-600',
    textColor: 'text-blue-600',
    stages: ['Invoice Intake', '3-Way Match', 'Budget Check', 'Dept. Head Approval', 'Town Accountant', 'Payment', 'GL Posting'],
    slaBusinessDays: 30,
    features: [
      '3-way match (invoice / PO / receiving report) gate',
      'Budget availability check before approval chain',
      'Threshold-based routing: >$10K auto-escalates to Town Manager',
      'c.30B procurement compliance check for contracted services',
      'Warrant-equivalent payment record with immutable lock',
      'Town Accountant certification stage (c.41 §56)',
      '10-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T30-ap',
            name: 'Payment Processing Target',
            businessDays: 30,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-ap-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'RAO',
            subject: '[{{caseNumber}}] Invoice Received for Processing',
            body: `A new invoice ({{caseNumber}}) has been received and is pending 3-way match verification.\n\nPlease log into VAULT to review.`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-procurement',
    moduleId: 'VAULTPROCURE',
    name: 'Procurement & Contracts',
    subtitle: 'M.G.L. c.30B',
    description:
      'Full procurement lifecycle: specification, IFB/RFP solicitation, bid evaluation, award, contract execution, and ongoing compliance monitoring. c.30B threshold rules enforced at intake.',
    category: 'administration',
    color: 'bg-violet-600',
    textColor: 'text-violet-600',
    stages: ['Specification', 'Solicitation', 'Bid Opening', 'Evaluation', 'Award', 'Contract Execution', 'Monitoring'],
    slaBusinessDays: 90,
    features: [
      'c.30B threshold routing (<$10K / $10K–$50K / >$50K)',
      'Sealed bid opening record with witness requirement',
      'Debarment check stage before award',
      'Contract execution with amendment tracking',
      'Ongoing monitoring with renewal alert 90 days out',
      'Performance bond and insurance certificate tracking',
      '10-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T14-award',
            name: 'Award Notice Deadline',
            businessDays: 14,
            statutory: true,
            statutorycitation: 'M.G.L. c.30B, §20',
            startEvent: 'STAGE_ENTERED',
            startStage: 'Bid Opening',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [],
      },
    },
  },
  {
    id: 'ma-oml-meetings',
    moduleId: 'VAULTMEET',
    name: 'Open Meeting Law',
    subtitle: 'M.G.L. c.30A §§18–25',
    description:
      '48-hour posting deadline enforced for all public bodies. Agenda management, vote recording, 30-day minutes approval cycle, and executive session tracking per 940 CMR 29.00.',
    category: 'governance',
    color: 'bg-slate-600',
    textColor: 'text-slate-600',
    stages: ['Notice (48hr)', 'Agenda Finalized', 'In-Meeting', 'Draft Minutes', 'Minutes Approval', 'Posted', 'Closed'],
    slaBusinessDays: 2,
    features: [
      '48-hour notice deadline enforced with auto-warning',
      'Agenda freeze 24 hours before meeting',
      '30-day minutes approval cycle tracked',
      'Executive session vote record with reason citation',
      'Meeting cancellation notice workflow',
      'Annual meeting schedule with recurring OML deadlines',
      '7-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T48hr',
            name: '48-Hour Posting Deadline',
            businessDays: 2,
            statutory: true,
            statutorycitation: 'M.G.L. c.30A, §20',
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
          {
            id: 'T30-minutes',
            name: 'Minutes Approval Deadline',
            businessDays: 30,
            statutory: true,
            statutorycitation: 'M.G.L. c.30A, §22',
            startEvent: 'STAGE_ENTERED',
            startStage: 'Draft Minutes',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-oml-notice',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'RAO',
            subject: '[{{caseNumber}}] Meeting Notice Filed — Verify 48hr Compliance',
            body: `A meeting notice ({{caseNumber}}) has been filed. Please verify the notice is posted at least 48 hours before the scheduled meeting time.\n\nDeadline: {{deadline}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-hr-personnel',
    moduleId: 'VAULTHR',
    name: 'HR & Personnel Actions',
    subtitle: 'M.G.L. c.41 §108',
    description:
      'Personnel actions from hire through evaluation, grievance, disciplinary action, and separation. Approval chain enforced through Department Head → Town Manager. Personnel files locked on close.',
    category: 'administration',
    color: 'bg-pink-600',
    textColor: 'text-pink-600',
    stages: ['Request', 'HR Review', 'Department Head', 'Town Manager', 'Execution', 'Record Lock'],
    slaBusinessDays: 30,
    features: [
      'Personnel action type classification (hire/eval/discipline/termination)',
      'Mandatory Department Head and Town Manager sign-off',
      'Grievance response timeline (union CBA-aware)',
      'Performance evaluation 90-day and annual cycle',
      'Separation checklist with systems-access revocation gate',
      'Personnel file locked and sealed on closure',
      '10-year retention for personnel records',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T30-hr',
            name: 'HR Action Processing Target',
            businessDays: 30,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [],
      },
    },
  },
  {
    id: 'ma-work-orders',
    moduleId: 'VAULTFIX',
    name: 'Work Orders & Maintenance',
    subtitle: 'M.G.L. c.30 §39K',
    description:
      'Facilities and DPW work requests from intake through assignment, scheduling, completion, and verification. Priority-based SLA with escalation at 1 business day for P1.',
    category: 'administration',
    color: 'bg-orange-600',
    textColor: 'text-orange-600',
    stages: ['Request Intake', 'Priority Assessment', 'Assignment', 'Scheduled', 'Work in Progress', 'Verification', 'Closure'],
    slaBusinessDays: 10,
    features: [
      'Priority levels P1–P4 with different SLA targets (P1: 1 day)',
      'Skill-based routing to DPW divisions',
      'Parts and materials cost tracking',
      'Work completion sign-off by supervisor',
      'Requester notification on completion',
      'Asset linking (vehicle, building, equipment)',
      '5-year retention per MART schedule',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T10-wo',
            name: 'Standard Work Order Target',
            businessDays: 10,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [
          {
            id: 'et-wo-intake',
            trigger: 'INTAKE_RECEIVED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Work Request Received — {{town}}',
            body: `Dear {{requesterName}},\n\nYour work request ({{caseNumber}}) has been received and assigned for review. You will be notified when it is scheduled.\n\nDPW / Facilities\n{{town}}`,
            enabled: true,
          },
          {
            id: 'et-wo-close',
            trigger: 'CASE_CLOSED',
            toRecipient: 'REQUESTER',
            subject: '[{{caseNumber}}] Work Complete',
            body: `Dear {{requesterName}},\n\nYour work request ({{caseNumber}}) has been completed and closed.\n\nDPW / Facilities\n{{town}}`,
            enabled: true,
          },
        ],
      },
    },
  },
  {
    id: 'ma-records-management',
    moduleId: 'VAULTRECS',
    name: 'Records Management',
    subtitle: 'M.G.L. c.66 §10 · c.30 §42',
    description:
      'Retention schedule assignment, review at maturity, and disposition authorization. Destruction authorization requires Supervisor of Records approval per 950 CMR 32.00.',
    category: 'compliance',
    color: 'bg-teal-600',
    textColor: 'text-teal-600',
    stages: ['Classification', 'Schedule Assignment', 'Active Retention', 'Review at Maturity', 'Disposition Authorization', 'Destruction / Transfer'],
    slaBusinessDays: 30,
    features: [
      'MART retention schedule lookup built in',
      'Supervisor of Records destruction authorization',
      'Legal hold flag with case-linking',
      'Records disposition certificate generated at closure',
      'Permanent records flagged for state archives transfer',
      'Vital records classification with additional safeguards',
      'Compliant with 950 CMR 32.00',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T30-records',
            name: 'Disposition Review Deadline',
            businessDays: 30,
            statutory: false,
            startEvent: 'STAGE_ENTERED',
            startStage: 'Review at Maturity',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [],
      },
    },
  },
  {
    id: 'ma-staff-onboarding',
    moduleId: 'VAULTONBOARD',
    name: 'Staff Onboarding',
    subtitle: 'M.G.L. c.149',
    description:
      'New hire onboarding from background check authorization through systems access provisioning, mandatory training, and manager sign-off. All checklists locked as immutable record.',
    category: 'administration',
    color: 'bg-cyan-600',
    textColor: 'text-cyan-600',
    stages: ['Background Check Gate', 'Pre-Start Setup', 'Day 1 Checklist', 'Systems Access', 'Benefits Enrollment', 'Training Lock', 'Manager Sign-Off'],
    slaBusinessDays: 15,
    features: [
      'Background check authorization gate — cannot skip',
      'I-9 and E-Verify deadline tracking (3 days from start)',
      'CORI/SORI check tracking for required positions',
      'Systems access provisioning checklist',
      'Benefits enrollment 30-day window with reminder',
      'Mandatory training completion with cert upload',
      'Manager sign-off locks the record permanently',
    ],
    presetSettings: {
      emailNotificationsEnabled: true,
      workflow: {
        timers: [
          {
            id: 'T3-i9',
            name: 'I-9 Verification Deadline',
            businessDays: 3,
            statutory: true,
            statutorycitation: 'Immigration Reform and Control Act (IRCA)',
            startEvent: 'STAGE_ENTERED',
            startStage: 'Day 1 Checklist',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
          {
            id: 'T15-onboard',
            name: 'Onboarding Completion Target',
            businessDays: 15,
            statutory: false,
            startEvent: 'CASE_CREATED',
          warningDaysBefore: 3,
          onMiss: ['SEND_EMAIL'],
          },
        ],
        emailTemplates: [],
      },
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES: { id: TemplateCategory | 'all'; label: string }[] = [
  { id: 'all',            label: 'All Templates' },
  { id: 'public-records', label: 'Public Records' },
  { id: 'permitting',     label: 'Permitting' },
  { id: 'licensing',      label: 'Licensing' },
  { id: 'compliance',     label: 'Compliance' },
  { id: 'governance',     label: 'Governance' },
  { id: 'administration', label: 'Administration' },
]

export function getTemplatesByCategory(category: TemplateCategory | 'all'): MAModuleTemplate[] {
  if (category === 'all') return MA_MODULE_TEMPLATES
  return MA_MODULE_TEMPLATES.filter(t => t.category === category)
}
