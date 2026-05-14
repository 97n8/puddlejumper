// ── PolicyProvider Tests ─────────────────────────────────────────────────────
//
// Tests for the PolicyProvider interface and LocalPolicyProvider:
//   - Authorization: role-based, delegation-based, rejection, ambiguity
//   - Chain template resolution
//   - Audit event persistence and queries
//   - evaluateAuthorization (pure function, same logic as engine's checkAuthority)
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import { ChainStore, DEFAULT_TEMPLATE_ID } from "../src/engine/chainStore.js";
import {
  LocalPolicyProvider,
  evaluateAuthorization,
  type AuthorizationQuery,
  type AuditEvent,
  type AuditEventType,
  type ChainTemplateQuery,
} from "../src/engine/policyProvider.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let provider: LocalPolicyProvider;
let tmpDir: string;

const NOW = "2026-02-15T12:00:00.000Z";

function authQuery(overrides: Partial<AuthorizationQuery> = {}): AuthorizationQuery {
  return {
    operatorId: "op-1",
    operatorRole: "admin",
    operatorPermissions: ["deploy"],
    operatorDelegations: [],
    intent: "deploy_policy",
    connectors: ["github"],
    timestamp: NOW,
    ...overrides,
  };
}

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType: "action_evaluated",
    workspaceId: "ws-1",
    operatorId: "op-1",
    municipalityId: "muni-1",
    timestamp: NOW,
    intent: "deploy_policy",
    outcome: "approved",
    details: { planHash: "abc123" },
    ...overrides,
  };
}

