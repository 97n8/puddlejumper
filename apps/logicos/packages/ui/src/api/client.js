const BASE = import.meta.env.VITE_CASE_API_URL || 'http://localhost:3003';

function getToken() {
  return sessionStorage.getItem('logicos_token') || '';
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    'Content-Type': 'application/json',
    ...(method !== 'GET' ? { 'x-logicos-request': '1' } : {}),
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, method, headers });

  if (res.status === 401) {
    sessionStorage.removeItem('logicos_token');
    sessionStorage.removeItem('logicos_actor');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (res.status === 503) {
    throw new Error('ORG_MANAGER_INCOMPLETE');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  }

  return res.json();
}
