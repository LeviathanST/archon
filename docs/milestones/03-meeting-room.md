# Milestone 3: Meeting Room Core

> Status: **Complete**
> Goal: The meeting loop works end-to-end through all 4 phases.

---

## Tasks

### Message Types
- [x] `src/meeting/types.ts` — All meeting message Zod schemas

### Phase State Machine
- [x] `src/meeting/phases.ts` — PRESENT → DISCUSS → DECIDE → ASSIGN transitions
  - Transition triggers: budget exhaustion, all-pass, initiator advance
  - Cancel from any phase

### Meeting Room
- [x] `src/meeting/meeting-room.ts` — MeetingRoom class
  - Create meeting record in Postgres
  - Manage participant list
  - Track current phase
  - Broadcast messages to participants
  - Store all messages in `meeting_messages`

### Turn Management
- [x] `src/meeting/turn-manager.ts` — Relevance collection, 120s timeout, turn ordering
  - MUST_SPEAK first (by response time), then COULD_ADD
  - All PASS → auto-advance phase
  - Timeout bumped from 10s to 120s for CLI agent providers (claude, gemini)

### Token Budget
- [x] `src/meeting/token-counter.ts` — Simple token estimator (chars/4)
  - Not tiktoken yet — using char-based approximation
- [x] Budget enforcement: PRESENT 20%, DISCUSS 50%, DECIDE 20%, ASSIGN 10%
- [x] Auto-advance on budget exhaustion

### Router
- [x] Add all `meeting.*` handlers to router

### Persistence
- [x] Save decisions (DECIDE phase) to meetings.decisions JSONB
- [x] Save action items (ASSIGN phase) to meetings.action_items JSONB
- [x] Update meeting status on completion

### User-Defined Methodologies (2026-03-12)
- [x] `src/meeting/methodology.ts` — PhaseCapability, PhaseDefinition, Methodology interfaces
- [x] `src/meeting/methodology-parser.ts` — Markdown parser + DEFAULT_METHODOLOGY constant
- [x] `src/meeting/methodology-loader.ts` — File loader with caching from `~/.archon/methodologies/`
- [x] Phase type changed from fixed enum to free-form string (methodology-driven)
- [x] Capability-based phase guards replace hardcoded phase name checks
- [x] Dynamic budgets from methodology definitions (replaces PHASE_BUDGET constant)
- [x] Phase description and meeting rules injected into relevance prompts
- [x] `meetings.methodology` column added to DB schema
- [x] `--methodology` CLI flag, AgentClient param, router integration
- [x] archon-client synced: dynamic PhaseIndicator, methodology selector, capability-based UI

### Tests (64 non-DB tests passing)
- [x] Phase transition tests (`phases.test.ts` — 4 tests)
- [x] Budget exhaustion tests (`meeting-room.test.ts`)
- [x] Turn ordering tests (`turn-manager.test.ts` — 6 tests)
- [x] Meeting persistence tests (`meeting-room.test.ts` — 13 tests incl. JSONB verification)
- [x] Relevance prompt builder & parser tests (`relevance.test.ts` — 28 tests)
- [x] Token counter tests (`token-counter.test.ts` — 3 tests)
- [x] Methodology parser tests (`methodology-parser.test.ts` — 23 tests)

---

## Notes
- Token counter uses simple chars/4 estimation instead of tiktoken. Good enough for MVP, can upgrade later.
- Relevance timeout was increased from 10s to 120s because CLI tools (claude --print, gemini -p) take 10-30s per call.
- Meeting room is fully functional for end-to-end meetings, tested with 2 agents (Claude + Gemini).
- All persistence and test tasks completed 2026-03-11.
- Methodology system added 2026-03-12: phases are now dynamic, driven by markdown definitions with capability-based enforcement.
- Default "general" methodology preserves exact backward compat (same 4 phases, same budgets).

---

## Deliverable
Agents can hold a structured meeting through all four phases, with user-defined methodology support.
