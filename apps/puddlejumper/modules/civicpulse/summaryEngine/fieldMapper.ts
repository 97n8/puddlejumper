import { type VaultRecord } from '../core/actionTypes.js';

export interface MappedFields {
  financialAmountFormatted: string;
  actionDate: string;
  departmentLabel: string;
  governingBodyLabel: string;
  responsiblePartyLabel: string;
  voteOutcomeLabel: string;
  fundingSourceLabel: string;
  descriptionLabel: string;
}

export function mapVaultRecord(record: VaultRecord): MappedFields {
  const financialAmountFormatted =
    record.financialAmount != null
      ? `$${record.financialAmount.toLocaleString('en-US')}`
      : '';

  const actionDate = new Date(record.date).toLocaleDateString('en-US', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
    timeZone: 'UTC',
  });

  return {
    financialAmountFormatted,
    actionDate,
    departmentLabel:       record.department,
    governingBodyLabel:    record.governingBody,
    responsiblePartyLabel: record.responsibleParty,
    voteOutcomeLabel:      record.voteOutcome ?? '',
    fundingSourceLabel:    record.fundingSource ?? '',
    descriptionLabel:      record.description,
  };
}
