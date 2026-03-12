import { DEFAULT_METHODOLOGY } from "./methodology-parser.js";
import type { Methodology } from "./methodology.js";

/**
 * Phase state machine — derived from the default methodology for backward compat.
 *
 * For custom methodologies, use Methodology.phases directly.
 */

const PHASE_ORDER: string[] = DEFAULT_METHODOLOGY.phases.map((p) => p.name);

export function nextPhase(current: string, methodology?: Methodology): string | "completed" {
  const phases = methodology
    ? methodology.phases.map((p) => p.name)
    : PHASE_ORDER;
  const idx = phases.indexOf(current);
  if (idx === -1 || idx === phases.length - 1) return "completed";
  return phases[idx + 1];
}

export function isValidPhase(phase: string, methodology?: Methodology): boolean {
  const phases = methodology
    ? methodology.phases.map((p) => p.name)
    : PHASE_ORDER;
  return phases.includes(phase);
}

export function phaseIndex(phase: string, methodology?: Methodology): number {
  const phases = methodology
    ? methodology.phases.map((p) => p.name)
    : PHASE_ORDER;
  return phases.indexOf(phase);
}

export const PHASES = PHASE_ORDER;
