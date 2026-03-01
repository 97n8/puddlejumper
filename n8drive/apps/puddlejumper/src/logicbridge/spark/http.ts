// spark.http — HTTP client for handler sandbox

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
