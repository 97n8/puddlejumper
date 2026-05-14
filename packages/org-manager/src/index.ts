/**
 * Org Manager — Runtime Routing
 * 
 * Resolves who a governance action should route to based on
 * organizational structure, role, authority level, and availability.
 * Not a directory — a routing engine.
 * 
 * Slot: drop existing Org Manager logic here.
 * 
 * // GPR
 */

export interface OrgNode {
  id: string;
  tenantId: string;
  title: string;
  department: string;
  parentId?: string;
  userId?: string;
  authorityLevel: number;
  canApprove: string[]; // action types this node can approve
}

export interface RouteResult {
  targetNodeId: string;
  targetUserId?: string;
  reason: string;
  fallbackNodeId?: string;
}
