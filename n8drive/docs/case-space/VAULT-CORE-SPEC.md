# VAULT Core — Technical Specification

**Area:** Case Space  
**Status:** Draft — Pre-Implementation  
**Version:** 0.1.0  
**Date:** 2026-02-23  
**Author:** PublicLogic Architecture

---

## Overview

This specification defines the VAULT Core rollout: a structured extension of the existing `@puddlejumper/vault` compliance engine that adds a **Tailored piece** (Piece 10 of the module set), formalizes the **ARCHIEVE + SEAL integrity chain**, and integrates **PuddleJumper (PJ) + Vauly API** to protect deployments, enforce archival integrity, and secure encoding/partner handoffs.

The spec covers identity, schema, API contracts, actor/role model, release gates, and test requirements. No implementation begins until this spec is ratified.

---

## 1. VAULT Core Identity

VAULT Core is the canonical baseline for all PublicLogic governance modules. All statutory bindings, retention codes, and compliance constraints live upstream in Core — no consumer may define their own.

### Versioning

| Field | Value |
|-------|-------|
| Package | `@puddlejumper/vault` |
| Schema version | `2.0.0` (VAULT Core release) |
| Backward compatibility | Core v1 process packages remain valid; `schemaVersion` field drives migration |

### Canonical Responsibilities

- Statutory bindings (`mglCitations`, retention codes) — defined in Core, immutable downstream.
- Retention codes — expressed as `retentionClass` on each ProcessPackage (`permanent`, `7-year`, `3-year`, `1-year`, `custom`).
- Module registry — Core is the authoritative index of all deployed modules.
- SEAL chain lifecycle — Core initializes and extends SEAL entries via the Vauly API.
- FormKey immutability — once registered, a FormKey cannot be mutated; only superseded by a new version with its own FormKey.

### What Core Does NOT Own

- Town-specific overrides → Tailored piece (Piece 10).
- Deployment orchestration → PuddleJumper.
- Cryptographic key management → Vauly API.
- UI rendering → PublicLogic OS.

---

## 2. Tailored Piece — Piece 10

Piece 10 is a first-class module extension that attaches to any Core process package. It holds all town-specific overrides, local bylaws, exemptions, and protection settings. One Tailored piece per town per process version.

### Purpose

- Express local legal posture without forking Core.
- Record approved deviations with legal signoff.
- Map roles to town org-chart positions.
- Override SLA defaults where town bylaws differ.
- Configure encryption policy and connector routing for the town's environment.

### JSON Schema

