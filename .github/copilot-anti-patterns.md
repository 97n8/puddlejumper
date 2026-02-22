# Copilot Anti-Patterns

Concrete mistakes to avoid in this codebase. Each entry shows what not to do and why.

---

## Rule of Interpretation

If a refactor would:
- Simplify error handling
- Collapse response envelopes
- Remove workspace scoping
- Replace wrappers with native primitives
- Inline logic that exists for security or durability

**Assume the refactor is wrong unless explicitly requested.**

These patterns exist for reasons that aren't always visible in the immediate context — CSRF protection, multi-tenant isolation, structured observability, SQLite durability guarantees. "Simpler" code that removes them is not an improvement.

---

## Logging

**Don't** use bare `console.log` / `console.error` in route or engine code.

```ts
// ❌
console.error("Something went wrong:", err);
console.log("User logged in");
```

**Do** use the structured logging helpers from `serverMiddleware.ts`, which emit JSON with `correlationId`, `scope`, and `timestamp`.

```ts
// ✅
import { logServerError, logServerInfo } from "../serverMiddleware.js";
logServerError("approvals.decide", correlationId, err);
logServerInfo("auth.login", correlationId, { userId: user.id });
```

Raw `console.*` is only acceptable in `serverMiddleware.ts` itself (behind `// eslint-disable-next-line no-console`) and at server startup/shutdown in `server.ts`.

---

## API Response Shape

**Don't** return bare error strings or data without the envelope.

```ts
// ❌
res.status(400).json({ error: "Invalid input" });
res.json(rows);
```

**Do** always include `success` and `correlationId` in every response.

```ts
// ✅
const correlationId = getCorrelationId(res);
res.status(400).json({ success: false, correlationId, error: "Invalid input" });
res.json({ success: true, correlationId, data: rows });
```

---

## Auth Context

**Don't** use `getAuthContext` without a null check, and don't trust request body for workspace scope.

```ts
// ❌
const auth = getAuthContext(req);
const workspaceId = req.body.workspaceId; // attacker-controlled
store.query({ workspaceId });
```

**Do** check for null and always extract `workspaceId` from the JWT.

```ts
// ✅
const auth = getAuthContext(req);
if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
const workspaceId = auth.workspaceId; // from verified JWT
store.query({ workspaceId });
```

---

## Frontend Fetch

**Don't** call `fetch()` directly from frontend pages — it skips CSRF, credentials, and token refresh.

```ts
// ❌
const res = await fetch("/api/approvals", { method: "POST", body: JSON.stringify(data) });
```

**Do** use the `pjFetch` wrapper from `web/src/lib/pjFetch.ts`.

```ts
// ✅
import { pjFetch } from "../../lib/pjFetch";
const res = await pjFetch("/api/approvals", { method: "POST", body: JSON.stringify(data) });
```

`pjFetch` automatically adds `X-PuddleJumper-Request`, `credentials: "include"`, and handles 401 → silent refresh → retry.

---

## Inline Styles and Scripts in HTML

**Don't** add `style="..."` attributes or `<script>` blocks with inline content to backend HTML. The CSP (`script-src 'self'`, `style-src 'self' https://fonts.googleapis.com`) will block them silently.

```html
<!-- ❌ -->
<div style="display:flex;gap:8px;">...</div>
<script>window.doThing();</script>
```

**Do** add a CSS class to the relevant stylesheet in `public/styles/` and reference external JS from `public/scripts/`.

```html
<!-- ✅ -->
<div class="action-row">...</div>
<script src="/pj/scripts/thing.js"></script>
```

Never add `'unsafe-inline'` to the CSP to work around this.

---

## SQLite Stores

**Don't** open a new `better-sqlite3` database without durability pragmas.

```ts
// ❌
const db = new Database(dbPath);
db.exec(schema);
```

**Do** set WAL mode and durability settings immediately after opening.

```ts
// ✅
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("wal_autocheckpoint = 1000");
db.pragma("foreign_keys = ON");
db.exec(schema);
```

---

## TypeScript `any`

**Don't** use `any` as a shortcut, including in test files.

```ts
// ❌
function handleResult(data: any) { ... }
const col: any = pragma.find(...);
```

**Do** use a specific type, `unknown` with a type guard, or a narrow inline type.

```ts
// ✅
function handleResult(data: unknown) { ... }
const col = (pragma as Array<{ name: string }>).find(...);
```

---

## Package Manager Mix-up

**Don't** run `pnpm` inside `n8drive/web/` or `npm` inside `n8drive/`.

```bash
# ❌ — breaks the lockfile
cd n8drive/web && pnpm install
cd n8drive && npm install
```

**Do** match the package manager to the directory.

```bash
# ✅
cd n8drive       && pnpm install
cd n8drive/web   && npm ci
```

---

## Admin Role Checks

**Don't** rely on `auth.role` existing without checking, and don't use loose equality for role checks.

```ts
// ❌
if (auth.role != "admin") return res.status(403)...
```

**Do** use strict equality and always guard with an existence check.

```ts
// ✅
if (auth.role !== "admin") {
  res.status(403).json({ success: false, correlationId, error: "Forbidden" });
  return;
}
```

---

## Type-Only Imports

**Don't** import types without the `type` keyword (this project uses `"moduleResolution": "bundler"` / ESM and it matters for tree-shaking and declaration emit).

```ts
// ❌
import { ApprovalStore } from "../../engine/approvalStore.js";
```

**Do** use `import type` for type-only imports.

```ts
// ✅
import type { ApprovalStore } from "../../engine/approvalStore.js";
```
