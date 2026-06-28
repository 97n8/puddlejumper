'use strict';
require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { getDb, queryOne, queryAll, queryRun, transaction } = require('./db/adapter');
const { validate }            = require('./middleware/validate');
const { auth }                = require('./middleware/auth');
const { entityAuth }          = require('./middleware/entityAuth');
const { orgGate }             = require('./middleware/orgGate');
const { jurisdictionScope }   = require('./middleware/jurisdictionScope');
const { issueStaffToken, validateToken } = require('./domains/auth/authService');
const { lookup: entityLookup } = require('./domains/auth/entityAuthService');
const auditLog                = require('./domains/audit/auditLog');
const { validateAdvance }     = require('./domains/cases/stageEngine');
const { generateCaseNumber }  = require('./domains/cases/caseNumber');
const { scheduleObligationTask } = require('./services/pulseClient');
const {
  CaseSpaceResolutionAuditSchema,
  CreateCaseSchema, CreateObligationSchema,
  CreateActionSchema, EntityLookupSchema, StaffAuthSchema,
} = require('./validation/schemas');

const app = express();
const PORT = process.env.PORT || 3003;
const DISCOVERY_URL = process.env.DISCOVERY_URL || 'http://localhost:3004';

const allowedOrigins = [
  process.env.UI_ORIGIN     || 'http://localhost:5173',
  process.env.PORTAL_ORIGIN || 'http://localhost:5174',
];

// 1. helmet
app.use(helmet());

// 2. cors
app.use(cors({ origin: allowedOrigins, credentials: true }));

// 3. Rate limiters
app.use('/api/v1/discover', rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/v1/entity/lookup', rateLimit({ windowMs: 15 * 60_000, max: 10 }));
app.use('/api/v1/auth/token', rateLimit({ windowMs: 15 * 60_000, max: 20 }));
app.use('/api/v1/auth/sso', rateLimit({ windowMs: 15 * 60_000, max: 20 }));

// 4. Body parsing
app.use(express.json());

// 5. CSRF check
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers['x-logicos-request'] !== '1') {
    return res.status(403).json({ error: 'CSRF_REJECTED', message: 'Missing x-logicos-request header.' });
  }
  next();
});

// 6. Jurisdiction scope
app.use('/api/v1', (req, res, next) => jurisdictionScope(req, res, next));

// ── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/v1/auth/token', validate(StaffAuthSchema), async (req, res) => {
  const { email, password } = req.body;
  const cred = queryOne('SELECT * FROM credentials WHERE email = ?', [email]);
  if (!cred) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const match = await bcrypt.compare(password, cred.password_hash);
  if (!match) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const actor = queryOne('SELECT * FROM objects WHERE id = ?', [cred.object_id]);
  const token = issueStaffToken({ id: actor.id, jurisdiction_id: actor.jurisdiction_id, role: cred.role });

  const now = new Date().toISOString();
  queryRun('UPDATE credentials SET last_login_at = ? WHERE id = ?', [now, cred.id]);
  res.json({ data: { token } });
});

app.get('/api/v1/auth/sso', (req, res) => {
  // SSO redirect stub — wire M365/Google OAuth in production
  res.status(501).json({ error: 'SSO_NOT_CONFIGURED', message: 'Configure SSO credentials in .env' });
});

app.get('/api/v1/auth/sso/callback', (req, res) => {
  res.status(501).json({ error: 'SSO_NOT_CONFIGURED', message: 'Configure SSO credentials in .env' });
});

// ── Entity auth ──────────────────────────────────────────────────────────────

