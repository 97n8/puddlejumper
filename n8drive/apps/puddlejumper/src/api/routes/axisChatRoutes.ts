// ── Axis Chat Routes ─────────────────────────────────────────────────────────
//
// Stores AI provider API keys per workspace and proxies chat completions.
//
//   PUT  /api/v1/axis/keys      - save OpenAI / Anthropic keys for this workspace
//   GET  /api/v1/axis/keys      - get key status (masked, not the raw values)
//   POST /api/v1/axis/chat      - stream/complete a chat message via stored key
//
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import { z } from "zod";

const KeysSchema = z.strictObject({
  openai: z.string().max(200).optional(),
  anthropic: z.string().max(200).optional(),
});

const ChatSchema = z.strictObject({
  model: z.enum(["claude-opus", "gpt-4.1"]),
  messages: z.array(z.strictObject({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().max(32000),
  })).min(1).max(100),
});

function keysPath(dataDir: string, workspaceId: string) {
  const dir = path.join(dataDir, "axis");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${workspaceId}.json`);
}

function loadKeys(dataDir: string, workspaceId: string): { openai?: string; anthropic?: string } {
  try {
    return JSON.parse(fs.readFileSync(keysPath(dataDir, workspaceId), "utf8"));
  } catch { return {}; }
}

function saveKeys(dataDir: string, workspaceId: string, keys: { openai?: string; anthropic?: string }) {
  const existing = loadKeys(dataDir, workspaceId);
  const merged = {
    ...(keys.openai !== undefined ? { openai: keys.openai || undefined } : { openai: existing.openai }),
    ...(keys.anthropic !== undefined ? { anthropic: keys.anthropic || undefined } : { anthropic: existing.anthropic }),
  };
  // Remove undefined keys
  if (!merged.openai) delete merged.openai;
  if (!merged.anthropic) delete merged.anthropic;
  fs.writeFileSync(keysPath(dataDir, workspaceId), JSON.stringify(merged));
}

function mask(key: string | undefined): string | null {
  if (!key) return null;
  return key.slice(0, 7) + "…" + key.slice(-4);
}

export function createAxisChatRoutes(): express.Router {
  const router = express.Router();
  const dataDir = process.env.DATA_DIR || "./data";

  function resolveWorkspace(req: express.Request) {
    const auth = getAuthContext(req);
    if (!auth) return null;
    const raw = auth.workspaceId ?? auth.tenantId ?? auth.sub;
    return raw?.startsWith("ws-") ? raw : `ws-${raw}`;
  }

  // GET /api/v1/axis/keys — return masked key status
  router.get("/v1/axis/keys", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const workspaceId = resolveWorkspace(req);
    if (!workspaceId) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const keys = loadKeys(dataDir, workspaceId);
    res.json({
      success: true, correlationId,
      status: {
        openai: { connected: !!keys.openai, masked: mask(keys.openai) },
        anthropic: { connected: !!keys.anthropic, masked: mask(keys.anthropic) },
      }
    });
  });

  // PUT /api/v1/axis/keys — save keys
  router.put("/v1/axis/keys", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const workspaceId = resolveWorkspace(req);
    if (!workspaceId) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const parsed = KeysSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, correlationId, error: "Invalid body" }); return; }
    saveKeys(dataDir, workspaceId, parsed.data);
    res.json({ success: true, correlationId });
  });

  // POST /api/v1/axis/chat — proxy to AI provider
  router.post("/v1/axis/chat", requireAuthenticated(), async (req, res) => {
    const correlationId = getCorrelationId(res);
    const workspaceId = resolveWorkspace(req);
    if (!workspaceId) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, correlationId, error: "Invalid body" }); return; }

    const { model, messages } = parsed.data;
    const keys = loadKeys(dataDir, workspaceId);

    try {
      if (model === "gpt-4.1") {
        if (!keys.openai) { res.status(402).json({ success: false, correlationId, error: "OpenAI key not configured" }); return; }
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` },
          body: JSON.stringify({ model: "gpt-4.1", messages, max_tokens: 1024 }),
        });
        if (!upstream.ok) {
          const err = await upstream.text();
          res.status(upstream.status).json({ success: false, correlationId, error: `OpenAI error: ${err.slice(0, 200)}` });
          return;
        }
        const data = await upstream.json() as any;
        res.json({ success: true, correlationId, content: data.choices[0].message.content });
      } else {
        // claude-opus
        if (!keys.anthropic) { res.status(402).json({ success: false, correlationId, error: "Anthropic key not configured" }); return; }
        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keys.anthropic,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-opus-4-5",
            max_tokens: 1024,
            messages: messages.filter(m => m.role !== "system"),
            system: messages.find(m => m.role === "system")?.content,
          }),
        });
        if (!upstream.ok) {
          const err = await upstream.text();
          res.status(upstream.status).json({ success: false, correlationId, error: `Anthropic error: ${err.slice(0, 200)}` });
          return;
        }
        const data = await upstream.json() as any;
        res.json({ success: true, correlationId, content: data.content[0].text });
      }
    } catch (e: any) {
      res.status(502).json({ success: false, correlationId, error: e?.message ?? "Upstream error" });
    }
  });

  return router;
}
