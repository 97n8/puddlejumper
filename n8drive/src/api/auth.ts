import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt, { type Algorithm, type JwtPayload, type SignOptions } from "jsonwebtoken";

export type TenantClaim = {
  id: string;
  name: string;
  sha: string;
  connections: string[];
};

export type DelegationClaim = {
  id?: string;
  from?: string;
  until?: string;
  to?: string;
  scope?: string[];
  precedence?: number;
  delegator?: string;
  delegatee?: string;
};

export type AuthContext = {
  userId: string;
  name: string;
  role: string;
  permissions: string[];
  tenants: TenantClaim[];
  tenantId: string | null;
  delegations: DelegationClaim[];
};

export type AuthOptions = {
  issuer: string;
  audience: string;
  jwtSecret?: string;
  jwtPublicKey?: string;
  jwtPrivateKey?: string;
};

type VerificationConfig = {
  key: jwt.Secret;
  algorithms: Algorithm[];
  issuer: string;
  audience: string;
};

type SigningConfig = {
  key: jwt.Secret;
  algorithm: Algorithm;
  issuer: string;
  audience: string;
};

type RawClaims = JwtPayload & {
  sub?: string;
  role?: string;
  name?: string;
  permissions?: unknown;
  tenants?: unknown;
  tenantId?: string;
  delegations?: unknown;
};

const MIN_HS256_SECRET_BYTES = 32;
const DEV_SECRET_FALLBACK = "dev-secret";
const CSRF_HEADER_NAME = "x-puddlejumper-request";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((item) => asString(item).toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function parseTenantClaims(value: unknown): TenantClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const objectEntry = entry as Record<string, unknown>;
      const id = asString(objectEntry.id);
      const name = asString(objectEntry.name);
      const sha = asString(objectEntry.sha);
      const connections = Array.isArray(objectEntry.connections)
        ? objectEntry.connections.map((item) => asString(item)).filter(Boolean)
        : [];
      if (!id || !name) {
        return null;
      }
      return { id, name, sha, connections };
    })
    .filter((entry): entry is TenantClaim => Boolean(entry));
}

function parseDelegations(value: unknown): DelegationClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const delegations: DelegationClaim[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const objectEntry = entry as Record<string, unknown>;
    const delegation: DelegationClaim = {};
    const id = asString(objectEntry.id);
    const from = asString(objectEntry.from);
    const until = asString(objectEntry.until);
    const to = asString(objectEntry.to);
    const delegator = asString(objectEntry.delegator);
    const delegatee = asString(objectEntry.delegatee);
    const scope = Array.isArray(objectEntry.scope)
      ? objectEntry.scope.map((item) => asString(item)).filter(Boolean)
      : undefined;
    const precedenceRaw = objectEntry.precedence;
    const parsedPrecedence =
      typeof precedenceRaw === "number" && Number.isFinite(precedenceRaw)
        ? precedenceRaw
        : Number.parseInt(asString(precedenceRaw), 10);

    if (id) {
      delegation.id = id;
    }
    if (from) {
      delegation.from = from;
    }
    if (until) {
      delegation.until = until;
    }
    if (to) {
      delegation.to = to;
    }
    if (scope && scope.length > 0) {
      delegation.scope = scope;
    }
    if (Number.isFinite(parsedPrecedence)) {
      delegation.precedence = parsedPrecedence;
    }
    if (delegator) {
      delegation.delegator = delegator;
    }
    if (delegatee) {
      delegation.delegatee = delegatee;
    }

    delegations.push(delegation);
  }

  return delegations;
}

function decodeClaims(verified: string | JwtPayload): AuthContext | null {
  if (!verified || typeof verified === "string") {
    return null;
  }

  const claims = verified as RawClaims;
  const userId = asString(claims.sub);
  const role = asString(claims.role).toLowerCase();
  if (!userId || !role) {
    return null;
  }

  const tenants = parseTenantClaims(claims.tenants);
  const tenantId = asString(claims.tenantId) || tenants[0]?.id || null;
  const name = asString(claims.name) || userId;

  return {
    userId,
    name,
    role,
    permissions: parsePermissions(claims.permissions),
    tenants,
    tenantId,
    delegations: parseDelegations(claims.delegations)
  };
}

