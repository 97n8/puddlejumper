# Vault - PublicLogic Compliance Engine

**Status:** Production-ready (Phase 6 complete)  
**Version:** 0.1.0  
**Package:** `@puddlejumper/vault`

## What is Vault?

Vault is the **compliance engine** within the PublicLogic architecture. It provides:

- **Process Package Management** - Governed municipal workflows with legal metadata
- **PolicyProvider Implementation** - Authorization, audit, and release management
- **FormKey Deployment** - Versioned, immutable process deployment
- **M.G.L. Citation Tracking** - Massachusetts General Laws compliance
- **Audit Ledger** - Append-only compliance trail

---

## System Context

### Position in PublicLogic Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ PublicLogic Architecture                                        │
│                                                                 │
│  ┌──────────┐         ┌──────────┐         ┌────────────┐     │
│  │ Website  │         │    OS    │         │     PJ     │     │
│  │ (Narrative) ───────│(Execution)│         │ (Operator) │     │
│  └──────────┘         └─────┬────┘         └──────┬─────┘     │
│                             │                      │           │
│                             │      ┌───────────────┘           │
│                             │      │                           │
│                        ┌────▼──────▼────┐                      │
│                        │     VAULT      │◄──── Compliance      │
│                        │  (Compliance   │      Engine          │
│                        │    Engine)     │                      │
│                        └────────┬───────┘                      │
│                                 │                              │
│                        ┌────────▼───────┐                      │
│                        │ LogicCommons   │◄──── Shared          │
│                        │  (Plumbing)    │      Primitives      │
│                        └────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### What Vault Is:
✅ **Compliance engine** - Enforces legal/policy constraints  
✅ **Process registry** - Centralized source of truth for workflows  
✅ **Audit system** - Immutable compliance trail  
✅ **Release gatekeeper** - Approval/authorization for deployments  
✅ **PolicyProvider service** - Authorization and chain template logic

### What Vault Is NOT:
❌ **Not a UI** - Vault is backend infrastructure  
❌ **Not the OS** - Vault serves OS (and PJ), doesn't contain it  
❌ **Not PuddleJumper** - PJ is a separate operator app that integrates with Vault  
❌ **Not LogicCommons** - Vault uses Commons primitives, doesn't define them  
❌ **Not a product surface** - Vault is internal architecture

---

## Dependency Matrix

### What Vault Depends On

| Dependency | Purpose | Coupling Level |
|------------|---------|----------------|
| **@publiclogic/core** | JWT auth middleware, auth primitives | Light (interface-based) |
| LogicCommons | Session types, governance schemas | Light (shared types) |
| Express | HTTP server | Standard (framework) |
| SQLite | Audit ledger, manifest registry | Standard (storage) |
| Zod | Schema validation | Standard (validation) |

**Key Principle:** Vault has minimal dependencies on PublicLogic-specific logic. It primarily uses:
- Standard web primitives (HTTP, JWT)
- Shared type definitions (schemas)
- Auth middleware (pluggable)

### What Depends on Vault

| Consumer | Integration Point | Required? |
|----------|-------------------|-----------|
| **PuddleJumper** | RemotePolicyProvider → Vault HTTP | Optional (config-swap) |
| **OS (future)** | PolicyProvider → Vault HTTP | Not yet integrated |
| **Admin UI (future)** | Process management → Vault API | Not yet built |

**Migration Path:** Systems using `LocalPolicyProvider` can migrate to Vault by:
1. Setting `VAULT_URL` environment variable
2. No code changes required (config-swap pattern)
3. Backward compatible (LocalPolicyProvider remains default)

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│ Vault Package (packages/vault)                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ HTTP Server (Express)                                    │  │
│  │  - 11 PolicyProvider endpoints                           │  │
│  │  - JWT authentication                                    │  │
│  │  - Health monitoring                                     │  │
│  └─────────────────┬────────────────────────────────────────┘  │
│                    │                                            │
│  ┌─────────────────▼────────────────────────────────────────┐  │
│  │ VaultPolicyProvider                                      │  │
│  │  - checkAuthorization()                                  │  │
│  │  - getChainTemplate()                                    │  │
│  │  - writeAuditEvent()                                     │  │
│  │  - registerManifest()                                    │  │
│  │  - authorizeRelease()                                    │  │
│  │  - classifyDrift()                                       │  │
│  └────┬────────────────────┬──────────────────┬─────────────┘  │
│       │                    │                  │                │
│  ┌────▼──────┐   ┌─────────▼──────┐   ┌──────▼────────────┐   │
│  │  Vault    │   │ AuditLedger    │   │ Manifest          │   │
│  │  Storage  │   │ (SQLite)       │   │ Registry          │   │
│  │ (FS+Cache)│   │ Append-only    │   │ (SQLite)          │   │
│  └───────────┘   └────────────────┘   └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### PolicyProvider Boundary