app.post('/api/v1/entity/lookup', validate(EntityLookupSchema), async (req, res) => {
  const { email, case_number } = req.body;
  const jurisdiction_id = req.scope?.jurisdiction_id;
  if (!jurisdiction_id) return res.status(400).json({ error: 'JURISDICTION_REQUIRED' });
  try {
    const result = await entityLookup({ email, case_number, jurisdiction_id });
    res.json({ data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Org Manager ──────────────────────────────────────────────────────────────

app.get('/api/v1/org-manager/status', auth, (req, res) => {
  const cfg = queryOne('SELECT * FROM org_config WHERE jurisdiction_id = ?', [req.actor.jurisdiction_id]);
  res.json({ data: cfg || null });
});

app.post('/api/v1/org-manager/town', auth, (req, res) => {
  const { name, state, slug, timezone, fiscal_year_start } = req.body;
  const jid = req.actor.jurisdiction_id;
  const now = new Date().toISOString();
  queryRun('UPDATE jurisdictions SET name=?, state=?, slug=?, timezone=?, fiscal_year_start=?, updated_at=? WHERE id=?',
    [name, state, slug, timezone || 'America/New_York', fiscal_year_start || '07-01', now, jid]);
  queryRun('UPDATE org_config SET town_complete=1, setup_step=2, updated_at=? WHERE jurisdiction_id=?', [now, jid]);
  res.json({ data: { ok: true } });
});

app.get('/api/v1/org-manager/identity', auth, (req, res) => {
  const jur = queryOne('SELECT * FROM jurisdictions WHERE id = ?', [req.actor.jurisdiction_id]);
  res.json({ data: jur });
});

app.post('/api/v1/org-manager/staff', auth, async (req, res) => {
  const { email, password, name } = req.body;
  const jid = req.actor.jurisdiction_id;
  const now = new Date().toISOString();
  const actorId = uuidv4();
  const credId  = uuidv4();
  const hash    = await bcrypt.hash(password, 10);
  try {
    transaction(() => {
      queryRun(`INSERT INTO objects (id,jurisdiction_id,object_type,subtype,status,created_at,created_by,updated_at,updated_by,data)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [actorId, jid, 'actor', 'staff', 'active', now, req.actor.actor_id, now, req.actor.actor_id, JSON.stringify({ name })]);
      queryRun(`INSERT INTO credentials (id,object_id,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)`,
        [credId, actorId, email, hash, 'staff', now]);
      queryRun('UPDATE org_config SET staff_complete=1, setup_step=4, updated_at=? WHERE jurisdiction_id=?', [now, jid]);
    });
    res.json({ data: { actor_id: actorId } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/org-manager/bodies', auth, (req, res) => {
  const now = new Date().toISOString();
  queryRun('UPDATE org_config SET bodies_complete=1, setup_step=5, updated_at=? WHERE jurisdiction_id=?',
    [now, req.actor.jurisdiction_id]);
  res.json({ data: { ok: true } });
});

app.post('/api/v1/org-manager/connectors', auth, (req, res) => {
  const { connector_token } = req.body;
  const now = new Date().toISOString();
  queryRun('UPDATE org_config SET connectors_complete=1, connector_token=?, setup_step=6, updated_at=? WHERE jurisdiction_id=?',
    [connector_token || null, now, req.actor.jurisdiction_id]);
  res.json({ data: { ok: true } });
});

app.post('/api/v1/org-manager/complete', auth, (req, res) => {
  const now = new Date().toISOString();
  queryRun('UPDATE org_config SET complete=1, updated_at=? WHERE jurisdiction_id=?',
    [now, req.actor.jurisdiction_id]);
  queryRun('UPDATE jurisdictions SET setup_complete=1, updated_at=? WHERE id=?',
    [now, req.actor.jurisdiction_id]);
  res.json({ data: { ok: true } });
});

// ── Cases ────────────────────────────────────────────────────────────────────

function authOrEntity(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.actor = validateToken(token);
    return next();
  } catch {
    return entityAuth(req, res, next);
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.actor = validateToken(token);
  } catch {
    req.actor = null;
  }
  next();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRulePayload(body = {}) {
  const id = body.id || uuidv4();
  const now = new Date().toISOString();
  return {
    id,
    jurisdiction_id: body.jurisdiction_id || body.jurisdictionId || null,
    rule_key: body.rule_key || body.ruleKey || `rule-${id.slice(0, 8)}`,
    version: body.version || '1.0.0',
    description: body.description || 'Generated rule draft',
    source_citation: body.source_citation || body.sourceCitation || null,
    conditions: JSON.stringify(parseJsonArray(body.conditions)),
    actions: JSON.stringify(parseJsonArray(body.actions)),
    common_catches: JSON.stringify(parseJsonArray(body.common_catches || body.commonCatches)),
    status: body.status || 'draft',
    published_by: body.published_by || body.publishedBy || null,
    published_at: body.published_at || body.publishedAt || null,
    created_at: body.created_at || now,
    updated_at: now,
  };
}

app.post('/api/v1/cases', authOrEntity, validate(CreateCaseSchema), (req, res) => {
  const db  = getDb();
  const jid = req.scope?.jurisdiction_id || req.actor?.jurisdiction_id;
  if (!jid) return res.status(400).json({ error: 'JURISDICTION_REQUIRED' });

  const { case_type, description, address, parcel_id, rule_refs, idempotency_key } = req.body;
  const now = new Date().toISOString();

  // 1. Idempotency
  if (idempotency_key) {
    const existing = queryOne('SELECT * FROM cases WHERE idempotency_key = ?', [idempotency_key]);
    if (existing) return res.json({ data: existing });
  }

  const jur = queryOne('SELECT * FROM jurisdictions WHERE id = ?', [jid]);
  if (!jur) return res.status(404).json({ error: 'JURISDICTION_NOT_FOUND' });

  const case_number = generateCaseNumber(db, jid, jur.slug);
  const case_id     = uuidv4();

  transaction(() => {
    queryRun(
      `INSERT INTO cases (id,jurisdiction_id,case_number,case_type,stage,status,
        description,address,parcel_id,rule_refs,idempotency_key,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [case_id, jid, case_number, case_type, 'RECEIVES', 'open',
       description || null, address || null, parcel_id || null,
       JSON.stringify(rule_refs || []), idempotency_key || null, now, now]
    );

    // 4. Create obligations for each rule_ref
    for (const rule_id of (rule_refs || [])) {
      const rule = queryOne('SELECT * FROM rules WHERE id = ?', [rule_id]);
      if (!rule) continue;
      const actions = JSON.parse(rule.actions || '[]');
      for (const action of actions) {
        if (action.type === 'require') {
          const obl_id    = uuidv4();
          const due_date  = action.dueDays
            ? new Date(Date.now() + action.dueDays * 86400000).toISOString()
            : null;
          queryRun(
            `INSERT INTO obligations (id,case_id,rule_id,description,assigned_side,due_date,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [obl_id, case_id, rule_id, `${action.object || 'permit'} required`, 'B', due_date, now, now]
          );
          scheduleObligationTask({ obligation_id: obl_id, case_id, due_date, assigned_to: null, assigned_side: 'B' })
            .catch(() => {});
        }
      }
    }
  });

  // 5. Audit log
  const actor     = req.actor?.actor_id || req.entity?.entity_id || 'system';
  const actorType = req.actor ? 'staff' : req.entity ? 'entity' : 'system';
  auditLog.appendCaseAction(db, { case_id, action_type: 'case_opened', actor, actor_type: actorType, payload: {} });

  const created = queryOne('SELECT * FROM cases WHERE id = ?', [case_id]);
  res.status(201).json({ data: created });
});

app.post('/api/v1/discover/query', async (req, res) => {
  try {
    const response = await fetch(`${DISCOVERY_URL}/api/v1/discover/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
      body: JSON.stringify(req.body || {}),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json(payload || { error: 'DISCOVERY_ERROR' });
    }
    res.json(payload || {});
  } catch (err) {
    res.status(502).json({ error: 'DISCOVERY_UNAVAILABLE', message: err.message });
  }
});

app.post('/api/v1/discover/log', (req, res) => {
  const {
    id, raw_query, address, parcel_id, mapped_rules,
    answer_summary, answer_source, confidence, common_catches, case_id, entity_id,
  } = req.body || {};
  if (!id || !raw_query) {
    return res.status(400).json({ error: 'INVALID_DISCOVERY_LOG' });
  }

  queryRun(
    `INSERT INTO discovery_queries
      (id, jurisdiction_id, entity_id, raw_query, address, parcel_id, mapped_rules,
       answer_summary, answer_source, confidence, common_catches, case_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      req.scope?.jurisdiction_id || null,
      entity_id || null,
      raw_query,
      address || null,
      parcel_id || null,
      JSON.stringify(Array.isArray(mapped_rules) ? mapped_rules : []),
      answer_summary || null,
      answer_source || null,
      typeof confidence === 'number' ? confidence : null,
      JSON.stringify(Array.isArray(common_catches) ? common_catches : []),
      case_id || null,
      new Date().toISOString(),
    ]
  );

  res.status(201).json({ data: { ok: true } });
});

app.get('/api/v1/cases', authOrEntity, (req, res) => {
  const jid = req.scope?.jurisdiction_id || req.actor?.jurisdiction_id;
  if (!jid) return res.status(400).json({ error: 'JURISDICTION_REQUIRED' });
  const cases = queryAll('SELECT * FROM cases WHERE jurisdiction_id = ? ORDER BY created_at DESC', [jid]);
  res.json({ data: cases });
});

app.get('/api/v1/cases/:id', authOrEntity, (req, res) => {
  const row = queryOne('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ data: row });
});

app.post('/api/v1/cases/:id/actions', authOrEntity, validate(CreateActionSchema), (req, res) => {
  const db  = getDb();
  const row = queryOne('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });

  const jid = req.scope?.jurisdiction_id || req.actor?.jurisdiction_id;
  if (jid && row.jurisdiction_id !== jid) return res.status(403).json({ error: 'FORBIDDEN' });

  const { action_type, side, description, metadata } = req.body;
  const now       = new Date().toISOString();
  const action_id = uuidv4();
  const performer = req.actor?.actor_id || req.entity?.entity_id || 'system';
  const perf_type = req.actor ? 'actor' : req.entity ? 'entity' : 'system';

  queryRun(
    `INSERT INTO case_actions (id,case_id,action_type,performed_by,performer_type,side,description,metadata,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [action_id, row.id, action_type, performer, perf_type, side, description || null, JSON.stringify(metadata || {}), now]
  );

  auditLog.appendCaseAction(db, { case_id: row.id, action_type, actor: performer, actor_type: perf_type, payload: {} });

  // Attempt stage advance on approval/denial
  if (action_type === 'approval' || action_type === 'denial') {
    validateAdvance(db, { case_id: row.id, from_stage: row.stage, to_stage: 'RECORDS', actor_id: performer });
  }

  res.status(201).json({ data: queryOne('SELECT * FROM case_actions WHERE id = ?', [action_id]) });
});

app.post('/api/v1/cases/:id/obligations', auth, validate(CreateObligationSchema), (req, res) => {
  const row = queryOne('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });

  const { description, assigned_side, rule_id, due_date, assigned_to, idempotency_key } = req.body;
  const now    = new Date().toISOString();
  const obl_id = uuidv4();

  if (idempotency_key) {
    const existing = queryOne('SELECT * FROM obligations WHERE idempotency_key = ?', [idempotency_key]);
    if (existing) return res.json({ data: existing });
  }

  queryRun(
    `INSERT INTO obligations (id,case_id,rule_id,description,assigned_side,due_date,assigned_to,idempotency_key,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [obl_id, row.id, rule_id || null, description, assigned_side, due_date || null, assigned_to || null, idempotency_key || null, now, now]
  );

  scheduleObligationTask({ obligation_id: obl_id, case_id: row.id, due_date, assigned_to, assigned_side }).catch(() => {});

  res.status(201).json({ data: queryOne('SELECT * FROM obligations WHERE id = ?', [obl_id]) });
});

app.get('/api/v1/cases/:id/obligations', authOrEntity, (req, res) => {
  const obls = queryAll('SELECT * FROM obligations WHERE case_id = ? ORDER BY created_at ASC', [req.params.id]);
  res.json({ data: obls });
});

app.post('/api/v1/cases/:id/submissions', authOrEntity, (req, res) => {
  const row = queryOne('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  const now   = new Date().toISOString();
  const sub_id = uuidv4();
  const { form_id, obligation_id, data } = req.body;
  const submitter = req.entity?.entity_id || req.actor?.actor_id || null;
  queryRun(
    `INSERT INTO submissions (id,case_id,obligation_id,form_id,submitted_by,submitted_at,data,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [sub_id, row.id, obligation_id || null, form_id || 'default', submitter, now, JSON.stringify(data || {}), now, now]
  );
  res.status(201).json({ data: queryOne('SELECT * FROM submissions WHERE id = ?', [sub_id]) });
});

app.post('/api/v1/cases/:id/documents', authOrEntity, (req, res) => {
  const row = queryOne('SELECT * FROM cases WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  const { doc_id, checksum, stored_at, doc_type, vault_class, submission_id, uploader_type } = req.body;
  const uploader = req.entity?.entity_id || req.actor?.actor_id || 'system';
  const now = new Date().toISOString();
  queryRun(
    `INSERT INTO documents (id,case_id,submission_id,uploaded_by,uploader_type,doc_type,filename,checksum,stored_at,vault_class,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [doc_id || uuidv4(), row.id, submission_id || null, uploader, uploader_type || 'entity',
     doc_type || 'upload', stored_at || now, checksum || '', stored_at || now,
     vault_class || 'internal', now]
  );
  res.status(201).json({ data: { ok: true } });
});

// ── Rules ────────────────────────────────────────────────────────────────────

app.get('/api/v1/rules', (req, res) => {
  const jid = req.scope?.jurisdiction_id;
  const rules = queryAll(
    `SELECT * FROM rules
     WHERE (jurisdiction_id = ? OR jurisdiction_id IS NULL) AND status = 'active'
     ORDER BY CASE WHEN jurisdiction_id IS NOT NULL THEN 0 ELSE 1 END ASC, created_at DESC`,
    [jid || null]
  );
  res.json({ data: rules });
});

app.get('/api/v1/rules/:id', auth, (req, res) => {
  const rule = queryOne('SELECT * FROM rules WHERE id = ?', [req.params.id]);
  if (!rule) return res.status(404).json({ error: 'NOT_FOUND' });
  if (rule.jurisdiction_id && rule.jurisdiction_id !== req.actor.jurisdiction_id) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  res.json({ data: rule });
});

app.post('/api/v1/rules', auth, (req, res) => {
  const payload = normalizeRulePayload({
    ...req.body,
    jurisdiction_id: req.body?.jurisdiction_id || req.actor.jurisdiction_id,
  });
  queryRun(
    `INSERT INTO rules
      (id, jurisdiction_id, rule_key, version, description, source_citation,
       conditions, actions, common_catches, status, published_by, published_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      payload.id,
      payload.jurisdiction_id,
      payload.rule_key,
      payload.version,
      payload.description,
      payload.source_citation,
      payload.conditions,
      payload.actions,
      payload.common_catches,
      payload.status,
      payload.published_by,
      payload.published_at,
      payload.created_at,
      payload.updated_at,
    ]
  );
  res.status(201).json({ data: queryOne('SELECT * FROM rules WHERE id = ?', [payload.id]) });
});

app.patch('/api/v1/rules/:id', auth, (req, res) => {
  const current = queryOne('SELECT * FROM rules WHERE id = ?', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'NOT_FOUND' });
  if (current.jurisdiction_id && current.jurisdiction_id !== req.actor.jurisdiction_id) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const merged = normalizeRulePayload({
    ...current,
    ...req.body,
    id: current.id,
    jurisdiction_id: current.jurisdiction_id,
    created_at: current.created_at,
  });

  queryRun(
    `UPDATE rules
     SET rule_key=?, version=?, description=?, source_citation=?, conditions=?, actions=?,
         common_catches=?, status=?, published_by=?, published_at=?, updated_at=?
     WHERE id=?`,
    [
      merged.rule_key,
      merged.version,
      merged.description,
      merged.source_citation,
      merged.conditions,
      merged.actions,
      merged.common_catches,
      merged.status,
      merged.published_by,
      merged.published_at,
      merged.updated_at,
      current.id,
    ]
  );

  res.json({ data: queryOne('SELECT * FROM rules WHERE id = ?', [current.id]) });
});

app.post('/api/v1/audit/ai-call', auth, (req, res) => {
  const { package_id, jurisdiction_id } = req.body || {};
  if (!package_id) return res.status(400).json({ error: 'package_id required' });
  const db = getDb();
  const entry = auditLog.appendAICall(db, {
    package_id,
    actor: req.actor.actor_id,
    jurisdiction_id: jurisdiction_id || req.actor.jurisdiction_id,
  });
  res.status(201).json({ data: entry });
});

app.post('/api/v1/audit/casespace-resolution', optionalAuth, validate(CaseSpaceResolutionAuditSchema), (req, res) => {
  const db = getDb();
  const actor = req.actor?.actor_id || req.body.actor || 'anonymous';
  const actorType = req.actor || req.body.actor ? 'staff' : 'system';
  const entry = auditLog.appendCaseSpaceResolution(db, {
    requested_id: req.body.requested_id,
    outcome: req.body.outcome,
    actor,
    actor_type: actorType,
    request_scope: req.body.request_scope || req.scope?.jurisdiction_id || null,
    jurisdiction_id: req.actor?.jurisdiction_id || req.scope?.jurisdiction_id || null,
  });
  res.status(201).json({ data: entry });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`[case-api] listening on :${PORT}`));
module.exports = app;
