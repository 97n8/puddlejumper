'use strict';
require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const { v4: uuidv4 } = require('uuid');

const { validateRule }  = require('./services/ruleValidator');
const { ingest }        = require('./services/ruleIngestionAgent');

const CASE_API_URL = process.env.CASE_API_URL || 'http://localhost:3003';
const app  = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers['x-logicos-request'] !== '1') {
    return res.status(403).json({ error: 'CSRF_REJECTED' });
  }
  next();
});

// AI-assisted rule ingest
app.post('/api/v1/rules/ingest', async (req, res) => {
  const { legal_text, jurisdiction_id } = req.body;
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!legal_text || !jurisdiction_id) {
    return res.status(400).json({ error: 'legal_text and jurisdiction_id required' });
  }
  try {
    const result = await ingest({ legal_text, jurisdiction_id, actor: { token } });
    res.status(201).json({ data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Activate rule (human-in-the-loop gate)
app.put('/api/v1/rules/:id/activate', async (req, res) => {
  const token   = (req.headers['authorization'] || '').replace('Bearer ', '');
  const ruleRes = await fetch(`${CASE_API_URL}/api/v1/rules/${req.params.id}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-logicos-request': '1' },
  });
  if (!ruleRes.ok) return res.status(ruleRes.status).json({ error: 'Rule not found' });
  const rule = (await ruleRes.json()).data;

  const common_catches = JSON.parse(rule.common_catches || '[]');
  if (common_catches.length === 0) {
    return res.status(422).json({
      error:   'ACTIVATION_BLOCKED',
      message: 'Rule cannot be activated without human-reviewed common_catches.',
    });
  }

  const validation = validateRule({
    conditions:     JSON.parse(rule.conditions || '[]'),
    actions:        JSON.parse(rule.actions || '[]'),
    common_catches,
    source_citation: rule.source_citation,
  });

  if (!validation.valid) {
    return res.status(422).json({ error: 'VALIDATION_FAILED', errors: validation.errors });
  }

  const updateRes = await fetch(`${CASE_API_URL}/api/v1/rules/${req.params.id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-logicos-request': '1' },
    body:    JSON.stringify({ status: 'active', published_by: req.body.actor_id }),
  });

  const updated = await updateRes.json().catch(() => ({}));
  res.json({ data: updated.data || { ok: true } });
});

app.listen(PORT, () => console.log(`[archieve] listening on :${PORT}`));
module.exports = app;
