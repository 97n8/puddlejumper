/**
 * CAL — Civic Automation Layer
 * 
 * Automation that is civic-aware: knows about boards, committees,
 * meeting schedules, public notice requirements, and statutory deadlines.
 * 
 * Slot: drop existing CAL logic here.
 * 
 * // GPR
 */

export interface CivicAutomation {
  id: string;
  tenantId: string;
  name: string;
  type: "notice" | "deadline" | "workflow" | "report";
  config: Record<string, unknown>;
  active: boolean;
}
