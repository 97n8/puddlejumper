import { verifyJwt, signJwt } from './jwt.js';
export function resolveAuthOptions(opts) {
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
function extractToken(req) {
    if (req.cookies?.jwt)
        return req.cookies.jwt;
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}
export function createJwtAuthenticationMiddleware(_opts) {
    return async (req, res, next) => {
        const token = extractToken(req);
        if (!token)
            return res.status(401).json({ error: 'Authentication required' });
        try {
            const payload = await verifyJwt(token);
            req.auth = payload;
            next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
}
export function createOptionalJwtAuthenticationMiddleware(_opts) {
    return async (req, _res, next) => {
        const token = extractToken(req);
        if (!token)
            return next();
        try {
            const payload = await verifyJwt(token);
            req.auth = payload;
        }
        catch {
            // ignore invalid token for optional middleware
        }
        return next();
    };
}
export function getAuthContext(req) {
    return req.auth ?? null;
}
export function requireAuthenticated() {
    return (req, res, next) => {
        if (!req.auth)
            return res.status(401).json({ error: 'Authentication required' });
        next();
    };
}
export function requirePermission(permission) {
    return (req, res, next) => {
        const perms = (req.auth && (req.auth.permissions || [])) || [];
        if (!perms.includes(permission))
            return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}
export function requireRole(role) {
    return (req, res, next) => {
        const r = req.auth && req.auth.role;
        if (!r || r !== role)
            return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_HEADER = 'x-puddlejumper-request';
export function csrfProtection() {
    return (req, res, next) => {
        if (CSRF_METHODS.has(req.method) && req.headers[CSRF_HEADER] !== 'true') {
            return res.status(403).json({ error: 'Missing CSRF header' });
        }
        next();
    };
}
export { signJwt };
