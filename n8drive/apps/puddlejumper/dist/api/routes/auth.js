// ── Login, logout, identity routes (PJ-specific) ───────────────────────────
//
// Session lifecycle (refresh, /auth/logout, /auth/revoke, /auth/status,
// /session, /admin/audit) are now provided by @publiclogic/logic-commons
// createSessionRoutes() — mounted separately in server.ts.
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { getAuthContext, requireAuthenticated, signJwt, setJwtCookieOnResponse, } from "@publiclogic/core";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, } from "../config.js";
import { loginRequestSchema } from "../schemas.js";
import { initials } from "../serverMiddleware.js";
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
    return router;
}
