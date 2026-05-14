import { VaultStorage } from './storage';
import { AuditLedger, AuditEvent } from './auditLedger';
import { ManifestRegistry } from './manifestRegistry';

/**
 * PolicyProvider interface matching PuddleJumper's contract
 * Implements authorization, chain templates, audit, manifest, and release gates
 */

// ── PJ-aligned types ────────────────────────────────────────────────────────

export type AuthorizationQuery = {
  operatorId: string;
  operatorRole?: string;
  operatorPermissions: string[];
  operatorDelegations: unknown[];
  intent: string;
  connectors: string[];
  timestamp: string;
};

export type AuthorizationResponse = {
  authorized: boolean;
  reason?: string;
  delegationEvaluation?: Record<string, unknown>;
};

export type ChainTemplateQuery = {
  workspaceId: string;
  processId?: string;
  actionType?: string;
};

export type ChainTemplateResponse = {
  templateId: string;
  steps: Array<{
    role: string;
    required?: boolean;
    timeoutSeconds?: number;
  }>;
  metadata?: Record<string, unknown>;
};

export type ManifestInput = {
  manifestId: string;
  workspaceId: string;
  operatorId: string;
  municipalityId: string;
  intent: string;
  planHash: string;
  description: string;
  connectors: string[];
  timestamp: string;
};

export type ManifestResponse = {
  accepted: boolean;
  manifestId: string;
  reason?: string;
};

export type ReleaseQuery = {
  approvalId: string;
  manifestId: string;
  workspaceId: string;
  municipalityId: string;
  operatorId: string;
  planHash: string;
  timestamp: string;
};

export type ReleaseResponse = {
  authorized: boolean;
  reason?: string;
  expiresAt: string | null;
  token?: string;
};

export type DriftQuery = {
  approvalId: string;
  manifestId: string;
  workspaceId: string;
  municipalityId: string;
  changedFields: string[];
  driftContext: Record<string, unknown>;
  timestamp: string;
};

export type DriftResponse = {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical' | 'major';
  requiresReapproval: boolean;
  reason?: string;
};

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
   * Accepts PJ's AuthorizationQuery shape.
   */
  async checkAuthorization(query: AuthorizationQuery): Promise<AuthorizationResponse> {
    const evaluatedAt = new Date().toISOString();
    return {
      authorized: true,
      reason: 'Default allow policy',
      delegationEvaluation: {
        evaluatedAt,
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
   * Accepts PJ's ManifestInput shape. Does not look up a process —
   * VAULT won't have every PJ intent registered as a process.
   */
  async registerManifest(input: ManifestInput): Promise<ManifestResponse> {
    // Register manifest using PJ fields mapped to registry fields
    const manifest = this.manifestRegistry.register({
      workspaceId: input.workspaceId,
      processId: input.intent,
      processVersion: '1.0.0',
      planHash: input.planHash,
      registeredBy: input.operatorId,
      registeredAt: new Date().toISOString(),
      status: 'registered',
    });

    // Audit
    await this.writeAuditEvent({
      eventType: 'manifest_register',
      workspaceId: input.workspaceId,
      operatorId: input.operatorId,
      details: {
        manifestId: input.manifestId,
        intent: input.intent,
        planHash: input.planHash,
        municipalityId: input.municipalityId,
        description: input.description,
        connectors: input.connectors,
      },
    });

    return {
      accepted: true,
      manifestId: input.manifestId,
    };
  }

  /**
   * Authorize release (post-approval gate)
   * Accepts PJ's ReleaseQuery shape.
   */
  async authorizeRelease(query: ReleaseQuery): Promise<ReleaseResponse> {
    const manifest = this.manifestRegistry.get(query.manifestId);

    if (!manifest) {
      // Manifest not found — authorize anyway (degraded mode, manifest may have been
      // registered with a PJ-generated manifestId that VAULT doesn't hold)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await this.writeAuditEvent({
        eventType: 'release_authorize',
        workspaceId: query.workspaceId,
        operatorId: query.operatorId,
        details: {
          approvalId: query.approvalId,
          manifestId: query.manifestId,
          planHash: query.planHash,
          expiresAt,
          note: 'manifest_not_found_degraded',
        },
      });
      return {
        authorized: true,
        expiresAt,
        token: this.generateReleaseToken(query.manifestId),
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

    // Authorize release with 24-hour TTL
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.manifestRegistry.updateStatus(manifest.manifestId, 'authorized', { expiresAt });

    // Audit
    await this.writeAuditEvent({
      eventType: 'release_authorize',
      workspaceId: query.workspaceId,
      operatorId: query.operatorId,
      details: {
        approvalId: query.approvalId,
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
   * Accepts PJ's DriftQuery shape.
   */
  async classifyDrift(query: DriftQuery): Promise<DriftResponse> {
    if (query.changedFields.length === 0) {
      return {
        severity: 'none',
        requiresReapproval: false,
      };
    }

    // Write drift audit event
    await this.writeAuditEvent({
      eventType: 'drift_classify',
      workspaceId: query.workspaceId,
      details: {
        approvalId: query.approvalId,
        manifestId: query.manifestId,
        changedFields: query.changedFields,
        driftContext: query.driftContext,
        severity: 'major',
      },
    });

    return {
      severity: 'major',
      requiresReapproval: true,
      reason: 'Field-level drift detected',
    };
  }

  private generateReleaseToken(manifestId: string): string {
    // Simple token generation (TODO: use JWT or HMAC signing)
    return Buffer.from(`${manifestId}:${Date.now()}`).toString('base64');
  }
}
