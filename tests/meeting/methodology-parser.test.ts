import { describe, it, expect } from "vitest";
import {
  parseMethodology,
  DEFAULT_METHODOLOGY,
  MethodologyParseError,
} from "../../src/meeting/methodology-parser.js";

describe("parseMethodology", () => {
  const validMarkdown = `# Daily Standup

## Phases
- UPDATES [initiator_only]: 30% — Each participant briefly shares status
- BLOCKERS [open_discussion]: 50% — Discuss and resolve blockers
- ACTIONS [open_discussion, assignments]: 20% — Assign unblocking tasks

## Rules
- Keep updates under 2 sentences
- Only raise blockers needing group input
`;

  it("parses a valid methodology markdown", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.id).toBe("standup");
    expect(m.name).toBe("Daily Standup");
    expect(m.phases).toHaveLength(3);
    expect(m.rules).toHaveLength(2);
  });

  it("parses phase names as lowercase", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.phases[0].name).toBe("updates");
    expect(m.phases[1].name).toBe("blockers");
    expect(m.phases[2].name).toBe("actions");
  });

  it("parses phase budgets correctly", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.phases[0].budget).toBe(0.3);
    expect(m.phases[1].budget).toBe(0.5);
    expect(m.phases[2].budget).toBe(0.2);
  });

  it("parses phase capabilities", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.phases[0].capabilities.has("initiator_only")).toBe(true);
    expect(m.phases[1].capabilities.has("open_discussion")).toBe(true);
    expect(m.phases[2].capabilities.has("open_discussion")).toBe(true);
    expect(m.phases[2].capabilities.has("assignments")).toBe(true);
  });

  it("parses phase descriptions", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.phases[0].description).toBe("Each participant briefly shares status");
    expect(m.phases[2].description).toBe("Assign unblocking tasks");
  });

  it("parses rules", () => {
    const m = parseMethodology("standup", validMarkdown);
    expect(m.rules[0]).toBe("Keep updates under 2 sentences");
    expect(m.rules[1]).toBe("Only raise blockers needing group input");
  });

  it("throws on missing H1 title", () => {
    const md = `## Phases
- FOO [open_discussion]: 100% — Do stuff
`;
    expect(() => parseMethodology("bad", md)).toThrow(MethodologyParseError);
    expect(() => parseMethodology("bad", md)).toThrow("Missing H1 title");
  });

  it("throws on no phases defined", () => {
    const md = `# Empty Meeting

## Phases

## Rules
- Be nice
`;
    expect(() => parseMethodology("bad", md)).toThrow("No phases defined");
  });

  it("throws on invalid capability name", () => {
    const md = `# Bad Meeting

## Phases
- FOO [invalid_cap]: 100% — Do stuff
`;
    expect(() => parseMethodology("bad", md)).toThrow('Invalid capability "invalid_cap"');
  });

  it("throws when budgets don't sum to ~100%", () => {
    const md = `# Bad Budget

## Phases
- A [open_discussion]: 30% — Phase A
- B [open_discussion]: 30% — Phase B
`;
    expect(() => parseMethodology("bad", md)).toThrow("budgets sum to 60%");
  });

  it("accepts budgets that sum to exactly 100%", () => {
    const md = `# Exact

## Phases
- A [open_discussion]: 50% — Phase A
- B [open_discussion]: 50% — Phase B
`;
    const m = parseMethodology("exact", md);
    expect(m.phases).toHaveLength(2);
  });

  it("accepts budgets within 5% tolerance", () => {
    const md = `# Close

## Phases
- A [open_discussion]: 48% — Phase A
- B [open_discussion]: 49% — Phase B
`;
    const m = parseMethodology("close", md);
    expect(m.phases).toHaveLength(2);
  });

  it("handles -- and - as dash separators", () => {
    const md = `# Dash Test

## Phases
- A [open_discussion]: 50% -- Phase with double dash
- B [open_discussion]: 50% - Phase with single dash
`;
    const m = parseMethodology("dash", md);
    expect(m.phases[0].description).toBe("Phase with double dash");
    expect(m.phases[1].description).toBe("Phase with single dash");
  });

  it("handles methodology with no rules section", () => {
    const md = `# No Rules

## Phases
- ONLY [open_discussion]: 100% — Just discuss
`;
    const m = parseMethodology("norules", md);
    expect(m.rules).toHaveLength(0);
  });

  it("handles proposals capability", () => {
    const md = `# Voting

## Phases
- VOTE [proposals]: 100% — Vote on things
`;
    const m = parseMethodology("voting", md);
    expect(m.phases[0].capabilities.has("proposals")).toBe(true);
  });
});

describe("DEFAULT_METHODOLOGY", () => {
  it("has id 'general'", () => {
    expect(DEFAULT_METHODOLOGY.id).toBe("general");
  });

  it("has 4 phases in the correct order", () => {
    const names = DEFAULT_METHODOLOGY.phases.map((p) => p.name);
    expect(names).toEqual(["present", "discuss", "decide", "assign"]);
  });

  it("has budgets that sum to 1.0", () => {
    const total = DEFAULT_METHODOLOGY.phases.reduce((sum, p) => sum + p.budget, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("present phase has initiator_only capability", () => {
    expect(DEFAULT_METHODOLOGY.phases[0].capabilities.has("initiator_only")).toBe(true);
  });

  it("discuss phase has open_discussion capability", () => {
    expect(DEFAULT_METHODOLOGY.phases[1].capabilities.has("open_discussion")).toBe(true);
  });

  it("decide phase has proposals capability", () => {
    expect(DEFAULT_METHODOLOGY.phases[2].capabilities.has("proposals")).toBe(true);
  });

  it("assign phase has assignments capability", () => {
    expect(DEFAULT_METHODOLOGY.phases[3].capabilities.has("assignments")).toBe(true);
  });

  it("has matching budget allocations (20/50/20/10)", () => {
    expect(DEFAULT_METHODOLOGY.phases[0].budget).toBe(0.2);
    expect(DEFAULT_METHODOLOGY.phases[1].budget).toBe(0.5);
    expect(DEFAULT_METHODOLOGY.phases[2].budget).toBe(0.2);
    expect(DEFAULT_METHODOLOGY.phases[3].budget).toBe(0.1);
  });
});
