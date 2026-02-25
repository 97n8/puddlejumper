import { type ActionType } from '../core/actionTypes.js';
import { type Threshold } from '../core/thresholdConfig.js';

export interface MunicipalityConfig {
  municipalityId: string;
  municipalityName: string;
  vaultBaseUrl: string;
  ruleSetPath: string;
  ruleSet: {
    municipalityId: string;
    municipalityName: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
    thresholds: Partial<Record<string, Threshold>>;
    excludedActionTypes?: ActionType[];
  };
  routingConfig: {
    autoReleaseTypes: ActionType[];
    legalHoldTypes: ActionType[];
  };
  escalationConfig: {
    primaryContactId: string;
    escalationContactId: string;
    promptThresholdPercent: number;
  };
  outputChannels: Record<string, { enabled: boolean; [key: string]: unknown }>;
  activatedAt: string;
  activatedBy: string;
}
