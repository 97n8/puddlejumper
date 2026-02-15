import type { RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { verifyJwt } from './jwt.js';

/** Extract JWT from cookie or Authorization: Bearer header. */
function extractToken(req: any): string | null {
  if (req.cookies?.jwt) return req.cookies.jwt as string;
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function cookieParserMiddleware(): RequestHandler {
  return cookieParser() as unknown as RequestHandler;
}

export function validateJwt(): RequestHandler {
  return async (req: any, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
      const auth = await verifyJwt(token);
      req.auth = auth;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

/**
 * Correlation ID middleware.
 * Reads `x-request-id` from the incoming request or generates a new UUID.
 * Sets `req.correlationId` and echoes the header on the response.
 */
export function correlationId(): RequestHandler {
  return (req: any, _res, next) => {
    const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.correlationId = id;
    _res.setHeader('x-request-id', id);
    next();
  };
}

export { extractToken };
