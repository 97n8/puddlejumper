import { useEffect } from 'react'
import type React from 'react'
import type { VaultCase, VaultModuleSettings, AuditEntry } from '../types'
import type { CaseSpace } from '@/lib/types'
import { updateCaseSpace } from '@/services/casespaceApi'
import { uuid } from '../utils/vaultHelpers'

const PHILLIPSTON_IDS = ['vault-phillipston-prr', 'vault-phillipston-prr-2', 'vault-phillipston-prr-3']
const SUTTON_IDS = ['vault-sutton', 'vault-sutton-2', 'vault-sutton-3']
const LOGICVILLE_IDS = ['vault-logicville']
const LOGICVILLE_MODULES = ['VAULTCLERK','VAULTPRR','VAULTFISCAL','VAULTTIME','VAULTFIX','VAULTONBOARD','VAULTPERMIT','VAULTHR','VAULTPROCURE','VAULTRECS','VAULTMEET']

export function useVaultSeedEffects({
  envId,
  allSettings,
  allCases,
  setAllSettings,
  setAllCases,
  setCasespaces,
  casespaces,
}: {
  envId: string
  allSettings: Record<string, VaultModuleSettings>
  allCases: VaultCase[] | null
  setAllSettings: (v: Record<string, VaultModuleSettings>) => void
  setAllCases: (updater: VaultCase[] | ((prev: VaultCase[]) => VaultCase[])) => void
  setCasespaces: React.Dispatch<React.SetStateAction<CaseSpace[]>>
  casespaces: CaseSpace[]
}) {
  // Seed default settings for known environments on first open (or when missing new fields)
  useEffect(() => {
    if (PHILLIPSTON_IDS.includes(envId) && !allSettings['VAULTPRR']?.municipalityName) {
      setAllSettings({
        VAULTPRR: {
          moduleId: 'VAULTPRR',
          envId: 'vault-phillipston-prr',
          municipalityName: 'Town of Phillipston',
          municipalityAddress: '50 The Common, Phillipston, MA 01331',
          municipalityPhone: '(978) 249-1605',
          municipalityWebsite: 'https://phillipston-ma.gov',
          accentColor: '#4ade80',
          notificationEmail: 'clerk@phillipston-ma.gov',
          emailNotificationsEnabled: true,
          raos: [
            {
              id: 'rao-phillipston-clerk-1',
              name: 'Town Clerk',
              title: 'Records Access Officer',
              email: 'clerk@phillipston-ma.gov',
              phone: '(978) 249-1605',
              isPrimary: true,
            },
            {
              id: 'rao-phillipston-admin-1',
              name: 'Town Administrator',
              title: 'Deputy Records Access Officer',
              email: 'admin@phillipston-ma.gov',
              phone: '(978) 249-1605',
              isPrimary: false,
            },
          ],
          escalation: [
            {
              id: 'esc-phillipston-1',
              name: 'Town Administrator',
              email: 'admin@phillipston-ma.gov',
              title: 'Town Administrator',
              severity: 'high',
              triggerDaysBeforeDeadline: 3,
            },
            {
              id: 'esc-phillipston-2',
              name: 'MA Supervisor of Records',
              email: 'pre@sec.state.ma.us',
              title: 'Supervisor of Records — Secretary of State',
              severity: 'critical',
              triggerDaysBeforeDeadline: 1,
            },
          ],
          team: [
            { id: 'tm-phillipston-1', name: 'Town Clerk', email: 'clerk@phillipston-ma.gov', role: 'admin', canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-phillipston-2', name: 'Town Administrator', email: 'admin@phillipston-ma.gov', role: 'approver', canSeeAllCases: true, department: 'Administration' },
            { id: 'tm-phillipston-3', name: 'Board of Selectmen Chair', email: 'selectmen@phillipston-ma.gov', role: 'viewer', canSeeAllCases: false, department: 'Board of Selectmen' },
          ],
          trainingLinks: [
            { id: 'tr-phil-1', title: 'Phillipston PRR SOP', url: 'https://phillipston-ma.gov/sop/prr', description: 'Internal standard operating procedure for public records requests' },
            { id: 'tr-phil-2', title: 'MA Supervisor of Records Guide', url: 'https://www.sec.state.ma.us/pre/preidx.htm', description: 'Official guidance from the Secretary of State' },
          ],
          workflow: {
            timers: [
              {
                id: 'timer-prr-t10',
                name: 'T10 — Initial Response',
                businessDays: 10,
                statutory: true,
                statutorycitation: 'M.G.L. c. 66, §10(b)',
                startEvent: 'CASE_CREATED',
                warningDaysBefore: 3,
                onMiss: ['AUTO_ESCALATE', 'SEND_EMAIL', 'WAIVE_FEES'],
              },
              {
                id: 'timer-prr-t25',
                name: 'T25 — Extended Response',
                businessDays: 25,
                statutory: true,
                statutorycitation: 'M.G.L. c. 66, §10(b)',
                startEvent: 'CASE_CREATED',
                warningDaysBefore: 5,
                onMiss: ['BLOCK_CLOSE', 'AUTO_ESCALATE', 'SEND_EMAIL'],
              },
            ],
            emailTemplates: [
              {
                id: 'tpl-phil-intake',
                trigger: 'INTAKE_RECEIVED',
                toRecipient: 'REQUESTER',
                subject: 'Your Public Records Request — {{caseNumber}}',
                body: `Dear {{requesterName}},\n\nThank you for submitting a public records request to the {{town}}. Your request has been received and assigned case number {{caseNumber}}.\n\nWe will respond within 10 business days as required by M.G.L. c. 66, §10.\n\nRecords Access Officer\n{{town}}\n{{raoName}}\nclerk@phillipston-ma.gov\n(978) 249-1605`,
                enabled: true,
              },
              {
                id: 'tpl-phil-t10warn',
                trigger: 'T10_WARNING',
                toRecipient: 'RAO',
                subject: '[ACTION REQUIRED] T10 Deadline Approaching — {{caseNumber}}',
                body: `{{raoName}},\n\nThe 10-business-day statutory deadline for case {{caseNumber}} is approaching ({{deadline}}).\n\nPlease review and respond before the deadline to avoid fee waiver.\n\n— VAULT Governance`,
                enabled: true,
              },
              {
                id: 'tpl-phil-approval',
                trigger: 'APPROVAL_ISSUED',
                toRecipient: 'REQUESTER',
                subject: 'Decision Issued — {{caseNumber}}',
                body: `Dear {{requesterName}},\n\nA decision has been issued for your public records request ({{caseNumber}}).\n\nPlease contact our office to arrange records delivery.\n\nRecords Access Officer\n{{town}}\n(978) 249-1605`,
                enabled: true,
              },
              {
                id: 'tpl-phil-closed',
                trigger: 'CASE_CLOSED',
                toRecipient: 'REQUESTER',
                subject: 'Request Closed — {{caseNumber}}',
                body: `Dear {{requesterName}},\n\nYour public records request ({{caseNumber}}) has been closed.\n\nIf you have questions or wish to appeal, please contact the MA Supervisor of Records at pre@sec.state.ma.us.\n\nRecords Access Officer\n{{town}}`,
                enabled: true,
              },
            ],
          },
          updatedAt: Date.now(),
        }
      })
      // Ensure the server casespace has VAULTPRR as an active module
      updateCaseSpace(envId, { vaultModuleIds: ['VAULTPRR'] })
        .then(updated => { if (updated) setCasespaces(prev => prev.map(cs => cs.id === envId ? updated : cs)) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId])

  useEffect(() => {
    if (SUTTON_IDS.includes(envId) && !allSettings['VAULTHR']?.municipalityName) {
      const muni = {
        municipalityName: 'Town of Sutton',
        municipalityAddress: '4 Uxbridge Road, Sutton, MA 01590',
        municipalityPhone: '(508) 865-8701',
        municipalityWebsite: 'https://www.suttonma.org',
        emailNotificationsEnabled: true,
        notificationEmail: 'admin@suttonma.org',
      }
      setAllSettings({
        VAULTCLERK: {
          moduleId: 'VAULTCLERK', envId,
          ...muni,
          accentColor: '#6366f1',
          raos: [
            { id: 'rao-sutton-clerk-1', name: 'Margaret A. Collins', title: 'Town Clerk', email: 'mcolliins@suttonma.org', phone: '(508) 865-8701 x101', isPrimary: true },
            { id: 'rao-sutton-clerk-2', name: 'Thomas R. Hastings', title: 'Assistant Town Clerk', email: 'thastings@suttonma.org', phone: '(508) 865-8701 x102', isPrimary: false },
          ],
          escalation: [
            { id: 'esc-sutton-clerk-1', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', title: 'Town Administrator', severity: 'high' as const, triggerDaysBeforeDeadline: 2 },
          ],
          team: [
            { id: 'tm-sutton-clerk-1', name: 'Margaret A. Collins', email: 'mcolliins@suttonma.org', role: 'admin' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-sutton-clerk-2', name: 'Thomas R. Hastings', email: 'thastings@suttonma.org', role: 'approver' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-sutton-clerk-3', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', role: 'viewer' as const, canSeeAllCases: false, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-sutton-clerk-1', title: 'MA Town Clerk Handbook', url: 'https://www.sec.state.ma.us/ele/eleclk/clkidx.htm', description: 'Secretary of State official clerk guidance' },
            { id: 'tr-sutton-clerk-2', title: 'MMACC Clerk Resources', url: 'https://www.mmacc.org', description: 'MA Municipal Association of City & Town Clerks' },
            { id: 'tr-sutton-clerk-3', title: 'Open Meeting Law Guide', url: 'https://www.mass.gov/guides/open-meeting-law-guide-for-public-bodies', description: 'AG Office OML compliance guide' },
          ],
          workflow: {
            timers: [
              { id: 'timer-clerk-lic', name: 'License Issuance Deadline', businessDays: 10, statutory: true, statutorycitation: 'M.G.L. c.41 §19', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 3, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            ],
            emailTemplates: [
              { id: 'tpl-clerk-intake', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Clerk Request Received — {{caseNumber}}', body: 'Dear {{requesterName}},\n\nThank you for submitting your request to the Town of Sutton Town Clerk\'s office. Your case number is {{caseNumber}}.\n\nWe will follow up within 10 business days.\n\nMargaret A. Collins\nSutton Town Clerk\n(508) 865-8701', enabled: true },
              { id: 'tpl-clerk-close', trigger: 'CASE_CLOSED' as const, toRecipient: 'REQUESTER' as const, subject: 'Request Complete — {{caseNumber}}', body: 'Dear {{requesterName}},\n\nYour request ({{caseNumber}}) has been completed. Please contact the Town Clerk\'s office with any questions.\n\nSutton Town Clerk\n(508) 865-8701', enabled: true },
            ],
          },
          updatedAt: Date.now(),
        },
        VAULTHR: {
          moduleId: 'VAULTHR', envId,
          ...muni,
          accentColor: '#ec4899',
          raos: [
            { id: 'rao-sutton-hr-1', name: 'Linda M. Barrett', title: 'HR Director', email: 'lbarrett@suttonma.org', phone: '(508) 865-8701 x110', isPrimary: true },
            { id: 'rao-sutton-hr-2', name: 'Patricia K. Moore', title: 'HR Coordinator', email: 'pmoore@suttonma.org', phone: '(508) 865-8701 x111', isPrimary: false },
          ],
          escalation: [
            { id: 'esc-sutton-hr-1', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', title: 'Town Administrator', severity: 'high' as const, triggerDaysBeforeDeadline: 3 },
          ],
          team: [
            { id: 'tm-sutton-hr-1', name: 'Linda M. Barrett', email: 'lbarrett@suttonma.org', role: 'admin' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-sutton-hr-2', name: 'Patricia K. Moore', email: 'pmoore@suttonma.org', role: 'approver' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-sutton-hr-3', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', role: 'approver' as const, canSeeAllCases: true, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-sutton-hr-1', title: 'MA DLR Municipal HR Guide', url: 'https://www.mass.gov/orgs/department-of-labor-relations', description: 'MA Dept of Labor Relations guidance for municipal HR' },
            { id: 'tr-sutton-hr-2', title: 'CORI Compliance — MA DCJIS', url: 'https://www.mass.gov/cori', description: 'Background check compliance for public employers' },
            { id: 'tr-sutton-hr-3', title: 'Sutton Personnel Bylaws', url: 'https://www.suttonma.org/town-clerk/bylaws', description: 'Town of Sutton personnel and compensation bylaws' },
          ],
          workflow: {
            timers: [
              { id: 'timer-hr-action', name: 'Personnel Action Review', businessDays: 15, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            ],
            emailTemplates: [
              { id: 'tpl-hr-intake', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'HR Request Received — {{caseNumber}}', body: 'Your HR request ({{caseNumber}}) has been received and assigned to the Sutton HR Department.\n\nHR Director: Linda M. Barrett\nlbarrett@suttonma.org · (508) 865-8701 x110', enabled: true },
            ],
          },
          updatedAt: Date.now(),
        },
        VAULTTIME: {
          moduleId: 'VAULTTIME', envId,
          ...muni,
          accentColor: '#10b981',
          raos: [
            { id: 'rao-sutton-pay-1', name: 'Carol A. Whitney', title: 'Finance Director', email: 'cwhitney@suttonma.org', phone: '(508) 865-8701 x120', isPrimary: true },
            { id: 'rao-sutton-pay-2', name: 'David R. Pennington', title: 'Payroll Coordinator', email: 'dpennington@suttonma.org', phone: '(508) 865-8701 x121', isPrimary: false },
          ],
          escalation: [
            { id: 'esc-sutton-pay-1', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', title: 'Town Administrator', severity: 'critical' as const, triggerDaysBeforeDeadline: 1 },
          ],
          team: [
            { id: 'tm-sutton-pay-1', name: 'Carol A. Whitney', email: 'cwhitney@suttonma.org', role: 'admin' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-sutton-pay-2', name: 'David R. Pennington', email: 'dpennington@suttonma.org', role: 'approver' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-sutton-pay-3', name: 'Linda M. Barrett', email: 'lbarrett@suttonma.org', role: 'viewer' as const, canSeeAllCases: false, department: 'Human Resources' },
          ],
          trainingLinks: [
            { id: 'tr-sutton-time-1', title: 'MA DOR Municipal Payroll Compliance', url: 'https://www.mass.gov/orgs/massachusetts-department-of-revenue', description: 'DOR guidance for municipal payroll and withholding' },
            { id: 'tr-sutton-time-2', title: 'MA Wage & Hour Laws (M.G.L. c.149)', url: 'https://www.mass.gov/wage-hour-laws', description: 'Overtime, prevailing wage, and timekeeping requirements' },
          ],
          workflow: {
            timers: [
              { id: 'timer-time-submit', name: 'Timesheet Submission', businessDays: 5, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['SEND_EMAIL' as const, 'AUTO_ESCALATE' as const] },
              { id: 'timer-time-approve', name: 'Supervisor Approval', businessDays: 2, statutory: false, startEvent: 'STAGE_ENTERED' as const, startStage: 'Supervisor Review', warningDaysBefore: 1, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            ],
            emailTemplates: [
              { id: 'tpl-time-intake', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Timesheet Received — {{caseNumber}}', body: 'Your timesheet for {{caseNumber}} has been received and is pending supervisor review.\n\nPayroll: David R. Pennington · (508) 865-8701 x121', enabled: true },
              { id: 'tpl-time-approved', trigger: 'APPROVAL_ISSUED' as const, toRecipient: 'REQUESTER' as const, subject: 'Timesheet Approved — {{caseNumber}}', body: 'Your timesheet ({{caseNumber}}) has been approved and submitted to payroll.', enabled: true },
            ],
          },
          updatedAt: Date.now(),
        },
        VAULTFIX: {
          moduleId: 'VAULTFIX', envId,
          ...muni,
          accentColor: '#f97316',
          raos: [
            { id: 'rao-sutton-dpw-1', name: 'Steven T. Rowell', title: 'DPW Director', email: 'srowell@suttonma.org', phone: '(508) 865-8701 x130', isPrimary: true },
            { id: 'rao-sutton-dpw-2', name: 'James P. Sullivan', title: 'DPW Foreman', email: 'jsullivan@suttonma.org', phone: '(508) 865-8701 x131', isPrimary: false },
          ],
          escalation: [
            { id: 'esc-sutton-dpw-1', name: 'Rebecca L. Farnsworth', email: 'rfarnsworth@suttonma.org', title: 'Town Administrator', severity: 'high' as const, triggerDaysBeforeDeadline: 2 },
          ],
          team: [
            { id: 'tm-sutton-dpw-1', name: 'Steven T. Rowell', email: 'srowell@suttonma.org', role: 'admin' as const, canSeeAllCases: true, department: 'DPW' },
            { id: 'tm-sutton-dpw-2', name: 'James P. Sullivan', email: 'jsullivan@suttonma.org', role: 'approver' as const, canSeeAllCases: true, department: 'DPW' },
            { id: 'tm-sutton-dpw-3', name: 'Michael R. Oates', email: 'moates@suttonma.org', role: 'viewer' as const, canSeeAllCases: false, department: 'DPW' },
            { id: 'tm-sutton-dpw-4', name: 'Sandra J. Kowalski', email: 'skowalski@suttonma.org', role: 'viewer' as const, canSeeAllCases: false, department: 'Facilities' },
          ],
          trainingLinks: [
            { id: 'tr-sutton-dpw-1', title: 'Sutton DPW Standard Operating Procedures', url: 'https://www.suttonma.org/dpw', description: 'Internal DPW SOPs for road, parks, and fleet maintenance' },
            { id: 'tr-sutton-dpw-2', title: 'APWA Public Works Standards', url: 'https://www.apwa.net', description: 'American Public Works Association best practices' },
            { id: 'tr-sutton-dpw-3', title: 'MassDOT Road Maintenance Guide', url: 'https://www.mass.gov/massdot', description: 'State guidance for municipal road maintenance and Chapter 90 compliance' },
          ],
          workflow: {
            timers: [
              { id: 'timer-wo-p1', name: 'Priority 1 — Emergency Response', businessDays: 1, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 0, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
              { id: 'timer-wo-p2', name: 'Priority 2 — Urgent Repair', businessDays: 5, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
              { id: 'timer-wo-p3', name: 'Priority 3 — Standard Work Order', businessDays: 20, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['SEND_EMAIL' as const] },
            ],
            emailTemplates: [
              { id: 'tpl-wo-intake', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Work Order Submitted — {{caseNumber}}', body: 'Your work order ({{caseNumber}}) has been received by the Sutton DPW.\n\nDPW Director: Steven T. Rowell · srowell@suttonma.org · (508) 865-8701 x130\n\nYou will be contacted once work is scheduled.', enabled: true },
              { id: 'tpl-wo-close', trigger: 'CASE_CLOSED' as const, toRecipient: 'REQUESTER' as const, subject: 'Work Order Complete — {{caseNumber}}', body: 'Your work order ({{caseNumber}}) has been completed.\n\nThank you — Sutton DPW', enabled: true },
            ],
          },
          updatedAt: Date.now(),
        },
      })
      updateCaseSpace(envId, { vaultModuleIds: ['VAULTHR', 'VAULTTIME', 'VAULTFIX'] })
        .then(updated => { if (updated) setCasespaces(prev => prev.map(cs => cs.id === envId ? updated : cs)) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId])

  useEffect(() => {
    if (!SUTTON_IDS.includes(envId)) return
    if ((allCases || []).length > 0) return
    const now = Date.now()
    const d = (offsetDays: number) => new Date(now + offsetDays * 86400000).toISOString().slice(0, 10)
    const t = (offsetDays: number) => now + offsetDays * 86400000
    const audit = (actor: string, action: AuditEntry['action'], notes: string, ts = now): AuditEntry =>
      ({ id: uuid(), timestamp: ts, actor, action, notes })
    setAllCases([
      {
        id: uuid(), caseNumber: 'HR-2026-001', moduleId: 'VAULTHR', envId,
        caseType: 'Personnel Action', createdAt: t(-9), createdBy: 'hr@suttonma.org',
        subject: { employeeName: 'Highway Laborer II Candidate', department: 'Department of Public Works', actionType: 'Offer Approval', hiringManager: 'Steven T. Rowell' },
        scopeDefinition: 'DPW hiring packet for Laborer II vacancy', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'Town Manager Approval', dueDate: d(2), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'REVIEW', transitionBlockers: [],
        processing: {
          INTAKE: { receivedVia: 'HR Intake', bargainingUnit: 'AFSCME', salaryStep: 'Step 3' },
          REVIEW: { backgroundCheck: 'Complete', references: 'Verified', onboardingWindow: 'Target start 2026-04-14' },
        },
        assets: [], notes: 'Offer packet is complete and waiting on Town Manager sign-off before onboarding is scheduled.',
        auditLog: [
          audit('hr@suttonma.org', 'CREATE', 'HR packet opened for DPW vacancy.', t(-9)),
          audit('hr@suttonma.org', 'STAGE_TRANSITION', 'Compensation and union step verified.', t(-7)),
          audit('ac3@sutton.demo', 'STAGE_TRANSITION', 'Moved to REVIEW for Town Manager approval.', t(-1)),
        ],
        assignedRAO: 'Sutton Town Manager', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'TIM-2026-014', moduleId: 'VAULTTIME', envId,
        caseType: 'Time & Attendance Review', createdAt: t(-4), createdBy: 'finance@suttonma.org',
        subject: { employeeName: 'Highway Division Week Ending 2026-03-29', department: 'DPW', payrollCycle: 'Weekly' },
        scopeDefinition: 'DPW weekly payroll with storm overtime review', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'Payroll Release', dueDate: d(1), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'APPROVAL', transitionBlockers: [],
        processing: {
          INTAKE: { importSource: 'Timeclock sync', overtimeHours: '21.5', exceptionCount: '2' },
          APPROVAL: { pendingReviewer: 'Town Manager', flaggedReason: 'Storm response overtime exceeds weekly average by 34%' },
        },
        assets: [], notes: 'Two exception lines are flagged for review before payroll export closes.',
        auditLog: [
          audit('finance@suttonma.org', 'CREATE', 'Weekly payroll batch imported from timeclock.', t(-4)),
          audit('finance@suttonma.org', 'STAGE_TRANSITION', 'Exceptions isolated for review.', t(-3)),
          audit('finance@suttonma.org', 'ASSIGN', 'Assigned to Town Manager for approval.', t(-2)),
        ],
        assignedRAO: 'Sutton Town Manager', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'FIX-2026-008', moduleId: 'VAULTFIX', envId,
        caseType: 'Municipal Work Order', createdAt: t(-12), createdBy: 'facilities@suttonma.org',
        subject: { requesterName: 'Sutton Town Hall', asset: 'Server room HVAC', priority: 'Priority 1', location: '4 Uxbridge Road' },
        scopeDefinition: 'Emergency HVAC stabilization for Town Hall server room', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'Emergency Response', dueDate: d(-10), status: 'MET' },
          T25: { key: 'T25', label: 'Permanent Repair Completion', dueDate: d(3), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'IN_PROGRESS', transitionBlockers: [],
        processing: {
          INTAKE: { receivedVia: 'Facilities hotline', outageRisk: 'High', serviceImpact: 'Network + public counter operations' },
          IN_PROGRESS: { temporaryMitigation: 'Portable cooling online', vendor: 'New England Climate Controls', capexReview: 'Town Manager briefing requested' },
        },
        assets: [], notes: 'Temporary mitigation is active. Final vendor quote is queued for Town Manager review before permanent install.',
        auditLog: [
          audit('facilities@suttonma.org', 'CREATE', 'Emergency HVAC work order opened.', t(-12)),
          audit('srowell@suttonma.org', 'STAGE_TRANSITION', 'Temporary cooling deployed to protect server rack.', t(-11)),
          audit('srowell@suttonma.org', 'NOTE', 'Capital quote requested for permanent replacement.', t(-3)),
        ],
        assignedRAO: 'Steven T. Rowell', approvals: [],
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId, allCases])

  useEffect(() => {
    if (!SUTTON_IDS.includes(envId)) return
    if ((allCases || []).some(c => c.caseNumber === 'FIX-2026-009')) return
    const now = Date.now()
    const d = (offsetDays: number) => new Date(now + offsetDays * 86400000).toISOString().slice(0, 10)
    const t = (offsetDays: number) => now + offsetDays * 86400000
    const closedCase: VaultCase = {
      id: uuid(), caseNumber: 'FIX-2026-009', moduleId: 'VAULTFIX', envId,
      caseType: 'Municipal Work Order', createdAt: t(-28), createdBy: 'facilities@suttonma.org',
      subject: { requesterName: 'Sutton Senior Center', asset: 'Front entry lighting', priority: 'Priority 2', location: '19 Hough Road' },
      scopeDefinition: 'Replace failed exterior lighting and document completion for public safety follow-up.',
      scopeVersion: 1, scopeHistory: [],
      deadlines: {
        T10: { key: 'T10', label: 'Scheduling', dueDate: d(-23), status: 'MET' },
        T25: { key: 'T25', label: 'Completion', dueDate: d(-18), status: 'MET' },
      },
      tollingHistory: [], enforcementFlags: { feesAllowed: true },
      currentStage: 'CLOSED', transitionBlockers: [],
      processing: {
        INTAKE: { receivedVia: 'Facilities hotline', outageRisk: 'Medium', serviceImpact: 'Entry safety after dusk' },
        IN_PROGRESS: { assignedCrew: 'DPW electrical', vendor: 'N/A', closeout: 'Photos and completion memo filed' },
      },
      assets: [], notes: 'Completed and ready for archive/export demo.',
      auditLog: [
        { id: uuid(), timestamp: t(-28), actor: 'facilities@suttonma.org', action: 'CREATE', notes: 'Lighting repair request opened.' },
        { id: uuid(), timestamp: t(-26), actor: 'jsullivan@suttonma.org', action: 'STAGE_TRANSITION', notes: 'Crew assigned and materials confirmed.' },
        { id: uuid(), timestamp: t(-19), actor: 'jsullivan@suttonma.org', action: 'CLOSE', notes: 'Work completed and site verified.' },
      ],
      assignedRAO: 'Steven T. Rowell', approvals: [], closureReason: 'Completed',
    }
    setAllCases(prev => [...prev, closedCase])
  }, [allCases, envId, setAllCases])

  useEffect(() => {
    if (LOGICVILLE_IDS.includes(envId) && !allSettings['VAULTPRR']?.municipalityName) {
      const muni = {
        municipalityName: 'Town of Logicville',
        municipalityAddress: '1 Logicville Common, Logicville, MA 01600',
        municipalityPhone: '(978) 555-0100',
        municipalityWebsite: 'https://www.logicvillema.gov',
        emailNotificationsEnabled: true,
        notificationEmail: 'admin@logicvillema.gov',
      }
      const eleanor = { id: 'esc-lv-admin', name: 'Eleanor K. Whitmore', email: 'ewhitmore@logicvillema.gov', title: 'Town Administrator', severity: 'high' as const, triggerDaysBeforeDeadline: 3 }
      setAllSettings({
        VAULTCLERK: {
          moduleId: 'VAULTCLERK', envId, ...muni, accentColor: '#6366f1',
          raos: [
            { id: 'rao-lv-clerk-1', name: 'Robert A. Sinclair', title: 'Town Clerk', email: 'rsinclair@logicvillema.gov', phone: '(978) 555-0101', isPrimary: true },
            { id: 'rao-lv-clerk-2', name: 'Victoria M. Nash', title: 'Assistant Town Clerk', email: 'vnash@logicvillema.gov', phone: '(978) 555-0102', isPrimary: false },
          ],
          escalation: [eleanor],
          team: [
            { id: 'tm-lv-clerk-1', name: 'Robert A. Sinclair', email: 'rsinclair@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-lv-clerk-2', name: 'Victoria M. Nash', email: 'vnash@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Town Clerk' },
          ],
          trainingLinks: [
            { id: 'tr-lv-clerk-1', title: 'MA Town Clerk Handbook', url: 'https://www.sec.state.ma.us/ele/eleclk/clkidx.htm', description: 'Secretary of State official clerk guidance' },
            { id: 'tr-lv-clerk-2', title: 'Open Meeting Law Guide', url: 'https://www.mass.gov/guides/open-meeting-law-guide-for-public-bodies', description: 'AG Office OML compliance guide' },
            { id: 'tr-lv-clerk-3', title: 'MMACC Resources', url: 'https://www.mmacc.org', description: 'MA Municipal Association of City & Town Clerks' },
          ],
          workflow: { timers: [{ id: 'timer-lv-lic', name: 'License Review Deadline', businessDays: 10, statutory: true, statutorycitation: 'M.G.L. c.41 §19', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 3, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] }], emailTemplates: [{ id: 'tpl-lv-clerk-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Clerk Request Received — {{caseNumber}}', body: 'Dear {{requesterName}},\n\nYour request ({{caseNumber}}) has been received by the Logicville Town Clerk\'s office. We will respond within 10 business days.\n\nRobert A. Sinclair, Town Clerk\n(978) 555-0101', enabled: true }] },
          updatedAt: Date.now(),
        },
        VAULTPRR: {
          moduleId: 'VAULTPRR', envId, ...muni, accentColor: '#3b82f6',
          raos: [
            { id: 'rao-lv-prr-1', name: 'Robert A. Sinclair', title: 'Records Access Officer', email: 'rsinclair@logicvillema.gov', phone: '(978) 555-0101', isPrimary: true },
            { id: 'rao-lv-prr-2', name: 'Eleanor K. Whitmore', title: 'Deputy Records Access Officer', email: 'ewhitmore@logicvillema.gov', phone: '(978) 555-0100', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-prr-1', title: 'Supervisor of Records — Town Administrator', severity: 'critical' as const, triggerDaysBeforeDeadline: 1 }],
          team: [
            { id: 'tm-lv-prr-1', name: 'Robert A. Sinclair', email: 'rsinclair@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-lv-prr-2', name: 'Victoria M. Nash', email: 'vnash@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-lv-prr-3', name: 'Eleanor K. Whitmore', email: 'ewhitmore@logicvillema.gov', role: 'viewer' as const, canSeeAllCases: false, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-lv-prr-1', title: 'MA Supervisor of Records Guide', url: 'https://www.sec.state.ma.us/pre/preidx.htm', description: 'Official PRR guidance from the Secretary of State' },
            { id: 'tr-lv-prr-2', title: 'MA Public Records Law (M.G.L. c.66 §10)', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleX/Chapter66/Section10', description: 'Statutory text for public records obligations' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-t10', name: 'T10 — Initial Response', businessDays: 10, statutory: true, statutorycitation: 'M.G.L. c.66 §10(b)', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 3, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const, 'WAIVE_FEES' as const] },
            { id: 'timer-lv-t25', name: 'T25 — Extended Response', businessDays: 25, statutory: true, statutorycitation: 'M.G.L. c.66 §10(b)', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['BLOCK_CLOSE' as const, 'AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-prr-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Public Records Request Received — {{caseNumber}}', body: 'Dear {{requesterName}},\n\nThank you for submitting a public records request to the Town of Logicville. Your case number is {{caseNumber}}.\n\nWe will respond within 10 business days as required by M.G.L. c.66 §10.\n\nRobert A. Sinclair\nRecords Access Officer — Town of Logicville\n(978) 555-0101', enabled: true },
            { id: 'tpl-lv-prr-cl', trigger: 'CASE_CLOSED' as const, toRecipient: 'REQUESTER' as const, subject: 'Request Closed — {{caseNumber}}', body: 'Dear {{requesterName}},\n\nYour public records request ({{caseNumber}}) has been closed. Questions or appeals: pre@sec.state.ma.us.\n\nRecords Access Officer — Town of Logicville', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTFISCAL: {
          moduleId: 'VAULTFISCAL', envId, ...muni, accentColor: '#eab308',
          raos: [
            { id: 'rao-lv-fin-1', name: 'Diane M. Petrov', title: 'Finance Director', email: 'dpetrov@logicvillema.gov', phone: '(978) 555-0110', isPrimary: true },
            { id: 'rao-lv-fin-2', name: 'James E. Korhonen', title: 'Assistant Finance Director', email: 'jkorhonen@logicvillema.gov', phone: '(978) 555-0111', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-fin-1' }],
          team: [
            { id: 'tm-lv-fin-1', name: 'Diane M. Petrov', email: 'dpetrov@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-lv-fin-2', name: 'James E. Korhonen', email: 'jkorhonen@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-lv-fin-3', name: 'Eleanor K. Whitmore', email: 'ewhitmore@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-lv-fin-1', title: 'MA DOR Municipal Finance Guide', url: 'https://www.mass.gov/municipal-finance', description: 'DOR guidance on AP, warrants, and budget controls' },
            { id: 'tr-lv-fin-2', title: 'M.G.L. c.41 §56 — Expenditure Controls', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter41/Section56', description: 'Statutory appropriation and payment authority' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-3way', name: '3-Way Match Review', businessDays: 3, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['SEND_EMAIL' as const, 'AUTO_ESCALATE' as const] },
            { id: 'timer-lv-pay', name: 'Payment Approval Chain', businessDays: 5, statutory: false, startEvent: 'STAGE_ENTERED' as const, startStage: 'Approval Chain', warningDaysBefore: 2, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-fin-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Invoice Received — {{caseNumber}}', body: 'Invoice ({{caseNumber}}) received. 3-way match underway. Questions: jkorhonen@logicvillema.gov · (978) 555-0111', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTTIME: {
          moduleId: 'VAULTTIME', envId, ...muni, accentColor: '#10b981',
          raos: [
            { id: 'rao-lv-pay-1', name: 'Diane M. Petrov', title: 'Finance Director', email: 'dpetrov@logicvillema.gov', phone: '(978) 555-0110', isPrimary: true },
            { id: 'rao-lv-pay-2', name: 'Amanda T. Chow', title: 'Payroll Coordinator', email: 'achow@logicvillema.gov', phone: '(978) 555-0112', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-pay-1', severity: 'critical' as const, triggerDaysBeforeDeadline: 1 }],
          team: [
            { id: 'tm-lv-pay-1', name: 'Diane M. Petrov', email: 'dpetrov@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-lv-pay-2', name: 'Amanda T. Chow', email: 'achow@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Finance' },
            { id: 'tm-lv-pay-3', name: 'Marcus J. Ellington', email: 'mellington@logicvillema.gov', role: 'viewer' as const, canSeeAllCases: false, department: 'Human Resources' },
          ],
          trainingLinks: [
            { id: 'tr-lv-pay-1', title: 'MA Wage & Hour Laws', url: 'https://www.mass.gov/wage-hour-laws', description: 'Overtime, prevailing wage, and timekeeping' },
            { id: 'tr-lv-pay-2', title: 'MA DOR Payroll Guidance', url: 'https://www.mass.gov/orgs/massachusetts-department-of-revenue', description: 'Municipal payroll and withholding compliance' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-ts', name: 'Timesheet Submission', businessDays: 5, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['SEND_EMAIL' as const, 'AUTO_ESCALATE' as const] },
            { id: 'timer-lv-sup', name: 'Supervisor Approval', businessDays: 2, statutory: false, startEvent: 'STAGE_ENTERED' as const, startStage: 'Supervisor Review', warningDaysBefore: 1, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-ts-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Timesheet Received — {{caseNumber}}', body: 'Your timesheet ({{caseNumber}}) is pending supervisor review. Payroll: Amanda T. Chow · achow@logicvillema.gov', enabled: true },
            { id: 'tpl-lv-ts-ap', trigger: 'APPROVAL_ISSUED' as const, toRecipient: 'REQUESTER' as const, subject: 'Timesheet Approved — {{caseNumber}}', body: 'Your timesheet ({{caseNumber}}) has been approved and submitted to payroll.', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTFIX: {
          moduleId: 'VAULTFIX', envId, ...muni, accentColor: '#f97316',
          raos: [
            { id: 'rao-lv-dpw-1', name: 'Frank T. Kowalski', title: 'DPW Director', email: 'fkowalski@logicvillema.gov', phone: '(978) 555-0120', isPrimary: true },
            { id: 'rao-lv-dpw-2', name: 'Owen B. MacNeil', title: 'DPW Foreman', email: 'omacneil@logicvillema.gov', phone: '(978) 555-0121', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-dpw-1', triggerDaysBeforeDeadline: 2 }],
          team: [
            { id: 'tm-lv-dpw-1', name: 'Frank T. Kowalski', email: 'fkowalski@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'DPW' },
            { id: 'tm-lv-dpw-2', name: 'Owen B. MacNeil', email: 'omacneil@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'DPW' },
            { id: 'tm-lv-dpw-3', name: 'Sandra J. Kowalski', email: 'skowalski@logicvillema.gov', role: 'viewer' as const, canSeeAllCases: false, department: 'Facilities' },
          ],
          trainingLinks: [
            { id: 'tr-lv-dpw-1', title: 'APWA Public Works Standards', url: 'https://www.apwa.net', description: 'American Public Works Association best practices' },
            { id: 'tr-lv-dpw-2', title: 'MassDOT Chapter 90 Program', url: 'https://www.mass.gov/chapter-90', description: 'State road funding and maintenance compliance' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-p1', name: 'Priority 1 — Emergency', businessDays: 1, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 0, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            { id: 'timer-lv-p2', name: 'Priority 2 — Urgent', businessDays: 5, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            { id: 'timer-lv-p3', name: 'Priority 3 — Standard', businessDays: 20, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-wo-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Work Order Submitted — {{caseNumber}}', body: 'Your work order ({{caseNumber}}) has been received by Logicville DPW.\n\nDPW Director: Frank T. Kowalski · fkowalski@logicvillema.gov · (978) 555-0120', enabled: true },
            { id: 'tpl-lv-wo-cl', trigger: 'CASE_CLOSED' as const, toRecipient: 'REQUESTER' as const, subject: 'Work Order Complete — {{caseNumber}}', body: 'Work order ({{caseNumber}}) has been completed. Thank you — Logicville DPW', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTONBOARD: {
          moduleId: 'VAULTONBOARD', envId, ...muni, accentColor: '#8b5cf6',
          raos: [
            { id: 'rao-lv-ob-1', name: 'Marcus J. Ellington', title: 'HR Director', email: 'mellington@logicvillema.gov', phone: '(978) 555-0130', isPrimary: true },
            { id: 'rao-lv-ob-2', name: 'Jennifer R. Stamos', title: 'HR Coordinator', email: 'jstamos@logicvillema.gov', phone: '(978) 555-0131', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-ob-1' }],
          team: [
            { id: 'tm-lv-ob-1', name: 'Marcus J. Ellington', email: 'mellington@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-lv-ob-2', name: 'Jennifer R. Stamos', email: 'jstamos@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-lv-ob-3', name: 'Ben R. Torres', email: 'btorres@logicvillema.gov', role: 'viewer' as const, canSeeAllCases: false, department: 'IT' },
          ],
          trainingLinks: [
            { id: 'tr-lv-ob-1', title: 'MA CORI Background Checks', url: 'https://www.mass.gov/cori', description: 'DCJIS background check compliance for public employers' },
            { id: 'tr-lv-ob-2', title: 'EEOC New Hire Requirements', url: 'https://www.eeoc.gov', description: 'Federal equal employment and onboarding requirements' },
            { id: 'tr-lv-ob-3', title: 'MA c.149 Employment Law', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149', description: 'MA labor law governing new hire compliance' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-cori', name: 'CORI Background Check Gate', businessDays: 5, statutory: true, statutorycitation: 'M.G.L. c.6 §172', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['BLOCK_CLOSE' as const, 'AUTO_ESCALATE' as const] },
            { id: 'timer-lv-onb', name: 'Full Onboarding Completion', businessDays: 20, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-ob-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Onboarding Started — {{caseNumber}}', body: 'Welcome to the Town of Logicville! Your onboarding case ({{caseNumber}}) has been created.\n\nHR Director: Marcus J. Ellington · mellington@logicvillema.gov · (978) 555-0130', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTPERMIT: {
          moduleId: 'VAULTPERMIT', envId, ...muni, accentColor: '#06b6d4',
          raos: [
            { id: 'rao-lv-bld-1', name: 'Patrick L. Dunne', title: 'Building Commissioner', email: 'pdunne@logicvillema.gov', phone: '(978) 555-0140', isPrimary: true },
            { id: 'rao-lv-bld-2', name: 'Yolanda S. Ferris', title: 'Building Inspector', email: 'yferris@logicvillema.gov', phone: '(978) 555-0141', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-bld-1' }],
          team: [
            { id: 'tm-lv-bld-1', name: 'Patrick L. Dunne', email: 'pdunne@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Building' },
            { id: 'tm-lv-bld-2', name: 'Yolanda S. Ferris', email: 'yferris@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Building' },
          ],
          trainingLinks: [
            { id: 'tr-lv-bld-1', title: 'MA Board of Building Regulations', url: 'https://www.mass.gov/orgs/board-of-building-regulations-and-standards', description: '9th Edition MA Building Code and inspectional standards' },
            { id: 'tr-lv-bld-2', title: 'MA Zoning Act (M.G.L. c.40A)', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40A', description: 'Zoning and permitting authority' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-permit', name: 'Permit Review', businessDays: 20, statutory: true, statutorycitation: 'M.G.L. c.40A §9', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-bld-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Permit Application Received — {{caseNumber}}', body: 'Your permit application ({{caseNumber}}) has been received by the Logicville Building Department.\n\nBuilding Commissioner: Patrick L. Dunne · pdunne@logicvillema.gov · (978) 555-0140', enabled: true },
            { id: 'tpl-lv-bld-ap', trigger: 'APPROVAL_ISSUED' as const, toRecipient: 'REQUESTER' as const, subject: 'Permit Approved — {{caseNumber}}', body: 'Your permit ({{caseNumber}}) has been approved. Please collect your permit card at the Building Department before commencing work.', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTHR: {
          moduleId: 'VAULTHR', envId, ...muni, accentColor: '#ec4899',
          raos: [
            { id: 'rao-lv-hr-1', name: 'Marcus J. Ellington', title: 'HR Director', email: 'mellington@logicvillema.gov', phone: '(978) 555-0130', isPrimary: true },
            { id: 'rao-lv-hr-2', name: 'Jennifer R. Stamos', title: 'HR Coordinator', email: 'jstamos@logicvillema.gov', phone: '(978) 555-0131', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-hr-1' }],
          team: [
            { id: 'tm-lv-hr-1', name: 'Marcus J. Ellington', email: 'mellington@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-lv-hr-2', name: 'Jennifer R. Stamos', email: 'jstamos@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Human Resources' },
            { id: 'tm-lv-hr-3', name: 'Eleanor K. Whitmore', email: 'ewhitmore@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-lv-hr-1', title: 'MA DLR Municipal HR Guidance', url: 'https://www.mass.gov/orgs/department-of-labor-relations', description: 'Labor relations and personnel action requirements' },
            { id: 'tr-lv-hr-2', title: 'MA Personnel Records Law (c.149 §52C)', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149/Section52C', description: 'Employee personnel file access rights' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-hr', name: 'Personnel Action Review', businessDays: 15, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 5, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-hr-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'HR Request Received — {{caseNumber}}', body: 'Your HR request ({{caseNumber}}) has been received.\n\nHR Director: Marcus J. Ellington · mellington@logicvillema.gov · (978) 555-0130', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTPROCURE: {
          moduleId: 'VAULTPROCURE', envId, ...muni, accentColor: '#84cc16',
          raos: [
            { id: 'rao-lv-proc-1', name: 'Sarah L. Huang', title: 'Chief Procurement Officer', email: 'shuang@logicvillema.gov', phone: '(978) 555-0150', isPrimary: true },
            { id: 'rao-lv-proc-2', name: 'Daniel R. Wright', title: 'Procurement Analyst', email: 'dwright@logicvillema.gov', phone: '(978) 555-0151', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-proc-1' }],
          team: [
            { id: 'tm-lv-proc-1', name: 'Sarah L. Huang', email: 'shuang@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Procurement' },
            { id: 'tm-lv-proc-2', name: 'Daniel R. Wright', email: 'dwright@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Procurement' },
            { id: 'tm-lv-proc-3', name: 'Diane M. Petrov', email: 'dpetrov@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Finance' },
          ],
          trainingLinks: [
            { id: 'tr-lv-proc-1', title: 'MA c.30B Procurement Manual', url: 'https://www.mass.gov/chapter-30b', description: 'Uniform Procurement Act — official OEMB manual' },
            { id: 'tr-lv-proc-2', title: 'OEMB Procurement Resources', url: 'https://www.mass.gov/orgs/office-of-the-inspector-general', description: 'Inspector General procurement guides for municipalities' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-bid', name: 'Bid Evaluation Period', businessDays: 10, statutory: true, statutorycitation: 'M.G.L. c.30B §5', startEvent: 'STAGE_ENTERED' as const, startStage: 'Bid Evaluation', warningDaysBefore: 3, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            { id: 'timer-lv-award', name: 'Contract Award', businessDays: 5, statutory: false, startEvent: 'STAGE_ENTERED' as const, startStage: 'Award', warningDaysBefore: 2, onMiss: ['AUTO_ESCALATE' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-proc-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Procurement Request Received — {{caseNumber}}', body: 'Procurement request ({{caseNumber}}) received.\n\nCPO: Sarah L. Huang · shuang@logicvillema.gov · (978) 555-0150', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTRECS: {
          moduleId: 'VAULTRECS', envId, ...muni, accentColor: '#64748b',
          raos: [
            { id: 'rao-lv-rec-1', name: 'Catherine P. Monroe', title: 'Records Manager', email: 'cmonroe@logicvillema.gov', phone: '(978) 555-0160', isPrimary: true },
            { id: 'rao-lv-rec-2', name: 'Robert A. Sinclair', title: 'Town Clerk', email: 'rsinclair@logicvillema.gov', phone: '(978) 555-0101', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-rec-1' }],
          team: [
            { id: 'tm-lv-rec-1', name: 'Catherine P. Monroe', email: 'cmonroe@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Records' },
            { id: 'tm-lv-rec-2', name: 'Robert A. Sinclair', email: 'rsinclair@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Town Clerk' },
          ],
          trainingLinks: [
            { id: 'tr-lv-rec-1', title: 'MA Records Retention Schedule', url: 'https://www.sec.state.ma.us/arc/arcmun/munidx.htm', description: 'Secretary of State retention schedules for municipalities' },
            { id: 'tr-lv-rec-2', title: 'MA Public Records Law c.66', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleX/Chapter66', description: 'Public records obligations and disposition rules' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-ret', name: 'Disposition Review at Maturity', businessDays: 30, statutory: false, startEvent: 'CASE_CREATED' as const, warningDaysBefore: 10, onMiss: ['SEND_EMAIL' as const, 'AUTO_ESCALATE' as const] },
            { id: 'timer-lv-dis', name: 'Destruction Authorization', businessDays: 10, statutory: true, statutorycitation: 'M.G.L. c.66 §8', startEvent: 'STAGE_ENTERED' as const, startStage: 'Disposition Authorization', warningDaysBefore: 3, onMiss: ['BLOCK_CLOSE' as const, 'AUTO_ESCALATE' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-rec-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Records Request Received — {{caseNumber}}', body: 'Your records management request ({{caseNumber}}) has been received.\n\nRecords Manager: Catherine P. Monroe · cmonroe@logicvillema.gov', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
        VAULTMEET: {
          moduleId: 'VAULTMEET', envId, ...muni, accentColor: '#f43f5e',
          raos: [
            { id: 'rao-lv-meet-1', name: 'Robert A. Sinclair', title: 'Town Clerk', email: 'rsinclair@logicvillema.gov', phone: '(978) 555-0101', isPrimary: true },
            { id: 'rao-lv-meet-2', name: 'Victoria M. Nash', title: 'Assistant Town Clerk', email: 'vnash@logicvillema.gov', phone: '(978) 555-0102', isPrimary: false },
          ],
          escalation: [{ ...eleanor, id: 'esc-lv-meet-1', severity: 'critical' as const, triggerDaysBeforeDeadline: 1 }],
          team: [
            { id: 'tm-lv-meet-1', name: 'Robert A. Sinclair', email: 'rsinclair@logicvillema.gov', role: 'admin' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-lv-meet-2', name: 'Victoria M. Nash', email: 'vnash@logicvillema.gov', role: 'approver' as const, canSeeAllCases: true, department: 'Town Clerk' },
            { id: 'tm-lv-meet-3', name: 'Eleanor K. Whitmore', email: 'ewhitmore@logicvillema.gov', role: 'viewer' as const, canSeeAllCases: false, department: 'Administration' },
          ],
          trainingLinks: [
            { id: 'tr-lv-meet-1', title: 'Open Meeting Law Guide (AG)', url: 'https://www.mass.gov/guides/open-meeting-law-guide-for-public-bodies', description: 'AG Office OML compliance for public bodies' },
            { id: 'tr-lv-meet-2', title: 'MA OML Regulations (940 CMR 29)', url: 'https://www.mass.gov/regulations/940-CMR-2900-open-meeting-law', description: 'Regulatory framework for meeting posting and minutes' },
            { id: 'tr-lv-meet-3', title: 'MCMA Municipal Calendar', url: 'https://www.mma.org/resources/municipal-calendar/', description: 'MA Municipal Association meeting and compliance calendar' },
          ],
          workflow: { timers: [
            { id: 'timer-lv-post', name: 'Meeting Posting (48h Advance)', businessDays: 0, statutory: true, statutorycitation: 'M.G.L. c.30A §20', startEvent: 'CASE_CREATED' as const, warningDaysBefore: 1, onMiss: ['BLOCK_CLOSE' as const, 'AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
            { id: 'timer-lv-min', name: 'Minutes Draft (7 days post-meeting)', businessDays: 7, statutory: false, startEvent: 'STAGE_ENTERED' as const, startStage: 'Minutes Draft', warningDaysBefore: 2, onMiss: ['AUTO_ESCALATE' as const, 'SEND_EMAIL' as const] },
          ], emailTemplates: [
            { id: 'tpl-lv-meet-in', trigger: 'INTAKE_RECEIVED' as const, toRecipient: 'REQUESTER' as const, subject: 'Meeting Posted — {{caseNumber}}', body: 'Meeting ({{caseNumber}}) has been posted in compliance with M.G.L. c.30A §20.\n\nTown Clerk: Robert A. Sinclair · rsinclair@logicvillema.gov', enabled: true },
          ] },
          updatedAt: Date.now(),
        },
      })
      updateCaseSpace(envId, { vaultModuleIds: LOGICVILLE_MODULES, town: 'Town of Logicville', name: 'Town of Logicville' })
        .then(updated => { if (updated) setCasespaces(prev => prev.map(cs => cs.id === envId ? updated : cs)) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId])

  // Seed demo cases for Logicville (fires once when cases list is empty)
  const hasNoCases = (allCases || []).length === 0
  useEffect(() => {
    if (!LOGICVILLE_IDS.includes(envId)) return
    if ((allCases || []).length > 0) return
    const now = Date.now()
    const d = (offsetDays: number) => new Date(now + offsetDays * 86400000).toISOString().slice(0, 10)
    const t = (offsetDays: number) => now + offsetDays * 86400000
    const audit = (actor: string, action: AuditEntry['action'], notes: string, ts = now): AuditEntry =>
      ({ id: uuid(), timestamp: ts, actor, action, notes })
    setAllCases([
      // ── VAULTPRR ──────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'PRR-2026-001', moduleId: 'VAULTPRR', envId,
        caseType: 'Public Records Request', createdAt: t(-14), createdBy: 'rsinclair@logicvillema.gov',
        subject: { requesterName: 'Thomas Garfield', requesterEmail: 'tgarfield@gmail.com', requestText: 'All contracts awarded to Highway Associates LLC in FY2025, including any amendments and change orders.' },
        scopeDefinition: 'Contracts — Highway Associates LLC FY2025', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'T10 Initial Response', dueDate: d(-4), status: 'MISSED' },
          T25: { key: 'T25', label: 'T25 Extended Response', dueDate: d(11), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: false },
        currentStage: 'GATHERING', transitionBlockers: [],
        processing: { INTAKE: { receivedVia: 'Email', clarificationNeeded: 'No' }, ASSESSMENT: { scopeConfirmed: 'Yes', custodian: 'Town Administrator' } },
        assets: [], notes: 'T10 missed — fees waived per M.G.L. c.66 §10. Gathering records from DPW and Finance.',
        auditLog: [
          audit('rsinclair@logicvillema.gov', 'CREATE', 'Case created. T10 computed from receipt date.', t(-14)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to ASSESSMENT. Scope confirmed with requestor.', t(-13)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to GATHERING. Sent custodian requests to DPW and Finance.', t(-10)),
          audit('rsinclair@logicvillema.gov', 'DEADLINE_MISSED', 'T10 missed. Fees automatically waived per statute.', t(-4)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'PRR-2026-002', moduleId: 'VAULTPRR', envId,
        caseType: 'Public Records Request', createdAt: t(-5), createdBy: 'vnash@logicvillema.gov',
        subject: { requesterName: 'Maria Santos', requesterEmail: 'msantos@logicvilleherald.com', requestText: 'Board of Selectmen meeting minutes for January and February 2026.' },
        scopeDefinition: 'BOS Meeting Minutes — Jan–Feb 2026', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'T10 Initial Response', dueDate: d(5), status: 'OPEN' },
          T25: { key: 'T25', label: 'T25 Extended Response', dueDate: d(20), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'REVIEW', transitionBlockers: [],
        processing: { INTAKE: { receivedVia: 'Online Portal' }, ASSESSMENT: { scopeConfirmed: 'Yes', custodian: 'Town Clerk' }, GATHERING: { recordsLocated: 'Yes', pageCount: '38' } },
        assets: [], notes: 'Records located. In redaction review with Town Counsel.',
        auditLog: [
          audit('vnash@logicvillema.gov', 'CREATE', 'Case created.', t(-5)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to ASSESSMENT.', t(-4)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to GATHERING. Minutes retrieved from records vault.', t(-3)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to REVIEW. Sent to Town Counsel for redaction check.', t(-1)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'PRR-2026-003', moduleId: 'VAULTPRR', envId,
        caseType: 'Public Records Request', createdAt: t(-30), createdBy: 'rsinclair@logicvillema.gov',
        subject: { requesterName: 'Clifford Webb', requesterEmail: 'cwebb@cwebb.com', requestText: 'Police incident reports involving property at 44 Elm Street from 2023–2025.' },
        scopeDefinition: 'Police Reports — 44 Elm Street 2023–2025', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T10: { key: 'T10', label: 'T10 Initial Response', dueDate: d(-20), status: 'MET' },
          T25: { key: 'T25', label: 'T25 Extended Response', dueDate: d(-5), status: 'MET' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CLOSED', transitionBlockers: [], closureReason: 'Delivered', closedAt: t(-6),
        processing: { INTAKE: { receivedVia: 'Mail' }, ASSESSMENT: { scopeConfirmed: 'Yes', custodian: 'Police Dept' }, GATHERING: { recordsLocated: 'Yes', pageCount: '14' }, REVIEW: { redactionsApplied: 'Yes', exemptionsCited: 'M.G.L. c.4 §7(26)(f)' }, RESPONSE: { deliveryMethod: 'Email', fee: '$0' } },
        assets: [], notes: 'Delivered with redactions applied per exemption c.4 §7(26)(f) — personal privacy.',
        auditLog: [
          audit('rsinclair@logicvillema.gov', 'CREATE', 'Case created.', t(-30)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'ASSESSMENT complete.', t(-28)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'GATHERING — forwarded to Police Records Unit.', t(-25)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'REVIEW — redactions applied.', t(-10)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'RESPONSE sent to requester.', t(-7)),
          audit('rsinclair@logicvillema.gov', 'CLOSE', 'Closed: Delivered. Records emailed with redaction notice.', t(-6)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      // ── VAULTCLERK ────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'CLK-2026-001', moduleId: 'VAULTCLERK', envId,
        caseType: 'Town Clerk Operations', createdAt: t(-3), createdBy: 'vnash@logicvillema.gov',
        subject: { applicantName: 'Sunrise Café LLC', licenseType: 'Common Victualler License', contactEmail: 'sunrise@logicvillema.gov', contactPhone: '(978) 555-0200' },
        scopeDefinition: 'Common Victualler License — Sunrise Café LLC', scopeVersion: 1, scopeHistory: [],
        deadlines: { T10: { key: 'T10', label: 'License Review Deadline', dueDate: d(7), status: 'OPEN' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'COMPLETENESS', transitionBlockers: [],
        processing: { INTAKE: { receivedVia: 'In Person', paymentReceived: 'Yes', fee: '$50' } },
        assets: [], notes: 'Application received with fee. Pending completeness check.',
        auditLog: [
          audit('vnash@logicvillema.gov', 'CREATE', 'Application received in person.', t(-3)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to COMPLETENESS review.', t(-2)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'CLK-2026-002', moduleId: 'VAULTCLERK', envId,
        caseType: 'Town Clerk Operations', createdAt: t(-20), createdBy: 'rsinclair@logicvillema.gov',
        subject: { applicantName: 'Logicville VFW Post 441', licenseType: 'One-Day Alcohol License', contactEmail: 'vfw441@logicvillevfw.org', contactPhone: '(978) 555-0210', eventDate: '2026-03-15' },
        scopeDefinition: 'One-Day Alcohol License — VFW Post 441 Spring Dinner', scopeVersion: 1, scopeHistory: [],
        deadlines: { T10: { key: 'T10', label: 'License Review Deadline', dueDate: d(-10), status: 'MET' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CLOSED', transitionBlockers: [], closureReason: 'License Issued', closedAt: t(-8),
        processing: { INTAKE: { receivedVia: 'Mail' }, COMPLETENESS: { complete: 'Yes' }, INSPECTION: { notes: 'No prior violations' }, DECISION: { approved: 'Yes', boardVote: '5-0' }, ISSUANCE: { licenseNumber: 'ODA-2026-0012', issuedDate: '2026-03-01' } },
        assets: [], notes: 'One-day alcohol license issued for March 15th dinner event.',
        auditLog: [
          audit('rsinclair@logicvillema.gov', 'CREATE', 'Application received by mail.', t(-20)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'COMPLETENESS — all materials verified.', t(-18)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'INSPECTION — background clear.', t(-15)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'DECISION — BOS approved 5-0 at 2/10 meeting.', t(-10)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'ISSUANCE — license mailed to VFW.', t(-9)),
          audit('rsinclair@logicvillema.gov', 'CLOSE', 'Closed: License Issued.', t(-8)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      // ── VAULTFISCAL ───────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'FSC-2026-001', moduleId: 'VAULTFISCAL', envId,
        caseType: 'Accounts Payable', createdAt: t(-7), createdBy: 'jkorhonen@logicvillema.gov',
        subject: { vendorName: 'Northeast Road Services Inc', invoiceNumber: 'NRS-44821', invoiceAmount: '$18,450.00', department: 'DPW', description: 'Winter road treatment materials — January 2026' },
        scopeDefinition: 'Invoice NRS-44821 — Winter Road Materials', scopeVersion: 1, scopeHistory: [],
        deadlines: { T30: { key: 'T30', label: 'T30 Payment Due', dueDate: d(23), status: 'OPEN' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'APPROVAL', transitionBlockers: [],
        processing: { INTAKE: { receivedVia: 'Mail', poNumber: 'PO-2026-0041' }, MATCH: { poMatched: 'Yes', receiptConfirmed: 'Yes', amountMatches: 'Yes' }, BUDGET: { lineItem: 'DPW Materials 5200-580', fundsAvailable: 'Yes' } },
        assets: [], notes: '3-way match complete. Pending Finance Director signature.',
        auditLog: [
          audit('jkorhonen@logicvillema.gov', 'CREATE', 'Invoice received from NRS.', t(-7)),
          audit('jkorhonen@logicvillema.gov', 'STAGE_TRANSITION', 'MATCH — PO-2026-0041 matched, receipt confirmed.', t(-6)),
          audit('jkorhonen@logicvillema.gov', 'STAGE_TRANSITION', 'BUDGET — funds available in DPW Materials line.', t(-5)),
          audit('jkorhonen@logicvillema.gov', 'STAGE_TRANSITION', 'APPROVAL — forwarded to Finance Director.', t(-4)),
        ],
        assignedRAO: 'dpetrov@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'FSC-2026-002', moduleId: 'VAULTFISCAL', envId,
        caseType: 'Accounts Payable', createdAt: t(-45), createdBy: 'jkorhonen@logicvillema.gov',
        subject: { vendorName: 'Municipal Software Group', invoiceNumber: 'MSG-10092', invoiceAmount: '$4,200.00', department: 'IT', description: 'Annual software maintenance — Workspace FY2026' },
        scopeDefinition: 'Invoice MSG-10092 — Workspace Annual Maintenance', scopeVersion: 1, scopeHistory: [],
        deadlines: { T30: { key: 'T30', label: 'T30 Payment Due', dueDate: d(-15), status: 'MET' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CLOSED', transitionBlockers: [], closureReason: 'Paid', closedAt: t(-16),
        processing: { INTAKE: { receivedVia: 'Email', poNumber: 'PO-2026-0018' }, MATCH: { poMatched: 'Yes', receiptConfirmed: 'Yes', amountMatches: 'Yes' }, BUDGET: { lineItem: 'IT Software 1500-451', fundsAvailable: 'Yes' }, APPROVAL: { approvedBy: 'Diane M. Petrov', approvedDate: '2026-01-28' }, PAYMENT: { checkNumber: '28441', checkDate: '2026-01-30', warrantNumber: 'W-2026-04' } },
        assets: [], notes: 'Paid in full. Check 28441 on Warrant W-2026-04.',
        auditLog: [
          audit('jkorhonen@logicvillema.gov', 'CREATE', 'Invoice received.', t(-45)),
          audit('jkorhonen@logicvillema.gov', 'STAGE_TRANSITION', 'MATCH complete.', t(-43)),
          audit('jkorhonen@logicvillema.gov', 'STAGE_TRANSITION', 'BUDGET confirmed.', t(-42)),
          audit('dpetrov@logicvillema.gov', 'APPROVAL', 'Finance Director approved.', t(-20)),
          audit('dpetrov@logicvillema.gov', 'STAGE_TRANSITION', 'PAYMENT — check issued on Warrant W-2026-04.', t(-17)),
          audit('jkorhonen@logicvillema.gov', 'CLOSE', 'Closed: Paid.', t(-16)),
        ],
        assignedRAO: 'dpetrov@logicvillema.gov', approvals: [],
      },
      // ── VAULTFIX ──────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'FIX-2026-001', moduleId: 'VAULTFIX', envId,
        caseType: 'Work Order', createdAt: t(-1), createdBy: 'omacneil@logicvillema.gov',
        subject: { reporterName: 'Sandra Owens', reporterPhone: '(978) 555-0300', location: '88 Mill Road — Water main break at intersection', priority: 'P1 — Emergency', description: 'Active water main break flooding roadway. Water loss significant.' },
        scopeDefinition: 'Water Main Break — 88 Mill Road', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          SLA_CRITICAL: { key: 'SLA_CRITICAL', label: 'Critical SLA (1 business day)', dueDate: d(0), status: 'OPEN' },
          SLA_URGENT: { key: 'SLA_URGENT', label: 'Urgent SLA (5 business days)', dueDate: d(4), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'IN_PROGRESS', transitionBlockers: [],
        processing: { INTAKE: { reportedVia: 'Phone' }, PRIORITY: { priority: 'P1', rationale: 'Active water loss, road flooding' }, ASSIGNED: { crew: 'Crew A — Waters & Kowalski', assignedAt: String(t(-1)) } },
        assets: [], notes: 'Crew A on site. Water shut-off valve located. Repair underway.',
        auditLog: [
          audit('omacneil@logicvillema.gov', 'CREATE', 'Emergency work order created — P1 water main break.', t(-1)),
          audit('fkowalski@logicvillema.gov', 'STAGE_TRANSITION', 'PRIORITY set to P1. Crew A dispatched.', t(-1)),
          audit('fkowalski@logicvillema.gov', 'STAGE_TRANSITION', 'ASSIGNED — Crew A on scene.', t(-1)),
          audit('omacneil@logicvillema.gov', 'STAGE_TRANSITION', 'IN_PROGRESS — repair underway.', t(0)),
        ],
        assignedRAO: 'fkowalski@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'FIX-2026-002', moduleId: 'VAULTFIX', envId,
        caseType: 'Work Order', createdAt: t(-12), createdBy: 'fkowalski@logicvillema.gov',
        subject: { reporterName: 'Louis Bergeron', reporterPhone: '(978) 555-0310', location: 'Town Common — Park bench #7 broken, vandalism', priority: 'P3 — Standard', description: 'Bench slats broken and graffiti on backrest. Safety hazard.' },
        scopeDefinition: 'Town Common Bench Repair — Vandalism', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          SLA_CRITICAL: { key: 'SLA_CRITICAL', label: 'Critical SLA', dueDate: d(-11), status: 'MET' },
          SLA_STANDARD: { key: 'SLA_STANDARD', label: 'Standard SLA (20 business days)', dueDate: d(8), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CLOSED', transitionBlockers: [], closureReason: 'Completed', closedAt: t(-3),
        processing: { INTAKE: { reportedVia: 'Email' }, PRIORITY: { priority: 'P3' }, ASSIGNED: { crew: 'Crew B — Facilities', assignedAt: String(t(-10)) }, IN_PROGRESS: { startDate: String(t(-8)) }, VERIFICATION: { completedBy: 'Owen MacNeil', notes: 'New slats installed, graffiti removed.' } },
        assets: [], notes: 'Bench fully repaired. Graffiti removed. Photos on file.',
        auditLog: [
          audit('fkowalski@logicvillema.gov', 'CREATE', 'Work order created — P3.', t(-12)),
          audit('omacneil@logicvillema.gov', 'STAGE_TRANSITION', 'PRIORITY P3. Scheduled for next week.', t(-11)),
          audit('omacneil@logicneil@logicvillema.gov', 'STAGE_TRANSITION', 'ASSIGNED to Crew B.', t(-10)),
          audit('omacneil@logicvillema.gov', 'STAGE_TRANSITION', 'IN_PROGRESS.', t(-8)),
          audit('omacneil@logicvillema.gov', 'STAGE_TRANSITION', 'VERIFICATION complete.', t(-4)),
          audit('fkowalski@logicvillema.gov', 'CLOSE', 'Closed: Completed.', t(-3)),
        ],
        assignedRAO: 'fkowalski@logicvillema.gov', approvals: [],
      },
      // ── VAULTTIME ─────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'TIM-2026-001', moduleId: 'VAULTTIME', envId,
        caseType: 'Payroll & Timekeeping', createdAt: t(-4), createdBy: 'achow@logicvillema.gov',
        subject: { employeeName: 'Owen B. MacNeil', employeeId: 'EMP-0041', department: 'DPW', payPeriod: '2026-02-10 to 2026-02-21', regularHours: '80', overtimeHours: '6', supervisorEmail: 'fkowalski@logicvillema.gov' },
        scopeDefinition: 'Timesheet — Owen MacNeil, Pay Period 2/10–2/21', scopeVersion: 1, scopeHistory: [],
        deadlines: { SUBMIT: { key: 'SUBMIT', label: 'Submission Deadline', dueDate: d(1), status: 'OPEN' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'SUPERVISOR_REVIEW', transitionBlockers: [],
        processing: { INTAKE: { submittedVia: 'Online Portal' } },
        assets: [], notes: '6 hours OT from emergency main break response on 2/25. Pending supervisor sign-off.',
        auditLog: [
          audit('achow@logicvillema.gov', 'CREATE', 'Timesheet received for pay period 2/10–2/21.', t(-4)),
          audit('achow@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to SUPERVISOR_REVIEW.', t(-3)),
        ],
        assignedRAO: 'dpetrov@logicvillema.gov', approvals: [],
      },
      // ── VAULTONBOARD ──────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'OBD-2026-001', moduleId: 'VAULTONBOARD', envId,
        caseType: 'Employee Onboarding', createdAt: t(-10), createdBy: 'mellington@logicvillema.gov',
        subject: { employeeName: 'Priya Nair', position: 'Administrative Assistant', department: 'Finance', startDate: '2026-03-10', hiringManager: 'Diane M. Petrov', supervisorEmail: 'dpetrov@logicvillema.gov' },
        scopeDefinition: 'Onboarding — Priya Nair, Finance Administrative Assistant', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          DAY1: { key: 'DAY1', label: 'Day 1 Setup Deadline', dueDate: d(13), status: 'OPEN' },
          CORI: { key: 'CORI', label: 'CORI Clearance', dueDate: d(3), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'BACKGROUND', transitionBlockers: [],
        processing: { INTAKE: { offerLetterSigned: 'Yes', i9Completed: 'Yes', w4Completed: 'Yes' }, BACKGROUND: { coriSubmitted: 'Yes', coriDate: '2026-02-18' } },
        assets: [], notes: 'CORI submitted 2/18. Start date 3/10. IT setup and badge to follow clearance.',
        auditLog: [
          audit('mellington@logicvillema.gov', 'CREATE', 'Onboarding case created for Priya Nair.', t(-10)),
          audit('jstamos@logicvillema.gov', 'STAGE_TRANSITION', 'I-9 and W-4 collected. Moved to BACKGROUND.', t(-8)),
          audit('jstamos@logicvillema.gov', 'UPDATE', 'CORI request submitted to DCJIS.', t(-8)),
        ],
        assignedRAO: 'mellington@logicvillema.gov', approvals: [],
      },
      // ── VAULTPERMIT ───────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'PRM-2026-001', moduleId: 'VAULTPERMIT', envId,
        caseType: 'Building Permit', createdAt: t(-8), createdBy: 'yferris@logicvillema.gov',
        subject: { applicantName: 'Kevin Holloway', applicantEmail: 'kholloway@kh-construction.com', parcelId: '014-022-0041', permitType: 'Residential Addition', contractorLicense: 'CS-112847', description: '400 sq ft rear addition — 12 Birch Lane', projectValue: '$85,000' },
        scopeDefinition: '400sf Rear Addition — 12 Birch Lane', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          T7: { key: 'T7', label: 'T7 Completeness Review', dueDate: d(-1), status: 'MET' },
          T30: { key: 'T30', label: 'T30 Decision Deadline', dueDate: d(22), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CONDITIONS', transitionBlockers: [],
        processing: { INTAKE: { receivedVia: 'Online Portal', feeCollected: 'Yes', fee: '$425' }, VERIFICATION: { complete: 'Yes', plansReceived: 'Yes', engineeringStamp: 'Yes' }, CONDITIONS: { zoningReview: 'Underway', setbackCompliant: 'Under Review' } },
        assets: [], notes: 'Plans stamped by PE. Zoning setback review in progress.',
        auditLog: [
          audit('yferris@logicvillema.gov', 'CREATE', 'Permit application received online.', t(-8)),
          audit('yferris@logicvillema.gov', 'STAGE_TRANSITION', 'VERIFICATION complete. All plans received.', t(-6)),
          audit('pdunne@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to CONDITIONS review. ZBA setback question flagged.', t(-4)),
        ],
        assignedRAO: 'pdunne@logicvillema.gov', approvals: [],
      },
      // ── VAULTHR ───────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'HRP-2026-001', moduleId: 'VAULTHR', envId,
        caseType: 'Personnel Action', createdAt: t(-6), createdBy: 'mellington@logicvillema.gov',
        subject: { employeeName: 'Gregory Marsh', employeeId: 'EMP-0027', department: 'DPW', actionType: 'Disciplinary — Written Warning', initiatingManager: 'Frank T. Kowalski', supervisorEmail: 'fkowalski@logicvillema.gov', description: 'Unexcused absences — 3 occurrences in 60-day period.' },
        scopeDefinition: 'Written Warning — Gregory Marsh, DPW', scopeVersion: 1, scopeHistory: [],
        deadlines: { T15: { key: 'T15', label: 'T15 HR Initial Review', dueDate: d(9), status: 'OPEN' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'HR_REVIEW', transitionBlockers: [],
        processing: { INTAKE: { actionType: 'Written Warning', unionMember: 'Yes', union: 'AFSCME Local 1562' } },
        assets: [], notes: 'Union member — must follow contractual discipline procedure. HR reviewing attendance records.',
        auditLog: [
          audit('mellington@logicvillema.gov', 'CREATE', 'Personnel action initiated by DPW Director.', t(-6)),
          audit('mellington@logicvillema.gov', 'STAGE_TRANSITION', 'Moved to HR_REVIEW. Union status confirmed.', t(-5)),
        ],
        assignedRAO: 'mellington@logicvillema.gov', approvals: [],
      },
      // ── VAULTPROCURE ──────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'PCR-2026-001', moduleId: 'VAULTPROCURE', envId,
        caseType: 'Procurement', createdAt: t(-22), createdBy: 'shuang@logicvillema.gov',
        subject: { projectName: 'Town Hall HVAC Replacement', estimatedValue: '$340,000', procurementType: 'Invitation for Bids (IFB)', requestingDepartment: 'Facilities', projectManager: 'Frank T. Kowalski' },
        scopeDefinition: 'Town Hall HVAC Replacement — IFB-2026-03', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          IFB_T14: { key: 'IFB_T14', label: 'IFB Notice Deadline', dueDate: d(-8), status: 'MET' },
          OPEN_BIDS: { key: 'OPEN_BIDS', label: 'Bid Opening', dueDate: d(-1), status: 'MET' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'BID_EVAL', transitionBlockers: [],
        processing: { SPEC: { specApproved: 'Yes', legalReviewed: 'Yes' }, SOLICITATION: { advertised: 'Yes', advertDate: '2026-02-03', bidsReceived: '4', openingDate: '2026-02-25' }, BID_EVAL: { responsiveBids: '3', evaluators: 'Kowalski, Huang, Petrov' } },
        assets: [], notes: '3 responsive bids received. Evaluation panel reviewing. Award recommendation expected next week.',
        auditLog: [
          audit('shuang@logicvillema.gov', 'CREATE', 'Procurement initiated for HVAC replacement.', t(-22)),
          audit('shuang@logicvillema.gov', 'STAGE_TRANSITION', 'SPEC finalized and legal reviewed.', t(-20)),
          audit('shuang@logicvillema.gov', 'STAGE_TRANSITION', 'SOLICITATION — IFB advertised 2/3.', t(-18)),
          audit('shuang@logicvillema.gov', 'STAGE_TRANSITION', 'Bid opening held 2/25. 3 responsive bids. Moved to BID_EVAL.', t(-1)),
        ],
        assignedRAO: 'shuang@logicvillema.gov', approvals: [],
      },
      // ── VAULTRECS ─────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'REC-2026-001', moduleId: 'VAULTRECS', envId,
        caseType: 'Records Management', createdAt: t(-5), createdBy: 'cmonroe@logicvillema.gov',
        subject: { recordSeries: 'Building Permits 2016–2018', department: 'Building', retentionSchedule: 'M/SR 14 — 7 years from completion', recordCount: '342 folders', storageLocation: 'Vault Room B, Shelf 4', custodian: 'Patrick L. Dunne' },
        scopeDefinition: 'Disposition Review — Building Permits 2016–2018', scopeVersion: 1, scopeHistory: [],
        deadlines: { MATURITY: { key: 'MATURITY', label: 'Retention Maturity Review', dueDate: d(10), status: 'OPEN' } },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'REVIEW', transitionBlockers: [],
        processing: { CLASSIFICATION: { retentionApplied: 'M/SR 14', retentionYears: '7' }, SCHEDULE: { maturityDate: '2026-03-01', litigationHold: 'No' }, ACTIVE: { storageConfirmed: 'Yes' } },
        assets: [], notes: 'Retention maturity 3/1/2026. No litigation holds. Preparing disposition authorization for Supervisor of Records.',
        auditLog: [
          audit('cmonroe@logicvillema.gov', 'CREATE', 'Disposition review initiated for Building Permits 2016–2018.', t(-5)),
          audit('cmonroe@logicvillema.gov', 'STAGE_TRANSITION', 'CLASSIFICATION and SCHEDULE confirmed. Moved to REVIEW.', t(-3)),
        ],
        assignedRAO: 'cmonroe@logicvillema.gov', approvals: [],
      },
      // ── VAULTMEET ─────────────────────────────────────────────────────────────
      {
        id: uuid(), caseNumber: 'MTG-2026-001', moduleId: 'VAULTMEET', envId,
        caseType: 'Meeting Governance', createdAt: t(-3), createdBy: 'rsinclair@logicvillema.gov',
        subject: { bodyName: 'Board of Selectmen', meetingType: 'Regular Meeting', meetingDate: '2026-03-03', meetingTime: '7:00 PM', location: 'Town Hall — Main Hearing Room', noticeUrl: 'https://www.logicvillema.gov/agendas/bos-2026-03-03' },
        scopeDefinition: 'BOS Regular Meeting — March 3, 2026', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          NOTICE_48H: { key: 'NOTICE_48H', label: 'T48H Notice Deadline', dueDate: d(4), status: 'OPEN' },
          MINUTES_7D: { key: 'MINUTES_7D', label: 'Minutes Draft (7 days)', dueDate: d(11), status: 'OPEN' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'AGENDA', transitionBlockers: [],
        processing: { NOTICE: { draftComplete: 'Yes', postedLocation: 'Town Hall Bulletin Board' } },
        assets: [], notes: 'Agenda being finalized. Notice will post 3/1 to meet 48h OML requirement.',
        auditLog: [
          audit('rsinclair@logicvillema.gov', 'CREATE', 'Meeting case opened for BOS regular meeting 3/3/2026.', t(-3)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Notice drafted. Moved to AGENDA.', t(-2)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
      {
        id: uuid(), caseNumber: 'MTG-2026-002', moduleId: 'VAULTMEET', envId,
        caseType: 'Meeting Governance', createdAt: t(-18), createdBy: 'rsinclair@logicvillema.gov',
        subject: { bodyName: 'Planning Board', meetingType: 'Special Meeting — Zoning Hearing', meetingDate: '2026-02-12', meetingTime: '6:30 PM', location: 'Town Hall — Hearing Room A', noticeUrl: 'https://www.logicvillema.gov/agendas/pb-2026-02-12' },
        scopeDefinition: 'Planning Board Special Meeting — 2/12/2026 Zoning Hearing', scopeVersion: 1, scopeHistory: [],
        deadlines: {
          NOTICE_48H: { key: 'NOTICE_48H', label: 'T48H Notice Deadline', dueDate: d(-16), status: 'MET' },
          MINUTES_7D: { key: 'MINUTES_7D', label: 'Minutes Draft (7 days)', dueDate: d(-11), status: 'MET' },
        },
        tollingHistory: [], enforcementFlags: { feesAllowed: true },
        currentStage: 'CLOSED', transitionBlockers: [], closureReason: 'Minutes Approved and Posted', closedAt: t(-5),
        processing: { NOTICE: { draftComplete: 'Yes', postedLocation: 'Town Hall Bulletin Board + Website' }, AGENDA: { agendaPosted: 'Yes' }, IN_MEETING: { attendees: '5 members, 12 public', quorum: 'Yes' }, DRAFT_MINUTES: { draftPreparedBy: 'Victoria M. Nash', draftDate: '2026-02-14' }, APPROVED: { approvedAt: '2026-02-19 Planning Board Meeting', vote: '5-0' }, POSTED: { postedDate: '2026-02-20', url: 'https://www.logicvillema.gov/minutes/pb-2026-02-12' } },
        assets: [], notes: 'Minutes approved 2/19 and posted to town website.',
        auditLog: [
          audit('rsinclair@logicvillema.gov', 'CREATE', 'Meeting case opened.', t(-18)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Notice posted. Moved to AGENDA.', t(-16)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Agenda posted. Moved to IN_MEETING.', t(-14)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Meeting complete. Moved to DRAFT_MINUTES.', t(-14)),
          audit('vnash@logicvillema.gov', 'STAGE_TRANSITION', 'Draft minutes ready. Moved to APPROVED.', t(-12)),
          audit('rsinclair@logicvillema.gov', 'STAGE_TRANSITION', 'Minutes approved 5-0. Moved to POSTED.', t(-7)),
          audit('rsinclair@logicvillema.gov', 'CLOSE', 'Closed: Minutes Approved and Posted.', t(-5)),
        ],
        assignedRAO: 'rsinclair@logicvillema.gov', approvals: [],
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId, hasNoCases])

  // Ensure Logicville caseSpace always has all 11 modules — decoupled from settings-seed guard
  useEffect(() => {
    if (!LOGICVILLE_IDS.includes(envId)) return
    const cs = casespaces.find(c => c.id === envId)
    if (!cs) return
    const current = cs.vaultModuleIds ?? []
    if (LOGICVILLE_MODULES.every(m => current.includes(m))) return
    updateCaseSpace(envId, { vaultModuleIds: LOGICVILLE_MODULES, town: 'Town of Logicville', name: 'Town of Logicville' })
      .then(updated => { if (updated) setCasespaces(prev => prev.map(c => c.id === envId ? updated : c)) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envId, casespaces.length])
}
