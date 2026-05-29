import { pjFetch } from '../client.js';

export async function ask({ intent, rules, raw_query }) {
  return pjFetch('/assistant/ask', {
    method: 'POST',
    body:   JSON.stringify({ intent, rules, raw_query }),
  });
}
