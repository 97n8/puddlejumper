// Single client for the PJ backend. Cookie-first auth, no Bearer from the
// browser. Mutating verbs must carry the X-PuddleJumper-Request header.
// Source: Phase 5 prompt — "API BASE & AUTH" section.

const PROD_DEFAULT = 'https://api.publiclogic.org';
const DEV_DEFAULT  = 'http://localhost:3002';

/**
 * Resolve the API base. Static prerender bakes this in at build time via
 * NEXT_PUBLIC_API_BASE_URL. If unset, dev → localhost:3002, prod → the
 * Fly.io host. Empty string means "same-origin" (no prefix).
 */
export function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof env === 'string') return env;
  return process.env.NODE_ENV === 'production' ? PROD_DEFAULT : DEV_DEFAULT;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  issues?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;
  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.issues = body.issues;
  }
}

type Body = unknown;
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const WRITE_METHODS = new Set<Method>(['POST', 'PATCH', 'PUT', 'DELETE']);

async function request<T>(method: Method, path: string, body?: Body): Promise<T> {
  const base = getApiBase();
  const url = base ? `${base}${path}` : path;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (WRITE_METHODS.has(method)) {
    headers['Content-Type'] = 'application/json';
    headers['X-PuddleJumper-Request'] = 'true';
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Try to parse the body as JSON. Some 204s have no body.
  const text = await res.text();
  const parsed = text.length > 0
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;

  if (!res.ok) {
    const errBody: ApiErrorShape =
      parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error && typeof parsed.error === 'object'
        ? (parsed.error as ApiErrorShape)
        : { code: `HTTP_${res.status}`, message: res.statusText || 'Request failed' };
    throw new ApiError(res.status, errBody);
  }

  return (parsed ?? (undefined as unknown)) as T;
}

export const api = {
  get:   <T = unknown>(path: string)            => request<T>('GET', path),
  post:  <T = unknown>(path: string, body?: Body) => request<T>('POST', path, body),
  patch: <T = unknown>(path: string, body?: Body) => request<T>('PATCH', path, body),
  put:   <T = unknown>(path: string, body?: Body) => request<T>('PUT', path, body),
  del:   <T = unknown>(path: string)            => request<T>('DELETE', path),
};
