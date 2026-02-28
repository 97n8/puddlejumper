import { z } from "zod";

/**
 * Process Package Schema - PuddleJumper Vault
 * 
 * Defines the structure for enclosed, versioned municipal process packages
 * deployed via FormKeys (e.g., "prr-intake-v1", "building-permit-v1").
 * 
 * Schema Version: 1.0.0
 */

// ── Asset Definition ────────────────────────────────────────────────────────

export const AssetSchema = z.object({
  path: z.string().meta({ description: "Relative path to asset file" }),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).meta({ description: "SHA-256 integrity hash" }),
  mime: z.string().optional().meta({ description: "MIME type (e.g., application/json)" }),
  sizeBytes: z.number().int().positive().optional(),
});

export type Asset = z.infer<typeof AssetSchema>;

// ── M.G.L. Citation ─────────────────────────────────────────────────────────

export const MGLCitationSchema = z.object({
  citation: z.string().meta({ description: "M.G.L. citation (e.g., 'M.G.L. c.66 §10')" }),
  context: z.string().optional().meta({ description: "Legal context or excerpt" }),
  url: z.url().optional().meta({ description: "Link to authoritative source" }),
  lineNumbers: z.string().optional().meta({ description: "Line range in source document" }),
});

export type MGLCitation = z.infer<typeof MGLCitationSchema>;

// ── Execution Configuration ─────────────────────────────────────────────────

export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).default(3),
  baseDelayMs: z.number().int().min(100).default(1000),
  maxDelayMs: z.number().int().min(1000).default(30000),
});

export const ExecutionConfigSchema = z.object({
  connectors: z.array(z.string()).meta({ description: "Required connectors (e.g., 'github', 'webhook')" }),
  timeoutSeconds: z.number().int().positive().default(600),
  retry: RetryConfigSchema.optional(),
});

export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// ── Release Constraints ─────────────────────────────────────────────────────

export const FreezeWindowSchema = z.object({
  start: z.iso.datetime().meta({ description: "ISO 8601 freeze start" }),
  end: z.iso.datetime().meta({ description: "ISO 8601 freeze end" }),
  reason: z.string().meta({ description: "Why releases are frozen (e.g., 'Municipal holiday')" }),
});

export const ReleaseConstraintsSchema = z.object({
  freezeWindows: z.array(FreezeWindowSchema).optional(),
  ttlSeconds: z.number().int().positive().optional().meta({ description: "Time-to-live after approval" }),
  budgetCap: z.number().positive().optional().meta({ description: "Max cost in USD" }),
  requiresComplianceReview: z.boolean().default(false),
});

export type ReleaseConstraints = z.infer<typeof ReleaseConstraintsSchema>;

// ── Process Package Manifest ────────────────────────────────────────────────

export const ManifestSchema = z.object({
  planHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).meta({ description: "Canonical content hash" }),
  assets: z.array(AssetSchema).meta({ description: "Files used by this process" }),
  schemaVersion: z.string().default("1.0.0").meta({ description: "Schema version for migrations" }),
});

export type Manifest = z.infer<typeof ManifestSchema>;

// ── Process Package (Full) ──────────────────────────────────────────────────

export const ProcessPackageSchema = z.looseObject({
  // Core metadata
  id: z.string().meta({ description: "Unique process ID (e.g., 'prr-intake')" }),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).meta({ description: "Semantic version (e.g., '1.0.0')" }),
  title: z.string().meta({ description: "Human-readable title" }),
  description: z.string().meta({ description: "Detailed description" }),

  // FormKeys - multiple keys can reference the same package
  formKeys: z.array(z.string()).min(1).meta({ description: "FormKey identifiers (e.g., ['prr.intake.v1'])" }),

  // Manifest & integrity
  manifest: ManifestSchema,

  // Legal grounding
  mglCitations: z.array(MGLCitationSchema).min(1).meta({ description: "Required M.G.L. citations" }),

  // Execution configuration
  execution: ExecutionConfigSchema,

  // Release constraints
  releaseConstraints: ReleaseConstraintsSchema.optional(),

  // Tenant scope
  tenantScope: z.union([
    z.literal("all"),
    z.array(z.string()).meta({ description: "Allowed tenant IDs" }),
  ]).default("all"),
  requiredPermissions: z.array(z.string()).default([]).meta({ description: "Required operator permissions" }),

  // Workflow steps (cards)
  steps: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    mglCitation: MGLCitationSchema.optional(),
    requiredInput: z.record(z.string(), z.any()).optional(),
    expectedOutput: z.record(z.string(), z.any()).optional(),
  })).optional(),

  // Metadata
  createdBy: z.string().meta({ description: "Author email or identifier" }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  deprecated: z.boolean().default(false),
});

export type ProcessPackage = z.infer<typeof ProcessPackageSchema>;

// ── Vault Manifest (Index) ──────────────────────────────────────────────────

export const VaultManifestSchema = z.object({
  processes: z.array(z.object({
    id: z.string(),
    version: z.string(),
    title: z.string(),
    formKeys: z.array(z.string()),
    category: z.string().optional(),
    jurisdiction: z.string().optional(),
  })),
  lastUpdated: z.iso.datetime(),
});

export type VaultManifest = z.infer<typeof VaultManifestSchema>;
