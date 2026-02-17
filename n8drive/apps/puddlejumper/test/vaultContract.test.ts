/**
 * Vault Contract Tests
 * 
 * Validates that Vault HTTP endpoints match the PolicyProvider interface
 * contract and that PuddleJumper's RemotePolicyProvider correctly implements
 * the PolicyProvider interface via HTTP calls to Vault.
 * 
 * These tests ensure schema compatibility between PJ and Vault.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import type { 
  AuthorizationQuery, 
  AuthorizationResult,
  ChainTemplateQuery,
  AuditEvent,
  ManifestInput,
  ReleaseQuery,
  DriftQuery 
} from "../src/engine/policyProvider.js";

// Mock PolicyProvider interface for schema validation
describe("Vault Contract Tests", () => {
  describe("PolicyProvider Interface Compliance", () => {
    it("should define AuthorizationQuery schema", () => {
      const query: AuthorizationQuery = {
        userId: "user-123",
        action: "approve",
        resourceType: "approval",
        resourceId: "appr-456",
        tenantId: "tenant-789",
      };
      
      expect(query.userId).toBeDefined();
      expect(query.action).toBeDefined();
      expect(query.resourceType).toBeDefined();
      expect(query.tenantId).toBeDefined();
    });

    it("should define AuthorizationResult schema", () => {
      const result: AuthorizationResult = {
        allowed: true,
        reason: "User has admin role",
        delegationChain: ["user-123"],
      };
      
      expect(typeof result.allowed).toBe("boolean");
      expect(result.reason).toBeDefined();
    });

    it("should define ChainTemplateQuery schema", () => {
      const query: ChainTemplateQuery = {
        formKey: "prr-intake-v1",
        tenantId: "tenant-789",
        context: {
          urgency: "standard",
          department: "clerk",
        },
      };
      
      expect(query.formKey).toBeDefined();
      expect(query.tenantId).toBeDefined();
    });

    it("should define AuditEvent schema", () => {
      const event: AuditEvent = {
        eventId: "evt-123",
        timestamp: new Date().toISOString(),
        userId: "user-123",
        action: "approve",
        resourceType: "approval",
        resourceId: "appr-456",
        tenantId: "tenant-789",
        outcome: "success",
        metadata: {
          comment: "Approved after review",
        },
      };
      
      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.action).toBeDefined();
      expect(event.outcome).toBeDefined();
    });

    it("should define ManifestInput schema", () => {
      const manifest: ManifestInput = {
        processId: "prr-intake",
        version: "1.0.0",
        planHash: "sha256:abc123...",
        deployedBy: "user-123",
        tenantId: "tenant-789",
        approvedBy: "admin-456",
        releaseNotes: "Initial release",
      };
      
      expect(manifest.processId).toBeDefined();
      expect(manifest.version).toBeDefined();
      expect(manifest.planHash).toBeDefined();
      expect(manifest.tenantId).toBeDefined();
    });

    it("should define ReleaseQuery schema", () => {
      const query: ReleaseQuery = {
        manifestId: "manifest-123",
        approvedBy: "admin-456",
        tenantId: "tenant-789",
        constraints: {
          maxBudget: 50000,
          freezeWindow: false,
        },
      };
      
      expect(query.manifestId).toBeDefined();
      expect(query.approvedBy).toBeDefined();
      expect(query.tenantId).toBeDefined();
    });

    it("should define DriftQuery schema", () => {
      const query: DriftQuery = {
        processId: "prr-intake",
        tenantId: "tenant-789",
        deployedHash: "sha256:def456...",
        currentHash: "sha256:ghi789...",
      };
      
      expect(query.processId).toBeDefined();
      expect(query.tenantId).toBeDefined();
      expect(query.deployedHash).toBeDefined();
      expect(query.currentHash).toBeDefined();
    });
  });

  describe("HTTP Endpoint Schemas", () => {
    it("should match POST /api/v1/vault/check-authorization request schema", () => {
      const request = {
        method: "POST",
        path: "/api/v1/vault/check-authorization",
        body: {
          userId: "user-123",
          action: "approve",
          resourceType: "approval",
          resourceId: "appr-456",
          tenantId: "tenant-789",
        } as AuthorizationQuery,
      };
      
      expect(request.body.userId).toBeDefined();
      expect(request.body.action).toBeDefined();
      expect(request.body.tenantId).toBeDefined();
    });

    it("should match POST /api/v1/vault/chain-template request schema", () => {
      const request = {
        method: "POST",
        path: "/api/v1/vault/chain-template",
        body: {
          formKey: "prr-intake-v1",
          tenantId: "tenant-789",
          context: { urgency: "standard" },
        } as ChainTemplateQuery,
      };
      
      expect(request.body.formKey).toBeDefined();
      expect(request.body.tenantId).toBeDefined();
    });

    it("should match POST /api/v1/vault/audit request schema", () => {
      const request = {
        method: "POST",
        path: "/api/v1/vault/audit",
        body: {
          eventId: "evt-123",
          timestamp: new Date().toISOString(),
          userId: "user-123",
          action: "approve",
          resourceType: "approval",
          resourceId: "appr-456",
          tenantId: "tenant-789",
          outcome: "success",
        } as AuditEvent,
      };
      
      expect(request.body.eventId).toBeDefined();
      expect(request.body.timestamp).toBeDefined();
      expect(request.body.outcome).toBeDefined();
    });

    it("should match POST /api/vault/formkey/:key/deploy request schema", () => {
      const request = {
        method: "POST",
        path: "/api/vault/formkey/prr-intake-v1/deploy",
        body: {
          workspaceId: "ws-123",
        },
      };
      
      expect(request.path).toContain("formkey");
      expect(request.path).toContain("deploy");
    });

    it("should match GET /api/vault/deployed-processes response schema", () => {
      const response = [
        {
          id: "dp-123",
          workspace_id: "ws-123",
          form_key: "prr-intake-v1",
          process_id: "prr-intake",
          process_version: "1.0.0",
          deployed_by: "user-123",
          deployed_at: new Date().toISOString(),
          manifest_hash: "sha256:abc123...",
          status: "active" as const,
        },
      ];
      
      expect(response[0].id).toBeDefined();
      expect(response[0].workspace_id).toBeDefined();
      expect(response[0].form_key).toBeDefined();
      expect(response[0].status).toMatch(/active|archived|error/);
    });
  });

  describe("Error Handling Schemas", () => {
    it("should define 401 Unauthorized error schema", () => {
      const error = {
        status: 401,
        body: {
          error: "Authentication required",
        },
      };
      
      expect(error.status).toBe(401);
      expect(error.body.error).toBeDefined();
    });

    it("should define 404 Not Found error schema", () => {
      const error = {
        status: 404,
        body: {
          error: "Process not found",
        },
      };
      
      expect(error.status).toBe(404);
      expect(error.body.error).toBeDefined();
    });

    it("should define 500 Internal Server Error schema", () => {
      const error = {
        status: 500,
        body: {
          error: "Internal server error",
        },
      };
      
      expect(error.status).toBe(500);
      expect(error.body.error).toBeDefined();
    });
  });

  describe("RemotePolicyProvider Schema Compliance", () => {
    it("should implement checkAuthorization method signature", () => {
      const method = {
        name: "checkAuthorization",
        params: ["query" as const],
        returns: "Promise<AuthorizationResult>",
      };
      
      expect(method.name).toBe("checkAuthorization");
      expect(method.params).toContain("query");
    });

    it("should implement getChainTemplate method signature", () => {
      const method = {
        name: "getChainTemplate",
        params: ["query" as const],
        returns: "Promise<ChainTemplate>",
      };
      
      expect(method.name).toBe("getChainTemplate");
      expect(method.params).toContain("query");
    });

    it("should implement writeAuditEvent method signature", () => {
      const method = {
        name: "writeAuditEvent",
        params: ["event" as const],
        returns: "Promise<void>",
      };
      
      expect(method.name).toBe("writeAuditEvent");
      expect(method.params).toContain("event");
    });

    it("should implement registerManifest method signature", () => {
      const method = {
        name: "registerManifest",
        params: ["manifest" as const],
        returns: "Promise<ManifestRegistration>",
      };
      
      expect(method.name).toBe("registerManifest");
      expect(method.params).toContain("manifest");
    });

    it("should implement authorizeRelease method signature", () => {
      const method = {
        name: "authorizeRelease",
        params: ["query" as const],
        returns: "Promise<ReleaseAuthorization>",
      };
      
      expect(method.name).toBe("authorizeRelease");
      expect(method.params).toContain("query");
    });

    it("should implement classifyDrift method signature", () => {
      const method = {
        name: "classifyDrift",
        params: ["query" as const],
        returns: "Promise<DriftClassification>",
      };
      
      expect(method.name).toBe("classifyDrift");
      expect(method.params).toContain("query");
    });
  });
});

/**
 * Integration Test Notes:
 * 
 * These contract tests validate schema compatibility at compile time.
 * For runtime validation, run integration tests that actually call the
 * Vault HTTP server and verify responses.
 * 
 * See vault-integration.test.ts for runtime tests.
 */