function parseCookieHeader(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  const parsed: Record<string, string> = {};
  for (const pair of rawCookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!key) {
      continue;
    }
    parsed[key] = decodeURIComponent(value);
  }
  return parsed;
}

function parseBearerToken(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme = "", token = ""] = header.trim().split(/\s+/, 2);
  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

function failUnauthorized(res: Response): void {
  res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
}

function devFallbackSecretAllowed(secret: string): boolean {
  return secret === DEV_SECRET_FALLBACK && (process.env.NODE_ENV ?? "development") !== "production";
}

function resolveVerificationConfig(options: AuthOptions): VerificationConfig {
  const issuer = options.issuer.trim();
  const audience = options.audience.trim();
  if (!issuer || !audience) {
    throw new Error("AUTH_ISSUER and AUTH_AUDIENCE must be configured");
  }

  const publicKey = options.jwtPublicKey?.trim();
  if (publicKey) {
    return {
      key: publicKey,
      algorithms: ["RS256"],
      issuer,
      audience
    };
  }

  const secret = options.jwtSecret?.trim() || DEV_SECRET_FALLBACK;
  if (!secret) {
    throw new Error("JWT verification key is not configured");
  }
  if (Buffer.byteLength(secret, "utf8") < MIN_HS256_SECRET_BYTES && !devFallbackSecretAllowed(secret)) {
    throw new Error("JWT secret is too short; minimum 256-bit secret required");
  }

  return {
    key: secret,
    algorithms: ["HS256"],
    issuer,
    audience
  };
}

function resolveSigningConfig(options: AuthOptions): SigningConfig {
  const issuer = options.issuer.trim();
  const audience = options.audience.trim();
  if (!issuer || !audience) {
    throw new Error("AUTH_ISSUER and AUTH_AUDIENCE must be configured");
  }

  const privateKey = options.jwtPrivateKey?.trim();
  const publicKey = options.jwtPublicKey?.trim();
  if (privateKey && publicKey) {
    return {
      key: privateKey,
      algorithm: "RS256",
      issuer,
      audience
    };
  }

  const secret = options.jwtSecret?.trim() || DEV_SECRET_FALLBACK;
  if (!secret) {
    throw new Error("JWT signing key is not configured");
  }
  if (Buffer.byteLength(secret, "utf8") < MIN_HS256_SECRET_BYTES && !devFallbackSecretAllowed(secret)) {
    throw new Error("JWT secret is too short; minimum 256-bit secret required");
  }

  return {
    key: secret,
    algorithm: "HS256",
    issuer,
    audience
  };
}

export function resolveAuthOptions(overrides: Partial<AuthOptions> = {}): AuthOptions {
  return {
    issuer: overrides.issuer ?? process.env.AUTH_ISSUER ?? "puddle-jumper",
    audience: overrides.audience ?? process.env.AUTH_AUDIENCE ?? "puddle-jumper-api",
    jwtSecret: overrides.jwtSecret ?? process.env.JWT_SECRET,
    jwtPublicKey: overrides.jwtPublicKey ?? process.env.JWT_PUBLIC_KEY,
    jwtPrivateKey: overrides.jwtPrivateKey ?? process.env.JWT_PRIVATE_KEY
  };
}

export type AuthenticatedRequest = Request & { user?: AuthContext; auth?: AuthContext; cookies?: Record<string, string> };

export function getAuthContext(req: Request): AuthContext | null {
  const maybeUser = (req as Partial<AuthenticatedRequest>).user;
  if (maybeUser && typeof maybeUser === "object") {
    return maybeUser;
  }

  const maybeAuth = (req as Partial<AuthenticatedRequest>).auth;
  return maybeAuth && typeof maybeAuth === "object" ? maybeAuth : null;
}

