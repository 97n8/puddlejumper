// ── GitHub Connector Dispatcher ─────────────────────────────────────────────
//
// Executes approved GitHub plan steps by creating branches, commits, and PRs
// via the GitHub REST API.
//
// Requires GITHUB_DISPATCH_TOKEN env var (a PAT or app installation token
// with repo scope).
//
import type { ConnectorDispatcher, PlanStepInput, DispatchStepResult, DispatchContext } from "../dispatch.js";

// ── Types ───────────────────────────────────────────────────────────────────

type GitHubFile = {
  name: string;
  content: string;
  encoding: "utf-8" | "base64";
};

type GitHubPlanData = {
  connector: string;
  operation: string;
  repo: string;
  branchName: string;
  commitMessage?: string;
  commitMessageTemplate?: string;
  enforceBranchProtection?: boolean;
  files?: GitHubFile[];
  target?: string;
  planHash?: string;
};

// ── Dispatcher ──────────────────────────────────────────────────────────────

export class GitHubDispatcher implements ConnectorDispatcher {
  readonly connectorName = "github" as const;

  private get token(): string | undefined {
    return process.env.GITHUB_DISPATCH_TOKEN;
  }

  private get apiBase(): string {
    return process.env.GITHUB_API_BASE ?? "https://api.github.com";
  }

