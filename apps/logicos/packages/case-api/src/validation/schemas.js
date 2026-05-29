'use strict';
const { z } = require('zod');

const CreateCaseSchema = z.object({
  case_type:       z.string().min(1),
  description:     z.string().optional(),
  address:         z.string().optional(),
  parcel_id:       z.string().optional(),
  rule_refs:       z.array(z.string()).default([]),
  idempotency_key: z.string().optional(),
});

const CreateObligationSchema = z.object({
  description:     z.string().min(1),
  assigned_side:   z.enum(['A', 'B']),
  rule_id:         z.string().optional(),
  due_date:        z.string().optional(),
  assigned_to:     z.string().optional(),
  idempotency_key: z.string().optional(),
});

const CreateActionSchema = z.object({
  action_type:  z.string().min(1),
  side:         z.enum(['A', 'B', 'system']),
  description:  z.string().optional(),
  metadata:     z.record(z.unknown()).default({}),
});

const EntityLookupSchema = z.object({
  email:       z.string().email(),
  case_number: z.string().regex(/^[A-Z]+-\d{4}-\d{5}$/),
});

const StaffAuthSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const CaseSpaceResolutionAuditSchema = z.object({
  requested_id: z.string().min(1),
  outcome: z.enum(['unauthenticated', 'not_found']),
  request_scope: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
});

module.exports = {
  CreateCaseSchema,
  CreateObligationSchema,
  CreateActionSchema,
  EntityLookupSchema,
  StaffAuthSchema,
  CaseSpaceResolutionAuditSchema,
};
