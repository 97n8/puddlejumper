// ── Token exchange route: SSO bridge for external apps ──────────────────────
//
// Accepts a provider access token (e.g. from a client-side MSAL flow) and
// creates a PJ session.  This allows the PublicLogic OS (which authenticates
// with MSAL directly) to establish a PJ session without a full server-side
// OAuth redirect.
//
// Flow:
//   1. Client acquires an access token from the provider (e.g. MSAL).
//   2. Client POSTs { provider, accessToken } to /api/auth/token-exchange.
//   3. This route validates the token by calling the provider's userinfo
//      endpoint (e.g. MS Graph /me).
//   4. On success, creates a PJ session (JWT + refresh cookies).
//   5. Returns { ok, user }.

import express from "express";
import type { OAuthProvider, OAuthUserInfo } from "../lib/oauth.js";
import {
  createSessionAndSetCookies,
  authEvent,
  type UserInfo,
} from "../lib/session.js";

export interface TokenExchangeOptions {
  nodeEnv: string;
  /** Map of provider name → OAuthProvider config (reuses fetchUserInfo). */
  providers: Record<string, OAuthProvider>;
  /**
   * Optional hook called after fetching the user profile.
   * Mirrors the onUserAuthenticated hook from OAuth routes.
   */
  onUserAuthenticated?: (
    userInfo: UserInfo,
  ) => UserInfo | Promise<UserInfo>;
}

/**
 * Create an Express router with a single route:
 *
 *   POST /auth/token-exchange
 *
 * Body: { provider: string, accessToken: string }
 *
 * Mount under `/api` so the full path becomes `/api/auth/token-exchange`.
 */
export function createTokenExchangeRoutes(
  opts: TokenExchangeOptions,
): express.Router {
  const router = express.Router();

  router.post("/auth/token-exchange", async (req, res) => {
    const { provider: providerName, accessToken } = req.body ?? {};

    if (
      typeof providerName !== "string" ||
      typeof accessToken !== "string" ||
      !providerName.trim() ||
      !accessToken.trim()
    ) {
      return res.status(400).json({
        error: "Missing required fields: provider, accessToken",
      });
    }

    const provider = opts.providers[providerName];
    if (!provider) {
      return res.status(400).json({
        error: `Unsupported provider: ${providerName}`,
      });
    }

    let rawUserInfo: OAuthUserInfo;
    try {
      rawUserInfo = await provider.fetchUserInfo(accessToken);
    } catch (err: any) {
      authEvent(req, "token_exchange_failed", {
        provider: providerName,
        reason: err?.message ?? "userinfo fetch failed",
      });
      return res.status(401).json({
        error: "Invalid or expired provider token",
      });
    }

    if (!rawUserInfo.sub) {
      return res.status(401).json({ error: "Provider returned no user ID" });
    }

    // Allow the host app to resolve/create user records
    const sessionUser: UserInfo = opts.onUserAuthenticated
      ? await opts.onUserAuthenticated({
          sub: rawUserInfo.sub,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          provider: providerName,
        })
      : {
          sub: rawUserInfo.sub,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          provider: providerName,
        };

    await createSessionAndSetCookies(res, sessionUser, opts.nodeEnv);

    authEvent(req, "token_exchange", {
      sub: sessionUser.sub,
      provider: providerName,
      method: "token_exchange",
    });

    return res.json({
      ok: true,
      user: {
        sub: sessionUser.sub,
        email: sessionUser.email,
        name: sessionUser.name,
        provider: providerName,
      },
    });
  });

  return router;
}
