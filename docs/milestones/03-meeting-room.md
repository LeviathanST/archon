# Milestone 3: Meeting Room Core

> Status: **Mostly Complete**
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
- [ ] Save decisions (DECIDE phase) to meetings.decisions JSONB
- [ ] Save action items (ASSIGN phase) to meetings.action_items JSONB
- [x] Update meeting status on completion

### Tests
- [ ] Phase transition tests
- [ ] Budget exhaustion tests
- [ ] Turn ordering tests
- [ ] Meeting persistence tests

---

## Notes
- Token counter uses simple chars/4 estimation instead of tiktoken. Good enough for MVP, can upgrade later.
- Relevance timeout was increased from 10s to 120s because CLI tools (claude --print, gemini -p) take 10-30s per call.
- Meeting room is fully functional for end-to-end meetings, tested with 2 agents (Claude + Gemini).
- Missing: persisting decisions/action_items to Postgres JSONB columns, and unit tests.

---

## Deliverable
Agents can hold a structured meeting through all four phases.
