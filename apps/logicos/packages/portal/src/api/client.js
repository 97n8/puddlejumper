const CASE_API     = import.meta.env.VITE_CASE_API_URL     || 'http://localhost:3003';
const DISCOVERY    = import.meta.env.VITE_DISCOVERY_URL    || 'http://localhost:3004';
const FORMKEY      = import.meta.env.VITE_FORMKEY_URL      || 'http://localhost:3005';

function getToken() {
  return sessionStorage.getItem('logicos_entity_token') || '';
}

function checkExpiry() {
  const meta = JSON.parse(sessionStorage.getItem('logicos_entity_meta') || 'null');
  if (!meta) return false;
  return new Date(meta.expires_at) > new Date();
}

export async function portalFetch(base, path, options = {}) {
  if (getToken() && !checkExpiry()) {
    sessionStorage.removeItem('logicos_entity_token');
    sessionStorage.removeItem('logicos_entity_meta');
    window.location.href = '/case-lookup';
    throw new Error('Session expired');
  }

  const method  = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    'x-logicos-request': '1',
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...(method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${base}${path}`, { ...options, method, headers });

  if (res.status === 401) {
    window.location.href = '/case-lookup';
    throw new Error('Not authenticated');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  }

  return res.json();
}

export const caseApiFetch     = (path, opts) => portalFetch(CASE_API, path, opts);
export const discoveryFetch   = (path, opts) => portalFetch(DISCOVERY, path, opts);
export const formkeyFetch     = (path, opts) => portalFetch(FORMKEY, path, opts);
