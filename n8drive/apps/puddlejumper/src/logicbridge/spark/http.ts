// spark.http — HTTP client for handler sandbox
// SSRF guard: block requests to private/metadata IP ranges

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local / AWS+GCP metadata
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // RFC 6598 CGNAT
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function assertNotPrivate(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error(`Disallowed host: ${host}`);
  }
  for (const range of PRIVATE_RANGES) {
    if (range.test(host)) {
      throw new Error(`Disallowed private/metadata address: ${host}`);
    }
  }
}

export interface SparkHttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
  body?: unknown;
}

export interface SparkHttpResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  _body: string;
  json(): unknown;
  text(): string;
}

function makeResponse(status: number, statusText: string, headers: Record<string, string>, body: string): SparkHttpResponse {
  return {
    status,
    statusText,
    ok: status >= 200 && status < 300,
    headers,
    _body: body,
    json() { return JSON.parse(this._body); },
    text() { return this._body; },
  };
}

async function doFetch(url: string, init: RequestInit, timeoutMs = 30_000): Promise<SparkHttpResponse> {
  assertNotPrivate(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return makeResponse(res.status, res.statusText, headers, body);
  } finally {
    clearTimeout(timer);
  }
}

export function createSparkHttp() {
  return {
    async get(url: string, opts: SparkHttpOptions = {}): Promise<SparkHttpResponse> {
      return doFetch(url, { method: 'GET', headers: opts.headers }, opts.timeout);
    },
    async post(url: string, body: unknown, opts: SparkHttpOptions = {}): Promise<SparkHttpResponse> {
      const isJson = body !== null && typeof body === 'object';
      const headers: Record<string, string> = {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      };
      return doFetch(url, {
        method: 'POST',
        headers,
        body: isJson ? JSON.stringify(body) : String(body ?? ''),
      }, opts.timeout);
    },
    async put(url: string, body: unknown, opts: SparkHttpOptions = {}): Promise<SparkHttpResponse> {
      const isJson = body !== null && typeof body === 'object';
      const headers: Record<string, string> = {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      };
      return doFetch(url, {
        method: 'PUT',
        headers,
        body: isJson ? JSON.stringify(body) : String(body ?? ''),
      }, opts.timeout);
    },
    async patch(url: string, body: unknown, opts: SparkHttpOptions = {}): Promise<SparkHttpResponse> {
      const isJson = body !== null && typeof body === 'object';
      const headers: Record<string, string> = {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      };
      return doFetch(url, {
        method: 'PATCH',
        headers,
        body: isJson ? JSON.stringify(body) : String(body ?? ''),
      }, opts.timeout);
    },
    async delete(url: string, opts: SparkHttpOptions = {}): Promise<SparkHttpResponse> {
      return doFetch(url, { method: 'DELETE', headers: opts.headers }, opts.timeout);
    },
  };
}
