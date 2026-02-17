# Frontend ↔ Backend Integration Plan

> **Date:** 2026-02-17
> **Baseline:** V1.0.0 (shipped 2026-02-16)
> **Status:** Actionable — implementation ready

---

## Current State

The backend exposes **30+ API endpoints** across 12 route modules. The frontend
currently consumes **14 of those endpoints**, leaving significant backend
capabilities disconnected from the UI.

### Frontend pages today

| Page | Route | Backend endpoints consumed |
|------|-------|--------------------------|
| Home | `/` | `/health`, `/api/pj/execute`, `/api/capabilities/manifest`, `/api/runtime/context`, `/api/config/tiles`, `/api/auth/status`, `/api/login`, `/api/refresh`, `/api/auth/logout` |
| Login | `/login` | OAuth redirects (`/api/auth/{provider}/login`) |
| Dashboard | `/dashboard` | `GET /api/prr?limit=50` |
| Governance | `/governance` | `GET /api/prompt`, `GET /api/core-prompt`, `GET /api/pj/actions` |

### Backend endpoints **not consumed** by any frontend page

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/approvals` | GET | List approvals (workspace-scoped) |
| `/api/approvals/:id` | GET | Get single approval with chain progress |
| `/api/approvals/:id/decide` | POST | Approve or reject an approval |
| `/api/approvals/:id/dispatch` | POST | Execute the approved plan |
| `/api/approvals/:id/chain` | GET | Get chain progress detail |
| `/api/approvals/count/pending` | GET | Pending approval count |
| `/api/chain-templates` | GET | List chain templates |
| `/api/chain-templates/:id` | GET | Get single template |
| `/api/chain-templates` | POST | Create template |
| `/api/chain-templates/:id` | PUT | Update template |
| `/api/chain-templates/:id` | DELETE | Delete template |
| `/api/workspace/invite` | POST | Send workspace invitation |
| `/api/workspace/invitations` | GET | List pending invitations |
| `/api/workspace/invitations/:id` | DELETE | Cancel invitation |
| `/api/workspace/members` | GET | List workspace members |
| `/api/workspace/members/:userId` | PATCH | Update member role |
| `/api/workspace/members/:userId` | DELETE | Remove member |
| `/api/workspace/usage` | GET | Workspace usage/tier metrics |
| `/api/admin/stats` | GET | Aggregated operational metrics |
| `/api/admin/workspace/:id/plan` | PATCH | Upgrade workspace plan |
| `/api/evaluate` | POST | Evaluate governance request |

---

## Integration Roadmap

### Phase 1 — Approvals Page (connects core governance loop)

**New page:** `/approvals`

**Why first:** The approval queue is the core interaction loop. Backend has
complete CRUD + chain progression + dispatch. Frontend has zero visibility.

**Endpoints to wire:**
- `GET /api/approvals` → table of pending/approved/rejected approvals
- `GET /api/approvals/:id` → detail view with chain progress
- `POST /api/approvals/:id/decide` → approve/reject buttons
- `POST /api/approvals/:id/dispatch` → execute after approval
- `GET /api/approvals/count/pending` → badge count in navigation

**Implementation:**
1. Create `web/src/app/approvals/page.tsx`
2. Fetch approval list on mount with polling (30s interval)
3. Detail modal/panel showing chain steps and status
4. Decide buttons with confirmation dialog
5. Add pending count badge to home page navigation

---

### Phase 2 — Admin Page (connects operational controls)

**New page:** `/admin`

**Why second:** Operators need visibility into workspace stats, member
management, and chain templates without database access.

**Endpoints to wire:**
- `GET /api/admin/stats` → operational metrics dashboard
- `GET /api/workspace/usage` → tier usage with progress bars
- `GET /api/workspace/members` → member list
- `PATCH /api/workspace/members/:userId` → role management
- `GET /api/chain-templates` → template list
- `POST /api/chain-templates` → create template

**Implementation:**
1. Create `web/src/app/admin/page.tsx` with tabs (Stats, Members, Templates)
2. Stats tab: approval counts, dispatch success rate, workspace usage
3. Members tab: invite/remove/role-change with workspace isolation
4. Templates tab: CRUD for approval chain templates

---

### Phase 3 — Enhance Existing Pages

#### Dashboard enhancements
- Add pending approval count card (from `GET /api/approvals/count/pending`)
- Add workspace usage summary (from `GET /api/workspace/usage`)
- Link PRR rows to detail views

#### Governance enhancements
- Add "Submit for Evaluation" form using `POST /api/evaluate`
- Show approval status after `POST /api/pj/execute` with polling
- Display action execution results inline

#### Home page enhancements
- Add pending approval badge to Governance nav link
- Show workspace usage in runtime context area

---

### Phase 4 — Webhook Event Routing

**Existing file:** `web/src/app/api/webhook/route.ts`

**Current state:** Verifies HMAC signature, parses event, returns 200 with no
side effects. Has explicit `TODO` for idempotency and business logic.

**Next steps:**
1. Add in-memory `Set` for event ID deduplication (capped at 10K)
2. Route events by `type` field to handlers:
   - `approval.status_change` → invalidate cached approval data
   - `access.notification` → trigger notification UI update
3. Add TTL cleanup for the idempotency set

---

## Architecture Notes

### API Proxy

All frontend API calls go through the Next.js rewrite proxy (`/api/*` →
Fly.io backend). This means:
- No CORS issues — cookies and sessions share the frontend origin
- Next.js API routes (e.g., `/api/webhook`) take precedence over rewrites
- `NEXT_PUBLIC_API_URL` should be empty/unset so `pjFetch` uses relative paths

### Auth Flow

```
Browser → /api/auth/{provider}/login (rewrite → backend)
  → OAuth provider callback → backend session cookie
  → Frontend detects session via /api/auth/status
  → Fetches manifest, context, tiles
  → Silent refresh 60s before expiry
```

### Key Shared Types

The frontend `LiveTile`, `CapabilityManifest`, and `RuntimeContext` types in
`web/src/lib/auth.tsx` mirror backend response shapes. New pages should define
their own response types inline (same pattern as `PrrRow` in
`dashboard/page.tsx`).

### Navigation Pattern

The home page uses capability-gated navigation links. New pages should:
1. Add an entry to `NAV_LINKS` in `page.tsx` with the appropriate capability key
2. Use `<RequireAuth>` wrapper for auth-gated pages
3. Include a `← Home` back link in the header (same pattern as dashboard/governance)

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `web/src/app/approvals/page.tsx` | Approval queue with decide/dispatch |
| **Create** | `web/src/app/admin/page.tsx` | Admin dashboard (stats, members, templates) |
| **Edit** | `web/src/app/page.tsx` | Add approval badge, admin nav link |
| **Edit** | `web/src/app/dashboard/page.tsx` | Add approval count + usage cards |
| **Edit** | `web/src/app/governance/page.tsx` | Add evaluate form + approval tracking |

---

## Deferred (not blocked)

| Item | Reason | Revisit trigger |
|------|--------|----------------|
| Workspace invitation email delivery | Requires email provider integration | First non-technical admin onboarding |
| Approval CSV/JSON export | Backend endpoint exists but no UI | Compliance audit request |
| Slack/Teams notifications | Dispatcher stubs exist | Admin requests push notifications |
| Audit log viewer | Events written but no read API yet | Municipality admin needs history |
