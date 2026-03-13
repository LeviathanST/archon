# ADR-004: Simplified Task State Machine for MVP

**Status:** Proposed
**Date:** 2026-03-10
**Context:** Claw-Empire's full task lifecycle (6 states + failure paths)

## Decision

Simplify Claw-Empire's task state machine for Archon's ASSIGN phase:

```
CREATED → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                         ↓
                      failure → CREATED (re-assignable)
```

## Rationale

- Claw-Empire has INBOX, PLANNED, COLLABORATING, PENDING, CANCELLED — too complex for MVP
- Skip COLLABORATING (single-agent tasks for now)
- Skip PENDING/CANCELLED until we have execution control
- Orphan recovery (detecting stale in-progress tasks) is essential from day one

## Consequences

- Cross-department delegation (multi-agent tasks) deferred to post-MVP
- Task acknowledgment in meetings maps to ASSIGNED state
