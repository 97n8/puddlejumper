/**
 * Common PuddleJumper Types
 * // GPR
 */

/** User within the runtime */
export interface PJUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  createdAt: string;
}

/** API response envelope */
export interface PJResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: string;
    tenantId: string;
    requestId: string;
  };
}

/** Pagination */
export interface PJPaginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
