import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { meetings, meetingParticipants, meetingMessages } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { countTokens } from "./token-counter.js";
import { nextPhase } from "./phases.js";
import { TurnManager } from "./turn-manager.js";
import {
  PHASE_BUDGET,
  type Phase,
  type Proposal,
  type ActionItem,
  type MeetingMessageOut,
  type MeetingPhaseChangeOut,
  type MeetingInviteOut,
  type MeetingRelevanceCheckOut,
  type MeetingYourTurnOut,
  type MeetingProposalOut,
  type MeetingVoteResultOut,
  type MeetingActionItemOut,
  type MeetingCompletedOut,
  type MeetingCancelledOut,
} from "./types.js";

export interface SendFn {
  (agentId: string, message: unknown): boolean;
}

export interface MeetingRoomOptions {
  id?: string;
  title: string;
  initiatorId: string;
  projectId?: string;
  invitees: string[];
  tokenBudget?: number;
  agenda?: string;
  send: SendFn;
}

export class MeetingRoom {
  readonly id: string;
  readonly title: string;
  readonly initiatorId: string;
  readonly projectId: string | undefined;
  readonly tokenBudget: number;
  readonly agenda: string | undefined;

  private phase: Phase = "present";
  private status: "active" | "completed" | "cancelled" = "active";
  private tokensUsed = 0;
  private phaseBudgets: Record<Phase, number>;
  private phaseTokensUsed: Record<Phase, number> = {
    present: 0,
    discuss: 0,
    decide: 0,
    assign: 0,
  };

  private participants = new Set<string>();
  private joined = new Set<string>();

  private proposals: Proposal[] = [];
  private actionItems: ActionItem[] = [];

  private turnManager = new TurnManager();
  private speakingQueue: string[] = [];
  private currentSpeaker: string | null = null;
  private consecutivePasses = 0;
  private lastMessage: { agentId: string; content: string } | null = null;

  private send: SendFn;

  constructor(opts: MeetingRoomOptions) {
    this.id = opts.id ?? nanoid(12);
    this.title = opts.title;
    this.initiatorId = opts.initiatorId;
    this.projectId = opts.projectId;
    this.tokenBudget = opts.tokenBudget ?? 50_000;
    this.agenda = opts.agenda;
    this.send = opts.send;

    // Calculate per-phase budgets
    this.phaseBudgets = {
      present: Math.floor(this.tokenBudget * PHASE_BUDGET.present),
      discuss: Math.floor(this.tokenBudget * PHASE_BUDGET.discuss),
      decide: Math.floor(this.tokenBudget * PHASE_BUDGET.decide),
      assign: Math.floor(this.tokenBudget * PHASE_BUDGET.assign),
    };

    // Add initiator + invitees as participants
    this.participants.add(opts.initiatorId);
    for (const id of opts.invitees) {
      this.participants.add(id);
    }
  }

  // --- Lifecycle ---

  async persist(): Promise<void> {
    await db.insert(meetings).values({
      id: this.id,
      title: this.title,
      initiatorId: this.initiatorId,
      projectId: this.projectId ?? null,
      phase: this.phase,
      status: this.status,
      tokenBudget: this.tokenBudget,
      tokensUsed: this.tokensUsed,
      agenda: this.agenda ?? null,
    });

    // Insert participant records
    const rows = [...this.participants].map((agentId) => ({
      meetingId: this.id,
      agentId,
    }));
    if (rows.length > 0) {
      await db.insert(meetingParticipants).values(rows);
    }
  }

  sendInvites(): void {
    for (const agentId of this.participants) {
      if (agentId === this.initiatorId) continue;
      const invite: MeetingInviteOut = {
        type: "meeting.invite",
        meetingId: this.id,
        title: this.title,
        initiator: this.initiatorId,
        agenda: this.agenda,
      };
      this.send(agentId, invite);
    }
  }

  // --- Join/Leave ---

  join(agentId: string): boolean {
    if (!this.participants.has(agentId)) return false;
    if (this.status !== "active") return false;

    this.joined.add(agentId);

    // Update DB
    db.update(meetingParticipants)
      .set({ joinedAt: new Date() })
      .where(
        eq(meetingParticipants.meetingId, this.id)
      )
      .then(() => {})
      .catch((e) => logger.error({ error: e }, "Failed to update participant join"));

    // If all participants joined, notify phase
    if (this.joined.size === this.participants.size) {
      this.broadcastPhaseChange();
    }

    return true;
  }

  leave(agentId: string): void {
    this.joined.delete(agentId);
  }

  // --- Speaking ---

