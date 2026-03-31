/**
 * Regression tests for scripts/start-meeting.ts — Bug 1 (issue #53).
 *
 * start-meeting.ts auto-runs on import (it's a script), so we cannot import it.
 * Instead we read the source file and assert on its text content.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SOURCE_PATH = resolve(import.meta.dirname, "../../scripts/start-meeting.ts");
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("start-meeting.ts — chatViaClaude uses Agent SDK (Bug 1, issue #53)", () => {
  it("uses dynamic import of @anthropic-ai/claude-agent-sdk", () => {
    expect(source).toContain('import("@anthropic-ai/claude-agent-sdk")');
  });

  it("does NOT use the old --no-session-persistence CLI flag", () => {
    expect(source).not.toContain("--no-session-persistence");
  });

  it("passes settingSources: [] for session isolation", () => {
    expect(source).toContain("settingSources: []");
  });

  it("passes permissionMode to bypass permissions", () => {
    expect(source).toContain("permissionMode");
  });
});
