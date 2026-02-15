// ── @publiclogic/logic-commons barrel export ────────────────────────────────

// OAuth factory & types
export {
  createOAuthRoutes,
  type OAuthProvider,
  type OAuthUserInfo,
  type OAuthRouteOptions,
  type IOAuthStateStore,
} from "./lib/oauth.js";

// Provider configs
export { googleProvider } from "./lib/google.js";
export { githubProvider } from "./lib/github.js";
export { microsoftProvider } from "./lib/microsoft.js";

// Session helpers
export {
  createSessionAndSetCookies,
  getRefreshCookieOpts,
  getAccessCookieOpts,
  authEvent,
  REFRESH_TTL_SEC,
  type UserInfo,
} from "./lib/session.js";

// Stores
export { OAuthStateStore } from "./lib/state-store.js";
export {
  createRefreshToken,
  findRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeFamily,
  revokeAllForUser,
  rotateRefreshToken,
  purgeExpired,
  resetDb,
  configureRefreshStore,
  type RefreshTokenRow,
} from "./lib/refresh-store.js";
export {
  insertAuditEvent,
  queryAuditEvents,
  resetAuditDb,
  configureAuditStore,
  type AuditEventRow,
  type InsertAuditEvent,
  type AuditQueryOptions,
} from "./lib/audit-store.js";

// Session lifecycle routes
export { createSessionRoutes, type SessionRoutesOptions } from "./routes/login.js";

// High-level mounting helper
export {
  mountAuthRoutes,
  type MountAuthRoutesOptions,
  type MountAuthRoutesResult,
} from "./server.js";
