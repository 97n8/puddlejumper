// ── Shared auth helpers: session creation, cookie options, audit logging ─────
//
// Provider-agnostic utilities used by OAuth callbacks and session routes.
import type express from "express";
import { signJwt } from "@publiclogic/core";
import { insertAuditEvent } from "./audit-store.js";
import { createRefreshToken } from "./refresh-store.js";

// ── Constants ───────────────────────────────────────────────────────────────

/** Refresh token lifetime in seconds (7 days). */
export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

/**
 * Cookie options for the `pj_refresh` (7-day) cookie.
 * Uses SameSite=None in production for cross-origin fetch.
 */
export function getRefreshCookieOpts(nodeEnv: string) {
  const isProduction = nodeEnv === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/api",
    maxAge: REFRESH_TTL_SEC * 1000,
  };
}

/**
 * Cookie options for the `jwt` (1-hour) access cookie.
 * Uses SameSite=None in production for cross-origin fetch.
 */
export function getAccessCookieOpts(nodeEnv: string) {
  const isProduction = nodeEnv === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 60 * 60 * 1000, // 1 hour
  };
}

// ── Structured auth event logger ────────────────────────────────────────────

/**
 * Log a structured auth event to stdout and persist it to the audit DB.
 * Best-effort — audit writes never break auth flows.
 */
export function authEvent(req: any, event: string, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    correlationId: req.correlationId ?? null,
    ip: req.ip,
    ...data,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));

  try {
    insertAuditEvent({
      event_type: `auth.${event}`,
      actor_id: (data.sub ?? data.actor ?? null) as string | null,
      target_id: (data.target ?? null) as string | null,
      ip_address: req.ip ?? null,
      user_agent: req.headers?.["user-agent"] ?? null,
      request_id: req.correlationId ?? null,
      metadata: data,
    });
  } catch {
    // best-effort
  }
}

// ── Session token creation ──────────────────────────────────────────────────

/** Normalised user info passed from any login method. */
export type UserInfo = {
  sub: string;
  email?: string;
  name?: string;
  provider: string;
  role?: string;
};

/**
 * Create access JWT (1h) + refresh token (7d) and set both as httpOnly cookies.
 * Returns the access JWT string.
 */
export async function createSessionAndSetCookies(
  res: express.Response,
  userInfo: UserInfo,
  nodeEnv: string,
): Promise<string> {
  const baseClaims: Record<string, any> = {
    sub: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    provider: userInfo.provider,
    role: userInfo.role ?? "user",
  };

  // Short-lived access token (1h)
  const accessJwt = await signJwt(baseClaims, { expiresIn: "1h" });

  // Persisted refresh entry — new family chain
  const refreshRow = createRefreshToken(String(userInfo.sub), null, REFRESH_TTL_SEC);
  const refreshJwt = await signJwt(
    { ...baseClaims, jti: refreshRow.id, family: refreshRow.family, token_type: "refresh" },
    { expiresIn: "7d" },
  );

  // Set cookies
  res.cookie("pj_refresh", refreshJwt, getRefreshCookieOpts(nodeEnv));
  res.cookie("jwt", accessJwt, getAccessCookieOpts(nodeEnv));

  // Also set pj_sso — same JWT, cross-origin-friendly cookie for session probes
  res.cookie("pj_sso", accessJwt, {
    ...getAccessCookieOpts(nodeEnv),
    domain: nodeEnv === "production" ? ".publiclogic.org" : undefined,
  });

  return accessJwt;
}
