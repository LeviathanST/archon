/**
 * Regression tests for Bug 8 (issue #54): Partial participant join with grace period.
 *
 * These tests use vi.useFakeTimers() to control the 30s grace period timer.
 * They are in a separate file from meeting-room.test.ts to avoid fake timers
 * interfering with the DB connection pool cleanup in that file's afterAll.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { MeetingRoom } from "../../src/meeting/meeting-room.js";

// Collect messages sent to agents
type SentMessage = { agentId: string; message: unknown };
let sent: SentMessage[] = [];
const mockSend = (agentId: string, message: unknown): boolean => {
  sent.push({ agentId, message: message as Record<string, unknown> });
  return true;
};

function messagesOfType(type: string) {
  return sent.filter((s) => (s.message as { type: string }).type === type);
}

const INITIATOR = "grace-test-initiator";
const AGENT_A = "grace-test-a";
const AGENT_B = "grace-test-b";

describe("MeetingRoom — grace period join (Bug 8, issue #54)", () => {
  afterEach(() => {
    vi.useRealTimers();
    sent = [];
  });

  it("all agents join — meeting starts immediately, no delay", () => {
    vi.useFakeTimers();
    sent = [];

    const room = new MeetingRoom({
      id: "grace-all-join-test",
      title: "Grace All Join",
      initiatorId: INITIATOR,
      invitees: [AGENT_A],
      send: mockSend,
    });

    room.join(INITIATOR);
    room.join(AGENT_A);

    // broadcastPhaseChange should have fired immediately — no timer advance needed
    const phaseChanges = messagesOfType("meeting.phase_change");
    expect(phaseChanges.length).toBeGreaterThan(0);

    // Confirm it does NOT fire again when we advance past the grace window
    const countBefore = phaseChanges.length;
    vi.advanceTimersByTime(30_000);
    expect(messagesOfType("meeting.phase_change").length).toBe(countBefore);
  });

  it("partial join — meeting starts after 30s grace period", () => {
    vi.useFakeTimers();
    sent = [];

    const room = new MeetingRoom({
      id: "grace-partial-join-test",
      title: "Grace Partial Join",
      initiatorId: INITIATOR,
      invitees: [AGENT_A, AGENT_B],
      send: mockSend,
    });

    room.join(INITIATOR);
    room.join(AGENT_A);
    // AGENT_B never joins

    // Before grace period expires — no phase_change yet
    expect(messagesOfType("meeting.phase_change")).toHaveLength(0);

    // Advance to exactly the grace period
    vi.advanceTimersByTime(30_000);

    // Now broadcastPhaseChange should have fired
    expect(messagesOfType("meeting.phase_change").length).toBeGreaterThan(0);
  });

  it("no double-broadcast if all join right as timer fires", () => {
    vi.useFakeTimers();
    sent = [];

    const room = new MeetingRoom({
      id: "grace-no-double-test",
      title: "Grace No Double",
      initiatorId: INITIATOR,
      invitees: [AGENT_A],
      send: mockSend,
    });

    room.join(INITIATOR);
    // Timer is now running — 1 of 2 joined

    // Second agent joins before timer fires — cancels timer, starts immediately
    room.join(AGENT_A);

    // Advance past the grace window — timer was cancelled, should not fire again
    vi.advanceTimersByTime(30_000);

    // broadcastPhaseChange was called exactly once, broadcasting to both joined agents
    expect(messagesOfType("meeting.phase_change")).toHaveLength(2);
  });
});
