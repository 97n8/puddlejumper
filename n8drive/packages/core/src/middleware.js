import cookieParser from 'cookie-parser';
import { verifyJwt } from './jwt.js';

export const cookieParserMiddleware = cookieParser();

export const validateJwt = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const auth = await verifyJwt(token);
    req.auth = auth;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
