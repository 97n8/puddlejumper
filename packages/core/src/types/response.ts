// Canon: API response envelopes.
// Source: Master Build Spec v1.1, Part 7 (@pj/core).

export interface PJResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PJPaginated<T> {
  ok: boolean;
  data: T[];
  page: {
    limit: number;
    cursor: string | null;
    next_cursor: string | null;
  };
}
