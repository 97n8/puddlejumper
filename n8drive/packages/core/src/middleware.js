import cookieParser from 'cookie-parser';
import type { RequestHandler } from 'express';
import { verifyJwt } from './jwt.js';

export const cookieParserMiddleware: RequestHandler = cookieParser();

export const validateJwt: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const auth = await verifyJwt(token);
    (req as any).auth = auth;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
