import jwt from "jsonwebtoken";
const MIN_HS256_SECRET_BYTES = 32;
const DEV_SECRET_FALLBACK = "dev-secret";
const CSRF_HEADER_NAME = "x-puddlejumper-request";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function parsePermissions(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const normalized = value
        .map((item) => asString(item).toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(normalized));
}
function parseTenantClaims(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => {
        if (!entry || typeof entry !== "object") {
            return null;
        }
        const objectEntry = entry;
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
        .filter((entry) => Boolean(entry));
}
function parseDelegations(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const delegations = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") {
            continue;
        }
        const objectEntry = entry;
        const delegation = {};
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
        const parsedPrecedence = typeof precedenceRaw === "number" && Number.isFinite(precedenceRaw)
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
function decodeClaims(verified) {
    if (!verified || typeof verified === "string") {
        return null;
    }
    const claims = verified;
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
function parseCookieHeader(rawCookieHeader) {
    if (!rawCookieHeader) {
        return {};
    }
    const parsed = {};
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
function parseBearerToken(req) {
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
function failUnauthorized(res) {
    res.status(401).json({ error: "Unauthorized" });
}
function devFallbackSecretAllowed(secret) {
    return secret === DEV_SECRET_FALLBACK && (process.env.NODE_ENV ?? "development") !== "production";
}
function resolveVerificationConfig(options) {
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
function resolveSigningConfig(options) {
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
export function resolveAuthOptions(overrides = {}) {
    return {
        issuer: overrides.issuer ?? process.env.AUTH_ISSUER ?? "puddle-jumper",
        audience: overrides.audience ?? process.env.AUTH_AUDIENCE ?? "puddle-jumper-api",
        jwtSecret: overrides.jwtSecret ?? process.env.JWT_SECRET,
        jwtPublicKey: overrides.jwtPublicKey ?? process.env.JWT_PUBLIC_KEY,
        jwtPrivateKey: overrides.jwtPrivateKey ?? process.env.JWT_PRIVATE_KEY
    };
}
export function getAuthContext(req) {
    const maybeUser = req.user;
    if (maybeUser && typeof maybeUser === "object") {
        return maybeUser;
    }
    const maybeAuth = req.auth;
    return maybeAuth && typeof maybeAuth === "object" ? maybeAuth : null;
}
export function getJwtFromRequest(req) {
    const bearer = parseBearerToken(req);
    if (bearer) {
        return bearer;
    }
    const fromCookies = req.cookies?.jwt;
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
export function createJwtAuthenticationMiddleware(options) {
    const verification = resolveVerificationConfig(options);
    return (req, res, next) => {
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
            req.user = context;
            req.auth = context;
            next();
        }
        catch {
            failUnauthorized(res);
        }
    };
}
export function createOptionalJwtAuthenticationMiddleware(options) {
    const verification = resolveVerificationConfig(options);
    return (req, res, next) => {
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
            req.user = context;
            req.auth = context;
            next();
        }
        catch {
            failUnauthorized(res);
        }
    };
}
export function signJwt(payload, options = {}, signOptions = { expiresIn: "8h" }) {
    const authOptions = resolveAuthOptions(options);
    const signing = resolveSigningConfig(authOptions);
    return jwt.sign(payload, signing.key, {
        algorithm: signing.algorithm,
        issuer: signing.issuer,
        audience: signing.audience,
        expiresIn: signOptions.expiresIn ?? "8h"
    });
}
export function authMiddlewareFactory(options = {}) {
    return createJwtAuthenticationMiddleware(resolveAuthOptions(options));
}
export const authMiddleware = authMiddlewareFactory();
export function csrfProtection(req, res, next) {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
        next();
        return;
    }
    const marker = req.get(CSRF_HEADER_NAME);
    if (marker === "true") {
        next();
        return;
    }
    res.status(403).json({ error: "Forbidden: missing request marker" });
}
export function requireAuthenticated() {
    return (req, res, next) => {
        if (!getAuthContext(req)) {
            failUnauthorized(res);
            return;
        }
        next();
    };
}
export function requireRole(requiredRole) {
    const normalizedRole = requiredRole.trim().toLowerCase();
    return (req, res, next) => {
        const auth = getAuthContext(req);
        if (!auth) {
            failUnauthorized(res);
            return;
        }
        if (auth.role !== normalizedRole) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}
export function requirePermission(requiredPermission) {
    const normalizedPermission = requiredPermission.trim().toLowerCase();
    return (req, res, next) => {
        const auth = getAuthContext(req);
        if (!auth) {
            failUnauthorized(res);
            return;
        }
        if (!auth.permissions.includes(normalizedPermission)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}
