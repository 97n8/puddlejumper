// ── Shared auth helpers: audit logging, refresh token constants, session creation
//
// Used by OAuth route handlers and auth.ts to avoid duplication.
import type express from "express";
import { signJwt } from "@publiclogic/core";
import { insertAuditEvent } from "./auditStore.js";
import { createRefreshToken } from "./refreshTokenStore.js";

// ── Constants ───────────────────────────────────────────────────────────────

export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days in seconds

export function getRefreshCookieOpts(nodeEnv: string) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/api",
    maxAge: REFRESH_TTL_SEC * 1000,
  };
}

export function getAccessCookieOpts(nodeEnv: string) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 1000, // 1 hour (matches access token expiry)
  };
}

// ── Structured auth event logger ────────────────────────────────────────────

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

  // Persist to audit DB (best-effort — don't let audit writes break auth flows)
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

  return accessJwt;
}
