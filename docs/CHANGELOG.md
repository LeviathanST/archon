# Changelog

All notable progress on Archon is logged here.

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
