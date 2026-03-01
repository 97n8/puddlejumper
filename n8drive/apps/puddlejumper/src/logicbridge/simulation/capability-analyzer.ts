// spark.utils.xml — capability analysis for handler code
// V1: regex-based (no AST)

const CAPABILITY_PATTERNS: Array<{ capability: string; patterns: RegExp[] }> = [
  {
    capability: 'http',
    patterns: [/spark\.http\./g, /fetch\s*\(/g],
  },
  {
    capability: 'credentials',
    patterns: [/spark\.credentials\./g, /axis-cred:\/\//g],
  },
  {
    capability: 'kv',
    patterns: [/spark\.kv\./g],
  },
  {
    capability: 'vault.lookup',
    patterns: [/vault\.lookup\s*\(/g, /vault\.read\s*\(/g],
  },
  {
    capability: 'read',
    patterns: [/\.get\s*\(/g, /\.list\s*\(/g, /\.query\s*\(/g, /GET/g],
  },
  {
    capability: 'write',
    patterns: [/\.post\s*\(/g, /\.put\s*\(/g, /\.patch\s*\(/g, /\.create\s*\(/g, /POST|PUT|PATCH/g],
  },
  {
    capability: 'delete',
    patterns: [/\.delete\s*\(/g, /DELETE/g],
  },
  {
    capability: 'webhook',
    patterns: [/webhook/gi, /callback/gi, /event\s*=>/g],
  },
];

export function analyzeCapabilities(handlerSource: string): string[] {
  const detected = new Set<string>();
  for (const { capability, patterns } of CAPABILITY_PATTERNS) {
    for (const regex of patterns) {
      regex.lastIndex = 0;
      if (regex.test(handlerSource)) {
        detected.add(capability);
        break;
      }
    }
  }
  return Array.from(detected);
}

export function compareCapabilities(
  declared: string[],
  detected: string[]
): { mismatch: boolean; undeclaredCapabilities: string[] } {
  const declaredSet = new Set(declared);
  const undeclared = detected.filter(c => !declaredSet.has(c));
  return {
    mismatch: undeclared.length > 0,
    undeclaredCapabilities: undeclared,
  };
}
