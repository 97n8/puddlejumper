export const LEGACY_DEMO_ENVIRONMENT_IDS = new Set([
  'town-operating-demo',
  'vault-logicville-2',
  'vault-logicville-3',
  'vault-sutton',
  'vault-sutton-2',
  'vault-sutton-3',
])

export function isLegacyDemoEnvironmentId(id?: string | null): boolean {
  return Boolean(id && LEGACY_DEMO_ENVIRONMENT_IDS.has(id))
}
