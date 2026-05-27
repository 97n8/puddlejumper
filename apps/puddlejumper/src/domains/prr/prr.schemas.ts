// PRR canon HTTP schemas — kept separate from prr.routes.ts so they can be
// imported by the store / tests / future MCP tool definitions without
// pulling in the Express router.

import { z } from 'zod';

const ChecklistItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  done: z.boolean(),
});

/**
 * Allowlist for PATCH /api/prr/:id/fields.
 *
 * `.strict()` is load-bearing — it makes Zod reject any top-level key not
 * in this allowlist, which gives the route a hard contract that the only
 * mutable fields are the three named here.  The refine ensures at least
 * one allowlisted key is present so callers can't fire empty mutations.
 */
export const PatchFieldsSchema = z
  .object({
    checklist:  z.array(ChecklistItem).max(100).optional(),
    notes:      z.string().max(8000).optional(),
    automation: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.checklist !== undefined ||
      v.notes !== undefined ||
      v.automation !== undefined,
    { message: 'fields.empty_patch' },
  );

export type PatchFieldsInput = z.infer<typeof PatchFieldsSchema>;

export type ChecklistItemInput = z.infer<typeof ChecklistItem>;
