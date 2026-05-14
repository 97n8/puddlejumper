import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ApprovalStore, type CreateApprovalInput } from "../src/engine/approvalStore.js";

let store: ApprovalStore;
let tmpDir: string;

function makeInput(overrides: Partial<CreateApprovalInput> = {}): CreateApprovalInput {
  return {
    requestId: `req-${crypto.randomUUID()}`,
    operatorId: "op-1",
    workspaceId: "ws-1",
    municipalityId: "muni-1",
    actionIntent: "deploy_ordinance",
    actionMode: "governed",
    planHash: "abc123",
    planSteps: [{ stepId: "s1", description: "Step 1", connector: "github", status: "ready", plan: {} }],
    auditRecord: { event: "test" },
    decisionResult: { status: "approved" },
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "approval-store-test-"));
  store = new ApprovalStore(path.join(tmpDir, "approvals.db"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ApprovalStore", () => {
  // ── Create ──────────────────────────────────────────────────────────────

  it("creates a pending approval record", () => {
    const row = store.create(makeInput());
    expect(row.id).toBeTruthy();
    expect(row.approval_status).toBe("pending");
    expect(row.decision_status).toBe("approved");
    expect(row.operator_id).toBe("op-1");
    expect(row.workspace_id).toBe("ws-1");
    expect(row.municipality_id).toBe("muni-1");
    expect(row.action_intent).toBe("deploy_ordinance");
    expect(row.action_mode).toBe("governed");
    expect(row.plan_hash).toBe("abc123");
    expect(row.approver_id).toBeNull();
    expect(row.dispatched_at).toBeNull();
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("enforces unique request_id", () => {
    const input = makeInput({ requestId: "unique-req" });
    store.create(input);
    expect(() => store.create(input)).toThrow();
  });

  it("serialises plan_json and audit_record_json as JSON", () => {
    const input = makeInput({ planSteps: [{ x: 1 }], auditRecord: { y: 2 } });
    const row = store.create(input);
    expect(JSON.parse(row.plan_json)).toEqual([{ x: 1 }]);
    expect(JSON.parse(row.audit_record_json)).toEqual({ y: 2 });
  });

  // ── Read / Query ────────────────────────────────────────────────────────

  it("findById returns the row", () => {
    const created = store.create(makeInput());
    const found = store.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("findById returns null for unknown id", () => {
    expect(store.findById("nope")).toBeNull();
  });

  it("findByRequestId returns the row", () => {
    const input = makeInput({ requestId: "find-me" });
    store.create(input);
    const found = store.findByRequestId("find-me");
    expect(found).not.toBeNull();
    expect(found!.request_id).toBe("find-me");
  });

  it("query filters by approvalStatus", () => {
    store.create(makeInput());
    store.create(makeInput());
    const pending = store.query({ approvalStatus: "pending" });
    expect(pending.length).toBe(2);
    const approved = store.query({ approvalStatus: "approved" });
    expect(approved.length).toBe(0);
  });

  it("query filters by operatorId", () => {
    store.create(makeInput({ operatorId: "alice" }));
    store.create(makeInput({ operatorId: "bob" }));
    const rows = store.query({ operatorId: "alice" });
    expect(rows.length).toBe(1);
    expect(rows[0].operator_id).toBe("alice");
  });

  it("query supports limit and offset", () => {
    for (let i = 0; i < 5; i++) store.create(makeInput());
    const page1 = store.query({ limit: 2, offset: 0 });
    const page2 = store.query({ limit: 2, offset: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it("countPending returns pending count", () => {
    expect(store.countPending()).toBe(0);
    store.create(makeInput());
    store.create(makeInput());
    expect(store.countPending()).toBe(2);
  });

  // ── Decide ──────────────────────────────────────────────────────────────

  it("approve transitions pending → approved", () => {
    const created = store.create(makeInput());
    const decided = store.decide({
      approvalId: created.id,
      approverId: "admin-1",
      status: "approved",
      note: "Looks good",
    });
    expect(decided).not.toBeNull();
    expect(decided!.approval_status).toBe("approved");
    expect(decided!.approver_id).toBe("admin-1");
    expect(decided!.approval_note).toBe("Looks good");
  });

  it("reject transitions pending → rejected", () => {
    const created = store.create(makeInput());
    const decided = store.decide({
      approvalId: created.id,
      approverId: "admin-2",
      status: "rejected",
      note: "Nope",
    });
    expect(decided).not.toBeNull();
    expect(decided!.approval_status).toBe("rejected");
  });

  it("decide returns null for non-existent id", () => {
    const result = store.decide({ approvalId: "nope", approverId: "x", status: "approved" });
    expect(result).toBeNull();
  });

  it("decide returns null for already-decided approval", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });
    // Second decide on same item should fail (no longer pending)
    const second = store.decide({ approvalId: created.id, approverId: "admin2", status: "rejected" });
    expect(second).toBeNull();
  });

  it("decide auto-expires if past TTL", () => {
    const created = store.create(makeInput({ ttlSeconds: 0 }));
    // Wait a tick so it's past expiry
    const result = store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });
    expect(result).toBeNull();
    // Row should now be expired
    const row = store.findById(created.id);
    expect(row!.approval_status).toBe("expired");
  });

  // ── Dispatch lifecycle ────────────────────────────────────────────────

  it("markDispatching transitions approved → dispatching", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });
    const dispatching = store.markDispatching(created.id);
    expect(dispatching).not.toBeNull();
    expect(dispatching!.approval_status).toBe("dispatching");
  });

  it("markDispatching returns null if not approved", () => {
    const created = store.create(makeInput());
    // Still pending — should fail
    expect(store.markDispatching(created.id)).toBeNull();
  });

  it("markDispatched transitions dispatching → dispatched", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });
    store.markDispatching(created.id);
    const done = store.markDispatched(created.id, { pr: "https://github.com/pulls/1" });
    expect(done).not.toBeNull();
    expect(done!.approval_status).toBe("dispatched");
    expect(done!.dispatched_at).toBeTruthy();
    expect(JSON.parse(done!.dispatch_result_json!)).toEqual({ pr: "https://github.com/pulls/1" });
  });

  it("markDispatchFailed transitions dispatching → dispatch_failed", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });
    store.markDispatching(created.id);
    const failed = store.markDispatchFailed(created.id, "API timeout");
    expect(failed).not.toBeNull();
    expect(failed!.approval_status).toBe("dispatch_failed");
    expect(JSON.parse(failed!.dispatch_result_json!)).toEqual({ error: "API timeout" });
  });

  // ── Expiry ────────────────────────────────────────────────────────────

  it("expirePending expires items past TTL", () => {
    store.create(makeInput({ ttlSeconds: 0 }));
    store.create(makeInput({ ttlSeconds: 86400 })); // 24h — should NOT expire
    const expired = store.expirePending();
    expect(expired).toBe(1);
    expect(store.countPending()).toBe(1);
  });

  // ── Full lifecycle ────────────────────────────────────────────────────

  it("full lifecycle: create → approve → dispatching → dispatched", () => {
    const input = makeInput();
    const created = store.create(input);
    expect(created.approval_status).toBe("pending");

    const approved = store.decide({
      approvalId: created.id, approverId: "admin", status: "approved",
    });
    expect(approved!.approval_status).toBe("approved");

    const dispatching = store.markDispatching(created.id);
    expect(dispatching!.approval_status).toBe("dispatching");

    const dispatched = store.markDispatched(created.id, { ok: true });
    expect(dispatched!.approval_status).toBe("dispatched");
    expect(dispatched!.dispatched_at).toBeTruthy();
  });
});
