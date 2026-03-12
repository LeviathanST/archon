/**
 * Parses methodology markdown files into Methodology objects.
 *
 * Format:
 *   # Meeting Name
 *
 *   ## Phases
 *   - PHASE_NAME [cap1, cap2]: NN% — Description text
 *
 *   ## Rules
 *   - Rule text here
 */

import type { Methodology, PhaseDefinition, PhaseCapability } from "./methodology.js";
import { VALID_CAPABILITIES } from "./methodology.js";

// --- Default methodology (the original 4-phase flow) ---

export const DEFAULT_METHODOLOGY: Methodology = {
  id: "general",
  name: "General Meeting",
  phases: [
    {
      name: "present",
      budget: 0.2,
      description: "Initiator presents the topic and agenda",
      capabilities: new Set<PhaseCapability>(["initiator_only"]),
    },
    {
      name: "discuss",
      budget: 0.5,
      description: "Open discussion with relevance-based turns",
      capabilities: new Set<PhaseCapability>(["open_discussion"]),
    },
    {
      name: "decide",
      budget: 0.2,
      description: "Propose solutions and vote on them",
      capabilities: new Set<PhaseCapability>(["open_discussion", "proposals"]),
    },
    {
      name: "assign",
      budget: 0.1,
      description: "Assign action items and get acknowledgements",
      capabilities: new Set<PhaseCapability>(["open_discussion", "assignments"]),
    },
  ],
  rules: [],
};

// --- Parser ---

export class MethodologyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MethodologyParseError";
  }
}

const PHASE_LINE_RE = /^-\s+(\w+)\s+\[([^\]]*)\]:\s*(\d+)%\s*(?:—|--|-)\s*(.+)$/;

export function parseMethodology(id: string, markdown: string): Methodology {
  const lines = markdown.split("\n");

  // Parse H1 → name
  let name = "";
  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      name = h1Match[1].trim();
      break;
    }
  }
  if (!name) {
    throw new MethodologyParseError("Missing H1 title (# Meeting Name)");
  }

  // Find sections
  const phases: PhaseDefinition[] = [];
  const rules: string[] = [];
  let currentSection: "none" | "phases" | "rules" = "none";

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (/^##\s+Phases/i.test(trimmed)) {
      currentSection = "phases";
      continue;
    }
    if (/^##\s+Rules/i.test(trimmed)) {
      currentSection = "rules";
      continue;
    }
    // Any other H2 ends current section
    if (/^##\s+/.test(trimmed)) {
      currentSection = "none";
      continue;
    }

    if (currentSection === "phases") {
      const match = trimmed.match(PHASE_LINE_RE);
      if (match) {
        const phaseName = match[1].toLowerCase();
        const capsRaw = match[2].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
        const budget = parseInt(match[3], 10);
        const description = match[4].trim();

        // Validate capabilities
        const capabilities = new Set<PhaseCapability>();
        for (const cap of capsRaw) {
          if (!VALID_CAPABILITIES.has(cap as PhaseCapability)) {
            throw new MethodologyParseError(
              `Invalid capability "${cap}" in phase "${phaseName}". ` +
              `Valid: ${[...VALID_CAPABILITIES].join(", ")}`
            );
          }
          capabilities.add(cap as PhaseCapability);
        }

        phases.push({
          name: phaseName,
          budget: budget / 100,
          description,
          capabilities,
        });
      }
    }

    if (currentSection === "rules") {
      const ruleMatch = trimmed.match(/^-\s+(.+)/);
      if (ruleMatch) {
        rules.push(ruleMatch[1].trim());
      }
    }
  }

  if (phases.length === 0) {
    throw new MethodologyParseError("No phases defined in ## Phases section");
  }

  // Validate budgets sum to ~100%
  const totalBudget = phases.reduce((sum, p) => sum + p.budget, 0);
  if (Math.abs(totalBudget - 1.0) > 0.05) {
    throw new MethodologyParseError(
      `Phase budgets sum to ${Math.round(totalBudget * 100)}%, expected ~100%`
    );
  }

  return { id, name, phases, rules };
}
