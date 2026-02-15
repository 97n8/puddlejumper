// ── Login, logout, identity, refresh, revoke, audit routes ──────────────────
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { getAuthContext, requireAuthenticated, signJwt, verifyJwt, setJwtCookieOnResponse, } from "@publiclogic/core";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, } from "../config.js";
import { loginRequestSchema } from "../schemas.js";
import { initials } from "../serverMiddleware.js";
import { authEvent, REFRESH_TTL_SEC, getRefreshCookieOpts, getAccessCookieOpts, } from "../authHelpers.js";
import { rotateRefreshToken, revokeRefreshToken, revokeAllForUser, } from "../refreshTokenStore.js";
import { queryAuditEvents } from "../auditStore.js";
function secureEqual(left, right) {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");
    if (leftBuffer.length !== rightBuffer.length)
        return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
async function findUserAndValidate(users, requestBody) {
    const username = typeof requestBody?.username === "string" ? requestBody.username.trim() : "";
    const password = typeof requestBody?.password === "string" ? requestBody.password : "";
    if (!username || !password)
        return null;
    const user = users.find((c) => secureEqual(c.username, username));
    if (!user)
        return null;
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    return passwordMatches ? user : null;
}
export function createAuthRoutes(opts) {
    const router = express.Router();
    router.post("/login", opts.loginRateLimit, async (req, res) => {
        if (!opts.builtInLoginEnabled) {
            res.status(404).json({ error: "Not Found" });
            return;
        }
        if (opts.loginUsers.length === 0) {
            res.status(503).json({ error: "Login unavailable" });
            return;
        }
        const parsedLogin = loginRequestSchema.safeParse(req.body);
        if (!parsedLogin.success) {
            res.status(400).json({ error: "Invalid request payload",
                issues: parsedLogin.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
            return;
        }
        const user = await findUserAndValidate(opts.loginUsers, parsedLogin.data);
        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const token = await signJwt({ sub: user.id, name: user.name, role: user.role, permissions: user.permissions,
            tenants: user.tenants, tenantId: user.tenantId ?? undefined, delegations: [] }, { expiresIn: "8h" });
        setJwtCookieOnResponse(res, token, { maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000), sameSite: opts.nodeEnv === "production" ? "none" : "lax" });
        res.status(200).json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
    });
    router.post("/logout", requireAuthenticated(), (_req, res) => {
        res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: opts.nodeEnv === "production", sameSite: opts.nodeEnv === "production" ? "none" : "lax", path: "/" });
        res.clearCookie("pj_refresh", { path: "/api", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
        res.status(200).json({ ok: true });
    });
    router.get("/identity", requireAuthenticated(), (req, res) => {
        const auth = getAuthContext(req);
        if (!auth) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        res.json({
            name: auth.name,
            initials: initials(auth.name) || "OP",
            role: auth.role,
            tenants: auth.tenants,
            trustedParentOrigins: opts.trustedParentOrigins,
        });
    });
    // ── Lightweight session probe (uses optional auth — never 401) ────────────────
    router.get("/auth/status", (req, res) => {
        const auth = getAuthContext(req);
        if (auth?.sub) {
            res.json({
                authenticated: true,
                user: {
                    sub: auth.sub,
                    email: auth.email,
                    name: auth.name,
                    provider: auth.provider,
                },
            });
        }
        else {
            res.json({ authenticated: false });
        }
    });
    // ── Refresh (rotation with replay detection) ──────────────────────────────
    router.post("/refresh", async (req, res) => {
        try {
            const refreshToken = req.cookies?.pj_refresh;
            if (!refreshToken)
                return res.status(401).json({ error: "no refresh token" });
            const payload = await verifyJwt(refreshToken).catch(() => null);
            if (!payload || payload.token_type !== "refresh" || !payload.jti) {
                return res.status(401).json({ error: "invalid refresh token" });
            }
            // Attempt rotation — handles replay detection internally
            const result = rotateRefreshToken(payload.jti, REFRESH_TTL_SEC);
            if (!result.ok) {
                if (result.reason === "token_reuse_detected") {
                    // Breach: someone replayed an already-used token → family revoked
                    authEvent(req, "token_reuse_detected", { sub: payload.sub, family: payload.family });
                    res.clearCookie("pj_refresh", { path: "/api", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
                    return res.status(401).json({ error: "token_reuse_detected" });
                }
                authEvent(req, "refresh_failed", { sub: payload.sub, reason: result.reason });
                return res.status(401).json({ error: "invalid or expired refresh token" });
            }
            const newRow = result.token;
            const newRefreshJwt = await signJwt({ sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider,
                jti: newRow.id, family: newRow.family, token_type: "refresh" }, { expiresIn: "7d" });
            res.cookie("pj_refresh", newRefreshJwt, getRefreshCookieOpts(opts.nodeEnv));
            const newAccess = await signJwt({ sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider }, { expiresIn: "1h" });
            // Set httpOnly session cookie
            res.cookie("jwt", newAccess, getAccessCookieOpts(opts.nodeEnv));
            authEvent(req, "refresh", { sub: payload.sub });
            return res.json({
                jwt: newAccess,
                user: { sub: payload.sub, email: payload.email, name: payload.name, provider: payload.provider },
            });
        }
        catch (err) {
            authEvent(req, "refresh_error", { error: String(err) });
            return res.status(500).json({ error: "server error" });
        }
    });
    // ── Logout — revoke the specific refresh token + clear cookies ────────────
    router.post("/auth/logout", async (req, res) => {
        try {
            const refreshToken = req.cookies?.pj_refresh;
            if (refreshToken) {
                const payload = await verifyJwt(refreshToken).catch(() => null);
                if (payload?.jti)
                    revokeRefreshToken(payload.jti);
                authEvent(req, "logout", { sub: payload?.sub });
            }
            else {
                authEvent(req, "logout", { sub: null });
            }
            res.clearCookie("pj_refresh", { path: "/api", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
            res.clearCookie("jwt", { path: "/", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
            return res.status(200).json({ ok: true });
        }
        catch (err) {
            authEvent(req, "logout_error", { error: String(err) });
            return res.status(500).json({ error: "server error" });
        }
    });
    // ── Revoke — revoke all tokens for calling user (or admin target) ─────────
    router.post("/auth/revoke", async (req, res) => {
        try {
            const auth = req.auth;
            if (!auth?.sub)
                return res.status(401).json({ error: "Unauthorized" });
            const targetUserId = req.body?.user_id;
            if (targetUserId && targetUserId !== auth.sub) {
                if (auth.role !== "admin")
                    return res.status(403).json({ error: "Forbidden" });
                const count = revokeAllForUser(targetUserId);
                authEvent(req, "revoke", { actor: auth.sub, target: targetUserId, count });
                return res.json({ revoked: count });
            }
            const count = revokeAllForUser(String(auth.sub));
            authEvent(req, "revoke", { actor: auth.sub, target: auth.sub, count });
            res.clearCookie("pj_refresh", { path: "/api", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
            return res.json({ revoked: count });
        }
        catch (err) {
            authEvent(req, "revoke_error", { error: String(err) });
            return res.status(500).json({ error: "server error" });
        }
    });
    // ── Admin audit query ─────────────────────────────────────────────────────
    router.get("/admin/audit", (req, res) => {
        try {
            const auth = req.auth;
            if (!auth?.sub)
                return res.status(401).json({ error: "Unauthorized" });
            if (auth.role !== "admin")
                return res.status(403).json({ error: "Forbidden" });
            const event_type = typeof req.query.event_type === "string" ? req.query.event_type : undefined;
            const actor_id = typeof req.query.actor_id === "string" ? req.query.actor_id : undefined;
            const after = typeof req.query.after === "string" ? req.query.after : undefined;
            const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
            const events = queryAuditEvents({ event_type, actor_id, after, limit: isNaN(limit) ? 50 : limit });
            return res.json({ events });
        }
        catch (err) {
            return res.status(500).json({ error: "server error" });
        }
    });
    return router;
}
