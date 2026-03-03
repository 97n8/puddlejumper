// ── Login, logout, identity routes (PJ-specific) ───────────────────────────
//
// Session lifecycle (refresh, /auth/logout, /auth/revoke, /auth/status,
// /session, /admin/audit) are now provided by @publiclogic/logic-commons
// createSessionRoutes() — mounted separately in server.ts.
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
import {
  validateLocalUserPassword,
  updateLocalUserPassword,
  findLocalUserById,
} from "../localUsersStore.js";
import { getMemberRole, getWorkspaceForMember } from "../../engine/workspaceStore.js";

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function findEnvUserAndValidate(
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
  dataDir: string;
};

export function createAuthRoutes(opts: AuthRoutesOptions): express.Router {
  const router = express.Router();

  router.post("/login", opts.loginRateLimit, async (req, res) => {
    if (!opts.builtInLoginEnabled) { res.status(404).json({ error: "Not Found" }); return; }

    const parsedLogin = loginRequestSchema.safeParse(req.body);
    if (!parsedLogin.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsedLogin.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }

    const { username, password } = parsedLogin.data as { username: string; password: string };

    // 1. Try env-var (super-admin) users first
    const envUser = await findEnvUserAndValidate(opts.loginUsers, { username, password });
    if (envUser) {
      const token = await signJwt(
        { sub: envUser.id, name: envUser.name, role: envUser.role, permissions: envUser.permissions,
          tenants: envUser.tenants, tenantId: envUser.tenantId ?? undefined, delegations: [] },
        { expiresIn: "8h" },
      );
      setJwtCookieOnResponse(res, token, { maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000), sameSite: opts.nodeEnv === "production" ? "none" : "lax" });
      res.status(200).json({ ok: true, user: { id: envUser.id, name: envUser.name, role: envUser.role } });
      return;
    }

    // 2. Try DB-backed local users
    const localUser = await validateLocalUserPassword(opts.dataDir, username, password);
    if (!localUser) {
      // Burn a bcrypt compare to prevent timing-based username enumeration
      if (opts.loginUsers.length === 0) await bcrypt.compare("noop", "$2a$12$invalidhashpadding000000000000000000000000000000000000");
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Resolve workspace + role for this local user
    const membership = getWorkspaceForMember(opts.dataDir, localUser.id);
    let workspaceId = membership?.workspaceId;
    let role = membership?.role ?? "member";

    // If no invited membership, try direct workspace owner lookup (shouldn't happen for local users but guard it)
    if (!workspaceId) {
      workspaceId = `ws-${localUser.id}`;
    }

    const mustChangePassword = localUser.must_change_password === 1;

    const token = await signJwt(
      {
        sub: localUser.id,
        name: localUser.name,
        role,
        permissions: [],
        tenants: [{ id: workspaceId, name: "Workspace", sha: "", connections: [] }],
        tenantId: workspaceId,
        delegations: [],
        // Custom claim — LogicOS reads this to show the change-password gate
        mustChangePassword,
      } as any,
      { expiresIn: "8h" },
    );
    setJwtCookieOnResponse(res, token, { maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000), sameSite: opts.nodeEnv === "production" ? "none" : "lax" });
    res.status(200).json({
      ok: true,
      user: { id: localUser.id, name: localUser.name, role, mustChangePassword },
    });
  });

  // ── POST /api/auth/change-password ─────────────────────────────────────
  // Authenticated local user changes their own password.
  // If must_change_password was set, this clears it.
  // Body: { currentPassword, newPassword }
  router.post("/auth/change-password", requireAuthenticated(), async (req, res) => {
    const auth = getAuthContext(req);
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" }); return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "newPassword must be at least 8 characters" }); return;
    }

    // Only local users can change password via this endpoint
    const localUser = findLocalUserById(opts.dataDir, auth!.sub);
    if (!localUser) {
      res.status(403).json({ error: "Password change is only available for local accounts. OAuth users manage their password through their provider." });
      return;
    }

    const valid = await validateLocalUserPassword(opts.dataDir, localUser.username, currentPassword);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" }); return;
    }

    // Update password and clear must_change_password
    await updateLocalUserPassword(opts.dataDir, localUser.id, newPassword, false);

    res.json({ ok: true, message: "Password updated successfully" });
  });

  router.post("/logout", requireAuthenticated(), (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: opts.nodeEnv === "production", sameSite: opts.nodeEnv === "production" ? "none" : "lax", path: "/" });
    res.clearCookie("pj_refresh", { path: "/api", sameSite: opts.nodeEnv === "production" ? "none" : "lax", secure: opts.nodeEnv === "production" });
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
      mustChangePassword: (auth as any).mustChangePassword ?? false,
    });
  });

  // GET /api/v1/auth/whoami — auth smoke test: returns decoded token claims
  router.get("/v1/auth/whoami", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const claims = auth as typeof auth & { exp?: number; userId?: string; workspaceId?: string; permissions?: string[] };
    const tokenExpiresAt = claims.exp ? new Date(claims.exp * 1000).toISOString() : null;
    res.json({
      userId: auth.sub ?? claims.userId ?? null,
      tenantId: auth.tenantId ?? null,
      workspaceId: claims.workspaceId ?? auth.tenantId ?? null,
      role: auth.role ?? null,
      permissions: claims.permissions ?? [],
      tokenExpiresAt,
    });
  });

  return router;
}
