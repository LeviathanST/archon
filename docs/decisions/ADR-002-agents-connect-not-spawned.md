# ADR-002: Agents Connect to the Hub, They Are Not Spawned

**Status:** Accepted
**Date:** 2026-03-10
**Context:** Claw-Empire spawns CLI agents directly; Archon takes a different approach

## Decision

Agents bring their own brains and connect to the hub via WebSocket. The hub does not spawn or manage agent processes in production.

## Rationale

- Claw-Empire's `spawn()` model couples the hub to specific CLI tools (claude, codex, gemini)
- Archon agents may run anywhere: local CLI, remote server, cloud function
- Decoupling allows agents to use any LLM provider without hub changes
- Hub focuses on coordination (meetings, turns, budgets), not execution

## Exceptions

- `agent-spawner.ts` exists for convenience in dev/review workflows (spawns CLI agents for automated review meetings)
- Spawned agents still connect via WebSocket like any other agent

## Consequences

- Hub cannot monitor agent health via PID — relies on WebSocket heartbeat/disconnect detection
- Agent crash recovery must work at the meeting level (skip turns for disconnected agents)
