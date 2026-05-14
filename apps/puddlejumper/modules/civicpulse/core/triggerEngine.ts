import { type VaultRecord } from './actionTypes.js';
import { type RuleSet, resolveThreshold } from './ruleSet.js';

export interface TriggerResult {
  vaultRecordId: string;
  decision: 'required' | 'recommended' | 'none';
  backstopWindowHours: number;
  legalHoldRequired: boolean;
}

export function evaluateTrigger(record: VaultRecord, { ruleSet }: { ruleSet: RuleSet }): TriggerResult {
  const threshold = resolveThreshold(ruleSet, record.actionType);
  if (!threshold) {
    return { vaultRecordId: record.id, decision: 'none', backstopWindowHours: 0, legalHoldRequired: false };
  }
  return {
    vaultRecordId:      record.id,
    decision:           threshold.tier === 'required' ? 'required' : 'recommended',
    backstopWindowHours: threshold.backstopWindowHours,
    legalHoldRequired:  threshold.defaultLegalHold,
  };
}

export function evaluateBatch(records: VaultRecord[], opts: { ruleSet: RuleSet }): TriggerResult[] {
  return records
    .map(r => evaluateTrigger(r, opts))
    .filter(r => r.decision !== 'none');
}
