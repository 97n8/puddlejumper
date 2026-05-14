// ── Approval Chain Store ─────────────────────────────────────────────────────
//
// Multi-step approval chains extend the single-step approval gate.
//
// A chain is an ordered sequence of approval steps attached to an approval.
// Each step requires a specific role. Steps at the same order value run
// in parallel — all must be approved before the next order activates.
//
//   order 0 (active) → all approved → order 1 (active) → ... → done
//
// When ALL steps are approved, the parent approval transitions from
// "pending" to "approved" (eligible for dispatch). Rejection at any
// step makes the entire approval "rejected" (terminal — remaining skipped).
//
// Boundary:
//   PJ owns: routing, sequencing, step status tracking.
//   VAULT owns: who is authorized to approve, policy definitions.
//   Chain templates define routing order, not authorization rules.
//
import crypto from "node:crypto";
import type Database from "better-sqlite3";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Defines a reusable chain shape — an ordered list of required roles.
 *
 * Today: stored in SQLite as a local stand-in.
 * Future: returned by PolicyProvider.getChainTemplate().
 */
export type ChainTemplate = {
  id: string;
  name: string;
  description: string;
  /** Ordered step definitions. Index = step order (0-based). */
  steps: ChainTemplateStep[];
  createdAt: string;
  updatedAt: string;
  workspace_id: string;
};

export type ChainTemplateStep = {
  /** 0-based order within the chain. */
  order: number;
  /** Role required to decide this step. */
  requiredRole: string;
  /** Human-readable label for this step. */
  label: string;
};

/** Status of a single chain step instance. */
export type ChainStepStatus = "pending" | "active" | "approved" | "rejected" | "skipped";

/**
 * A chain step instance — one row per step per approval.
 *
 * Created when an approval is created. Progressed as decisions arrive.
 */
