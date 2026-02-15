// ── Login, logout, identity routes ──────────────────────────────────────────
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import {
  getAuthContext,
  requireAuthenticated,
  signJwt,
  setJwtCookieOnResponse,
} from "@publiclogic/core";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
} from "../config.js";
import { loginRequestSchema } from "../schemas.js";
import type { LoginUser } from "../types.js";
import { initials } from "../serverMiddleware.js";

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function findUserAndValidate(
  users: LoginUser[],
  requestBody: Partial<{ username: string; password: string }> | null | undefined,
): Promise<LoginUser | null> {
  const username = typeof requestBody?.username === "string" ? requestBody.username.trim() : "";
  const password = typeof requestBody?.password === "string" ? requestBody.password : "";
  if (!username || !password) return null;
  const user = users.find((c) => secureEqual(c.username, username));
  if (!user) return null;
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  return passwordMatches ? user : null;
}

type AuthRoutesOptions = {
  builtInLoginEnabled: boolean;
  loginUsers: LoginUser[];
  loginRateLimit: express.RequestHandler;
  nodeEnv: string;
  trustedParentOrigins: string[];
};

export function createAuthRoutes(opts: AuthRoutesOptions): express.Router {
  const router = express.Router();

  router.post("/login", opts.loginRateLimit, async (req, res) => {
    if (!opts.builtInLoginEnabled) { res.status(404).json({ error: "Not Found" }); return; }
    if (opts.loginUsers.length === 0) { res.status(503).json({ error: "Login unavailable" }); return; }

    const parsedLogin = loginRequestSchema.safeParse(req.body);
    if (!parsedLogin.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsedLogin.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const user = await findUserAndValidate(opts.loginUsers, parsedLogin.data);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const token = await signJwt(
      { sub: user.id, name: user.name, role: user.role, permissions: user.permissions,
        tenants: user.tenants, tenantId: user.tenantId ?? undefined, delegations: [] },
      { expiresIn: "8h" },
    );
    setJwtCookieOnResponse(res, token, { maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000), sameSite: "lax" });
    res.status(200).json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  router.post("/logout", requireAuthenticated(), (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: opts.nodeEnv === "production", sameSite: "lax", path: "/" });
    res.status(200).json({ ok: true });
  });

  router.get("/identity", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.json({
      name: auth.name,
      initials: initials(auth.name) || "OP",
      role: auth.role,
      tenants: auth.tenants,
      trustedParentOrigins: opts.trustedParentOrigins,
    });
  });

  // ── Lightweight session probe (uses optional auth — no 401 on missing cookie) ──
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
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  return router;
}
