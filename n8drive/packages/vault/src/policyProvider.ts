import { z } from 'zod';
import { VaultStorage } from './storage';
import { AuditLedger, AuditEvent } from './auditLedger';
import { ManifestRegistry, ManifestStatus } from './manifestRegistry';

/**
 * PolicyProvider interface matching PuddleJumper's contract
 * Implements authorization, chain templates, audit, manifest, and release gates
 */

// Request/Response schemas matching PJ's PolicyProvider

export const AuthorizationQuerySchema = z.object({
  workspaceId: z.string(),
  operatorId: z.string(),
  action: z.string(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export const AuthorizationResponseSchema = z.object({
  authorized: z.boolean(),
  reason: z.string().optional(),
  delegationEvaluation: z.record(z.any()).optional(),
});

export const ChainTemplateQuerySchema = z.object({
  workspaceId: z.string(),
  processId: z.string().optional(),
  actionType: z.string().optional(),
});

export const ChainTemplateResponseSchema = z.object({
  templateId: z.string(),
  steps: z.array(
    z.object({
      role: z.string(),
      required: z.boolean().optional(),
      timeoutSeconds: z.number().optional(),
    })
  ),
  metadata: z.record(z.any()).optional(),
});

export const ManifestInputSchema = z.object({
  workspaceId: z.string(),
  processId: z.string(),
  processVersion: z.string(),
  planHash: z.string(),
  operatorId: z.string(),
  metadata: z.record(z.any()).optional(),
});

export const ManifestResponseSchema = z.object({
  accepted: z.boolean(),
  manifestId: z.string().optional(),
  reason: z.string().optional(),
  constraints: z.object({
    freezeWindow: z.boolean().optional(),
    disabledIntents: z.array(z.string()).optional(),
  }).optional(),
});

export const ReleaseQuerySchema = z.object({
  workspaceId: z.string(),
  manifestId: z.string().optional(),
  planHash: z.string(),
  operatorId: z.string().optional(),
});

export const ReleaseResponseSchema = z.object({
  authorized: z.boolean(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
  token: z.string().optional(),
});

export const DriftQuerySchema = z.object({
  workspaceId: z.string(),
  planHash: z.string(),
  deployedHash: z.string(),
});

export const DriftResponseSchema = z.object({
  driftDetected: z.boolean(),
  severity: z.enum(['none', 'minor', 'major', 'critical']),
  requiresReapproval: z.boolean(),
  details: z.record(z.any()).optional(),
});

export type AuthorizationQuery = z.infer<typeof AuthorizationQuerySchema>;
export type AuthorizationResponse = z.infer<typeof AuthorizationResponseSchema>;
export type ChainTemplateQuery = z.infer<typeof ChainTemplateQuerySchema>;
export type ChainTemplateResponse = z.infer<typeof ChainTemplateResponseSchema>;
export type ManifestInput = z.infer<typeof ManifestInputSchema>;
export type ManifestResponse = z.infer<typeof ManifestResponseSchema>;
export type ReleaseQuery = z.infer<typeof ReleaseQuerySchema>;
export type ReleaseResponse = z.infer<typeof ReleaseResponseSchema>;
export type DriftQuery = z.infer<typeof DriftQuerySchema>;
export type DriftResponse = z.infer<typeof DriftResponseSchema>;

/**
 * VaultPolicyProvider - Implements PolicyProvider interface for VAULT
 */
export class VaultPolicyProvider {
  constructor(
    private storage: VaultStorage,
    private auditLedger: AuditLedger,
    private manifestRegistry: ManifestRegistry
  ) {}

  getProviderType(): 'local' | 'remote' {
    return 'remote';
  }

  /**
   * Check authorization for operator action
   * Currently: simple allow-all policy (extend with role-based rules)
   */
  async checkAuthorization(query: AuthorizationQuery): Promise<AuthorizationResponse> {
    // Log authorization check
    await this.writeAuditEvent({
      eventType: 'authorization_check',
      workspaceId: query.workspaceId,
      operatorId: query.operatorId,
      details: {
        action: query.action,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
      },
    });

    // TODO: Implement role-based authorization rules
    // For now: allow all actions (LocalPolicyProvider behavior)
    return {
      authorized: true,
      reason: 'Default allow policy',
      delegationEvaluation: {
        evaluatedAt: new Date().toISOString(),
        policy: 'default-allow',
      },
    };
  }

  /**
   * Get approval chain template for process/action
   * Returns municipality-specific chain configuration
   */
  async getChainTemplate(query: ChainTemplateQuery): Promise<ChainTemplateResponse> {
    // Log template fetch
    await this.writeAuditEvent({
      eventType: 'chain_template_fetch',
      workspaceId: query.workspaceId,
      details: {
        processId: query.processId,
        actionType: query.actionType,
      },
    });

    // TODO: Load municipality-specific templates from storage
    // For now: return default two-step chain (dept_head -> legal)
    return {
      templateId: 'default-chain-v1',
      steps: [
        { role: 'dept_head', required: true, timeoutSeconds: 86400 },
        { role: 'legal', required: true, timeoutSeconds: 86400 },
      ],
      metadata: {
        description: 'Default two-step approval chain',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Write audit event (idempotent)
   */
  async writeAuditEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.auditLedger.append(fullEvent);
  }

  /**
   * Register manifest (preflight check)
   * Validates freeze windows, disabled intents, and release constraints
   */
  async registerManifest(input: ManifestInput): Promise<ManifestResponse> {
    // Validate process exists
    const process = await this.storage.getProcess(input.processId);
    if (!process) {
      return {
        accepted: false,
        reason: `Process ${input.processId} not found in vault`,
      };
    }

    // Validate version matches
    if (process.version !== input.processVersion) {
      return {
        accepted: false,
        reason: `Version mismatch: expected ${process.version}, got ${input.processVersion}`,
      };
    }

    // Validate planHash matches
    if (process.manifest.planHash !== input.planHash) {
      return {
        accepted: false,
        reason: `Plan hash mismatch: expected ${process.manifest.planHash}`,
      };
    }

    // TODO: Check freeze windows and release constraints
    const constraints = {
      freezeWindow: false,
      disabledIntents: [] as string[],
    };

    // Register manifest
    const manifest = this.manifestRegistry.register({
      workspaceId: input.workspaceId,
      processId: input.processId,
      processVersion: input.processVersion,
      planHash: input.planHash,
      registeredBy: input.operatorId,
      registeredAt: new Date().toISOString(),
      metadata: input.metadata,
      status: 'registered',
    });

    // Audit
    await this.writeAuditEvent({
      eventType: 'manifest_register',
      workspaceId: input.workspaceId,
      operatorId: input.operatorId,
      details: {
        manifestId: manifest.manifestId,
        processId: input.processId,
        planHash: input.planHash,
      },
    });

    return {
      accepted: true,
      manifestId: manifest.manifestId,
      constraints,
    };
  }

  /**
   * Authorize release (post-approval gate)
   * Returns authorization token with expiration
   */
  async authorizeRelease(query: ReleaseQuery): Promise<ReleaseResponse> {
    let manifest;

    // Find manifest by ID or planHash
    if (query.manifestId) {
      manifest = this.manifestRegistry.get(query.manifestId);
    } else {
      manifest = this.manifestRegistry.findByPlanHash(query.planHash, query.workspaceId);
    }

    if (!manifest) {
      return {
        authorized: false,
        reason: 'Manifest not found or not registered',
      };
    }

    // Check if already authorized and not expired
    if (manifest.status === 'authorized' && manifest.expiresAt) {
      const expiresAt = new Date(manifest.expiresAt);
      if (expiresAt > new Date()) {
        return {
          authorized: true,
          expiresAt: manifest.expiresAt,
          token: this.generateReleaseToken(manifest.manifestId),
        };
      }
    }

    // TODO: Validate approval chain completed
    // TODO: Check release constraints (freeze windows, budget caps)

    // Authorize release with 24-hour TTL
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.manifestRegistry.updateStatus(manifest.manifestId, 'authorized', { expiresAt });

    // Audit
    await this.writeAuditEvent({
      eventType: 'release_authorize',
      workspaceId: query.workspaceId,
      operatorId: query.operatorId,
      details: {
        manifestId: manifest.manifestId,
        planHash: query.planHash,
        expiresAt,
      },
    });

    return {
      authorized: true,
      expiresAt,
      token: this.generateReleaseToken(manifest.manifestId),
    };
  }

  /**
   * Classify drift between approved and deployed artifacts
   */
  async classifyDrift(query: DriftQuery): Promise<DriftResponse> {
    const driftDetected = query.planHash !== query.deployedHash;

    if (!driftDetected) {
      return {
        driftDetected: false,
        severity: 'none',
        requiresReapproval: false,
      };
    }

    // TODO: Implement semantic drift analysis
    // For now: any drift is major and requires reapproval
    await this.writeAuditEvent({
      eventType: 'drift_classify',
      workspaceId: query.workspaceId,
      details: {
        planHash: query.planHash,
        deployedHash: query.deployedHash,
        severity: 'major',
      },
    });

    return {
      driftDetected: true,
      severity: 'major',
      requiresReapproval: true,
      details: {
        expectedHash: query.planHash,
        actualHash: query.deployedHash,
        detectedAt: new Date().toISOString(),
      },
    };
  }

  private generateReleaseToken(manifestId: string): string {
    // Simple token generation (TODO: use JWT or HMAC signing)
    return Buffer.from(`${manifestId}:${Date.now()}`).toString('base64');
  }
}