```jsonc
{
  "$schema": "https://publiclogic.org/schemas/vault-tailored-v1.json",
  "tailoredId": "tailored-{tenantId}-{formKey}-{semver}",   // e.g. "tailored-concord-prr.intake.v1-1.0.0"
  "formKey": "prr.intake.v1",                                // must reference a registered Core FormKey
  "tenantId": "concord-ma",
  "version": "1.0.0",
  "createdAt": "2026-02-23T00:00:00Z",
  "createdBy": "admin@concord.ma.gov",
  "legalSignoff": {
    "signedBy": "town-counsel@concord.ma.gov",
    "signedAt": "2026-02-23T00:00:00Z",
    "documentRef": "legal-memo-2026-02-23"                   // archival reference, not the document itself
  },

  // ── Enforcement mode ─────────────────────────────────────────────────────
  "enforcementMode": "tailored",                             // "core" | "tailored"
  // "core"     → ignore all overrides, apply Core rules verbatim
  // "tailored" → apply overrides where set; Core rules fill gaps
  // Changing this field always writes an audit entry (see § 6).

  // ── Local legal posture ──────────────────────────────────────────────────
  "localLegalPosture": {
    "jurisdiction": "Concord, MA",
    "governingLaw": ["M.G.L. c.66 §10", "Concord Town Charter § 5-3"],
    "notes": "Town requires 5-day response window vs. 10-day statutory default"
  },

  // ── SLA overrides ────────────────────────────────────────────────────────
  "slaOverrides": {
    "acknowledgmentDays": 5,                                 // Core default: 10
    "resolutionDays": 20                                     // Core default: 30
  },

  // ── Role mappings ────────────────────────────────────────────────────────
  "roleMappings": [
    {
      "coreRole": "dept_head",
      "localTitle": "Town Manager",
      "localEmail": "manager@concord.ma.gov",
      "canDelegate": true
    },
    {
      "coreRole": "legal",
      "localTitle": "Town Counsel",
      "localEmail": "counsel@concord.ma.gov",
      "canDelegate": false
    }
  ],

  // ── Encryption policy ────────────────────────────────────────────────────
  "encryptionPolicy": {
    "atRestAlgorithm": "AES-256-GCM",
    "keyProvider": "vauly",                                  // "vauly" | "local" | "none"
    "keyEscrowRequired": true,
    "keyRotationDays": 90
  },

  // ── Connector overrides ──────────────────────────────────────────────────
  "connectorOverrides": [
    {
      "connectorId": "email",
      "config": {
        "fromAddress": "no-reply@concord.ma.gov",
        "replyTo": "records@concord.ma.gov"
      }
    }
  ],

  // ── Approved deviations ──────────────────────────────────────────────────
  "approvedDeviations": [
    {
      "deviationId": "dev-001",
      "coreFieldPath": "execution.timeoutSeconds",
      "coreValue": 600,
      "overrideValue": 1200,
      "justification": "Town records system requires extended processing time for large batches",
      "approvedBy": "town-counsel@concord.ma.gov",
      "approvedAt": "2026-02-23T00:00:00Z",
      "expiresAt": "2027-02-23T00:00:00Z"
    }
  ],

  // ── Custom archival paths ─────────────────────────────────────────────────
  "archivalPaths": {
    "primaryDestination": "sharepoint://concord-ma/records/prr",
    "auditDestination": "vauly://audit-ledger/concord-ma",
    "retentionClass": "7-year"
  }
}
```

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| `formKey` must reference a registered Core FormKey | Vauly API rejects on SEAL init |
| `tailoredId` is immutable after creation | Server returns 409 on re-register with same ID |
| `legalSignoff.signedBy` must be a verified tenant admin | Auth middleware validates email domain against `tenantId` |
| `enforcementMode` changes write an audit entry | `writeAuditEvent` called before persistence |
| `approvedDeviations[].expiresAt` is required | Zod schema enforces presence |
| Expired deviations fall back to Core value automatically | Engine checks `expiresAt` at runtime |

---

## 3. FormKey + ARCHIEVE + SEAL Integrity

### FormKey Immutability

A FormKey, once registered with the Vauly API, is **sealed** — its `planHash` cannot be updated. Version bumps require a new FormKey (e.g., `prr.intake.v2`). The old FormKey remains queryable but is marked `deprecated: true`.

**Vauly API call at FormKey registration:**

```http
POST /vauly/v1/seal/init
Authorization: Bearer {pj-service-token}
Content-Type: application/json

{
  "sealType": "formkey",
  "objectId": "prr.intake.v1",
  "planHash": "sha256:a7c3f1e2...",
  "tenantId": "all",
  "metadata": {
    "title": "Public Records Request Intake",
    "coreVersion": "2.0.0",
    "registeredBy": "nate@publiclogic.org"
  }
}
```

**Response:**

```json
{
  "sealId": "seal-prr.intake.v1-20260223",
  "status": "sealed",
  "createdAt": "2026-02-23T00:00:00Z",
  "immutableFields": ["objectId", "planHash", "sealType"],
  "readOnly": true
}
```

### ARCHIEVE

ARCHIEVE is the append-only archival record for every case action. Each ARCHIEVE entry is:

- Written on: intake, step completion, deviation approval, enforcement mode change, release authorization, and dispatch.
- Immutable: entries may not be updated or deleted.
- Linked: each entry carries `sealId` of the associated SEAL record.
- Auditable: linked to the VAULT audit ledger entry.

**ARCHIEVE entry structure:**

