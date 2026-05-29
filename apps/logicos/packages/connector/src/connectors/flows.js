import { pjFetch } from '../client.js';

export async function getFlows(jurisdiction_id) {
  return pjFetch(`/flows?jurisdiction_id=${jurisdiction_id}`);
}

export async function triggerFlow(flow_id, payload) {
  return pjFetch(`/flows/${flow_id}/trigger`, {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}
