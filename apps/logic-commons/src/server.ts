// ── mountAuthRoutes — one-call setup for all auth infrastructure ────────────
//
// Mounts OAuth providers, session lifecycle routes, and rate limiting onto an
// Express app.  Consumers only need to call this once instead of wiring each
// piece individually.

import type express from "express";
import path from "node:path";
import { OAuthStateStore } from "./lib/state-store.js";
import { createOAuthRoutes } from "./lib/oauth.js";
import type { OAuthProvider } from "./lib/oauth.js";
import { createSessionRoutes } from "./routes/login.js";

// Re-export providers for convenience
export { googleProvider } from "./lib/google.js";
export { githubProvider } from "./lib/github.js";
export { microsoftProvider } from "./lib/microsoft.js";

export interface MountAuthRoutesOptions {
  /** Express app to mount routes on. */
  app: express.Express;
  /** "production" | "development" | "test" */
  nodeEnv: string;
  /** Path to the directory for SQLite databases (state store). */
  dataDir: string;
  /** OAuth providers to enable. Only providers whose env-vars are set will create login routes. */
  providers: OAuthProvider[];
  /** Optional rate-limit middleware applied to OAuth login routes. */
  oauthLoginRateLimit?: express.RequestHandler;
  /** Override the FRONTEND_URL for post-login redirects. */
  frontendUrl?: string;
}

export interface MountAuthRoutesResult {
  /** The state store instance (for shutdown cleanup). */
  oauthStateStore: OAuthStateStore;
}

/**
 * Mount all auth infrastructure onto an Express app:
 * 1. Creates an OAuthStateStore (SQLite-backed)
 * 2. Mounts OAuth routes for each configured provider under `/api`
 * 3. Applies rate limiting to OAuth login endpoints
 * 4. Mounts session lifecycle routes (status, refresh, logout, revoke, audit)
 *
 * Returns the state store instance for cleanup on shutdown.
 */
export function mountAuthRoutes(opts: MountAuthRoutesOptions): MountAuthRoutesResult {
  const { app, nodeEnv, dataDir, providers } = opts;

  // Create SQLite-backed state store
  const oauthStateStore = new OAuthStateStore(path.join(dataDir, "oauth_state.db"));

  // Mount OAuth provider routes
  for (const provider of providers) {
    // Apply rate limiting if provided
    if (opts.oauthLoginRateLimit) {
      app.use(`/api/auth/${provider.name}/login`, opts.oauthLoginRateLimit);
    }

    app.use(
      "/api",
      createOAuthRoutes(provider, {
        nodeEnv,
        oauthStateStore,
        frontendUrl: opts.frontendUrl,
      }),
    );
  }

  // Mount session lifecycle routes (refresh, logout, revoke, status, audit)
  app.use("/api", createSessionRoutes({ nodeEnv }));

  return { oauthStateStore };
}
