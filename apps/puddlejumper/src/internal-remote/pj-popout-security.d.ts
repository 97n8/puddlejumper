export function isTrustedOriginFromList(origin: string, allowedOrigins: string[]): boolean;
export function applyIdentityContext(
  current: {
    name: string;
    role: string;
    tenants: unknown[];
    trustedParentOrigins: string[];
  },
  incoming: unknown
): {
  name: string;
  role: string;
  tenants: unknown[];
  trustedParentOrigins: string[];
};