```typescript
interface ArchieveEntry {
  archieveId: string;          // ulid
  sealId: string;              // Vauly SEAL reference
  tenantId: string;
  formKey: string;
  tailoredId?: string;         // set if Tailored piece is active
  eventType:
    | "intake"
    | "step_complete"
    | "deviation_approved"
    | "enforcement_mode_changed"
    | "release_authorized"
    | "dispatched"
    | "archived";
  actorId: string;
  actorRole: string;
  timestamp: string;           // ISO 8601
  payload: Record<string, unknown>;  // event-specific data
  priorArchieveId?: string;    // chain link to previous entry
  integrityHash: string;       // sha256 of (priorArchieveId + payload)
}
```

### SEAL Chain

The SEAL chain extends at every significant lifecycle transition:

| Transition | Vauly API call |
|------------|---------------|
| FormKey registered | `POST /vauly/v1/seal/init` |
| Tailored piece attached | `POST /vauly/v1/seal/extend` |
| Release authorized | `POST /vauly/v1/seal/extend` |
| Archive written | `POST /vauly/v1/seal/extend` |
| Handoff to encoding partner | `POST /vauly/v1/seal/close` (read-only after this) |

**SEAL extend payload:**

```json
{
  "sealId": "seal-prr.intake.v1-20260223",
  "eventType": "tailored_attached",
  "actorId": "admin@concord.ma.gov",
  "payload": {
    "tailoredId": "tailored-concord-prr.intake.v1-1.0.0",
    "enforcementMode": "tailored"
  }
}
```

**Tailored archival path override:** When `archivalPaths.auditDestination` is set in the Tailored piece, the ARCHIEVE writer uses that path instead of the Core default. The path is recorded in the SEAL entry for reproducibility.

---

## 4. Connector & Protection Layer

### PuddleJumper (PJ) — Deployment Orchestration

PJ is responsible for:

- **Container secrets** — injected at startup from environment; never written to SQLite.
- **Runtime protection** — governance engine enforces fail-closed before any dispatch.
- **Deployment smoke test** — runs after every PJ deploy (see Release Gates, § 6).
- **Secret rotation** — PJ rotates `JWT_SECRET` via Vauly API secret store on a 90-day schedule.

PJ's existing `RemotePolicyProvider` already queries VAULT for chain templates and authorization. VAULT Core adds:

- Tailored piece lookup on `getChainTemplate` — if a Tailored piece exists for `{tenantId, formKey}`, the SLA overrides and role mappings from it are merged into the returned template.
- Enforcement mode enforcement — if `enforcementMode: "core"`, Tailored overrides are stripped before returning.

### Vauly API — Encryption, SEAL, and Secure Handoff

Vauly API provides:

| Capability | Endpoint | Used by |
|-----------|----------|---------|
| Key generation & storage | `POST /vauly/v1/keys/generate` | VAULT Core at FormKey registration |
| SEAL initialization | `POST /vauly/v1/seal/init` | VAULT Core at FormKey registration |
| SEAL extension | `POST /vauly/v1/seal/extend` | VAULT Core at every lifecycle transition |
| SEAL close (read-only) | `POST /vauly/v1/seal/close` | VAULT Core at handoff |
| At-rest encryption | `POST /vauly/v1/encrypt` | VAULT Core when writing ARCHIEVE |
| At-rest decryption | `POST /vauly/v1/decrypt` | VAULT Core when reading sealed archives |
| Audit signing | `POST /vauly/v1/sign` | VAULT Core when finalizing audit entry |
| Secret rotation | `POST /vauly/v1/secrets/rotate` | PJ secret rotation job |
| Key escrow confirmation | `GET /vauly/v1/keys/{keyId}/escrow` | Release gate check |

### Connector Contract

All connectors (email, SharePoint, webhook) must conform to this contract when operating within VAULT Core:

