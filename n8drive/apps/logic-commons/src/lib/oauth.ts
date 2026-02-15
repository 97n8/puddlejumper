// ── Generic OAuth provider configuration & route factory ────────────────────
//
// A single factory function replaces the three per-provider route files
// (googleOAuth.ts, githubOAuth.ts, microsoftOAuth.ts). Each provider is
// described by a declarative OAuthProvider config object.

import express from "express";
import { authEvent, createSessionAndSetCookies } from "./session.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Normalised user info returned by every provider's userinfo endpoint. */
export interface OAuthUserInfo {
  sub: string;
  email?: string;
  name?: string;
}

/** Structural interface for the OAuth state store (avoids private-field compatibility issues). */
export interface IOAuthStateStore {
  create(provider: string): string;
  consume(state: string): string | null;
}

/** Declarative description of an OAuth 2.0 provider. */
export interface OAuthProvider {
  /** Short lowercase name, used in route paths and logging (e.g. "google"). */
  name: string;

  /** OAuth authorize endpoint. Can be a function for dynamic URLs (e.g. Microsoft tenant). */
  authorizeUrl: string | ((env: Record<string, string | undefined>) => string);

  /** OAuth token-exchange endpoint. Can be a function for dynamic URLs. */
  tokenUrl: string | ((env: Record<string, string | undefined>) => string);

  /** Space-separated list of OAuth scopes. */
  scopes: string;

  /** How the token-exchange body is encoded. */
  tokenContentType: "json" | "form";

  /** Name of the CSRF state cookie. */
  stateCookieName: string;

  /** Env-var name for client ID.  Resolved at runtime via `process.env`. */
  clientIdEnvVar: string;
  /** Env-var name for client secret. */
  clientSecretEnvVar: string;
  /** Env-var name for redirect URI. */
  redirectUriEnvVar: string;

  /** Fallback redirect URI when the env-var is not set (local dev). */
  defaultRedirectUri: string;

  /** Extra query-string params appended to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;

  /** Extra body params added to the token-exchange request. */
  extraTokenParams?: Record<string, string>;

  /** Extra headers sent with the token-exchange request. */
  fetchHeaders?: Record<string, string>;

  /** Provider-specific function that exchanges an access token for user info. */
  fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

/** Options passed to createOAuthRoutes. */
export interface OAuthRouteOptions {
  nodeEnv: string;
  oauthStateStore: IOAuthStateStore;
  /** Override the frontend redirect target. Defaults to FRONTEND_URL env-var. */
  frontendUrl?: string;
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an Express router with `/auth/<provider>/login` and
 * `/auth/<provider>/callback` routes for the given OAuth provider.
 *
 * The router should be mounted under `/api` so the full paths become
 * `/api/auth/<provider>/login` and `/api/auth/<provider>/callback`.
 */
export function createOAuthRoutes(
  provider: OAuthProvider,
  opts: OAuthRouteOptions,
): express.Router {
  const router = express.Router();
  const resolveFrontendUrl = () =>
    opts.frontendUrl || process.env.FRONTEND_URL || "https://pj.publiclogic.org";

  // ── Login redirect ────────────────────────────────────────────────────────
  router.get(`/auth/${provider.name}/login`, (_req, res) => {
    const clientId = process.env[provider.clientIdEnvVar];
    if (!clientId) {
      return res.status(500).json({ error: `${provider.name} OAuth not configured` });
    }

    const state = opts.oauthStateStore.create(provider.name);
    const redirectUri =
      process.env[provider.redirectUriEnvVar] || provider.defaultRedirectUri;

    // Set CSRF state cookie (lax is fine here — it's a top-level navigation)
    res.cookie(provider.stateCookieName, state, {
      httpOnly: true,
      secure: opts.nodeEnv === "production",
      maxAge: 5 * 60 * 1000,
      sameSite: "lax",
    });

    // Build the authorize URL
    const authorizeUrl =
      typeof provider.authorizeUrl === "function"
        ? provider.authorizeUrl(process.env as Record<string, string | undefined>)
        : provider.authorizeUrl;

    const authUrl = new URL(authorizeUrl);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", provider.scopes);
    authUrl.searchParams.set("state", state);

    if (provider.extraAuthorizeParams) {
      for (const [k, v] of Object.entries(provider.extraAuthorizeParams)) {
        authUrl.searchParams.set(k, v);
      }
    }

    return res.redirect(authUrl.toString());
  });

  // ── Callback (code exchange) ──────────────────────────────────────────────
  router.get(`/auth/${provider.name}/callback`, async (req, res) => {
    const { code, state, error, error_description } = req.query as Record<
      string,
      string | undefined
    >;

    // Provider-returned error (e.g. user denied consent)
    if (error) {
      return res
        .status(400)
        .json({ error, error_description: error_description || "Auth error" });
    }

    // Validate + consume CSRF state (single-use, SQLite-backed)
    if (!state || !opts.oauthStateStore.consume(state)) {
      return res.status(400).json({ error: "Invalid or expired state parameter" });
    }
    res.clearCookie(provider.stateCookieName);

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      const redirectUri =
        process.env[provider.redirectUriEnvVar] || provider.defaultRedirectUri;
      const clientId = process.env[provider.clientIdEnvVar]!;
      const clientSecret = process.env[provider.clientSecretEnvVar]!;

      const tokenUrl =
        typeof provider.tokenUrl === "function"
          ? provider.tokenUrl(process.env as Record<string, string | undefined>)
          : provider.tokenUrl;

      const tokenParams: Record<string, string> = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        ...(provider.extraTokenParams ?? {}),
      };

      // Exchange code for access token — server-side, secret never exposed
      let fetchOpts: RequestInit;
      if (provider.tokenContentType === "json") {
        fetchOpts = {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(provider.fetchHeaders ?? {}),
          },
          body: JSON.stringify(tokenParams),
        };
      } else {
        fetchOpts = {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(provider.fetchHeaders ?? {}),
          },
          body: new URLSearchParams(tokenParams),
        };
      }

      const tokenResponse = await fetch(tokenUrl, fetchOpts);
      const tokenBody = (await tokenResponse.json()) as Record<string, any>;

      if (tokenBody.error || !tokenBody.access_token) {
        throw new Error(
          tokenBody.error_description || tokenBody.error || "Token exchange failed",
        );
      }

      // Fetch user profile from provider
      const userInfo = await provider.fetchUserInfo(tokenBody.access_token);

      // Create session: 1h access JWT + 7d refresh token (httpOnly cookies)
      await createSessionAndSetCookies(
        res,
        { sub: userInfo.sub, email: userInfo.email, name: userInfo.name, provider: provider.name },
        opts.nodeEnv,
      );

      authEvent(req, "login", {
        sub: userInfo.sub,
        provider: provider.name,
        method: "oauth_redirect",
      });

      // Redirect to frontend (cookie carries the session — no token in URL)
      return res.redirect(resolveFrontendUrl());
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(`${provider.name} OAuth callback error:`, err?.message);
      authEvent(req, "login_failed", {
        provider: provider.name,
        method: "oauth_redirect",
        reason: err?.message ?? "unknown",
      });
      return res.redirect(`${resolveFrontendUrl()}/#error=authentication_failed`);
    }
  });

  return router;
}
