import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createGovernanceEngine, type InputPayload } from "../src/engine/governanceEngine.js";

const TMP_AUDIT = path.join(process.cwd(), "data", `audit-test-${Date.now()}.ndjson`);
const TMP_IDEMPOTENCY = path.join(process.cwd(), "data", `idempotency-test-${Date.now()}.db`);

function launchPayload(): InputPayload {
  const requestSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    workspace: {
      id: "ws-1",
      name: "Clerk Ops",
      charter: {
        authority: true,
        accountability: true,
        boundary: true,
        continuity: true
      }
    },
    municipality: {
      id: "mun-1",
      name: "Ashfield",
      state: "MA",
      population: 2000,
      statutes: {
        ack: "MGL Ch. 66 Section 10"
      },
      policies: {
        records_ack: { text: "Acknowledge within 10 days" }
      },
      risk_profile: {
        strict_mode: false
      }
    },
    operator: {
      id: "op-1",
      name: "Taylor",
      role: "Clerk",
      permissions: ["deploy", "notify", "archive", "seal"],
      delegations: []
    },
    action: {
      mode: "launch",
      trigger: {
        type: "manual",
        reference: "remote",
        evidence: {
          citation: "Operator initiated launcher action"
        }
      },
      intent: "open_repository",
      targets: ["97n8/AGNOSTIC"],
      environment: "production",
      metadata: {
        description: "Open repository"
      },
      requestId: `req-launch-${requestSuffix}`
    },
    timestamp: "2026-02-11T12:00:00Z"
  };
}

function governedPayload(): InputPayload {
  const requestSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    workspace: {
      id: "ws-2",
      name: "Policy Ops",
      charter: {
        authority: true,
        accountability: true,
        boundary: true,
        continuity: true
      }
    },
    municipality: {
      id: "mun-2",
      name: "Ashfield",
      state: "MA",
      population: 2000,
      statutes: {
        zoning: "MGL Ch. 40A Section 5"
      },
      policies: {
        governance: { text: "Policy changes must be auditable" }
      },
      risk_profile: {
        strict_mode: true
      }
    },
    operator: {
      id: "op-2",
      name: "Jordan",
      role: "Clerk",
      permissions: ["deploy", "notify", "archive", "seal"],
      delegations: []
    },
    action: {
      mode: "governed",
      trigger: {
        type: "form",
        reference: "policy-form-1",
        evidence: {
          statuteKey: "zoning",
          policyKey: "governance"
        }
      },
      intent: "deploy_policy",
      targets: ["sharepoint:town:/drive/root:/records/policy", "github:publiclogic/town-ops"],
      environment: "production",
      metadata: {
        description: "Deploy revised parking policy",
        archieve: {
          dept: "clerk",
          type: "policy",
          date: "2026-02-11",
          seq: 2,
          v: 1
        },
        files: [{ name: "policy.md", content: "new policy", encoding: "utf-8" }],
        urgency: "normal",
        deployMode: "pr"
      },
      requestId: `req-governed-${requestSuffix}`
    },
    timestamp: "2026-02-11T12:00:00Z"
  };
}

test("approves launcher fast-path intent", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT });
  const payload = launchPayload();

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, true);
  assert.equal(result.actionPlan.length, 1);
  assert.equal(result.actionPlan[0].connector, "github");
  assert.equal(result.warnings.length, 0);
  assert.match(result.uiFeedback.lcdStatus, /OPEN/i);
});

test("blocks launcher in strict mode when target is restricted", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT });
  const payload = launchPayload();
  payload.municipality.risk_profile = { strict_mode: true };
  payload.action.targets = ["github:97n8/restricted-repo"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /restricted target/i);
});

test("approves governed deploy_policy intent", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT });
  const payload = governedPayload();

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, true);
  assert.equal(result.actionPlan.length, 2);
  assert.equal(typeof result.auditRecord.planHash, "string");
  assert.equal(result.auditRecord.planHash.length, 64);
});

test("blocks governed mode when workspace is unchartered", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT });
  const payload = governedPayload();
  payload.workspace.charter.boundary = false;

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /workspace not chartered/i);
});

test("blocks idempotency conflict", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload1 = launchPayload();
  const payload2 = launchPayload();
  payload2.action.requestId = payload1.action.requestId;
  payload2.action.targets = ["97n8/Public_Logic"];

  const first = await engine.evaluate(payload1);
  assert.equal(first.approved, true);

  const second = await engine.evaluate(payload2);
  assert.equal(second.approved, false);
  assert.match(second.warnings[0], /idempotency conflict/i);
});

test("replays identical requestId result across engine restart", async () => {
  const firstEngine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.action.requestId = "req-replay-1";

  const first = await firstEngine.evaluate(payload);
  assert.equal(first.approved, true);
  assert.ok(first.auditRecord.eventId);

  // Simulate process restart with the same durable store path.
  const secondEngine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const second = await secondEngine.evaluate(payload);
  assert.equal(second.approved, true);
  assert.equal(second.auditRecord.eventId, first.auditRecord.eventId);
  assert.equal(second.auditRecord.planHash, first.auditRecord.planHash);
});

test("rejects replay when schema version changes", async () => {
  const payload = governedPayload();
  payload.action.requestId = "req-schema-version-1";

  const firstEngine = createGovernanceEngine({
    auditLogPath: TMP_AUDIT,
    idempotencyStorePath: TMP_IDEMPOTENCY,
    schemaVersion: 1
  });
  const first = await firstEngine.evaluate(payload);
  assert.equal(first.approved, true);

  const secondEngine = createGovernanceEngine({
    auditLogPath: TMP_AUDIT,
    idempotencyStorePath: TMP_IDEMPOTENCY,
    schemaVersion: 2
  });
  const second = await secondEngine.evaluate(payload);
  assert.equal(second.approved, false);
  assert.match(second.warnings[0] ?? "", /schema version mismatch/i);
});