export function getJwtFromRequest(req: Request): string | null {
  const bearer = parseBearerToken(req);
  if (bearer) {
    return bearer;
  }

  const fromCookies = (req as Partial<AuthenticatedRequest>).cookies?.jwt;
  if (typeof fromCookies === "string" && fromCookies.trim()) {
    return fromCookies.trim();
  }

  const parsedCookieHeader = parseCookieHeader(req.get("cookie"));
  const fallbackCookie = parsedCookieHeader.jwt;
  if (typeof fallbackCookie === "string" && fallbackCookie.trim()) {
    return fallbackCookie.trim();
  }

  return null;
}

export function createJwtAuthenticationMiddleware(options: AuthOptions): RequestHandler {
  const verification = resolveVerificationConfig(options);

  return (req: Request, res: Response, next: NextFunction) => {
    const token = getJwtFromRequest(req);
    if (!token) {
      failUnauthorized(res);
      return;
    }

    try {
      const verified = jwt.verify(token, verification.key, {
        algorithms: verification.algorithms,
        issuer: verification.issuer,
        audience: verification.audience
      });
      const context = decodeClaims(verified);
      if (!context) {
        failUnauthorized(res);
        return;
      }
      (req as AuthenticatedRequest).user = context;
      (req as AuthenticatedRequest).auth = context;
      next();
    } catch {
      failUnauthorized(res);
    }
  };
}

export function createOptionalJwtAuthenticationMiddleware(options: AuthOptions): RequestHandler {
  const verification = resolveVerificationConfig(options);

  return (req: Request, res: Response, next: NextFunction) => {
    const token = getJwtFromRequest(req);
    if (!token) {
      next();
      return;
    }

    try {
      const verified = jwt.verify(token, verification.key, {
        algorithms: verification.algorithms,
        issuer: verification.issuer,
        audience: verification.audience
      });
      const context = decodeClaims(verified);
      if (!context) {
        failUnauthorized(res);
        return;
      }
      (req as AuthenticatedRequest).user = context;
      (req as AuthenticatedRequest).auth = context;
      next();
    } catch {
      failUnauthorized(res);
    }
  };
}

export function signJwt(
  payload: JwtPayload & { sub: string; role: string },
  options: Partial<AuthOptions> = {},
  signOptions: Pick<SignOptions, "expiresIn"> = { expiresIn: "8h" }
): string {
  const authOptions = resolveAuthOptions(options);
  const signing = resolveSigningConfig(authOptions);
  return jwt.sign(payload, signing.key, {
    algorithm: signing.algorithm,
    issuer: signing.issuer,
    audience: signing.audience,
    expiresIn: signOptions.expiresIn ?? "8h"
  });
}

export function authMiddlewareFactory(options: Partial<AuthOptions> = {}): RequestHandler {
  return createJwtAuthenticationMiddleware(resolveAuthOptions(options));
}

export const authMiddleware = authMiddlewareFactory();

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const marker = req.get(CSRF_HEADER_NAME);
  if (marker === "true") {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden: missing request marker", code: "CSRF_MISSING" });
}

export function requireAuthenticated(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!getAuthContext(req)) {
      failUnauthorized(res);
      return;
    }
    next();
  };
}

export function requireRole(requiredRole: string): RequestHandler {
  const normalizedRole = requiredRole.trim().toLowerCase();
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuthContext(req);
    if (!auth) {
      failUnauthorized(res);
      return;
    }
    if (auth.role !== normalizedRole) {
      res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}

export function requirePermission(requiredPermission: string): RequestHandler {
  const normalizedPermission = requiredPermission.trim().toLowerCase();
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuthContext(req);
    if (!auth) {
      failUnauthorized(res);
      return;
    }
    if (!auth.permissions.includes(normalizedPermission)) {
      res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
