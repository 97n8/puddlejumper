import type { RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { verifyJwt } from './jwt.js';

export function cookieParserMiddleware() {
  return cookieParser();
}

export function validateJwt(): RequestHandler {
  return async (req: any, res, next) => {
    const token = req.cookies?.jwt;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
      const auth = await verifyJwt(token as string);
      req.auth = auth;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
