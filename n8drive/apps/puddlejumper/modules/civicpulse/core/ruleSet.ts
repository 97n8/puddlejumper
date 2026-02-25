import { ActionType } from './actionTypes.js';
import { DEFAULT_THRESHOLDS, type Threshold } from './thresholdConfig.js';

export interface RuleSetInput {
  municipalityId: string;
  municipalityName: string;
  version: string;
  effectiveDate: string;
  approvedBy: string;
  thresholds: Partial<Record<string, Threshold>>;
  excludedActionTypes?: ActionType[];
}

export interface RuleSet extends RuleSetInput {
  excludedActionTypes: ActionType[];
}

export function loadRuleSet(input: Partial<RuleSetInput>): { ruleSet: RuleSet; warnings: string[] } {
  if (!input.municipalityId) throw new Error('municipalityId is required');
  if (!input.approvedBy)     throw new Error('approvedBy is required');

  const ruleSet: RuleSet = {
    municipalityId:       input.municipalityId,
    municipalityName:     input.municipalityName ?? '',
    version:              input.version ?? '1.0.0',
    effectiveDate:        input.effectiveDate ?? new Date().toISOString().slice(0, 10),
    approvedBy:           input.approvedBy,
    thresholds:           { ...input.thresholds },
    excludedActionTypes:  input.excludedActionTypes ?? [],
  };

  const warnings: string[] = [];
  for (const type of Object.values(ActionType)) {
    if (!ruleSet.excludedActionTypes.includes(type) && !ruleSet.thresholds[type]) {
      warnings.push(`Using default threshold for ${type}`);
    }
  }

  return { ruleSet, warnings };
}

export function resolveThreshold(ruleSet: RuleSet, actionType: ActionType): Threshold | null {
  if (ruleSet.excludedActionTypes?.includes(actionType)) return null;
  return ruleSet.thresholds[actionType] ?? DEFAULT_THRESHOLDS[actionType] ?? null;
}