function chainTemplateQuery(overrides: Partial<ChainTemplateQuery> = {}): ChainTemplateQuery {
  return {
    actionIntent: "deploy_policy",
    actionMode: "governed",
    municipalityId: "muni-1",
    workspaceId: "ws-1",
    ...overrides,
  };
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-provider-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  provider = new LocalPolicyProvider(approvalStore.db, chainStore);
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PolicyProvider", () => {

  // ── evaluateAuthorization (pure function) ─────────────────────────────

  describe("evaluateAuthorization", () => {
    it("allows when operator permissions cover required set", () => {
      const result = evaluateAuthorization(authQuery({ operatorPermissions: ["deploy"] }));
      expect(result.allowed).toBe(true);
      expect(result.delegationUsed).toBe("");
      expect(result.delegationEvaluation.source).toBe("role");
    });

    it("allows when operator has superset of required permissions", () => {
      const result = evaluateAuthorization(
        authQuery({ operatorPermissions: ["deploy", "seal", "notify", "archive"] }),
      );
      expect(result.allowed).toBe(true);
      expect(result.delegationEvaluation.source).toBe("role");
    });

    it("rejects when permissions are insufficient and no delegations", () => {
      const result = evaluateAuthorization(
        authQuery({ operatorPermissions: [], operatorDelegations: [] }),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("insufficient_permissions");
    });

    it("requires seal for seal_record intent", () => {
      const result = evaluateAuthorization(
        authQuery({
          intent: "seal_record",
          connectors: ["vault"],
          operatorPermissions: ["deploy"],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.required).toContain("seal");
    });

    it("allows via delegation when role permissions are insufficient", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-1",
              delegator: "boss",
              from: "2026-01-01T00:00:00Z",
              until: "2026-12-31T23:59:59Z",
              scope: ["deploy_policy"],
              precedence: 10,
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.delegationUsed).toBe("del-1");
      expect(result.delegationEvaluation.source).toBe("delegation");
    });

    it("allows via wildcard (*) delegation scope", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-wild",
              delegator: "superadmin",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["*"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.delegationUsed).toBe("del-wild");
    });

    it("allows via intent: prefixed delegation scope", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-intent",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["intent:deploy_policy"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it("allows via permission: prefixed delegation scope", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-perm",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["permission:deploy"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it("allows via connector: prefixed delegation scope", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          connectors: ["github"],
          operatorDelegations: [
            {
              id: "del-conn",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["connector:github"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it("ignores expired delegations", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-expired",
              from: "2025-01-01T00:00:00Z",
              until: "2025-12-31T23:59:59Z",
              scope: ["*"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("insufficient_permissions");
    });

    it("ignores not-yet-active delegations", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-future",
              from: "2027-01-01T00:00:00Z",
              until: "2027-12-31T23:59:59Z",
              scope: ["*"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(false);
    });

    it("rejects with delegation_ambiguity when multiple equal-precedence delegations match", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-a",
              delegator: "boss-a",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["deploy_policy"],
              precedence: 5,
            },
            {
              id: "del-b",
              delegator: "boss-b",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["*"],
              precedence: 5,
            },
          ],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("delegation_ambiguity");
      expect(result.delegationEvaluation.ambiguity).toBe(true);
    });

    it("selects highest-precedence delegation when multiple match", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-low",
              delegator: "manager",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["*"],
              precedence: 1,
            },
            {
              id: "del-high",
              delegator: "director",
              from: "2026-01-01T00:00:00Z",
              until: "2027-01-01T00:00:00Z",
              scope: ["deploy_policy"],
              precedence: 10,
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.delegationUsed).toBe("del-high");
    });

    it("uses `to` field as fallback for `until`", () => {
      const result = evaluateAuthorization(
        authQuery({
          operatorPermissions: [],
          operatorDelegations: [
            {
              id: "del-to",
              from: "2026-01-01T00:00:00Z",
              to: "2027-01-01T00:00:00Z",
              scope: ["*"],
            },
          ],
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it("populates required permissions from intent + connectors", () => {
      const result = evaluateAuthorization(
        authQuery({ intent: "seal_record", connectors: ["vault"] }),
      );
      expect(result.required).toContain("seal");
    });

    it("defaults to deploy permission for unknown intent", () => {
      const result = evaluateAuthorization(
        authQuery({
          intent: "unknown_intent" as any,
          operatorPermissions: ["deploy"],
          connectors: [],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.required).toContain("deploy");
    });
  });

  // ── LocalPolicyProvider.checkAuthorization ────────────────────────────

  describe("LocalPolicyProvider.checkAuthorization", () => {
    it("delegates to evaluateAuthorization", async () => {
      const result = await provider.checkAuthorization(authQuery());
      expect(result.allowed).toBe(true);
      expect(result.delegationEvaluation.source).toBe("role");
    });

    it("rejects insufficient permissions", async () => {
      const result = await provider.checkAuthorization(authQuery({ operatorPermissions: [] }));
      expect(result.allowed).toBe(false);
    });
  });

  // ── LocalPolicyProvider.getChainTemplate ──────────────────────────────

  describe("LocalPolicyProvider.getChainTemplate", () => {
    it("returns default template for any action/municipality", async () => {
      const template = await provider.getChainTemplate(chainTemplateQuery());
      expect(template).not.toBeNull();
      expect(template!.id).toBe(DEFAULT_TEMPLATE_ID);
      expect(template!.steps.length).toBeGreaterThanOrEqual(1);
    });

    it("returns default template regardless of municipality", async () => {
      const t1 = await provider.getChainTemplate(chainTemplateQuery({ municipalityId: "muni-a" }));
      const t2 = await provider.getChainTemplate(chainTemplateQuery({ municipalityId: "muni-b" }));
      expect(t1!.id).toBe(t2!.id);
    });

    it("returns template with valid step structure", async () => {
      const template = await provider.getChainTemplate(chainTemplateQuery());
      expect(template!.steps[0]).toHaveProperty("order");
      expect(template!.steps[0]).toHaveProperty("requiredRole");
      expect(template!.steps[0]).toHaveProperty("label");
    });
  });

  // ── LocalPolicyProvider.writeAuditEvent ───────────────────────────────

  describe("LocalPolicyProvider.writeAuditEvent", () => {
    it("persists an audit event to SQLite", async () => {
      const event = auditEvent();
      await provider.writeAuditEvent(event);

      const events = provider.getAuditEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe(event.eventId);
      expect(events[0].eventType).toBe("action_evaluated");
      expect(events[0].workspaceId).toBe("ws-1");
      expect(events[0].intent).toBe("deploy_policy");
      expect(events[0].outcome).toBe("approved");
      expect(events[0].details).toEqual({ planHash: "abc123" });
    });

    it("persists multiple events", async () => {
      await provider.writeAuditEvent(auditEvent({ eventType: "action_evaluated" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "approval_created" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "approval_decided" }));

      expect(provider.countAuditEvents()).toBe(3);
    });

    it("handles duplicate eventId with INSERT OR IGNORE", async () => {
      const event = auditEvent();
      await provider.writeAuditEvent(event);
      await provider.writeAuditEvent(event); // same eventId

      expect(provider.countAuditEvents()).toBe(1);
    });

    it("filters events by eventType", async () => {
      await provider.writeAuditEvent(auditEvent({ eventType: "action_evaluated" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "approval_created" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "action_evaluated" }));

      const filtered = provider.getAuditEvents({ eventType: "action_evaluated" });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.eventType === "action_evaluated")).toBe(true);
    });

    it("filters events by workspaceId", async () => {
      await provider.writeAuditEvent(auditEvent({ workspaceId: "ws-1" }));
      await provider.writeAuditEvent(auditEvent({ workspaceId: "ws-2" }));

      const filtered = provider.getAuditEvents({ workspaceId: "ws-1" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].workspaceId).toBe("ws-1");
    });

    it("filters events by municipalityId", async () => {
      await provider.writeAuditEvent(auditEvent({ municipalityId: "muni-1" }));
      await provider.writeAuditEvent(auditEvent({ municipalityId: "muni-2" }));

      const filtered = provider.getAuditEvents({ municipalityId: "muni-1" });
      expect(filtered).toHaveLength(1);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await provider.writeAuditEvent(auditEvent());
      }

      const limited = provider.getAuditEvents({ limit: 3 });
      expect(limited).toHaveLength(3);
    });

    it("returns events in newest-first order", async () => {
      await provider.writeAuditEvent(
        auditEvent({ timestamp: "2026-02-15T10:00:00Z", outcome: "first" }),
      );
      await provider.writeAuditEvent(
        auditEvent({ timestamp: "2026-02-15T12:00:00Z", outcome: "second" }),
      );
      await provider.writeAuditEvent(
        auditEvent({ timestamp: "2026-02-15T11:00:00Z", outcome: "middle" }),
      );

      const events = provider.getAuditEvents();
      expect(events[0].outcome).toBe("second");
      expect(events[1].outcome).toBe("middle");
      expect(events[2].outcome).toBe("first");
    });

    it("counts events by type", async () => {
      await provider.writeAuditEvent(auditEvent({ eventType: "action_evaluated" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "action_evaluated" }));
      await provider.writeAuditEvent(auditEvent({ eventType: "approval_created" }));

      expect(provider.countAuditEvents("action_evaluated")).toBe(2);
      expect(provider.countAuditEvents("approval_created")).toBe(1);
      expect(provider.countAuditEvents()).toBe(3);
    });

    it("stores all audit event types", async () => {
      const types: AuditEventType[] = [
        "action_evaluated",
        "approval_created",
        "approval_decided",
        "approval_dispatched",
        "chain_step_decided",
        "authorization_checked",
      ];
      for (const type of types) {
        await provider.writeAuditEvent(auditEvent({ eventType: type }));
      }
      expect(provider.countAuditEvents()).toBe(types.length);
    });
  });

  // ── PolicyProvider interface contract ─────────────────────────────────

  describe("interface contract", () => {
    it("implements all PolicyProvider methods", () => {
      expect(typeof provider.getProviderType).toBe("function");
      expect(typeof provider.checkAuthorization).toBe("function");
      expect(typeof provider.getChainTemplate).toBe("function");
      expect(typeof provider.writeAuditEvent).toBe("function");
      expect(typeof provider.registerManifest).toBe("function");
      expect(typeof provider.authorizeRelease).toBe("function");
      expect(typeof provider.classifyDrift).toBe("function");
    });

    it("checkAuthorization returns a complete AuthorizationResult", async () => {
      const result = await provider.checkAuthorization(authQuery());
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("required");
      expect(result).toHaveProperty("delegationUsed");
      expect(result).toHaveProperty("delegationEvaluation");
      expect(Array.isArray(result.required)).toBe(true);
    });

    it("getChainTemplate returns ChainTemplate with expected shape", async () => {
      const template = await provider.getChainTemplate(chainTemplateQuery());
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("name");
      expect(template).toHaveProperty("steps");
      expect(template).toHaveProperty("createdAt");
      expect(template).toHaveProperty("updatedAt");
    });
  });

  // ── LocalPolicyProvider.getProviderType ───────────────────────────────

  describe("LocalPolicyProvider.getProviderType", () => {
    it("returns 'local' provider type", () => {
      const providerType = provider.getProviderType();
      expect(providerType).toBe("local");
    });
  });

  // ── LocalPolicyProvider.registerManifest ──────────────────────────────

  describe("LocalPolicyProvider.registerManifest", () => {
    it("accepts all manifests (stub implementation)", async () => {
      const input = {
        manifestId: "manifest-1",
        workspaceId: "ws-1",
        operatorId: "op-1",
        municipalityId: "muni-1",
        intent: "deploy_policy",
        planHash: "abc123",
        description: "Deploy new policy configuration",
        connectors: ["github"],
        timestamp: NOW,
      };
      const result = await provider.registerManifest(input);
      expect(result.accepted).toBe(true);
      expect(result.manifestId).toBe("manifest-1");
    });
  });

  // ── LocalPolicyProvider.authorizeRelease ──────────────────────────────

  describe("LocalPolicyProvider.authorizeRelease", () => {
    it("authorizes all releases (stub implementation)", async () => {
      const query = {
        approvalId: "approval-1",
        manifestId: "manifest-1",
        workspaceId: "ws-1",
        municipalityId: "muni-1",
        operatorId: "op-1",
        planHash: "abc123",
        timestamp: NOW,
      };
      const result = await provider.authorizeRelease(query);
      expect(result.authorized).toBe(true);
      expect(result.expiresAt).toBe(null);
    });
  });

  // ── LocalPolicyProvider.classifyDrift ─────────────────────────────────

  describe("LocalPolicyProvider.classifyDrift", () => {
    it("returns no drift (stub implementation)", async () => {
      const query = {
        approvalId: "approval-1",
        manifestId: "manifest-1",
        workspaceId: "ws-1",
        municipalityId: "muni-1",
        changedFields: ["connectors", "targets"],
        driftContext: { deployedAt: NOW, approvedAt: "2026-02-15T11:00:00Z" },
        timestamp: NOW,
      };
      const result = await provider.classifyDrift(query);
      expect(result.severity).toBe("none");
      expect(result.requiresReapproval).toBe(false);
    });
  });
});
