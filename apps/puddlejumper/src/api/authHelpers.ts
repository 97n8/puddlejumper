// ── Thin re-export from @publiclogic/logic-commons ──────────────────────────
//
// All auth helpers (session creation, cookie opts, audit logging) now live
// in logic-commons.  This file re-exports for backward compatibility.
export {
  createSessionAndSetCookies,
  getRefreshCookieOpts,
  getAccessCookieOpts,
  authEvent,
  REFRESH_TTL_SEC,
  type UserInfo,
} from "@publiclogic/logic-commons";

