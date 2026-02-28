import { z } from "zod";

const nonEmptyString = (max: number) => z.string().trim().min(1).max(max);
const optionalString = (max: number) => z.string().trim().max(max).optional();

export const loginRequestSchema = z.strictObject({
  username: nonEmptyString(128),
  password: nonEmptyString(512)
});

const delegationSchema = z.strictObject({
  id: optionalString(128),
  from: optionalString(64),
  until: optionalString(64),
  to: optionalString(64),
  scope: z.array(nonEmptyString(64)).max(64).optional(),
  precedence: z.number().int().min(0).max(10_000).optional(),
  delegator: optionalString(128),
  delegatee: optionalString(128)
});

const archieveSchema = z.strictObject({
  dept: nonEmptyString(64),
  type: nonEmptyString(64),
  date: nonEmptyString(32),
  seq: z.union([z.number().int().nonnegative(), nonEmptyString(16)]),
  v: z.union([z.number().int().positive(), nonEmptyString(16)])
});

const metadataSchema = z.strictObject({
  description: optionalString(2_000),
  archieve: archieveSchema.optional(),
  timer: z.strictObject({ due: nonEmptyString(64) }).optional(),
  state: z.strictObject({ from: nonEmptyString(128), to: nonEmptyString(128) }).optional(),
  calendar: z.strictObject({ eventId: nonEmptyString(256) }).optional(),
  files: z
    .array(z.strictObject({
      name: nonEmptyString(256),
      content: z.string().max(1_000_000),
      encoding: z.enum(["utf-8", "base64"])
    }))
    .max(128)
    .optional(),
  urgency: z.enum(["normal", "emergency"]).optional(),
  deployMode: z.enum(["pr", "direct"]).optional(),
  connectorHealth: z.record(z.string(), z.union([z.boolean(), z.string().max(64)])).optional(),
  connectorStatus: z.record(z.string(), z.union([z.boolean(), z.string().max(64)])).optional(),
  restricted: z.boolean().optional(),
  automationId: optionalString(256),
  expectedPlanHash: optionalString(128),
  canonicalUrl: optionalString(2_048),
  canonicalSha: optionalString(128)
});

const triggerSchema = z.strictObject({
  type: nonEmptyString(32),
  reference: optionalString(512),
  evidence: z.record(z.string(), z.unknown()).optional()
});

const actionSchema = z.strictObject({
  mode: z.enum(["launch", "governed"]).optional(),
  trigger: triggerSchema,
  intent: nonEmptyString(64),
  targets: z.array(nonEmptyString(2_048)).max(64),
  environment: z.enum(["production", "staging", "pilot"]).optional(),
  metadata: metadataSchema,
  requestId: optionalString(256)
});

const workspaceSchema = z.strictObject({
  id: nonEmptyString(128),
  name: optionalString(256),
  charter: z.strictObject({
    authority: z.boolean(),
    accountability: z.boolean(),
    boundary: z.boolean(),
    continuity: z.boolean()
  })
});

const municipalitySchema = z.strictObject({
  id: nonEmptyString(128),
  name: optionalString(256),
  state: optionalString(64),
  population: z.number().int().nonnegative().max(100_000_000).optional(),
  statutes: z.record(z.string(), z.string().max(2_000)).optional(),
  policies: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  risk_profile: z.record(z.string(), z.unknown()).optional()
});

const operatorSchema = z.strictObject({
  id: nonEmptyString(128),
  name: optionalString(256),
  role: optionalString(128),
  permissions: z.array(nonEmptyString(64)).max(256).optional(),
  delegations: z.array(delegationSchema).max(256).optional()
});

const timestampSchema = z
  .string()
  .trim()
  .min(20)
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), { error: "Invalid timestamp" });

export const evaluateRequestSchema = z.strictObject({
  workspace: workspaceSchema,
  municipality: municipalitySchema,
  operator: operatorSchema,
  action: actionSchema,
  timestamp: timestampSchema
});

export type EvaluateRequestBody = z.infer<typeof evaluateRequestSchema>;

export const prrStatusSchema = z.enum(["received", "acknowledged", "in_progress", "extended", "closed"]);

export const prrIntakeRequestSchema = z.strictObject({
  tenantId: optionalString(128),
  requester_name: optionalString(256),
  requester_email: z.email().max(320).optional(),
  subject: nonEmptyString(512),
  description: optionalString(5_000)
});

export const prrStatusTransitionRequestSchema = z.strictObject({
  to_status: prrStatusSchema
});

export const prrCloseRequestSchema = z.strictObject({
  disposition: nonEmptyString(128)
});

export const accessRequestStatusSchema = z.enum([
  "received",
  "under_review",
  "approved",
  "provisioned",
  "denied",
  "revoked",
  "closed"
]);

export const accessRequestIntakeRequestSchema = z.strictObject({
  tenantId: optionalString(128),
  requester_name: optionalString(256),
  requester_email: z.email().max(320),
  organization: optionalString(256),
  requested_role: nonEmptyString(128),
  system: optionalString(128),
  justification: nonEmptyString(5_000),
  source: optionalString(64)
});

export const accessRequestStatusTransitionRequestSchema = z.strictObject({
  to_status: accessRequestStatusSchema
});

export const accessRequestCloseRequestSchema = z.strictObject({
  resolution: optionalString(2_000)
});

const pjModeSchema = z.enum(["dry-run", "execute"]);

const pjCreatePayloadSchema = z.strictObject({
  name: nonEmptyString(128),
  config: z.record(z.string(), z.unknown()).optional(),
  requestId: optionalString(256)
});

const pjUpdatePayloadSchema = z.strictObject({
  environmentId: nonEmptyString(128),
  patch: z.record(z.string(), z.unknown()),
  requestId: optionalString(256)
});

const pjPromotePayloadSchema = z.strictObject({
  sourceEnvironmentId: nonEmptyString(128),
  targetEnvironmentId: nonEmptyString(128),
  merge: z.boolean().optional(),
  snapshotTarget: z.boolean().optional(),
  requestId: optionalString(256)
});

const pjSnapshotPayloadSchema = z.strictObject({
  environmentId: nonEmptyString(128),
  message: optionalString(512),
  requestId: optionalString(256)
});

export const pjExecuteRequestSchema = z.discriminatedUnion("actionId", [
  z.strictObject({
    actionId: z.literal("environment.create"),
    payload: pjCreatePayloadSchema,
    mode: pjModeSchema.default("execute"),
    requestId: optionalString(256)
  }),
  z.strictObject({
    actionId: z.literal("environment.update"),
    payload: pjUpdatePayloadSchema,
    mode: pjModeSchema.default("execute"),
    requestId: optionalString(256)
  }),
  z.strictObject({
    actionId: z.literal("environment.promote"),
    payload: pjPromotePayloadSchema,
    mode: pjModeSchema.default("execute"),
    requestId: optionalString(256)
  }),
  z.strictObject({
    actionId: z.literal("environment.snapshot"),
    payload: pjSnapshotPayloadSchema,
    mode: pjModeSchema.default("execute"),
    requestId: optionalString(256)
  })
]);

export type PjExecuteRequestBody = z.infer<typeof pjExecuteRequestSchema>;
