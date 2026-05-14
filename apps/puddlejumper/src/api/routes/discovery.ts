// ── Discovery API ─────────────────────────────────────────────────────────────
//
// Compliance intake discovery — helps users identify what permit/license/case
// type they need based on a natural-language question.
//
// Routes:
//   POST /api/discover/query       ask a question, get case type + obligations
//   GET  /api/discover/rules       list discovery rules for caller's tenant
//   POST /api/discover/rules       create a discovery rule (admin only)
//   GET  /api/discover/history     last 20 queries for caller's tenant

import express from "express";
import Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";

const CASE_TYPES = ["permit", "license", "compliance", "grant", "records", "general"] as const;

const OPENAI_SYSTEM_PROMPT = `You are a compliance intake assistant for a government services platform. 
Given a user's question, determine:
1. The most likely case/permit type needed
2. A suggested title for the case
3. The key obligations (required steps/documents) the user will need to fulfill
4. Your confidence level (0-1)

Respond ONLY with valid JSON matching this schema:
{
  "caseType": "permit|license|compliance|grant|records|general",
  "suggestedTitle": "string (concise, e.g. 'Residential Shed Permit')",
  "obligations": [{"title": "string", "description": "string", "required": true|false}],
  "confidence": 0.0-1.0,
  "reasoning": "string (one sentence)"
}

Context rules for this jurisdiction:
{RULES_CONTEXT}`;

interface DiscoveryRule {
  id: string;
  tenant_id: string;
  jurisdiction_id: string | null;
  case_type: string;
  title: string;
  description: string;
  keywords: string;
  obligations: string;
  created_at: string;
  updated_at: string;
}

interface AiResult {
  caseType: string;
  suggestedTitle: string;
  obligations: { title: string; description: string; required: boolean }[];
  confidence: number;
  reasoning: string;
}

