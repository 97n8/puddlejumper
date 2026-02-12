import type { RequestHandler } from 'express';
import { verifyJwt, signJwt } from './jwt.js';

export type AuthOptions = {
  issuer?: string;
  audience?: string;
  jwtSecret?: string;
};

export type AuthContext = Record<string, any>;

export function resolveAuthOptions(opts?: Partial<AuthOptions>): AuthOptions {
  return {
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE,
    jwtSecret: process.env.JWT_SECRET,
    ...(opts || {})
  };
}

export function createJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler {
  return async (req: any, res, next) => {
    const token = req.cookies?.jwt;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = await verifyJwt(token as string);
      req.auth = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export function createOptionalJwtAuthenticationMiddleware(_opts?: Partial<AuthOptions>): RequestHandler {
  return async (req: any, _res, next) => {
    const token = req.cookies?.jwt;
    if (!token) return next();
    try {
      const payload = await verifyJwt(token as string);
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

export function csrfProtection(): RequestHandler {
  return (_req, _res, next) => {
    // noop placeholder; integrate real CSRF protection as needed
    next();
  };
}

export { signJwt };