**Philosophy:** Vault implements the same `PolicyProvider` interface that PuddleJumper uses internally. This creates a clean seam for migration without code rewrite.

```typescript
// Before (PuddleJumper using LocalPolicyProvider)
const policyProvider = new LocalPolicyProvider(db, chainStore);

// After (PuddleJumper using RemotePolicyProvider → Vault)
const policyProvider = createPolicyProvider(
  new LocalPolicyProvider(db, chainStore),  // Fallback
  getAccessToken                             // JWT for Vault
);
```

**Config-Swap Pattern:**
- `VAULT_URL` unset → `LocalPolicyProvider` (SQLite-backed, default)
- `VAULT_URL` set → `RemotePolicyProvider` (calls Vault HTTP)
- Zero breaking changes, backward compatible

---

## Deployment Models

### Option A: Vault as Standalone Service (Recommended)

```
┌──────────────┐         ┌──────────────┐
│      PJ      │────────▶│    Vault     │
│  (Fly.io)    │  HTTP   │  (Fly.io)    │
└──────────────┘         └──────────────┘
                              │
                         ┌────▼────┐
                         │ Storage │
                         │ (SQLite)│
                         └─────────┘
```

**Pros:**
- ✅ Modular deployment
- ✅ Independent scaling
- ✅ Multiple consumers (PJ, OS, future)
- ✅ Clear service boundaries

**Cons:**
- ⚠️ Network latency (minimal - same region)
- ⚠️ Additional service to manage

**Use when:** Planning to integrate multiple systems (OS + PJ) with Vault

---

### Option B: Vault Embedded in PJ

```
┌──────────────────────────┐
│      PuddleJumper        │
│  ┌────────────────────┐  │
│  │   PJ Server        │  │
│  └─────────┬──────────┘  │
│            │              │
│  ┌─────────▼──────────┐  │
│  │   Vault (embedded) │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

**Pros:**
- ✅ Simpler deployment (one app)
- ✅ No network overhead
- ✅ Easier local development

**Cons:**
- ⚠️ Tighter coupling
- ⚠️ Cannot share Vault with other systems
- ⚠️ Harder to scale independently

**Use when:** Only PJ needs Vault, no OS integration planned

---

### Option C: Vault as Shared Service

```
┌──────────┐
│    OS    │───┐
└──────────┘   │
               │    ┌──────────────┐
┌──────────┐   ├───▶│    Vault     │
│    PJ    │───┘    │  (Fly.io)    │
└──────────┘        └──────────────┘
               
┌──────────┐             │
│ PJ (SA)  │─────────────┘
└──────────┘
  (future)
```

**Pros:**
- ✅ Single source of truth
- ✅ Consistent compliance across surfaces
- ✅ Efficient resource usage

**Cons:**
- ⚠️ Shared state complexity
- ⚠️ Tenant isolation critical

**Use when:** Full PublicLogic platform deployment

---

## Environment Configuration

### Required Variables

```bash
# Vault HTTP Server
VAULT_PORT=3003
NODE_ENV=production

# Authentication (must match PuddleJumper config)
JWT_SECRET=<256-bit-base64-encoded-secret>
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api

# Storage
VAULT_DATA_DIR=/data/vault
DB_DIR=/data/vault/db
```

### PuddleJumper Integration

```bash
# In PuddleJumper .env
# Set to enable RemotePolicyProvider
VAULT_URL=https://vault.publiclogic.org  # Production
# VAULT_URL=http://localhost:3003         # Local development
# (Leave unset to use LocalPolicyProvider)
```

---

## API Documentation

### Health Endpoint

**GET `/health`**

Authentication: None

Response:
```json
{
  "status": "ok",
  "service": "puddlejumper-vault",
  "nodeEnv": "production",
  "now": "2026-02-17T21:00:00.000Z",
  "stats": {
    "processes": {},
    "auditEvents": 12345,
    "manifests": 42
  }
}
```

---

### PolicyProvider Endpoints

All require JWT authentication via `Authorization: Bearer <token>` header.

#### POST `/api/v1/vault/check-authorization`

Request:
```json
{
  "userId": "user-123",
  "action": "approve",
  "resourceType": "approval",
  "resourceId": "appr-456",
  "tenantId": "tenant-789"
}
```

Response:
```json
{
  "allowed": true,
  "reason": "User has admin role",
  "delegationChain": ["user-123"]
}
```

---

#### POST `/api/v1/vault/chain-template`

Request:
```json
{
  "formKey": "prr-intake-v1",
  "tenantId": "tenant-789",
  "context": { "urgency": "standard" }
}
```

Response:
```json
{
  "steps": [
    { "role": "clerk", "label": "Initial Review" },
    { "role": "dept_head", "label": "Department Approval" },
    { "role": "legal", "label": "Legal Review" }
  ],
  "timeout": 604800000,
  "requireAllApprovals": true
}
```

---

#### POST `/api/v1/vault/audit`

Request:
```json
{
  "eventId": "evt-123",
  "timestamp": "2026-02-17T21:00:00.000Z",
  "userId": "user-123",
  "action": "approve",
  "resourceType": "approval",
  "resourceId": "appr-456",
  "tenantId": "tenant-789",
  "outcome": "success",
  "metadata": { "comment": "Approved" }
}
```

Response: `204 No Content` (idempotent)

---

### FormKey Endpoints

#### GET `/api/v1/vault/formkey/:key`

Retrieve a process package by FormKey.

Authentication: Required

Example: `GET /api/v1/vault/formkey/prr-intake-v1`

Response:
```json
{
  "id": "prr-intake",
  "version": "1.0.0",
  "title": "Public Records Request Intake",
  "description": "Massachusetts PRR workflow with M.G.L. c.66 §10 compliance",
  "formKeys": ["prr-intake-v1"],
  "manifest": {
    "planHash": "sha256:abc123...",
    "assets": []
  },
  "mglCitations": [
    {
      "chapter": "66",
      "section": "10",
      "title": "Public Records Law",
      "url": "https://malegislature.gov/..."
    }
  ],
  "connectors": ["email", "sharepoint"],
  "tenantScope": "all"
}
```

---

#### GET `/api/v1/vault/processes`

List all available processes.

Authentication: Required

Response: Array of process packages

---

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- SQLite

### Setup

```bash
# Install dependencies
cd packages/vault
pnpm install

