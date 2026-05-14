// spark.credentials — V1 stub: resolves axis-cred:// refs to env vars
// Real AXIS backend integration is v2.

export interface SparkCredential {
  value: string;
  type: string;
}

function parseAxisRef(ref: string): { tenantId: string; name: string } | null {
  // axis-cred://{tenantId}/{name}
  const match = ref.match(/^axis-cred:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { tenantId: match[1], name: match[2] };
}

function resolveFromEnv(tenantId: string, name: string): string | undefined {
  // Pattern: NAME_TENANTID (uppercase, non-alphanumeric → _)
  const envKey = `${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey];
}

export function createSparkCredentials(tenantId: string) {
  return {
    async get(ref: string): Promise<SparkCredential> {
      const parsed = parseAxisRef(ref);
      if (!parsed) throw new Error(`Invalid credential ref: ${ref}`);

      const effectiveTenant = parsed.tenantId === 'tenant' ? tenantId : parsed.tenantId;
      const value = resolveFromEnv(parsed.name, effectiveTenant);
      if (!value) {
        throw new Error(`Credential not found: ${ref} (env var not set)`);
      }
      return { value, type: 'string' };
    },
    async list(prefix?: string): Promise<string[]> {
      // V1: enumerate env vars matching pattern
      const keys: string[] = [];
      for (const key of Object.keys(process.env)) {
        if (!prefix || key.startsWith(prefix.toUpperCase())) {
          keys.push(key);
        }
      }
      return keys;
    },
  };
}