export type ChainStepRow = {
  id: string;
  approvalId: string;
  templateId: string;
  stepOrder: number;
  requiredRole: string;
  label: string;
  status: ChainStepStatus;
  deciderId: string | null;
  deciderNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChainStepDecision = {
  stepId: string;
  deciderId: string;
  status: "approved" | "rejected";
  note?: string;
};

/** Summary of chain progress for an approval. */
export type ChainProgress = {
  approvalId: string;
  templateId: string;
  templateName: string;
  totalSteps: number;
  completedSteps: number;
  /** First active step (backward-compatible). */
  currentStep: ChainStepRow | null;
  /** All currently active steps (parallel support). */
  currentSteps: ChainStepRow[];
  steps: ChainStepRow[];
  /** True when all steps are approved. */
  allApproved: boolean;
  /** True when any step is rejected (terminal). */
  rejected: boolean;
};

/** Lightweight chain summary for embedding in approval list responses. */
export type ChainSummary = {
  templateId: string;
  templateName: string;
  totalSteps: number;
  completedSteps: number;
  currentStepLabel: string | null;
  allApproved: boolean;
  rejected: boolean;
};

// ── Constants ───────────────────────────────────────────────────────────────

/** The default template used for legacy single-step approvals. */
export const DEFAULT_TEMPLATE_ID = "default";
export const DEFAULT_TEMPLATE_NAME = "Single Admin Approval";

// ── Store ───────────────────────────────────────────────────────────────────

/**
 * Manages approval chain templates and step instances.
 *
 * Shares the same SQLite database as ApprovalStore — receives the db
 * handle rather than opening its own connection.
 */
export class ChainStore {
  constructor(private readonly db: Database.Database) {
    this.initialize();
  }

  // ── Schema ──────────────────────────────────────────────────────────────

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approval_chain_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        steps_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        workspace_id TEXT NOT NULL DEFAULT 'system'
      );

      CREATE TABLE IF NOT EXISTS approval_chain_steps (
        id TEXT PRIMARY KEY,
        approval_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        required_role TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        decider_id TEXT,
        decider_note TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (approval_id) REFERENCES approvals(id)
      );

      CREATE INDEX IF NOT EXISTS idx_chain_steps_approval
        ON approval_chain_steps(approval_id);
      CREATE INDEX IF NOT EXISTS idx_chain_steps_status
        ON approval_chain_steps(status);
      CREATE INDEX IF NOT EXISTS idx_chain_templates_workspace
        ON approval_chain_templates(workspace_id);
    `);

    // Migration: add workspace_id column if missing
    const pragma = this.db.prepare("PRAGMA table_info(approval_chain_templates)").all();
    if (!pragma.some((col: any) => col.name === "workspace_id")) {
      this.db.exec("ALTER TABLE approval_chain_templates ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'system'");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_templates_workspace ON approval_chain_templates(workspace_id)");
    }

    // Migration: drop old UNIQUE index (from 30-day milestone) and replace
    // with non-unique to support parallel steps at the same order.
    this.db.exec(`DROP INDEX IF EXISTS idx_chain_steps_approval_order`);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chain_steps_approval_order_v2
        ON approval_chain_steps(approval_id, step_order);
    `);

    this.ensureDefaultTemplate();
  }

  private ensureDefaultTemplate(): void {
    const existing = this.db
      .prepare("SELECT id FROM approval_chain_templates WHERE id = ?")
      .get(DEFAULT_TEMPLATE_ID) as { id: string } | undefined;

    if (!existing) {
      const now = new Date().toISOString();
      const steps: ChainTemplateStep[] = [
        { order: 0, requiredRole: "admin", label: "Admin Approval" },
      ];
      this.db.prepare(`
        INSERT INTO approval_chain_templates (id, name, description, steps_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        DEFAULT_TEMPLATE_ID,
        DEFAULT_TEMPLATE_NAME,
        "Default single-step approval requiring admin role. Backward-compatible with V1 approval gate.",
        JSON.stringify(steps),
        now, now,
      );
    }
  }

  // ── Template CRUD ─────────────────────────────────────────────────────

  /**
   * Create a chain template.
   * Steps are validated: at least 1 step, unique orders, orders sequential from 0.
   */
  createTemplate(input: {
    id?: string;
    name: string;
    description?: string;
    steps: ChainTemplateStep[];
    workspaceId?: string;
  }): ChainTemplate {
    if (input.steps.length === 0) {
      throw new Error("Chain template must have at least one step");
    }

    // Validate step orders: must be dense (0, 1, 2, ...) but multiple steps
    // can share the same order value (parallel group).
    const sorted = [...input.steps].sort((a, b) => a.order - b.order);
    const distinctOrders = [...new Set(sorted.map(s => s.order))].sort((a, b) => a - b);
    for (let i = 0; i < distinctOrders.length; i++) {
      if (distinctOrders[i] !== i) {
        throw new Error(`Step orders must be sequential starting from 0. Expected ${i}, got ${distinctOrders[i]}`);
      }
    }

    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO approval_chain_templates (id, name, description, steps_json, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.description ?? "",
      JSON.stringify(sorted),
      now, now,
      input.workspaceId ?? "system",
    );

    return this.getTemplate(id)!;
  }

  getTemplate(id: string): ChainTemplate | null {
    const row = this.db
      .prepare("SELECT * FROM approval_chain_templates WHERE id = ?")
      .get(id) as any | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps_json) as ChainTemplateStep[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspace_id: row.workspace_id,
    };
  }

  listTemplates(opts: { workspaceId?: string } = {}): ChainTemplate[] {
    let sql = "SELECT * FROM approval_chain_templates";
    const params: any[] = [];
    if (opts.workspaceId) {
      sql += " WHERE workspace_id = ?";
      params.push(opts.workspaceId);
    }
    sql += " ORDER BY name";
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps_json) as ChainTemplateStep[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspace_id: row.workspace_id,
    }));
  }

  /**
   * Update an existing chain template.
   * Only name, description, and steps can be updated.
   * The default template cannot be updated.
   */
  updateTemplate(id: string, input: {
    name?: string;
    description?: string;
    steps?: ChainTemplateStep[];
  }): ChainTemplate {
    if (id === DEFAULT_TEMPLATE_ID) {
      throw new Error("The default template cannot be modified");
    }

    const existing = this.getTemplate(id);
    if (!existing) {
      throw new Error(`Chain template not found: ${id}`);
    }

    if (input.steps) {
      if (input.steps.length === 0) {
        throw new Error("Chain template must have at least one step");
      }
      const sorted = [...input.steps].sort((a, b) => a.order - b.order);
      const distinctOrders = [...new Set(sorted.map(s => s.order))].sort((a, b) => a - b);
      for (let i = 0; i < distinctOrders.length; i++) {
        if (distinctOrders[i] !== i) {
          throw new Error(`Step orders must be sequential starting from 0. Expected ${i}, got ${distinctOrders[i]}`);
        }
      }
    }

    const now = new Date().toISOString();
    const newName = input.name ?? existing.name;
    const newDescription = input.description ?? existing.description;
    const newSteps = input.steps ?? existing.steps;

    this.db.prepare(`
      UPDATE approval_chain_templates
      SET name = ?, description = ?, steps_json = ?, updated_at = ?
      WHERE id = ?
    `).run(newName, newDescription, JSON.stringify(newSteps), now, id);

    return this.getTemplate(id)!;
  }

  /**
   * Delete a chain template.
   * The default template cannot be deleted.
   * Templates in use by active chains should be checked before calling this.
   */
  deleteTemplate(id: string): boolean {
    if (id === DEFAULT_TEMPLATE_ID) {
      throw new Error("The default template cannot be deleted");
    }

    const result = this.db
      .prepare("DELETE FROM approval_chain_templates WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  /**
   * Count active chains (pending or active steps) using a given template.
   * Used to prevent deletion of templates that are in use.
   */
  countActiveChainsByTemplate(templateId: string): number {
    const row = this.db
      .prepare(`
        SELECT COUNT(DISTINCT approval_id) as cnt
        FROM approval_chain_steps
        WHERE template_id = ? AND status IN ('pending', 'active')
      `)
      .get(templateId) as { cnt: number };
    return row.cnt;
  }

  // ── Chain Instance Lifecycle ──────────────────────────────────────────

  /**
   * Create chain step instances for an approval from a template.
   *
   * All steps at order 0 are set to "active" (ready for decision).
   * Remaining steps are "pending" (waiting for prior order groups).
   *
   * Returns the created step rows.
   */
  createChainForApproval(approvalId: string, templateId: string = DEFAULT_TEMPLATE_ID): ChainStepRow[] {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Chain template not found: ${templateId}`);
    }

    const existingSteps = this.getStepsForApproval(approvalId);
    if (existingSteps.length > 0) {
      throw new Error(`Chain already exists for approval: ${approvalId}`);
    }

    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO approval_chain_steps
        (id, approval_id, template_id, step_order, required_role, label, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = this.db.transaction(() => {
      for (const step of template.steps) {
        const status: ChainStepStatus = step.order === 0 ? "active" : "pending";
        insert.run(
          crypto.randomUUID(),
          approvalId,
          templateId,
          step.order,
          step.requiredRole,
          step.label,
          status,
          now, now,
        );
      }
    });
    insertAll();

    return this.getStepsForApproval(approvalId);
  }

  // ── Step Queries ──────────────────────────────────────────────────────

  getStepsForApproval(approvalId: string): ChainStepRow[] {
    return this.db
      .prepare("SELECT * FROM approval_chain_steps WHERE approval_id = ? ORDER BY step_order")
      .all(approvalId)
      .map(rowToChainStep);
  }

  getStep(stepId: string): ChainStepRow | null {
    const row = this.db
      .prepare("SELECT * FROM approval_chain_steps WHERE id = ?")
      .get(stepId) as any | undefined;
    return row ? rowToChainStep(row) : null;
  }

  /**
   * Get the current active step for an approval (the step awaiting decision).
   * Returns the first active step by order. For parallel chains, use getActiveSteps().
   * Returns null if no step is active (all done, or chain rejected).
   */
  getActiveStep(approvalId: string): ChainStepRow | null {
    const row = this.db
      .prepare("SELECT * FROM approval_chain_steps WHERE approval_id = ? AND status = 'active' ORDER BY step_order LIMIT 1")
      .get(approvalId) as any | undefined;
    return row ? rowToChainStep(row) : null;
  }

  /**
   * Get ALL currently active steps for an approval.
   * For parallel chains this returns multiple steps at the same order.
   */
  getActiveSteps(approvalId: string): ChainStepRow[] {
    return this.db
      .prepare("SELECT * FROM approval_chain_steps WHERE approval_id = ? AND status = 'active' ORDER BY step_order")
      .all(approvalId)
      .map(rowToChainStep);
  }

  // ── Step Decision ─────────────────────────────────────────────────────

  /**
   * Decide a chain step (approve or reject).
   *
   * Rules:
   * - Only an "active" step can be decided.
   * - On approve: if all siblings at the same order are now approved,
   *   activate all steps at the next order. Otherwise, wait.
   * - On reject: mark step "rejected", skip all active siblings at the
   *   same order and all subsequent steps.
   *
   * Returns:
   * - `{ advanced: true, allApproved: false }` — next order group activated
   * - `{ advanced: false, allApproved: true }` — chain complete, ready for dispatch
   * - `{ advanced: false, allApproved: false, rejected: true }` — chain rejected
   * - `{ advanced: false, allApproved: false, rejected: false }` — step approved,
   *     but parallel siblings at same order still active (waiting)
   * - `null` — step not found or not in "active" state
   */
  decideStep(decision: ChainStepDecision): {
    step: ChainStepRow;
    advanced: boolean;
    allApproved: boolean;
    rejected: boolean;
  } | null {
    const step = this.getStep(decision.stepId);
    if (!step || step.status !== "active") return null;

    const now = new Date().toISOString();

    if (decision.status === "rejected") {
      // Reject this step, skip active siblings at same order, and skip all subsequent
      return this.db.transaction(() => {
        // Mark this step rejected
        this.db.prepare(`
          UPDATE approval_chain_steps
          SET status = 'rejected', decider_id = ?, decider_note = ?, decided_at = ?, updated_at = ?
          WHERE id = ?
        `).run(decision.deciderId, decision.note ?? null, now, now, decision.stepId);

        // Skip active siblings at the same order
        this.db.prepare(`
          UPDATE approval_chain_steps
          SET status = 'skipped', updated_at = ?
          WHERE approval_id = ? AND step_order = ? AND status = 'active' AND id != ?
        `).run(now, step.approvalId, step.stepOrder, decision.stepId);

        // Skip all subsequent steps (pending at higher orders)
        this.db.prepare(`
          UPDATE approval_chain_steps
          SET status = 'skipped', updated_at = ?
          WHERE approval_id = ? AND step_order > ? AND status IN ('pending', 'active')
        `).run(now, step.approvalId, step.stepOrder);

        const updatedStep = this.getStep(decision.stepId)!;
        return { step: updatedStep, advanced: false, allApproved: false, rejected: true };
      })();
    }

    // Approve this step
    return this.db.transaction(() => {
      this.db.prepare(`
        UPDATE approval_chain_steps
        SET status = 'approved', decider_id = ?, decider_note = ?, decided_at = ?, updated_at = ?
        WHERE id = ?
      `).run(decision.deciderId, decision.note ?? null, now, now, decision.stepId);

      // Check if any siblings at the same order are still active
      const activeSiblings = this.db
        .prepare("SELECT COUNT(*) as cnt FROM approval_chain_steps WHERE approval_id = ? AND step_order = ? AND status = 'active'")
        .get(step.approvalId, step.stepOrder) as { cnt: number };

      if (activeSiblings.cnt > 0) {
        // Parallel siblings still active — wait for them
        const updatedStep = this.getStep(decision.stepId)!;
        return { step: updatedStep, advanced: false, allApproved: false, rejected: false };
      }

      // All siblings at this order are done. Check for next order group.
      const nextOrderSteps = this.db
        .prepare("SELECT * FROM approval_chain_steps WHERE approval_id = ? AND step_order = ? AND status = 'pending'")
        .all(step.approvalId, step.stepOrder + 1) as any[];

      if (nextOrderSteps.length > 0) {
        // Activate ALL steps at the next order
        this.db.prepare(
          "UPDATE approval_chain_steps SET status = 'active', updated_at = ? WHERE approval_id = ? AND step_order = ? AND status = 'pending'"
        ).run(now, step.approvalId, step.stepOrder + 1);
        const updatedStep = this.getStep(decision.stepId)!;
        return { step: updatedStep, advanced: true, allApproved: false, rejected: false };
      }

      // No next order — chain is complete
      const updatedStep = this.getStep(decision.stepId)!;
      return { step: updatedStep, advanced: false, allApproved: true, rejected: false };
    })();
  }

  // ── Chain Progress ────────────────────────────────────────────────────

  /**
   * Get full chain progress for an approval.
   * Returns null if no chain exists.
   */
  getChainProgress(approvalId: string): ChainProgress | null {
    const steps = this.getStepsForApproval(approvalId);
    if (steps.length === 0) return null;

    const templateId = steps[0].templateId;
    const template = this.getTemplate(templateId);

    const completedSteps = steps.filter((s) => s.status === "approved").length;
    const currentSteps = steps.filter((s) => s.status === "active");
    const currentStep = currentSteps[0] ?? null;
    const allApproved = steps.every((s) => s.status === "approved");
    const rejected = steps.some((s) => s.status === "rejected");

    return {
      approvalId,
      templateId,
      templateName: template?.name ?? "Unknown",
      totalSteps: steps.length,
      completedSteps,
      currentStep,
      currentSteps,
      steps,
      allApproved,
      rejected,
    };
  }

  /**
   * Get a lightweight chain summary for embedding in approval list responses.
   * Returns null if no chain exists.
   */
  getChainSummary(approvalId: string): ChainSummary | null {
    const steps = this.getStepsForApproval(approvalId);
    if (steps.length === 0) return null;

    const templateId = steps[0].templateId;
    const template = this.getTemplate(templateId);
    const completedSteps = steps.filter((s) => s.status === "approved").length;
    const currentStep = steps.find((s) => s.status === "active") ?? null;

    return {
      templateId,
      templateName: template?.name ?? "Unknown",
      totalSteps: steps.length,
      completedSteps,
      currentStepLabel: currentStep?.label ?? null,
      allApproved: steps.every((s) => s.status === "approved"),
      rejected: steps.some((s) => s.status === "rejected"),
    };
  }

  /**
   * Count currently active chain steps across all approvals.
   * Used for the pending gauge metric.
   */
  countActiveSteps(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM approval_chain_steps WHERE status = 'active'")
      .get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Clone the default template into a new workspace if not present.
   * Idempotent: does nothing if a template with the same name exists in the workspace.
   */
  cloneDefaultTemplateToWorkspace(workspaceId: string): void {
    // Check if a template with the default name exists in this workspace
    const row = this.db.prepare(
      "SELECT id FROM approval_chain_templates WHERE workspace_id = ? AND name = ?"
    ).get(workspaceId, DEFAULT_TEMPLATE_NAME);
    if (row) return; // Already present
    // Get the default template
    const def = this.getTemplate(DEFAULT_TEMPLATE_ID);
    if (!def) return;
    const now = new Date().toISOString();
    const newId = `${DEFAULT_TEMPLATE_ID}-${workspaceId}`;
    this.db.prepare(`
      INSERT INTO approval_chain_templates (id, name, description, steps_json, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      def.name,
      def.description,
      JSON.stringify(def.steps),
      now, now,
      workspaceId
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToChainStep(row: any): ChainStepRow {
  return {
    id: row.id,
    approvalId: row.approval_id,
    templateId: row.template_id,
    stepOrder: row.step_order,
    requiredRole: row.required_role,
    label: row.label,
    status: row.status as ChainStepStatus,
    deciderId: row.decider_id,
    deciderNote: row.decider_note,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
