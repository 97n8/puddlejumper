import { pjFetch } from '../client.js';

export async function getWatchFlags(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return pjFetch(`/watch/flags${qs ? '?' + qs : ''}`);
}
