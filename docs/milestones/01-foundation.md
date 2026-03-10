# Milestone 1: Foundation

> Status: **Complete**
> Goal: Hub boots, Postgres connected, agents can authenticate.

---

## Tasks

### Project Setup
- [x] Clean workspace (remove Zig scaffold: build.zig, build.zig.zon, src/, zig-out/)
- [x] Initialize `package.json` with dependencies
- [x] Create `tsconfig.json`
- [x] Create `docker-compose.yml` (Postgres 16)
- [x] Create `drizzle.config.ts`

### Database
- [x] `src/db/schema.ts` — Drizzle schema for all 9 tables
- [x] `src/db/connection.ts` — Postgres pool + drizzle instance
- [x] Generate initial migration (`npm run db:generate`)
- [x] Run migration (`npm run db:migrate`)
- [x] `src/db/seed.ts` — Seed CEO agent, departments, roles, permissions

### Hub Core
- [x] `src/protocol/messages.ts` — Zod schemas (auth messages first)
- [x] `src/protocol/errors.ts` — Error codes
- [x] `src/hub/server.ts` — WebSocket server with `ws`
- [x] `src/hub/session.ts` — AgentSession tracking
- [x] `src/hub/router.ts` — Message dispatch (auth only)
- [x] `src/utils/logger.ts` — pino setup

### Entry Point
- [x] `src/index.ts` — Boot sequence (load config → connect DB → start WS)

### Verification
- [x] `tests/hub/server.test.ts` — 10 tests covering auth, ping/pong, status, session management, reconnect
- [x] All tests passing against live Postgres

---

## Notes
- TypeScript compiles clean (`tsc --noEmit` passes)
- Migration generated: `drizzle/0000_nosy_tombstone.sql` (9 tables, all FKs, all indexes)
- MVP auth: token must match agent ID (pre-shared token). TODO: replace with JWT later.

---

## Deliverable
A running WebSocket server that authenticates agents against Postgres.
