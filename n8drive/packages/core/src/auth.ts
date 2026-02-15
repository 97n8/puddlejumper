import type { RequestHandler } from 'express';
import { verifyJwt, signJwt } from './jwt.js';

export type AuthOptions = {
  issuer?: string;
  audience?: string;
  jwtSecret?: string;
  jwtPublicKey?: string;
  jwtPrivateKey?: string;
};

export type AuthContext = Record<string, any>;

export function resolveAuthOptions(opts?: Partial<AuthOptions>): AuthOptions {
  return {
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE,
    jwtSecret: process.env.JWT_SECRET,
    jwtPublicKey: process.env.JWT_PUBLIC_KEY,
    jwtPrivateKey: process.env.JWT_PRIVATE_KEY,
    ...(opts || {})
  };
}

/** Extract JWT from cookie or Authorization: Bearer header. */
function extractToken(req: any): string | null {
  if (req.cookies?.jwt) return req.cookies.jwt as string;
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function createJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler {
  return async (req: any, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = await verifyJwt(token);
      req.auth = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export function createOptionalJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler {
  return async (req: any, _res, next) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = await verifyJwt(token);
      req.auth = payload;
    } catch {
      // ignore invalid token for optional middleware
    }
    return next();
  };
}

export function getAuthContext(req: any): AuthContext | null {
  return req.auth ?? null;
}

export function requireAuthenticated(): RequestHandler {
  return (req: any, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
    next();
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (req: any, res, next) => {
    const perms = (req.auth && (req.auth.permissions || [])) || [];
    if (!perms.includes(permission)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export function requireRole(role: string): RequestHandler {
  return (req: any, res, next) => {
    const r = req.auth && req.auth.role;
    if (!r || r !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_HEADER = 'x-puddlejumper-request';

export function csrfProtection(): RequestHandler {
  return (req, res, next) => {
    if (CSRF_METHODS.has(req.method) && req.headers[CSRF_HEADER] !== 'true') {
      return res.status(403).json({ error: 'Missing CSRF header' });
    }
    next();
  };
}

export { signJwt };
