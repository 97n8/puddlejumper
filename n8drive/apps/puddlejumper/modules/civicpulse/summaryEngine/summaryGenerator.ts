import crypto from 'node:crypto';
import { type VaultRecord } from '../core/actionTypes.js';
import { mapVaultRecord } from './fieldMapper.js';
import { applyTemplate } from './templateLibrary.js';
import { type CivicSummary } from './summarySchema.js';

export interface SummaryOptions {
  municipalityId: string;
  municipalityName: string;
  useAiAssist?: boolean;
  aiAssistFn?: (text: string) => Promise<string>;
}

export async function generateSummary(record: VaultRecord, options: SummaryOptions): Promise<CivicSummary> {
  const fields = mapVaultRecord(record);
  const { headline, body: rawBody } = applyTemplate(record, fields);

  let body = rawBody;
  let aiAssisted = false;
  if (options.useAiAssist && options.aiAssistFn) {
    body = await options.aiAssistFn(rawBody);
    aiAssisted = true;
  }

  return {
    summaryId:      crypto.randomUUID(),
    vaultRecordId:  record.id,
    actionType:     record.actionType,
    headline,
    body,
    approvalStatus: 'pending_review',
    aiAssisted,
    version:        1,
    municipalityId: options.municipalityId,
    fundingSource:  record.fundingSource,
    generatedAt:    new Date().toISOString(),
  };
}
