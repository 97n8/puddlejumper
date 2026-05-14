/**
 * PuddleJumper API Server
 * 
 * Express backend — slot for existing PJ codebase.
 * Drop existing routes, middleware, and domain logic into
 * the appropriate directories:
 * 
 *   src/routes/      → Express route handlers
 *   src/middleware/   → Auth, tenant binding, audit middleware
 *   src/services/    → Business logic services
 *   src/domains/     → Domain modules (12 domains, 60+ MCP tools)
 *   db/migrations/   → SQLite schema migrations
 *   db/seeds/        → Seed data
 * 
 * Architecture rules (enforced):
 *   - SQLite everywhere (better-sqlite3, WAL mode)
 *   - Append-only audit_events (SQLite trigger-enforced)
 *   - Tenant binding on every query
 *   - AI assists, never decides
 *   - No "wren" anywhere in new code
 * 
 * // GPR
 */

import express, { type Express } from "express";
import cors from "cors";
import { auditMiddleware } from "./middleware/audit.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { healthRouter } from "./routes/health.js";

const app: Express = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ── Core middleware ──
app.use(cors());
app.use(express.json());
app.use(tenantMiddleware);
app.use(auditMiddleware);

// ── Routes ──
app.use("/api/health", healthRouter);

// Slot: import and mount your existing domain routers here
// app.use("/api/flows", flowsRouter);
// app.use("/api/vault", vaultRouter);
// app.use("/api/org", orgManagerRouter);
// app.use("/api/sync8", sync8Router);
// app.use("/api/audit", auditRouter);
// app.use("/api/mcp", mcpRouter);

app.listen(PORT, () => {
  console.log(`[PJ API] Runtime active on :${PORT}`);
});

export default app;
