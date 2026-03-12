/**
 * Methodology interfaces — defines the shape of user-defined meeting flows.
 *
 * A methodology is a sequence of phases, each with a name, budget allocation,
 * description, and a set of capabilities that the hub enforces.
 *
 * The 4 capabilities map to the hub's enforcement behaviors:
 * - initiator_only: only initiator can speak (e.g. PRESENT phase)
 * - open_discussion: relevance-based turn-taking (e.g. DISCUSS phase)
 * - proposals: enables propose/vote workflow (e.g. DECIDE phase)
 * - assignments: enables assign/acknowledge workflow (e.g. ASSIGN phase)
 */

export type PhaseCapability = "initiator_only" | "open_discussion" | "proposals" | "assignments";

export const VALID_CAPABILITIES = new Set<PhaseCapability>([
  "initiator_only",
  "open_discussion",
  "proposals",
  "assignments",
]);

export interface PhaseDefinition {
  name: string;
  budget: number; // 0.0–1.0
  description: string;
  capabilities: Set<PhaseCapability>;
}

export interface Methodology {
  id: string;
  name: string;
  phases: PhaseDefinition[];
  rules: string[];
}
