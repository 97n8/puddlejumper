'use strict';
require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const { compose } = require('./services/answerComposer');

const app  = express();
const PORT = process.env.PORT || 3004;
const CASE_API_URL = process.env.CASE_API_URL || 'http://localhost:3003';

app.use(helmet());
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, max: 30 }));
app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers['x-logicos-request'] !== '1') {
    return res.status(403).json({ error: 'CSRF_REJECTED' });
  }
  next();
});

app.post('/api/v1/discover/query', async (req, res) => {
  const { raw_query, address, parcel_id, jurisdiction_slug, case_type } = req.body;
  if (!raw_query) return res.status(400).json({ error: 'raw_query required' });

  const query_id = uuidv4();
  const intent   = { case_type: case_type || null };

  try {
    // Fetch active rules from case-api
    const slugParam = jurisdiction_slug ? `?jurisdiction_slug=${encodeURIComponent(jurisdiction_slug)}` : '';
    const rulesRes  = await fetch(`${CASE_API_URL}/api/v1/rules${slugParam}`, {
      headers: { 'x-logicos-request': '1' },
    });
    const rulesJson = await rulesRes.json();
    const rules     = Array.isArray(rulesJson.data) ? rulesJson.data : [];

    const answer = await compose({ intent, rules, raw_query });

    // Persist query to case-api
    await fetch(`${CASE_API_URL}/api/v1/discover/log`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
      body:    JSON.stringify({
        id: query_id, raw_query, address, parcel_id,
        jurisdiction_slug, mapped_rules: rules.map(r => r.id),
        answer_summary: answer.plain, answer_source: answer.answer_source,
        confidence: answer.confidence,
      }),
    }).catch(() => {});

    res.json({
      data: {
        query_id,
        answer,
        rules_in_scope:  rules,
        can_create_case: rules.length > 0,
        case_type:       case_type || null,
      },
    });
  } catch (err) {
    console.error('[discovery] error:', err.message);
    res.status(500).json({ error: 'DISCOVERY_ERROR', message: err.message });
  }
});

app.listen(PORT, () => console.log(`[discovery] listening on :${PORT}`));
module.exports = app;
