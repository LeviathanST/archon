import type { Phase } from "./types.js";

/**
 * Phase state machine: PRESENT → DISCUSS → DECIDE → ASSIGN → completed.
 * Can be cancelled from any phase.
 */

const PHASE_ORDER: Phase[] = ["present", "discuss", "decide", "assign"];

export function nextPhase(current: Phase): Phase | "completed" {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return "completed";
  return PHASE_ORDER[idx + 1];
}

export function isValidPhase(phase: string): phase is Phase {
  return PHASE_ORDER.includes(phase as Phase);
}

export function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

export const PHASES = PHASE_ORDER;
