import { ActionType } from './actionTypes.js';

export interface Threshold {
  tier: 'required' | 'recommended' | 'no_action';
  backstopWindowHours: number;
  defaultLegalHold: boolean;
}

export const DEFAULT_THRESHOLDS: Record<string, Threshold> = {
  [ActionType.BOARD_VOTE]:            { tier: 'required',     backstopWindowHours: 48,  defaultLegalHold: false },
  [ActionType.CONTRACT_AWARD]:        { tier: 'required',     backstopWindowHours: 120, defaultLegalHold: false },
  [ActionType.PROCUREMENT_ACTION]:    { tier: 'required',     backstopWindowHours: 120, defaultLegalHold: false },
  [ActionType.BUDGET_TRANSFER]:       { tier: 'required',     backstopWindowHours: 72,  defaultLegalHold: false },
  [ActionType.FREE_CASH_ALLOCATION]:  { tier: 'required',     backstopWindowHours: 72,  defaultLegalHold: false },
  [ActionType.WARRANT_ARTICLE]:       { tier: 'required',     backstopWindowHours: 48,  defaultLegalHold: false },
  [ActionType.PUBLIC_HEARING]:        { tier: 'required',     backstopWindowHours: 24,  defaultLegalHold: false },
  [ActionType.ZBA_FILING]:            { tier: 'recommended',  backstopWindowHours: 168, defaultLegalHold: false },
  [ActionType.CAPITAL_MILESTONE]:     { tier: 'recommended',  backstopWindowHours: 168, defaultLegalHold: false },
  [ActionType.DEBT_ISSUANCE]:         { tier: 'required',     backstopWindowHours: 48,  defaultLegalHold: true  },
  [ActionType.EMERGENCY_DECLARATION]: { tier: 'required',     backstopWindowHours: 4,   defaultLegalHold: false },
  [ActionType.POLICY_ADOPTION]:       { tier: 'required',     backstopWindowHours: 72,  defaultLegalHold: false },
  [ActionType.POLICY_AMENDMENT]:      { tier: 'recommended',  backstopWindowHours: 72,  defaultLegalHold: false },
};
