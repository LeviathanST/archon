import type { WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { InboundMessage, AuthMessage } from "../protocol/messages.js";
import { createError, ErrorCode } from "../protocol/errors.js";
import { db } from "../db/connection.js";
import { agents } from "../db/schema.js";
import { SessionManager } from "./session.js";
import { discoverAgents } from "../registry/discovery.js";
import { getAgentCard } from "../registry/agent-card.js";
import { logger } from "../utils/logger.js";

export class Router {
  constructor(private sessions: SessionManager) {}

  async handleRaw(socket: WebSocket, raw: string): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      socket.send(
        JSON.stringify(createError(ErrorCode.INVALID_MESSAGE, "Invalid JSON"))
      );
      return;
    }

    // If this socket is not authenticated yet, only allow auth messages
    const agentId = this.getAgentIdForSocket(socket);
    if (!agentId) {
      await this.handleAuth(socket, data);
      return;
    }

    // Parse as known inbound message
    const parsed = InboundMessage.safeParse(data);
    if (!parsed.success) {
      this.sessions.send(
        agentId,
        createError(
          ErrorCode.INVALID_MESSAGE,
          `Invalid message: ${parsed.error.issues[0]?.message ?? "unknown"}`
        )
      );
      return;
    }

    const message = parsed.data;

    switch (message.type) {
      case "ping":
        this.sessions.send(agentId, { type: "pong" });
        break;

      case "agent.status":
        await this.handleAgentStatus(agentId, message.status);
        break;

      case "directory.list":
        await this.handleDirectoryList(agentId, message.filter);
        break;

      case "directory.get":
        await this.handleDirectoryGet(agentId, message.agentId);
        break;

      default:
        this.sessions.send(
          agentId,
          createError(ErrorCode.UNKNOWN_TYPE, `Unhandled message type: ${(message as { type: string }).type}`)
        );
    }
  }

  private async handleAuth(socket: WebSocket, data: unknown): Promise<void> {
    const parsed = AuthMessage.safeParse(data);
    if (!parsed.success) {
      socket.send(
        JSON.stringify(
          createError(ErrorCode.AUTH_REQUIRED, "First message must be auth")
        )
      );
      return;
    }

    const { agentId, token } = parsed.data;

    // Look up agent in database
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      socket.send(
        JSON.stringify(
          createError(ErrorCode.AUTH_FAILED, `Agent "${agentId}" not found`)
        )
      );
      socket.close(4001, "Authentication failed");
      return;
    }

    // MVP auth: token must match agent ID (simple pre-shared token)
    // TODO: Replace with JWT or proper token validation
    if (token !== agentId) {
      socket.send(
        JSON.stringify(createError(ErrorCode.AUTH_FAILED, "Invalid token"))
      );
      socket.close(4001, "Authentication failed");
      return;
    }

    // Create session
    this.sessions.add(agentId, socket);

    // Update agent status in DB
    await db
      .update(agents)
      .set({ status: "online", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    // Generate fresh agent card on auth
    const agentCard = await getAgentCard(agentId);

    // Send auth.ok
    socket.send(
      JSON.stringify({
        type: "auth.ok",
        agentCard: agentCard ?? {},
        pendingInvites: [],
      })
    );

    logger.info({ agentId }, "Agent authenticated");
  }

  private async handleAgentStatus(
    agentId: string,
    status: "online" | "offline" | "busy"
  ): Promise<void> {
    await db
      .update(agents)
      .set({ status, updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    logger.info({ agentId, status }, "Agent status updated");
  }

  private async handleDirectoryList(
    agentId: string,
    filter?: { departmentId?: string }
  ): Promise<void> {
    const cards = await discoverAgents(agentId, filter);
    this.sessions.send(agentId, {
      type: "directory.result",
      agents: cards,
    });
  }

  private async handleDirectoryGet(
    requestingAgentId: string,
    targetAgentId: string
  ): Promise<void> {
    const card = await getAgentCard(targetAgentId);
    if (!card) {
      this.sessions.send(
        requestingAgentId,
        createError(ErrorCode.AGENT_NOT_FOUND, `Agent "${targetAgentId}" not found`)
      );
      return;
    }

    this.sessions.send(requestingAgentId, {
      type: "directory.result",
      agents: [card],
    });
  }

  private getAgentIdForSocket(socket: WebSocket): string | undefined {
    for (const session of this.sessions.getAll()) {
      if (session.socket === socket) {
        return session.agentId;
      }
    }
    return undefined;
  }
}
