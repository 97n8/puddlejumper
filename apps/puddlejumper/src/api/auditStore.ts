// ── Thin re-export from @publiclogic/logic-commons ──────────────────────────
//
// All audit store functionality now lives in logic-commons.
// This file re-exports for backward compatibility with existing imports.
export {
  insertAuditEvent,
  queryAuditEvents,
  resetAuditDb,
  configureAuditStore,
  type AuditEventRow,
  type InsertAuditEvent,
  type AuditQueryOptions,
} from "@publiclogic/logic-commons";

