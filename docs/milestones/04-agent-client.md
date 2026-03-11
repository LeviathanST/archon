# Milestone 4: Agent Client + Relevance Detector

> Status: **In Progress**
> Goal: Agents autonomously decide when to speak and participate in meetings.

---

## Tasks

### Agent Runner
- [x] `scripts/agent.ts` — Runner script: reads SOUL.md/IDENTITY.md → connects to hub → participates
  - Loads identity from `~/.archon/agents/{id}/` or `agents/{id}/` in repo
  - Falls back to generic persona if no identity files found
  - Handles full meeting lifecycle: invite → join → relevance check → speak → vote → acknowledge

### Meeting Starter
- [x] `scripts/start-meeting.ts` — Creates meeting, auto-facilitates through all 4 phases
  - Connects as initiator (CEO), invites agents, presents agenda
  - Waits for agents to join, then drives phase transitions
  - Prints formatted meeting transcript to stdout

### Model Provider Integration
- [x] cli-claude provider — Uses `claude --print` + stdin (not `-p` which hangs in nested sessions)
  - Pattern from Claw-Empire: prompt via stdin, `--print` for non-interactive output
  - Unsets `CLAUDECODE` env var to allow nested sessions
  - Supports `--dangerously-skip-permissions` for non-interactive use
- [x] cli-gemini provider — Uses `gemini -p` with prompt as argument
- [x] openai provider — Direct API via OpenAI SDK (works with OpenRouter, Ollama, etc.)
- [ ] acpx provider — send prompts through acpx
- [ ] Provider config read from `~/.archon/agents/[name]/config.toml`

### Relevance Detector
- [x] Agent-side relevance detection via LLM prompt → MUST_SPEAK / COULD_ADD / PASS
- [ ] `src/meeting/relevance.ts` — Server-side relevance prompt builder (reference impl)

### Agent Client Library
- [ ] Reusable TypeScript library wrapping WebSocket connection:
  - [ ] Auth handshake
  - [ ] Meeting participation helpers (join, speak, vote, acknowledge)
  - [ ] Reconnect logic with backoff
  - [ ] Local state cache (offline mode — SPOF Phase 1)

### Neural Memory Integration
- [ ] Agent consults Neural Memory (nmem_recall) during relevance check
- [ ] Agent uses Neural Memory (nmem_context) before speaking
- [ ] Agent stores meeting insights (nmem_remember) after meetings
- [ ] Each agent spawns with its own Neural Memory MCP instance

### Integration Test
- [x] Start hub + 2 agent processes (Alice via Claude Haiku, Bob via Gemini CLI)
- [x] Create meeting, observe emergent multi-turn discussion
- [x] Verify relevance-based turn selection works (MUST_SPEAK / COULD_ADD / PASS)
- [ ] 3-agent test with Neural Memory

---

## Notes
- `claude -p` flag hangs when spawned from within another Claude Code session, even with `CLAUDECODE` unset. Fix: use `claude --print` with prompt via stdin (pattern from Claw-Empire v2.0.3).
- Gemini CLI works fine with `-p` flag.
- Successful end-to-end meeting: Alice and Bob had 8-turn discussion, reached consensus, self-assigned action items.
- Agent seeding: `npm run db:seed` creates demo agents `alice` and `bob` in engineering department.

---

## Deliverable
Fully autonomous meeting between agents with relevance-based turns and memory-informed responses.