```typescript
interface VaultConnectorContract {
  // Authentication
  authMethod: "bearer" | "hmac" | "oauth2";
  tokenSource: "pj-runtime" | "vauly-secret";

  // Webhook events emitted
  events: ConnectorEvent[];

  // Retry policy
  retry: {
    maxAttempts: number;    // 1–10
    baseDelayMs: number;    // ≥ 100
    maxDelayMs: number;     // ≤ 60_000
    backpressure: "exponential" | "linear";
  };

  // Error codes the connector may return
  errorCodes: {
    code: string;
    retryable: boolean;
    description: string;
  }[];
}

interface ConnectorEvent {
  eventType: string;        // e.g. "submission.received"
  payloadSchema: string;    // JSON Schema $id URI
  retryable: boolean;
}
```

**Backpressure:** If a connector returns `429 Too Many Requests` or a `Retry-After` header, PJ must honor the delay before re-enqueuing. This is enforced by the existing `RetryPolicy` in `dispatch.ts`.

**Error propagation:** Connector errors write a `dispatch_failed` ARCHIEVE entry and extend the SEAL chain with `eventType: "dispatch_error"`. Governance engine resets the approval state to `pending` only for retryable errors.

---

## 5. Actors & Roles

### Role Definitions

The Tailored piece augments Core roles with local titles, emails, and delegation rules. The canonical role set (defined in Core, not overridable):

| Core Role | Approval Scope | Self-Approval | Notes |
|-----------|---------------|--------------|-------|
| `admin` | All actions | ❌ Cannot approve own submission | Primary operator |
| `dept_head` | Department-scoped approvals | ❌ | Mapped to local title in Tailored piece |
| `legal` | Legal review step | ❌ | Required on actions with `requiresComplianceReview: true` |
| `clerk` | Intake processing | ❌ | First step in most municipal chains |
| `auditor` | Read-only; cannot approve | N/A | Audit trail access only |
| `tailored_owner` | Manage Tailored piece | ❌ | Must have `legalSignoff` on deviations |

### Separation of Duty Rules

1. **No self-approval.** A user who submitted an action cannot approve any step of its chain. Enforced at the chain step decision endpoint in PJ.
2. **Role hierarchy is flat.** `admin` does not supersede `dept_head` for department-scoped approvals. Each role approves only within its defined scope.
3. **Tailored piece changes require dual approval.** Any modification to `approvedDeviations` or `enforcementMode` requires approval by both `tailored_owner` and `legal`. This is a hardcoded chain in VAULT Core — it cannot be overridden by a Tailored piece.
4. **Auditor cannot write.** `auditor` role is rejected at all mutating endpoints with `403 Forbidden`.

### Role → Connector Mapping Export

Partners (encoding partners, external integrators) receive a role mapping export so they can enforce the same role rules on their side. Export format:

```jsonc
{
  "exportVersion": "1.0",
  "tenantId": "concord-ma",
  "formKey": "prr.intake.v1",
  "generatedAt": "2026-02-23T00:00:00Z",
  "roles": [
    {
      "coreRole": "dept_head",
      "localTitle": "Town Manager",
      "canApprove": ["governed_action", "intake_submission"],
      "cannotApprove": ["own_submission"],
      "delegationAllowed": true,
      "delegationMaxDepth": 1
    }
  ],
  "separationOfDuty": [
    "submitter != approver at any chain step",
    "tailored_piece_changes require dept_head + legal dual approval"
  ],
  "sealedBy": "vauly://sign/role-export-concord-ma-20260223"
}
```

This export is signed by the Vauly API (`POST /vauly/v1/sign`) and the signature is embedded in the export. Partners must verify the signature before consuming the mapping.

---

## 6. Release & Handoff

### Deployment Checklist (PJ + Vauly Gates)

The following gates must pass before a VAULT Core deployment is considered complete:

