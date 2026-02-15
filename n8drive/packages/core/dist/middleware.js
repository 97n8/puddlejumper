import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { verifyJwt } from './jwt.js';
/** Extract JWT from cookie or Authorization: Bearer header. */
function extractToken(req) {
    if (req.cookies?.jwt)
        return req.cookies.jwt;
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}
export function cookieParserMiddleware() {
    return cookieParser();
}
export function validateJwt() {
    return async (req, res, next) => {
        const token = extractToken(req);
        if (!token)
            return res.status(401).json({ error: 'Missing token' });
        try {
            const auth = await verifyJwt(token);
            req.auth = auth;
            next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
}
/**
 * Correlation ID middleware.
 * Reads `x-request-id` from the incoming request or generates a new UUID.
 * Sets `req.correlationId` and echoes the header on the response.
 */
export function correlationId() {
    return (req, _res, next) => {
        const id = req.headers['x-request-id'] || crypto.randomUUID();
        req.correlationId = id;
        _res.setHeader('x-request-id', id);
        next();
    };
}
export { extractToken };