export function createDiscoveryRoutes(opts: { dbPath: string; openAiKey?: string }): express.Router {
  const db = new Database(opts.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_rules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      jurisdiction_id TEXT,
      case_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      obligations TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_drules_tenant ON discovery_rules(tenant_id, jurisdiction_id);

    CREATE TABLE IF NOT EXISTS discovery_queries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      question TEXT NOT NULL,
      jurisdiction_id TEXT,
      result_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const router = express.Router();

  router.use((req, res, next) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    (req as any)._auth = auth;
    next();
  });

  function authOf(req: express.Request) {
    const a = (req as any)._auth;
    return {
      tenantId: (a.tenantId ?? "default") as string,
      userId: (a.userId ?? a.sub ?? "") as string,
      role: (a.role ?? "") as string,
    };
  }

  function findMatchingRules(tenantId: string, jurisdictionId: string | undefined, question: string): DiscoveryRule[] {
    const rows = db.prepare(
      `SELECT * FROM discovery_rules
       WHERE tenant_id = ?
         AND (jurisdiction_id IS NULL OR jurisdiction_id = ?)
       ORDER BY created_at DESC`
    ).all(tenantId, jurisdictionId ?? null) as DiscoveryRule[];

    const lowerQ = question.toLowerCase();
    return rows.filter((rule) => {
      const keywords: string[] = JSON.parse(rule.keywords);
      return keywords.some((kw) => lowerQ.includes(kw.toLowerCase()));
    });
  }

  async function callOpenAi(question: string, rulesContext: string, apiKey: string): Promise<AiResult | null> {
    const systemPrompt = OPENAI_SYSTEM_PROMPT.replace("{RULES_CONTEXT}", rulesContext);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) return null;
      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as AiResult;
    } catch {
      return null;
    }
  }

  function fallbackFromRules(rules: DiscoveryRule[]): AiResult {
    if (rules.length === 0) {
      return {
        caseType: "general",
        suggestedTitle: "General Inquiry",
        obligations: [],
        confidence: 0.1,
        reasoning: "No matching rules found; defaulting to general case type.",
      };
    }
    const best = rules[0];
    return {
      caseType: CASE_TYPES.includes(best.case_type as any) ? best.case_type : "general",
      suggestedTitle: best.title,
      obligations: JSON.parse(best.obligations),
      confidence: 0.6,
      reasoning: `Matched rule: "${best.title}" based on keyword match.`,
    };
  }

  // POST /api/discover/query
  router.post("/discover/query", async (req, res) => {
    const { tenantId, userId } = authOf(req);
    const { question, jurisdictionId } = req.body ?? {};

    if (typeof question !== "string" || question.trim().length === 0) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    if (question.length > 500) {
      res.status(400).json({ error: "question must be 500 characters or fewer" });
      return;
    }

    const matchedRules = findMatchingRules(tenantId, jurisdictionId, question);

    const rulesContext = matchedRules.length > 0
      ? matchedRules.map((r) => `- ${r.title}: ${r.description} (type: ${r.case_type})`).join("\n")
      : "No specific rules on file for this jurisdiction.";

    const openAiKey = opts.openAiKey ?? process.env.OPENAI_API_KEY;

    let aiResult: AiResult | null = null;
    let source: "ai" | "rules" | "fallback";

    if (openAiKey) {
      aiResult = await callOpenAi(question, rulesContext, openAiKey);
      source = aiResult ? "ai" : "rules";
    } else {
      source = matchedRules.length > 0 ? "rules" : "fallback";
    }

    const result = aiResult ?? fallbackFromRules(matchedRules);

    const queryId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO discovery_queries (id, tenant_id, user_id, question, jurisdiction_id, result_json) VALUES (?,?,?,?,?,?)"
    ).run(queryId, tenantId, userId, question, jurisdictionId ?? null, JSON.stringify(result));

    res.json({
      queryId,
      caseType: result.caseType,
      suggestedTitle: result.suggestedTitle,
      obligations: result.obligations,
      jurisdiction: jurisdictionId ?? null,
      confidence: result.confidence,
      source,
    });
  });

  // GET /api/discover/rules
  router.get("/discover/rules", (req, res) => {
    const { tenantId } = authOf(req);
    const rows = db.prepare(
      "SELECT * FROM discovery_rules WHERE tenant_id = ? ORDER BY created_at DESC"
    ).all(tenantId) as DiscoveryRule[];

    const parsed = rows.map((r) => ({
      ...r,
      keywords: JSON.parse(r.keywords),
      obligations: JSON.parse(r.obligations),
    }));
    res.json({ rules: parsed });
  });

  // POST /api/discover/rules (admin only)
  router.post("/discover/rules", (req, res) => {
    const { tenantId, role } = authOf(req);
    if (role !== "admin" && role !== "owner") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const { jurisdictionId, caseType, title, description, keywords, obligations } = req.body ?? {};

    if (!caseType || !CASE_TYPES.includes(caseType)) {
      res.status(400).json({ error: `caseType must be one of: ${CASE_TYPES.join(", ")}` });
      return;
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (typeof description !== "string" || description.trim().length === 0) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    if (!Array.isArray(keywords)) {
      res.status(400).json({ error: "keywords must be an array of strings" });
      return;
    }
    if (!Array.isArray(obligations)) {
      res.status(400).json({ error: "obligations must be an array" });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO discovery_rules (id, tenant_id, jurisdiction_id, case_type, title, description, keywords, obligations)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      id,
      tenantId,
      jurisdictionId ?? null,
      caseType,
      title.trim(),
      description.trim(),
      JSON.stringify(keywords),
      JSON.stringify(obligations)
    );

    const row = db.prepare("SELECT * FROM discovery_rules WHERE id = ?").get(id) as DiscoveryRule;
    res.status(201).json({
      ...row,
      keywords: JSON.parse(row.keywords),
      obligations: JSON.parse(row.obligations),
    });
  });

  // GET /api/discover/history
  router.get("/discover/history", (req, res) => {
    const { tenantId } = authOf(req);
    const rows = db.prepare(
      `SELECT id, user_id, question, jurisdiction_id, result_json, created_at
       FROM discovery_queries
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    ).all(tenantId);

    const parsed = (rows as any[]).map((r) => ({
      ...r,
      result: r.result_json ? JSON.parse(r.result_json) : null,
      result_json: undefined,
    }));
    res.json({ queries: parsed });
  });

  return router;
}