| Gate | Owner | Pass Criterion |
|------|-------|---------------|
| PJ deployment smoke test | PJ | `GET /health` returns `{"status": "ok"}` within 5 seconds on all Fly.io machines |
| Vauly SEAL init confirmation | VAULT Core | `GET /vauly/v1/seal/{sealId}` returns `{"status": "sealed"}` for all FormKeys in the release |
| Vauly key escrow confirmation | VAULT Core | `GET /vauly/v1/keys/{keyId}/escrow` returns `{"escrowed": true}` for all generated keys |
| Connector auth test (partner) | Connector owner | At least one successful authenticated webhook delivery to each configured connector |
| Tailored piece validation | VAULT Core | All active Tailored pieces pass Zod schema validation and `legalSignoff` is present |
| Training + QuickRef updated | PublicLogic | Tailored-piece fields and toggle documented in `USER_QUICKREF.md` |
| Audit log smoke test | VAULT Core | At least one `release_authorized` ARCHIEVE entry exists in the audit ledger for the release FormKey |

### Release Token Flow

```
1. Approval chain completes (all steps approved in PJ)
2. PJ calls POST /api/v1/vault/authorize-release
3. VAULT Core:
   a. Validates approval chain is complete
   b. Calls POST /vauly/v1/seal/extend (eventType: "release_authorized")
   c. Calls POST /vauly/v1/keys/{keyId}/escrow to confirm escrow
   d. Returns { authorized: true, token: "<release-token>", expiresAt: "<24h>" }
4. PJ includes release token in dispatch payload
5. Connector verifies token before executing
6. On success: PJ calls POST /api/v1/vault/audit (eventType: "dispatched")
7. VAULT Core calls POST /vauly/v1/seal/extend (eventType: "dispatched")
```

### Handoff to Encoding Partner

When a case is handed off to an encoding partner (e.g., for records digitization):

1. VAULT Core calls `POST /vauly/v1/seal/close` — the SEAL chain becomes read-only.
2. VAULT Core generates a signed role-mapping export (§ 5).
3. PJ dispatches the handoff payload with the release token and signed role export.
4. Encoding partner verifies:
   - Release token signature (against Vauly public key)
   - Role export signature
   - SEAL `status === "closed"` (confirms no further mutations)

Once sealed, neither PJ nor VAULT Core can extend the SEAL chain. Only Vauly API can re-open a sealed chain (requires dual `admin` + `legal` approval, out-of-band).

---

## 7. Tests & Safeguards

### Structural Validation

Before any process package (or Tailored piece) is accepted by VAULT Core, the following validations run:

| Check | Failure mode |
|-------|-------------|
| No orphan stages — every step ID referenced in `steps` exists | `409 Conflict` with `{error: "orphan_stage", stageId}` |
| No circular approval routes — chain steps must form a DAG | `409 Conflict` with `{error: "circular_route"}` |
| No SLA conflicts — Tailored `slaOverrides` must not exceed statutory maximum | `422 Unprocessable` with `{error: "sla_conflict", field, max}` |
| No stop-rule contradictions — a step cannot both block and allow the same intent | `422 Unprocessable` with `{error: "stop_rule_contradiction"}` |
| Expired deviations are not applied | Silent fallback to Core value; logged as `deviation_expired` audit event |
| `enforcementMode: "core"` ignores all Tailored overrides | Verified by integration test: Tailored SLA must not appear in chain template response |

### Automated Test Specifications

#### PJ Secret Rotation Test

```typescript
// test/vault-core/secret-rotation.test.ts
describe("PJ secret rotation via Vauly API", () => {
  it("rotates JWT_SECRET and PJ continues to issue valid tokens", async () => {
    // 1. Capture current secret fingerprint from Vauly
    // 2. Trigger rotation: POST /vauly/v1/secrets/rotate
    // 3. Verify PJ health endpoint still returns 200
    // 4. Verify old token is rejected after rotation (401)
    // 5. Verify new token (issued post-rotation) is accepted (200)
  });

  it("writes a rotation audit entry to VAULT Core audit ledger", async () => {
    // After rotation, GET /api/v1/vault/audit should include
    // an entry with eventType: "secret_rotated"
  });
});
```

#### Vauly SEAL Verification Test