# Configure environment
cp .env.sample .env
# Edit .env with your JWT_SECRET

# Build
pnpm run build

# Start server
npx tsx src/server.ts
```

Server runs on `http://localhost:3003`

---

### Testing

```bash
# Health check
curl http://localhost:3003/health

# Test with JWT (requires valid token)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3003/api/v1/vault/processes
```

---

## Future Integration Points

### PuddleJumper Standalone App

When PJ becomes a standalone operator app (separate from current workspace):

```typescript
// PJ standalone will use same RemotePolicyProvider
const policyProvider = new RemotePolicyProvider({
  vaultUrl: "https://vault.publiclogic.org",
  getAccessToken: async () => userSession.getToken()
});
```

---

### PublicLogic OS Integration

OS can integrate Vault for compliance-gated workflows:

```typescript
// OS governance layer
import { createVaultClient } from '@puddlejumper/vault';

const vault = createVaultClient({
  baseUrl: process.env.VAULT_URL,
  credentials: osServiceAccount
});

// Check if deployment is authorized
const authorized = await vault.authorizeRelease({
  manifestId: "manifest-123",
  approvedBy: currentUser.id,
  tenantId: municipality.id
});
```

---

### LogicCommons Expansion

Future: Vault could become the canonical implementation of governance primitives:

- **CASE structure** - Vault stores case templates
- **Agenda scaffolding** - Vault provides agenda schemas
- **Compliance patterns** - Vault enforces patterns across surfaces

This would make LogicCommons even more lightweight (just types), with Vault as the runtime.

---

## M.G.L. Citation Sources

Massachusetts General Laws (M.G.L.) citations are sourced from:

- **Official Source:** https://malegislature.gov/Laws/GeneralLaws
- **Chapter 66 §10** - Public Records Law
- **Chapter 140 §137** - Dog Licensing Requirements
- **Chapter 143 §3** - Building Permits

Each process package includes direct links to relevant statutes.

---

## Monitoring & Operations

### Health Checks

Monitor: `GET /health`

Expected response: `{"status": "ok"}`

Alert if:
- Status != "ok"
- Response time > 500ms
- HTTP 500 errors

---

### Key Metrics

- **Process count** - Should match expected (3 initially)
- **Audit events** - Should grow (append-only)
- **Manifest count** - Tracks deployments
- **Auth failures** - Should be low (< 1% of requests)

---

### Log Levels

- `[Vault]` - Startup messages
- `[Vault/Storage]` - Process loading
- `[Vault/Audit]` - Audit events written
- `[Vault/Manifest]` - Manifest operations

---

## Security Considerations

### Authentication
- All data endpoints require JWT
- Tokens must have correct issuer/audience
- Token expiration enforced

### Tenant Isolation
- All queries scoped to `tenantId`
- Cross-tenant access prevented
- Audit trail includes tenant context

### Audit Trail
- Append-only (no deletion)
- Immutable (no updates)
- Idempotent writes (duplicate protection)

---

## License

Proprietary - PublicLogic, Inc.

---

## Contact

For architecture questions or integration guidance, see:
- `SYSTEMS_REVIEW.md` - Full PublicLogic architecture
- `apps/puddlejumper/README.md` - PuddleJumper documentation
- LogicCommons documentation (future)
