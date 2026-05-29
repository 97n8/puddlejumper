import { pjFetch } from '../client.js';

export async function getDashboard(jurisdiction_id) {
  return pjFetch(`/dashboard?jurisdiction_id=${jurisdiction_id}`);
}

export async function getDashboardMetrics(jurisdiction_id) {
  return pjFetch(`/dashboard/metrics?jurisdiction_id=${jurisdiction_id}`);
}