```typescript
// test/vault-core/seal-verification.test.ts
describe("Vauly SEAL integrity", () => {
  it("initializes SEAL on FormKey registration", async () => {
    // Register a test FormKey
    // Assert GET /vauly/v1/seal/{sealId} returns status: "sealed"
  });

  it("extends SEAL on Tailored piece attachment", async () => {
    // Attach a Tailored piece
    // Assert SEAL entry count increases by 1
    // Assert new entry eventType === "tailored_attached"
  });

  it("closes SEAL on partner handoff and rejects further extensions", async () => {
    // Trigger handoff dispatch
    // Assert SEAL status === "closed"
    // Assert POST /vauly/v1/seal/extend returns 409
  });

  it("drift detection writes a drift_classify audit entry", async () => {
    // Submit planHash !== deployedHash to classify-drift endpoint
    // Assert audit ledger contains eventType: "drift_classify"
    // Assert response.severity === "major"
    // Assert response.requiresReapproval === true
  });
});
```

#### Tailored Piece Enforcement Mode Test

```typescript
// test/vault-core/tailored-enforcement.test.ts
describe("Tailored piece enforcement mode", () => {
  it("enforcementMode: core strips Tailored SLA overrides", async () => {
    // Create Tailored piece with slaOverrides.acknowledgmentDays: 5
    // Set enforcementMode: "core"
    // Call getChainTemplate
    // Assert returned template uses Core acknowledgmentDays: 10
  });

  it("enforcementMode change writes an audit entry", async () => {
    // Switch enforcementMode from "tailored" to "core"
    // Assert audit ledger contains eventType: "enforcement_mode_changed"
    // Assert entry.payload.previousMode === "tailored"
    // Assert entry.payload.newMode === "core"
  });

  it("self-approval is rejected at chain step decision", async () => {
    // Create approval where submitter === approver
    // Assert POST /api/approvals/:id/chain/:stepId/decide returns 403
    // Assert response.error === "self_approval_prohibited"
  });
});
```

---

## Appendix A — Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VAULY_API_URL` | Yes (production) | Base URL of the Vauly API service |
| `VAULY_SERVICE_TOKEN` | Yes | Bearer token for Vauly API authentication |
| `VAULY_PUBLIC_KEY` | Yes | PEM-encoded RSA public key for verifying Vauly signatures |
| `VAULT_CORE_VERSION` | Yes | Semantic version string of deployed VAULT Core |
| `VAULT_SEAL_ENABLED` | No (default: `true`) | Set `false` to disable SEAL integration (dev/test only) |
| `VAULT_ARCHIEVE_ENCRYPT` | No (default: `true`) | Set `false` to skip at-rest encryption (dev/test only) |

Existing required variables (`JWT_SECRET`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `VAULT_DATA_DIR`, `DB_DIR`) remain unchanged.

---

## Appendix B — Vauly API Auth

All Vauly API calls use a service-account bearer token (`VAULY_SERVICE_TOKEN`). This token is:

- Stored in Fly.io secrets (not in source code or SQLite).
- Rotated every 90 days via `POST /vauly/v1/secrets/rotate` (automated PJ job).
- Scoped to: `seal:read`, `seal:write`, `seal:close`, `keys:generate`, `keys:escrow`, `encrypt`, `decrypt`, `sign`, `secrets:rotate`.

Response signatures from Vauly are verified using `VAULY_PUBLIC_KEY` (RS256) before VAULT Core trusts the payload.

---

## Appendix C — Open Questions (Pre-Implementation)

| Question | Owner | Target date |
|----------|-------|-------------|
| What is the Vauly API base URL and token provisioning process? | Vauly team | Before implementation starts |
| Does Vauly support multi-tenant key namespacing, or do we namespace by `tenantId` prefix? | Vauly team | Before FormKey registration design is finalized |
| What is the encoding partner's webhook auth method (bearer vs. HMAC)? | Partner / ConnectorContract | Before connector override schema is finalized |
| Is `retentionClass` enforced by Vauly (auto-delete after N years) or only advisory? | Legal / Vauly team | Before ARCHIEVE entry design is finalized |
| Does the dual-approval requirement for Tailored piece changes need a separate chain template, or can it reuse the standard PJ chain mechanism? | Architecture | During implementation sprint planning |
