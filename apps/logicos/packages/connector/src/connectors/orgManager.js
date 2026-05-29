import { pjFetch } from '../client.js';

export async function getOrgManagerStatus(jurisdiction_id) {
  return pjFetch(`/org-manager/status?jurisdiction_id=${jurisdiction_id}`);
}

export async function updateOrgManager(jurisdiction_id, payload) {
  return pjFetch('/org-manager/update', {
    method: 'POST',
    body:   JSON.stringify({ jurisdiction_id, ...payload }),
  });
}
