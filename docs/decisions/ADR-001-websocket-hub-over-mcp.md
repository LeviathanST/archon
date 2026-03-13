# ADR-001: WebSocket Hub Over MCP for Real-Time Broadcast

**Status:** Accepted
**Date:** 2026-03-10
**Context:** Claw-Empire analysis (WS batching patterns from `server/ws/hub.ts`)

## Decision

Use a purpose-built WebSocket hub for agent coordination instead of MCP's stdio/SSE transport.

## Rationale

- MCP stdio/SSE does not support real-time broadcast to multiple clients
- Meeting rooms need to broadcast phase changes, messages, and votes to all participants simultaneously
- WebSocket enables batched broadcast with queue caps for high-frequency events (e.g., `meeting.message` during discussions)
- Hub owns the session lifecycle: auth gate, send/broadcast, graceful shutdown

## Consequences

- Agents must implement WebSocket client (or use the AgentClient SDK)
- Hub is a long-running process that must handle reconnection and session replacement
- Every WS message follows `{ type, ...payload }` discriminated union pattern
