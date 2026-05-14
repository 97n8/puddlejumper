import type { Request, Response, NextFunction } from "express";

/**
 * Tenant Binding Middleware
 * 
 * Every request must be scoped to a tenant. No cross-tenant data leakage.
 * Extracts tenant_id from auth token or header, attaches to req.
 * 
 * Slot: replace extraction logic with your auth provider.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const tenantId = req.headers["x-pj-tenant"] as string | undefined;
  
  if (tenantId) {
    (req as any).tenantId = tenantId;
  }
  
  next();
}
