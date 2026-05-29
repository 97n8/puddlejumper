import type { WorkflowConfig, WorkflowTimer, WorkflowEmailTemplate } from '../types'

export function defaultWorkflow(moduleId: string): WorkflowConfig {
  const isPRR = moduleId === 'VAULTPRR'
  const timers: WorkflowTimer[] = isPRR ? [
    {
      id: 'prr-t10', name: 'T10 — Initial Response', businessDays: 10,
      statutory: true, statutorycitation: 'M.G.L. c. 66, §10',
      startEvent: 'CASE_CREATED', warningDaysBefore: 3,
      onMiss: ['WAIVE_FEES', 'SEND_EMAIL'],
    },
    {
      id: 'prr-t25', name: 'T25 — Acknowledgment', businessDays: 25,
      statutory: true, statutorycitation: 'M.G.L. c. 66, §10',
      startEvent: 'CASE_CREATED', warningDaysBefore: 5,
      onMiss: ['AUTO_ESCALATE', 'SEND_EMAIL'],
    },
    {
      id: 'prr-t90', name: 'T90 — Final Resolution', businessDays: 90,
      statutory: true, statutorycitation: 'M.G.L. c. 66, §10A',
      startEvent: 'CASE_CREATED', warningDaysBefore: 10,
      onMiss: ['AUTO_ESCALATE', 'SEND_EMAIL'],
    },
  ] : [
    {
      id: `${moduleId}-t30`, name: 'Default Response Deadline', businessDays: 30,
      statutory: false, startEvent: 'CASE_CREATED', warningDaysBefore: 5,
      onMiss: ['SEND_EMAIL'],
    },
  ]

  const emailTemplates: WorkflowEmailTemplate[] = [
    {
      id: 'tpl-intake', trigger: 'INTAKE_RECEIVED', toRecipient: 'REQUESTER',
      subject: 'Your Public Records Request Has Been Received — {{caseNumber}}',
      body: `Dear {{requesterName}},\n\nThank you for submitting a public records request to the Town of {{town}}. Your request has been received and assigned Case Number {{caseNumber}}.\n\nPursuant to M.G.L. c. 66, §10, we will respond within 10 business days. Your statutory deadline is {{deadline}}.\n\nIf you have questions, please contact our Records Access Officer:\n{{raoName}}\n\nSincerely,\nTown of {{town}}\nRecords Access Officer`,
      enabled: true,
    },
    {
      id: 'tpl-t10-warn', trigger: 'T10_WARNING', toRecipient: 'RAO',
      subject: '⚠️ T10 Approaching — {{caseNumber}} due in {{daysLeft}} days',
      body: `This is an automated reminder that Case {{caseNumber}} has a T10 deadline approaching.\n\nDeadline: {{deadline}}\n\nPlease log in to VAULT to take action immediately.`,
      enabled: true,
    },
    {
      id: 'tpl-t10-miss', trigger: 'T10_MISSED', toRecipient: 'RAO',
      subject: '🚨 T10 MISSED — {{caseNumber}} — Fees Automatically Waived',
      body: `ENFORCEMENT ACTION:\n\nCase {{caseNumber}} missed the T10 statutory deadline.\n\nPer M.G.L. c. 66, §10, fees have been automatically waived. This action is non-negotiable and has been logged in the audit trail.\n\nPlease respond to this request immediately.`,
      enabled: true,
    },
    {
      id: 'tpl-approval', trigger: 'APPROVAL_ISSUED', toRecipient: 'REQUESTER',
      subject: 'Decision Issued on Your Public Records Request — {{caseNumber}}',
      body: `Dear {{requesterName}},\n\nA decision has been issued on your public records request ({{caseNumber}}).\n\nPlease contact our Records Access Officer for details:\n{{raoName}}\n\nYou have the right to appeal this decision to the Supervisor of Public Records within 90 calendar days.\n\nSincerely,\nTown of {{town}}`,
      enabled: true,
    },
    {
      id: 'tpl-closed', trigger: 'CASE_CLOSED', toRecipient: 'REQUESTER',
      subject: 'Your Public Records Request Has Been Closed — {{caseNumber}}',
      body: `Dear {{requesterName}},\n\nYour public records request ({{caseNumber}}) has been closed.\n\nIf you have questions or wish to appeal, please contact our Records Access Officer:\n{{raoName}}\n\nSincerely,\nTown of {{town}}`,
      enabled: true,
    },
  ]

  return { timers, emailTemplates }
}
