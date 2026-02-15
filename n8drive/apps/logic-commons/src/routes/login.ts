// ── Session lifecycle routes: status, refresh, logout, revoke, audit ────────
//
// Provider-agnostic routes that manage the session after initial login.
// The password-based /login route is NOT included here — it's app-specific.
import express from "express";
import { getAuthContext, signJwt, verifyJwt } from "@publiclogic/core";
import {
  authEvent,
  REFRESH_TTL_SEC,
  getRefreshCookieOpts,
  getAccessCookieOpts,
} from "../lib/session.js";
import {
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from "../lib/refresh-store.js";
import { queryAuditEvents } from "../lib/audit-store.js";

export interface SessionRoutesOptions {
  nodeEnv: string;
}

/**
 * Create an Express router with session-lifecycle routes:
 *
 * - `GET  /auth/status`   — lightweight session probe (never 401)
 * - `POST /refresh`       — token rotation with replay detection
 * - `POST /auth/logout`   — revoke refresh token + clear cookies
 * - `POST /auth/revoke`   — revoke all tokens for calling user (admin: any user)
 * - `GET  /admin/audit`   — admin audit event query
 *
 * Mount under `/api` so full paths become `/api/auth/status`, etc.
 */
export function createSessionRoutes(opts: SessionRoutesOptions): express.Router {
  const router = express.Router();

  // ── Lightweight session probe (uses optional auth — never 401) ────────────
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
      res.json({ authenticated: false });
    }
  });

  // ── Refresh (rotation with replay detection) ──────────────────────────────
  router.post("/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.pj_refresh;
      if (!refreshToken) return res.status(401).json({ error: "no refresh token" });

      const payload = (await verifyJwt(refreshToken).catch(() => null)) as Record<
        string,
        any
      > | null;
      if (!payload || payload.token_type !== "refresh" || !payload.jti) {
        return res.status(401).json({ error: "invalid refresh token" });
      }

      const result = rotateRefreshToken(payload.jti, REFRESH_TTL_SEC);

      if (!result.ok) {
        if (result.reason === "token_reuse_detected") {
          authEvent(req, "token_reuse_detected", {
            sub: payload.sub,
            family: payload.family,
          });
          res.clearCookie("pj_refresh", {
            path: "/api",
            sameSite: opts.nodeEnv === "production" ? "none" : "lax",
            secure: opts.nodeEnv === "production",
          });
          return res.status(401).json({ error: "token_reuse_detected" });
        }
        authEvent(req, "refresh_failed", { sub: payload.sub, reason: result.reason });
        return res.status(401).json({ error: "invalid or expired refresh token" });
      }

      const newRow = result.token;
      const newRefreshJwt = await signJwt(
        {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          provider: payload.provider,
          jti: newRow.id,
          family: newRow.family,
          token_type: "refresh",
        },
        { expiresIn: "7d" },
      );
      res.cookie("pj_refresh", newRefreshJwt, getRefreshCookieOpts(opts.nodeEnv));

      const newAccess = await signJwt(
        {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          provider: payload.provider,
        },
        { expiresIn: "1h" },
      );
      res.cookie("jwt", newAccess, getAccessCookieOpts(opts.nodeEnv));

      authEvent(req, "refresh", { sub: payload.sub });
      return res.json({
        jwt: newAccess,
        user: {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          provider: payload.provider,
        },
      });
    } catch (err) {
      authEvent(req, "refresh_error", { error: String(err) });
      return res.status(500).json({ error: "server error" });
    }
  });

  // ── Logout — revoke the specific refresh token + clear cookies ────────────
  router.post("/auth/logout", async (req, res) => {
    try {
      const refreshToken = req.cookies?.pj_refresh;
      if (refreshToken) {
        const payload = (await verifyJwt(refreshToken).catch(() => null)) as Record<
          string,
          any
        > | null;
        if (payload?.jti) revokeRefreshToken(payload.jti);
        authEvent(req, "logout", { sub: payload?.sub });
      } else {
        authEvent(req, "logout", { sub: null });
      }
      res.clearCookie("pj_refresh", {
        path: "/api",
        sameSite: opts.nodeEnv === "production" ? "none" : "lax",
        secure: opts.nodeEnv === "production",
      });
      res.clearCookie("jwt", {
        path: "/",
        sameSite: opts.nodeEnv === "production" ? "none" : "lax",
        secure: opts.nodeEnv === "production",
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      authEvent(req, "logout_error", { error: String(err) });
      return res.status(500).json({ error: "server error" });
    }
  });

  // ── Revoke — revoke all tokens for calling user (or admin target) ─────────
  router.post("/auth/revoke", async (req, res) => {
    try {
      const auth = (req as any).auth as Record<string, any> | undefined;
      if (!auth?.sub) return res.status(401).json({ error: "Unauthorized" });

      const targetUserId: string | undefined = req.body?.user_id;
      if (targetUserId && targetUserId !== auth.sub) {
        if (auth.role !== "admin")
          return res.status(403).json({ error: "Forbidden" });
        const count = revokeAllForUser(targetUserId);
        authEvent(req, "revoke", { actor: auth.sub, target: targetUserId, count });
        return res.json({ revoked: count });
      }

      const count = revokeAllForUser(String(auth.sub));
      authEvent(req, "revoke", { actor: auth.sub, target: auth.sub, count });
      res.clearCookie("pj_refresh", {
        path: "/api",
        sameSite: opts.nodeEnv === "production" ? "none" : "lax",
        secure: opts.nodeEnv === "production",
      });
      return res.json({ revoked: count });
    } catch (err) {
      authEvent(req, "revoke_error", { error: String(err) });
      return res.status(500).json({ error: "server error" });
    }
  });

  // ── Admin audit query ─────────────────────────────────────────────────────
  router.get("/admin/audit", (req, res) => {
    try {
      const auth = (req as any).auth as Record<string, any> | undefined;
      if (!auth?.sub) return res.status(401).json({ error: "Unauthorized" });
      if (auth.role !== "admin") return res.status(403).json({ error: "Forbidden" });

      const event_type =
        typeof req.query.event_type === "string" ? req.query.event_type : undefined;
      const actor_id =
        typeof req.query.actor_id === "string" ? req.query.actor_id : undefined;
      const after =
        typeof req.query.after === "string" ? req.query.after : undefined;
      const limit =
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;

      const events = queryAuditEvents({
        event_type,
        actor_id,
        after,
        limit: isNaN(limit) ? 50 : limit,
      });
      return res.json({ events });
    } catch {
      return res.status(500).json({ error: "server error" });
    }
  });

  return router;
}