  async healthCheck(): Promise<{ healthy: boolean; detail?: string }> {
    if (!this.token) {
      return { healthy: false, detail: "GITHUB_DISPATCH_TOKEN not configured" };
    }
    try {
      const res = await fetch(`${this.apiBase}/rate_limit`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        return { healthy: false, detail: `GitHub API returned ${res.status}` };
      }
      const json = (await res.json()) as Record<string, any>;
      const remaining = json?.rate?.remaining ?? 0;
      return { healthy: remaining > 10, detail: `Rate limit remaining: ${remaining}` };
    } catch (err) {
      return { healthy: false, detail: `GitHub API unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async dispatch(step: PlanStepInput, context: DispatchContext): Promise<DispatchStepResult> {
    const plan = step.plan as unknown as GitHubPlanData;

    if (!this.token) {
      return {
        stepId: step.stepId,
        connector: "github",
        status: "failed",
        error: "GITHUB_DISPATCH_TOKEN not configured",
        completedAt: new Date().toISOString(),
      };
    }

    if (!plan.repo) {
      return {
        stepId: step.stepId,
        connector: "github",
        status: "failed",
        error: "Missing repo in plan",
        completedAt: new Date().toISOString(),
      };
    }

    if (context.dryRun) {
      return {
        stepId: step.stepId,
        connector: "github",
        status: "dispatched",
        result: {
          dryRun: true,
          operation: plan.operation,
          repo: plan.repo,
          branchName: plan.branchName,
          message: "Dry run — no changes made",
        },
        completedAt: new Date().toISOString(),
      };
    }

    try {
      if (plan.operation === "prepare_branch_and_pr") {
        return await this.createBranchAndPr(step, plan, context);
      } else if (plan.operation === "prepare_direct_commit") {
        return await this.directCommit(step, plan, context);
      } else {
        return {
          stepId: step.stepId,
          connector: "github",
          status: "failed",
          error: `Unknown operation: ${plan.operation}`,
          completedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      return {
        stepId: step.stepId,
        connector: "github",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      };
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PuddleJumper/Dispatch",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Create a branch, commit files, and open a PR.
   */
  private async createBranchAndPr(
    step: PlanStepInput,
    plan: GitHubPlanData,
    context: DispatchContext,
  ): Promise<DispatchStepResult> {
    const { repo, branchName, files = [] } = plan;
    const commitMessage = plan.commitMessage ?? plan.commitMessageTemplate ?? `[PuddleJumper] ${step.description}`;

    // 1. Get default branch SHA
    const repoRes = await this.api(`/repos/${repo}`);
    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repo ${repo}: ${repoRes.status}`);
    }
    const repoData = (await repoRes.json()) as Record<string, any>;
    const defaultBranch = repoData.default_branch ?? "main";

    const refRes = await this.api(`/repos/${repo}/git/ref/heads/${defaultBranch}`);
    if (!refRes.ok) {
      throw new Error(`Failed to get ref for ${defaultBranch}: ${refRes.status}`);
    }
    const refData = (await refRes.json()) as Record<string, any>;
    const baseSha = refData.object?.sha;

    // 2. Create branch
    const createRefRes = await this.api(`/repos/${repo}/git/refs`, "POST", {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    if (!createRefRes.ok) {
      const errBody = await createRefRes.text().catch(() => "");
      // Branch may already exist — not fatal for idempotent operations
      if (!errBody.includes("Reference already exists")) {
        throw new Error(`Failed to create branch ${branchName}: ${createRefRes.status} ${errBody}`);
      }
    }

    // 3. Commit files
    for (const file of files) {
      const content = file.encoding === "base64"
        ? file.content
        : Buffer.from(file.content, "utf-8").toString("base64");

      const putRes = await this.api(`/repos/${repo}/contents/${file.name}`, "PUT", {
        message: commitMessage,
        content,
        branch: branchName,
      });
      if (!putRes.ok) {
        // If file exists, we need to supply the sha — get it first
        const existingRes = await this.api(`/repos/${repo}/contents/${file.name}?ref=${branchName}`);
        if (existingRes.ok) {
          const existingData = (await existingRes.json()) as Record<string, any>;
          const updateRes = await this.api(`/repos/${repo}/contents/${file.name}`, "PUT", {
            message: commitMessage,
            content,
            branch: branchName,
            sha: existingData.sha,
          });
          if (!updateRes.ok) {
            throw new Error(`Failed to update file ${file.name}: ${updateRes.status}`);
          }
        } else {
          throw new Error(`Failed to create file ${file.name}: ${putRes.status}`);
        }
      }
    }

    // 4. Open PR
    const prRes = await this.api(`/repos/${repo}/pulls`, "POST", {
      title: `[PuddleJumper] ${step.description}`,
      head: branchName,
      base: defaultBranch,
      body: [
        `**Automated by PuddleJumper Governance Engine**`,
        ``,
        `- Approval ID: \`${context.approvalId}\``,
        `- Request ID: \`${context.requestId}\``,
        `- Operator: \`${context.operatorId}\``,
        `- Plan Hash: \`${plan.planHash ?? "n/a"}\``,
        ``,
        `> ${step.description}`,
      ].join("\n"),
    });

    let prUrl: string | null = null;
    let prNumber: number | null = null;
    if (prRes.ok) {
      const prData = (await prRes.json()) as Record<string, any>;
      prUrl = prData.html_url ?? null;
      prNumber = prData.number ?? null;
    }
    // PR creation failure is not fatal — files are already committed

    return {
      stepId: step.stepId,
      connector: "github",
      status: "dispatched",
      result: {
        operation: "branch_and_pr",
        repo,
        branch: branchName,
        prUrl,
        prNumber,
        filesCommitted: files.length,
      },
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Commit files directly to the default branch.
   */
  private async directCommit(
    step: PlanStepInput,
    plan: GitHubPlanData,
    _context: DispatchContext,
  ): Promise<DispatchStepResult> {
    const { repo, files = [] } = plan;
    const commitMessage = plan.commitMessage ?? plan.commitMessageTemplate ?? `[PuddleJumper] ${step.description}`;

    for (const file of files) {
      const content = file.encoding === "base64"
        ? file.content
        : Buffer.from(file.content, "utf-8").toString("base64");

      // Check if file exists
      const existingRes = await this.api(`/repos/${repo}/contents/${file.name}`);
      const body: Record<string, unknown> = { message: commitMessage, content };

      if (existingRes.ok) {
        const existingData = (await existingRes.json()) as Record<string, any>;
        body.sha = existingData.sha;
      }

      const putRes = await this.api(`/repos/${repo}/contents/${file.name}`, "PUT", body);
      if (!putRes.ok) {
        throw new Error(`Failed to commit ${file.name} to ${repo}: ${putRes.status}`);
      }
    }

    return {
      stepId: step.stepId,
      connector: "github",
      status: "dispatched",
      result: {
        operation: "direct_commit",
        repo,
        filesCommitted: files.length,
      },
      completedAt: new Date().toISOString(),
    };
  }

  private async api(endpoint: string, method: string = "GET", body?: unknown): Promise<Response> {
    const opts: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    return fetch(`${this.apiBase}${endpoint}`, opts);
  }
}
