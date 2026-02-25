export interface EscalationConfig {
  primaryContactId: string;
  escalationContactId: string;
  promptThresholdPercent: number;
}

export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  primaryContactId:       'operator',
  escalationContactId:    'supervisor',
  promptThresholdPercent: 75,
};
