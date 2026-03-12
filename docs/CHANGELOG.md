# Changelog

All notable progress on Archon is logged here.

---

## 2026-03-12

### Methodology System (Milestone 3 extension)
- User-defined meeting methodologies via markdown files (`~/.archon/methodologies/`)
- `src/meeting/methodology.ts` — PhaseCapability, PhaseDefinition, Methodology interfaces
- `src/meeting/methodology-parser.ts` — Markdown parser + DEFAULT_METHODOLOGY constant
- `src/meeting/methodology-loader.ts` — File loader with caching
- Phase type changed from fixed enum to free-form string (methodology-driven)
- Capability-based phase guards: `initiator_only`, `open_discussion`, `proposals`, `assignments`
- Dynamic budgets from methodology definitions (replaces hardcoded PHASE_BUDGET)
- Phase description and rules injected into relevance prompts
- `meetings.methodology` column added to DB schema (migration: 0001_slippery_eternity.sql)
- `--methodology` CLI flag on start-meeting.ts, methodology param on AgentClient
- Synced archon-client: dynamic PhaseIndicator, methodology selector in MeetingLauncher, capability-based UI guards
- 23 new parser tests, 5 new relevance tests — 64 non-DB tests passing
- Verified end-to-end: 20+ turn meeting with Alice & Bob (Gemini CLI) using default methodology

### Milestone 4: Agent Client — In Progress
- `src/agent/client.ts` — AgentClient library with tests
  - Auth handshake, reconnect with exponential backoff, ping keepalive
  - Typed meeting helpers: join, leave, speak, relevance, propose, vote, assign, acknowledge, create, advance
  - Directory helpers: listAgents, getAgent
  - Hub protocol errors emitted as `hub.error` (avoids EventEmitter `error` collision)
  - 20 tests covering: auth flow, ping/pong, send helpers, meeting lifecycle, reconnect behavior, disconnect cleanup, directory queries

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

### Milestone 3: Meeting Room Core — Complete
- `src/meeting/types.ts` — Meeting message Zod schemas
- `src/meeting/phases.ts` — Phase state machine (PRESENT → DISCUSS → DECIDE → ASSIGN)
- `src/meeting/meeting-room.ts` — Full meeting room with participant tracking, phase transitions, budget enforcement
- `src/meeting/turn-manager.ts` — Relevance collection, MUST_SPEAK-first ordering, all-PASS auto-advance
- `src/meeting/token-counter.ts` — Simple token estimator (chars/4)
- `src/meeting/relevance.ts` — Server-side relevance prompt builder and response parser
- All `meeting.*` handlers wired in router
- Decisions and action items persisted to Postgres JSONB columns on meeting completion
- 50 tests passing: phases (4), turn-manager (6), meeting-room (13), relevance (24), token-counter (3)

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
