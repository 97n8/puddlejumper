import type { Request, Response, NextFunction } from "express";

/**
 * Audit Middleware
 * 
 * Logs every mutating request to audit_events.
 * The audit_events table is append-only — enforced by SQLite triggers.
 * You can't UPDATE or DELETE from audit_events. That's the point.
 * 
 * Slot: wire to @pj/db audit functions.
 */
export function auditMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    // TODO: Write to audit_events via @pj/db
    // {
    //   tenant_id: req.tenantId,
    //   actor_id: req.userId,
    //   action: `${req.method} ${req.path}`,
    //   timestamp: new Date().toISOString(),
    //   payload: req.body (redacted as needed)
    // }
  }
  next();
}