  async speak(agentId: string, content: string): Promise<boolean> {
    if (this.status !== "active") return false;
    if (!this.joined.has(agentId)) return false;

    // In PRESENT phase, only initiator can speak
    if (this.phase === "present" && agentId !== this.initiatorId) return false;

    // In DISCUSS/DECIDE/ASSIGN, must be current speaker or initiator advancing
    if (this.phase !== "present" && this.currentSpeaker !== agentId) return false;

    const tokens = countTokens(content);

    // Check phase budget
    if (this.phaseTokensUsed[this.phase] + tokens > this.phaseBudgets[this.phase]) {
      // Budget exhausted → auto-advance
      await this.advancePhase();
      return false;
    }

    // Track tokens
    this.phaseTokensUsed[this.phase] += tokens;
    this.tokensUsed += tokens;
    this.consecutivePasses = 0;
    this.lastMessage = { agentId, content };

    // Persist message
    await db.insert(meetingMessages).values({
      meetingId: this.id,
      agentId,
      phase: this.phase,
      content,
      tokenCount: tokens,
    });

    // Broadcast to all participants
    const msg: MeetingMessageOut = {
      type: "meeting.message",
      meetingId: this.id,
      agentId,
      content,
      phase: this.phase,
      tokenCount: tokens,
      budgetRemaining: this.phaseBudgets[this.phase] - this.phaseTokensUsed[this.phase],
    };
    this.broadcastToParticipants(msg);

    // After speaking, start next relevance round (except in PRESENT)
    if (this.phase !== "present") {
      this.currentSpeaker = null;
      await this.startRelevanceRound();
    }

    return true;
  }

  // --- Relevance ---

  recordRelevance(agentId: string, level: "must_speak" | "could_add" | "pass"): void {
    this.turnManager.addResponse(agentId, level);
  }

  private async startRelevanceRound(): Promise<void> {
    // Send relevance check to all joined participants (except last speaker)
    const checkTargets = [...this.joined].filter(
      (id) => id !== this.lastMessage?.agentId
    );

    if (checkTargets.length === 0) {
      await this.advancePhase();
      return;
    }

    // Build context summary (last few messages)
    const contextSummary = this.lastMessage
      ? `Last message by ${this.lastMessage.agentId}: "${this.lastMessage.content.slice(0, 200)}"`
      : "Meeting just started.";

    // Send relevance checks
    for (const agentId of checkTargets) {
      const check: MeetingRelevanceCheckOut = {
        type: "meeting.relevance_check",
        meetingId: this.id,
        lastMessage: this.lastMessage ?? { agentId: "", content: "" },
        phase: this.phase,
        contextSummary,
      };
      this.send(agentId, check);
    }

    // Collect responses (with 10s timeout)
    const queue = await this.turnManager.collect(checkTargets);

    if (queue.length === 0) {
      // All passed → increment consecutive passes
      this.consecutivePasses++;
      if (this.consecutivePasses >= 1) {
        // All agents passed → auto-advance
        await this.advancePhase();
      }
      return;
    }

    this.consecutivePasses = 0;
    this.speakingQueue = queue;
    await this.giveNextTurn();
  }

  private async giveNextTurn(): Promise<void> {
    if (this.speakingQueue.length === 0) {
      // Queue exhausted → new relevance round
      await this.startRelevanceRound();
      return;
    }

    const next = this.speakingQueue.shift()!;
    this.currentSpeaker = next;

    const turn: MeetingYourTurnOut = {
      type: "meeting.your_turn",
      meetingId: this.id,
      phase: this.phase,
      budgetRemaining: this.phaseBudgets[this.phase] - this.phaseTokensUsed[this.phase],
    };
    this.send(next, turn);
  }

  // --- Phase advancement ---

  async advance(agentId: string): Promise<boolean> {
    // Only initiator can manually advance
    if (agentId !== this.initiatorId) return false;
    await this.advancePhase();
    return true;
  }

  private async advancePhase(): Promise<void> {
    const next = nextPhase(this.phase);

    if (next === "completed") {
      await this.completeMeeting();
      return;
    }

    this.phase = next;
    this.currentSpeaker = null;
    this.speakingQueue = [];
    this.consecutivePasses = 0;

    // Update DB
    await db
      .update(meetings)
      .set({ phase: this.phase, tokensUsed: this.tokensUsed })
      .where(eq(meetings.id, this.id));

    this.broadcastPhaseChange();

    // Auto-start relevance round for discuss/decide/assign
    if (this.phase !== "present") {
      // Small delay to let clients process phase change
      setTimeout(() => this.startRelevanceRound(), 100);
    }
  }

  // --- DECIDE phase: proposals & voting ---

  async propose(agentId: string, proposal: string): Promise<boolean> {
    if (this.phase !== "decide") return false;
    if (!this.joined.has(agentId)) return false;

    const idx = this.proposals.length;
    this.proposals.push({ agentId, proposal, votes: [] });

    // Persist as message
    await db.insert(meetingMessages).values({
      meetingId: this.id,
      agentId,
      phase: "decide",
      content: `[PROPOSAL] ${proposal}`,
      tokenCount: countTokens(proposal),
    });

    // Broadcast
    const out: MeetingProposalOut = {
      type: "meeting.proposal",
      meetingId: this.id,
      proposalIndex: idx,
      agentId,
      proposal,
    };
    this.broadcastToParticipants(out);

    return true;
  }

