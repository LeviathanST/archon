# Changelog

All notable progress on Archon is logged here.

---

## 2026-03-11

### Milestone 4: Agent Client — In Progress
- `scripts/agent.ts` — Multi-provider agent runner (cli-claude, cli-gemini, openai)
  - Loads SOUL.md/IDENTITY.md for agent persona
  - Handles full meeting lifecycle: invite → join → relevance → speak → vote → assign
  - Claude provider uses `--print` + stdin (not `-p`) to avoid nested session hang
  - Gemini provider uses `-p` flag directly
  - OpenAI provider for OpenRouter/Ollama compatibility
- `scripts/start-meeting.ts` — Meeting starter with auto-facilitation through all 4 phases
- Seeded demo agents Alice and Bob in engineering department
- Successful end-to-end meeting: Alice (Claude Haiku) + Bob (Gemini CLI) had 8-turn emergent discussion, reached consensus on priorities, self-assigned action items
- Relevance-based turn management working (MUST_SPEAK / COULD_ADD / PASS)
- Bumped relevance timeout from 10s to 120s for CLI agent latency

### Milestone 3: Meeting Room Core — Mostly Complete
- `src/meeting/types.ts` — Meeting message Zod schemas
- `src/meeting/phases.ts` — Phase state machine (PRESENT → DISCUSS → DECIDE → ASSIGN)
- `src/meeting/meeting-room.ts` — Full meeting room with participant tracking, phase transitions, budget enforcement
- `src/meeting/turn-manager.ts` — Relevance collection, MUST_SPEAK-first ordering, all-PASS auto-advance
- `src/meeting/token-counter.ts` — Simple token estimator (chars/4)
- All `meeting.*` handlers wired in router
- Remaining: meeting persistence (decisions/action_items to Postgres JSONB), unit tests

---

## 2026-03-10

### Milestone 2: Registry & Discovery — Complete
- Created CEO agent workspace (`agents/ceo/`: SOUL.md, IDENTITY.md, MEMORY.md, AGENTS.md)
- Created default agent workspace templates (`agents/templates/default/`)
- `src/registry/agent-card.ts` — generates A2A-inspired Agent Cards from workspace files + DB
- `src/registry/agent-registry.ts` — CRUD for agents, departments, roles, assignments
- `src/registry/discovery.ts` — permission-filtered agent listing (admin sees all, others see shared depts)
- `src/hub/permissions.ts` — permission checking with wildcard resource support
- Wired `directory.list` and `directory.get` handlers in router
- Auth now returns fresh agent card on login
- Added `DirectoryGetMessage` to protocol
- 16 new tests (agent-card: 5, discovery: 5, permissions: 6), 26 total passing

### Milestone 1: Foundation — Complete
- Started Postgres via Docker Compose, ran initial migration (9 tables)
- Created `src/db/seed.ts` — seeds CEO agent, 3 departments, 3 roles, admin permissions
- Seeded database successfully
- Created `tests/hub/server.test.ts` — 10 tests covering auth flow, ping/pong, status updates, invalid messages, session cleanup on disconnect, reconnect handling
- All tests passing against live Postgres
- Added `vitest.config.ts`
- Milestone 1 marked complete

---

## 2026-03-09

### Planning Phase
- Defined project vision: AI agent company platform
- Researched competitive landscape (ChatDev, MetaGPT, CrewAI, AutoGen, Agent-MCP, OpenClaw, NullClaw)
- Confirmed architecture decisions: TypeScript hub, Postgres, Neural Memory, acpx, WebSocket
- Designed meeting room protocol (PRESENT → DISCUSS → DECIDE → ASSIGN)
- Designed relevance-based turn management
- Defined Postgres schema (9 tables)
- Defined WebSocket message protocol
- Decided on CEO agent as platform onboarding UX
- Decided on `~/.archon/` runtime directory (no hardcoded paths)
- Created `PLAN.md` with full architecture and 5 milestones
- Set up project docs structure
