import { ActionType, type VaultRecord } from '../core/actionTypes.js';
import { type MappedFields } from './fieldMapper.js';

export interface TemplateOutput {
  headline: string;
  body: string;
}

function amt(f: MappedFields): string {
  return f.financialAmountFormatted ? ` for ${f.financialAmountFormatted}` : '';
}

function funding(f: MappedFields): string {
  return f.fundingSourceLabel ? ` (${f.fundingSourceLabel})` : '';
}

function vote(r: VaultRecord): string {
  if (r.voteOutcome && r.voteMargin) return `, voting ${r.voteOutcome} ${r.voteMargin},`;
  if (r.voteOutcome) return `, voting ${r.voteOutcome},`;
  return '';
}

const TEMPLATES: Partial<Record<ActionType, (r: VaultRecord, f: MappedFields) => TemplateOutput>> = {
  [ActionType.BOARD_VOTE]: (r, f) => ({
    headline: `${r.governingBody} Votes on ${r.department} Action`,
    body: `The ${r.governingBody}${vote(r)} approved action related to ${r.description}. ` +
          `Amount: ${f.financialAmountFormatted}${funding(f)}.`,
  }),
  [ActionType.CONTRACT_AWARD]: (r, f) => ({
    headline: `Contract Awarded: ${r.description}`,
    body: `${r.governingBody} awarded a contract for ${r.description}${amt(f)}${funding(f)}, ` +
          `managed by ${r.department}.`,
  }),
  [ActionType.PROCUREMENT_ACTION]: (r, f) => ({
    headline: `Procurement Action: ${r.department}`,
    body: `${r.responsibleParty} completed a procurement action for ${r.description}${amt(f)}${funding(f)}.`,
  }),
  [ActionType.BUDGET_TRANSFER]: (r, f) => ({
    headline: `Budget Transfer Authorized`,
    body: `A budget transfer of ${f.financialAmountFormatted} was authorized by ${r.governingBody} ` +
          `for ${r.description}${funding(f)}.`,
  }),
  [ActionType.FREE_CASH_ALLOCATION]: (r, f) => ({
    headline: `Free Cash Allocation: ${f.financialAmountFormatted}`,
    body: `${r.governingBody} allocated ${f.financialAmountFormatted} in free cash for ${r.description}.`,
  }),
  [ActionType.WARRANT_ARTICLE]: (r, _f) => ({
    headline: `Warrant Article: ${r.description}`,
    body: `${r.governingBody} addressed a warrant article regarding ${r.description}, ` +
          `sponsored by ${r.responsibleParty}.`,
  }),
  [ActionType.PUBLIC_HEARING]: (r, f) => ({
    headline: `Public Hearing: ${r.description}`,
    body: `${r.governingBody} held a public hearing on ${f.actionDate} regarding ${r.description}.`,
  }),
  [ActionType.ZBA_FILING]: (r, f) => ({
    headline: `ZBA Filing: ${r.department}`,
    body: `A Zoning Board of Appeals filing was recorded on ${f.actionDate}: ${r.description}.`,
  }),
  [ActionType.CAPITAL_MILESTONE]: (r, f) => ({
    headline: `Capital Project Milestone: ${r.description}`,
    body: `${r.department} reached a capital project milestone on ${f.actionDate}: ${r.description}${amt(f)}.`,
  }),
  [ActionType.DEBT_ISSUANCE]: (r, f) => ({
    headline: `Debt Issuance Authorized: ${f.financialAmountFormatted}`,
    body: `${r.governingBody} authorized debt issuance of ${f.financialAmountFormatted} for ${r.description}.`,
  }),
  [ActionType.EMERGENCY_DECLARATION]: (r, f) => ({
    headline: `Emergency Declaration: ${r.department}`,
    body: `${r.governingBody} issued an emergency declaration on ${f.actionDate}: ${r.description}.`,
  }),
  [ActionType.POLICY_ADOPTION]: (r, _f) => ({
    headline: `Policy Adopted: ${r.description}`,
    body: `${r.governingBody} adopted a policy on ${r.description}, effective per ${r.responsibleParty}.`,
  }),
  [ActionType.POLICY_AMENDMENT]: (r, _f) => ({
    headline: `Policy Amendment: ${r.description}`,
    body: `${r.governingBody} approved an amendment to ${r.description}.`,
  }),
};

export function applyTemplate(record: VaultRecord, fields: MappedFields): TemplateOutput {
  const tpl = TEMPLATES[record.actionType];
  if (tpl) return tpl(record, fields);
  return {
    headline: `Municipal Action: ${record.actionType.replace(/_/g, ' ')}`,
    body: `${record.governingBody} recorded an action on ${fields.actionDate}: ${record.description}.`,
  };
}
