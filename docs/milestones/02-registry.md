# Milestone 2: Registry & Discovery

> Status: **Complete**
> Goal: Agents can discover each other via Agent Cards.

---

## Tasks

### Agent Workspaces
- [x] Create CEO agent workspace in `agents/ceo/` (SOUL.md, IDENTITY.md, MEMORY.md, AGENTS.md)
- [x] Define default agent workspace template in `agents/templates/default/`

### Database Seeding
- [x] `src/db/seed.ts` — CEO agent, departments, roles (done in Milestone 1)

### Registry
- [x] `src/registry/agent-card.ts` — Read SOUL.md + IDENTITY.md, merge with DB, produce AgentCard JSON
  - A2A Agent Card inspiration documented in comments
  - Parses markdown sections (strengths, weaknesses, skills, personality, communication style)
  - Caches generated card in agents.agent_card JSONB column
- [x] `src/registry/agent-registry.ts` — CRUD for agents, departments, roles, assignments
- [x] `src/registry/discovery.ts` — Permission-filtered agent listing
  - Admin (agent:* permission) sees all agents
  - Non-admin sees self + agents in shared departments
  - Supports departmentId filter

### Permissions
- [x] `src/hub/permissions.ts` — Permission checking with wildcard resource support

### Router
- [x] `directory.list` handler — uses real discovery with permission filtering
- [x] `directory.get` handler — lookup single agent by ID
- [x] Auth now returns fresh agent card on login

### Protocol
- [x] Added `DirectoryGetMessage` to `InboundMessage` discriminated union

### Tests
- [x] Agent card generation tests (5 tests) — DB data, CEO workspace files, caching, live status
- [x] Discovery filtering tests (5 tests) — admin view, department scoping, department filter
- [x] Permissions tests (6 tests) — exact match, wildcard, grant, dedup
- [x] All 26 tests passing

---

## Deliverable
Agents see each other's capabilities and organizational positions.
