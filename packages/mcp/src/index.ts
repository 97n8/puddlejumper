/**
 * PuddleJumper MCP Layer
 * Model Context Protocol — 60+ tools across 12 domains
 * 
 * Slot: drop existing MCP tool definitions into src/domains/
 * Each domain exports its tools. The registry aggregates them.
 * 
 * Domains:
 *   flows, vault, audit, org, finance, permits,
 *   records, procurement, hr, infrastructure, planning, comms
 * 
 * // GPR
 */

export interface MCPTool {
  name: string;
  domain: string;
  description: string;
  parameters: Record<string, MCPParam>;
  handler: (params: Record<string, unknown>, context: MCPContext) => Promise<unknown>;
}

export interface MCPParam {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
}

export interface MCPContext {
  tenantId: string;
  actorId: string;
  /** AI assists, never decides. MCP tools must respect this. */
  isAiAssist: boolean;
}

/** Tool registry — aggregates all domain tools */
export class MCPRegistry {
  private tools = new Map<string, MCPTool>();

  register(tool: MCPTool): void {
    this.tools.set(`${tool.domain}.${tool.name}`, tool);
  }

  get(qualifiedName: string): MCPTool | undefined {
    return this.tools.get(qualifiedName);
  }

  listByDomain(domain: string): MCPTool[] {
    return [...this.tools.values()].filter((t) => t.domain === domain);
  }

  listAll(): MCPTool[] {
    return [...this.tools.values()];
  }
}

export const registry = new MCPRegistry();