  async vote(
    agentId: string,
    proposalIndex: number,
    vote: "approve" | "reject" | "abstain",
    reason?: string
  ): Promise<boolean> {
    if (this.phase !== "decide") return false;
    if (!this.joined.has(agentId)) return false;
    if (proposalIndex < 0 || proposalIndex >= this.proposals.length) return false;

    const prop = this.proposals[proposalIndex];

    // Prevent double-voting
    if (prop.votes.some((v) => v.agentId === agentId)) return false;

    prop.votes.push({ agentId, vote, reason });

    // Broadcast
    const out: MeetingVoteResultOut = {
      type: "meeting.vote_result",
      meetingId: this.id,
      proposalIndex,
      agentId,
      vote,
      reason,
    };
    this.broadcastToParticipants(out);

    // Check if all proposals fully voted
    const allVoted = this.proposals.every(
      (p) => p.votes.length >= this.joined.size
    );
    if (allVoted) {
      await this.advancePhase();
    }

    return true;
  }

  // --- ASSIGN phase: action items ---

  async assignTask(
    agentId: string,
    task: string,
    assigneeId: string,
    deadline?: string
  ): Promise<boolean> {
    if (this.phase !== "assign") return false;
    if (!this.joined.has(agentId)) return false;

    const idx = this.actionItems.length;
    this.actionItems.push({
      task,
      assigneeId,
      assignedBy: agentId,
      deadline,
      acknowledged: false,
    });

    // Broadcast
    const out: MeetingActionItemOut = {
      type: "meeting.action_item",
      meetingId: this.id,
      taskIndex: idx,
      task,
      assigneeId,
      assignedBy: agentId,
      deadline,
    };
    this.broadcastToParticipants(out);

    return true;
  }

  async acknowledge(agentId: string, taskIndex: number): Promise<boolean> {
    if (this.phase !== "assign") return false;
    if (taskIndex < 0 || taskIndex >= this.actionItems.length) return false;

    const item = this.actionItems[taskIndex];
    if (item.assigneeId !== agentId) return false;

    item.acknowledged = true;

    // Check if all items acknowledged → complete
    const allAcked = this.actionItems.every((i) => i.acknowledged);
    if (allAcked && this.actionItems.length > 0) {
      await this.advancePhase(); // → completed
    }

    return true;
  }

  // --- Completion & cancellation ---

  private async completeMeeting(): Promise<void> {
    this.status = "completed";

    // Build decisions from approved proposals
    const decisions = this.proposals
      .filter((p) => {
        const approves = p.votes.filter((v) => v.vote === "approve").length;
        return approves > p.votes.length / 2;
      })
      .map((p) => ({
        proposal: p.proposal,
        proposedBy: p.agentId,
        votes: p.votes,
      }));

    // Persist
    await db
      .update(meetings)
      .set({
        status: "completed",
        tokensUsed: this.tokensUsed,
        decisions,
        actionItems: this.actionItems,
        completedAt: new Date(),
      })
      .where(eq(meetings.id, this.id));

    // Broadcast completion
    const out: MeetingCompletedOut = {
      type: "meeting.completed",
      meetingId: this.id,
      decisions,
      actionItems: this.actionItems,
    };
    this.broadcastToParticipants(out);

    logger.info({ meetingId: this.id, decisions: decisions.length, actionItems: this.actionItems.length }, "Meeting completed");
  }

  async cancel(reason: string): Promise<void> {
    this.status = "cancelled";

    await db
      .update(meetings)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(meetings.id, this.id));

    const out: MeetingCancelledOut = {
      type: "meeting.cancelled",
      meetingId: this.id,
      reason,
    };
    this.broadcastToParticipants(out);

    logger.info({ meetingId: this.id, reason }, "Meeting cancelled");
  }

  // --- Utilities ---

  private broadcastToParticipants(message: unknown): void {
    for (const agentId of this.joined) {
      this.send(agentId, message);
    }
  }

  private broadcastPhaseChange(): void {
    const msg: MeetingPhaseChangeOut = {
      type: "meeting.phase_change",
      meetingId: this.id,
      phase: this.phase,
      budgetRemaining: this.phaseBudgets[this.phase] - this.phaseTokensUsed[this.phase],
    };
    this.broadcastToParticipants(msg);
  }

  // --- Getters ---

  getPhase(): Phase {
    return this.phase;
  }

  getStatus(): "active" | "completed" | "cancelled" {
    return this.status;
  }

  getParticipants(): string[] {
    return [...this.participants];
  }

  getJoined(): string[] {
    return [...this.joined];
  }

  getTokensUsed(): number {
    return this.tokensUsed;
  }

  getPhaseTokensUsed(phase: Phase): number {
    return this.phaseTokensUsed[phase];
  }

  getPhaseBudget(phase: Phase): number {
    return this.phaseBudgets[phase];
  }

  getProposals(): readonly Proposal[] {
    return this.proposals;
  }

  getActionItems(): readonly ActionItem[] {
    return this.actionItems;
  }

  getCurrentSpeaker(): string | null {
    return this.currentSpeaker;
  }

  isActive(): boolean {
    return this.status === "active";
  }
}
