'use strict';
require('dotenv').config();

const PJ_BASE_URL  = process.env.PJ_BASE_URL || 'http://localhost:3002';
const CASE_API_URL = process.env.CASE_API_URL || 'http://localhost:3003';

async function ingest({ legal_text, jurisdiction_id, actor }) {
  // Call PuddleJumper to extract structured rule JSON from legal text
  let extracted;
  try {
    const res = await fetch(`${PJ_BASE_URL}/api/v1/assistant/ask`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        intent:   { task: 'rule_extraction' },
        raw_text: legal_text,
      }),
    });
    if (!res.ok) throw new Error(`PJ responded ${res.status}`);
    const json = await res.json();
    extracted = json.data || json;
  } catch (err) {
    console.error('[ruleIngestionAgent] AI extraction failed:', err.message);
    throw Object.assign(new Error('AI extraction failed'), { status: 502 });
  }

  // Always draft — never active. Human activation required.
  const rulePayload = {
    ...extracted,
    status:         'draft',
    jurisdiction_id,
  };

  const createRes = await fetch(`${CASE_API_URL}/api/v1/rules`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1',
               Authorization: `Bearer ${actor.token}` },
    body:    JSON.stringify(rulePayload),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'Rule creation failed'), { status: createRes.status });
  }

  const created = await createRes.json();
  const rule_id = created.data?.id;

  // Append SEAL entry for AI ingest
  await fetch(`${CASE_API_URL}/api/v1/audit/ai-call`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1',
               Authorization: `Bearer ${actor.token}` },
    body:    JSON.stringify({ package_id: rule_id, jurisdiction_id }),
  }).catch(() => {});

  return { success: true, rule_id, status: 'draft', requires_review: true };
}

module.exports = { ingest };
