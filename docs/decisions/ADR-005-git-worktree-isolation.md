# ADR-005: Git Worktree Isolation for Agent Code Tasks

**Status:** Proposed
**Date:** 2026-03-10
**Context:** Claw-Empire's worktree lifecycle (`server/modules/workflow/core/worktree/`)

## Decision

Use git worktrees to isolate agent code tasks. Each action item from a meeting's ASSIGN phase gets its own worktree branch.

## Key Patterns (from Claw-Empire)

- **Branch naming:** `archon/<taskId-prefix>` with collision fallback (`-1`, `-2`, `-3`)
- **Restricted file detection:** Block `.env`, private keys, binaries, `node_modules`, etc.
- **Verify-commit verdicts:** `no_worktree | no_commit | dirty_without_commit | commit_but_no_code | ok`
- **Merge flow:** `--no-ff` merge, approval required, conflict detection with abort+report

## Rationale

- Agents working on code need isolation to avoid stepping on each other
- Worktrees are lightweight (shared `.git` objects) and support concurrent branches
- Merge-only-after-review prevents agents from pushing broken code

## Consequences

- Hub needs worktree lifecycle management (create, verify, merge, cleanup)
- CEO/meeting consensus required before merging agent work
