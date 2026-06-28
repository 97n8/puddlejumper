import 'dotenv/config';

const PJ_BASE_URL     = process.env.PJ_BASE_URL     || 'http://localhost:3002';
const PJ_API_VERSION  = process.env.PJ_API_VERSION  || 'v1';
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';

export async function pjFetch(path, options = {}) {
  const url = `${PJ_BASE_URL}/api/${PJ_API_VERSION}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${CONNECTOR_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `PJ ${res.status}`), { status: res.status, body });
  }
  return res.json();
}