test("expired requestId proceeds as a new request", async () => {
  const engine = createGovernanceEngine({
    auditLogPath: TMP_AUDIT,
    idempotencyStorePath: TMP_IDEMPOTENCY,
    idempotencyTtlHours: 0.000005
  });
  const payload = launchPayload();
  payload.action.requestId = "req-expire-1";

  const first = await engine.evaluate(payload);
  assert.equal(first.approved, true);

  await new Promise((resolve) => setTimeout(resolve, 30));
  const second = await engine.evaluate(payload);
  assert.equal(second.approved, true);
  assert.notEqual(second.auditRecord.eventId, first.auditRecord.eventId);
});

test("ignores future delegation and allows active delegation exactly at start time", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.operator.permissions = ["deploy"];
  payload.operator.delegations = [
    {
      id: "future-seal",
      from: "2026-02-11T12:00:01Z",
      until: "2026-02-12T12:00:00Z",
      scope: ["seal_record", "seal"]
    },
    {
      id: "active-seal",
      from: "2026-02-11T12:00:00Z",
      until: "2026-02-12T12:00:00Z",
      scope: ["seal_record", "seal"]
    }
  ];
  payload.action.intent = "seal_record";
  payload.action.targets = ["vault:town-sealed-records"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, true);
  assert.equal(result.auditRecord.evidence.delegationUsed, "active-seal");
  assert.equal(result.auditRecord.evidence.delegationEvaluation?.source, "delegation");
});

test("blocks expired delegation using to date", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.operator.permissions = ["deploy"];
  payload.operator.delegations = [
    {
      id: "expired-seal",
      from: "2026-02-10T12:00:00Z",
      to: "2026-02-10T23:59:59Z",
      scope: ["seal_record", "seal"],
      precedence: 5
    }
  ];
  payload.action.intent = "seal_record";
  payload.action.targets = ["vault:town-sealed-records"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /authority check failed/i);
});

test("uses higher precedence delegation when scopes conflict", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.operator.permissions = ["deploy"];
  payload.operator.delegations = [
    {
      id: "low",
      from: "2026-02-11T10:00:00Z",
      until: "2026-02-12T10:00:00Z",
      scope: ["seal_record", "seal"],
      precedence: 1,
      delegator: "clerk-a"
    },
    {
      id: "high",
      from: "2026-02-11T09:00:00Z",
      until: "2026-02-12T10:00:00Z",
      scope: ["seal_record", "seal"],
      precedence: 10,
      delegator: "clerk-b"
    }
  ];
  payload.action.intent = "seal_record";
  payload.action.targets = ["vault:town-sealed-records"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, true);
  assert.equal(result.auditRecord.evidence.delegationUsed, "high");
});

test("blocks governance ambiguity when precedence and from tie", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.operator.permissions = ["deploy"];
  payload.operator.delegations = [
    {
      id: "tie-a",
      from: "2026-02-11T11:00:00Z",
      until: "2026-02-12T10:00:00Z",
      scope: ["seal_record", "seal"],
      precedence: 7,
      delegator: "clerk-a"
    },
    {
      id: "tie-b",
      from: "2026-02-11T11:00:00Z",
      until: "2026-02-12T10:00:00Z",
      scope: ["seal_record", "seal"],
      precedence: 7,
      delegator: "clerk-b"
    }
  ];
  payload.action.intent = "seal_record";
  payload.action.targets = ["vault:town-sealed-records"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /delegation ambiguity/i);
  assert.equal(result.nextSteps[0]?.type, "resolve_delegation_ambiguity");
});

test("detects plan integrity mismatch when expected hash is provided", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = governedPayload();
  payload.action.metadata.expectedPlanHash = "deadbeef";

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /plan integrity mismatch/i);
});

test("invalid intent remediation lists currently accepted legacy intents", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT, idempotencyStorePath: TMP_IDEMPOTENCY });
  const payload = launchPayload();
  payload.action.intent = "not_real" as InputPayload["action"]["intent"];

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  const allowed = result.nextSteps[0]?.details?.allowed as string[] | undefined;
  const remediation = String(result.nextSteps[0]?.details?.remediation ?? "");
  assert.ok(Array.isArray(allowed));
  assert.ok(allowed?.includes("archive"));
  assert.match(remediation, /action type, target, and reason/i);
  assert.match(remediation, /Deploy VAULTPRR to hubb-prod/i);
  for (const intent of allowed ?? []) {
    assert.match(remediation, new RegExp(`\\b${intent}\\b`));
  }
});

test("blocks unavailable connector in governed mode", async () => {
  const engine = createGovernanceEngine({ auditLogPath: TMP_AUDIT });
  const payload = governedPayload();
  payload.action.metadata.connectorHealth = { sharepoint: "unavailable" };

  const result = await engine.evaluate(payload);
  assert.equal(result.approved, false);
  assert.match(result.warnings[0], /connector unavailable/i);
});

test.after(() => {
  if (fs.existsSync(TMP_AUDIT)) {
    fs.unlinkSync(TMP_AUDIT);
  }
  if (fs.existsSync(TMP_IDEMPOTENCY)) {
    fs.unlinkSync(TMP_IDEMPOTENCY);
  }
  if (fs.existsSync(`${TMP_IDEMPOTENCY}-shm`)) {
    fs.unlinkSync(`${TMP_IDEMPOTENCY}-shm`);
  }
  if (fs.existsSync(`${TMP_IDEMPOTENCY}-wal`)) {
    fs.unlinkSync(`${TMP_IDEMPOTENCY}-wal`);
  }
});
