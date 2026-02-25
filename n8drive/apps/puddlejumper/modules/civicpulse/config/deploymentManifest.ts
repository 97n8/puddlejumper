export const REQUIRED_GATES = [
  'VAULT_FOUNDATIONS_COMPLETE',
  'VAULT_WORKSPACES_BOARD_COMPLIANCE',
  'VAULT_WORKSPACES_FISCAL',
  'ARCHIEVE_RULE_SET_APPROVED',
  'SEAL_INITIALIZED',
  'OUTPUT_CHANNELS_CONFIGURED',
  'OPERATOR_CERTIFIED',
] as const;

export type Gate = typeof REQUIRED_GATES[number];

export function validateGates(completedGates: string[]): { passed: boolean; missing: Gate[] } {
  const missing = REQUIRED_GATES.filter(g => !completedGates.includes(g));
  return { passed: missing.length === 0, missing };
}
