import { z } from "zod";

export const GoogleDrivePlanSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("move_file"),
    file_id: z.string(),
    from_parent_id: z.string(),
    to_parent_id: z.string(),
    preserve_name: z.literal(true),
    allow_overwrite: z.literal(false),
  }),
  z.object({
    operation: z.literal("create_shortcut"),
    target_file_id: z.string(),
    destination_parent_id: z.string(),
    shortcut_name: z.string().optional(),
  }),
  z.object({
    operation: z.literal("noop"),
    reason: z.string(),
  }),
]);

export type GoogleDrivePlan = z.infer<typeof GoogleDrivePlanSchema>;

export function validateGoogleDrivePlan(plan: unknown): GoogleDrivePlan {
  return GoogleDrivePlanSchema.parse(plan);
}
