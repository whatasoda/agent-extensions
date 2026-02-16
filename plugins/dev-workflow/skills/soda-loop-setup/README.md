# soda-loop-setup

## Background

Derived from three ad-hoc loop implementations used across projects:

1. **Task-driven** (`run-agent-loop.sh`) — TASKS.md checkbox tracking, STOP file sentinel, cooldown between sessions. Simple but lacks validation structure and context management.
2. **Validation-driven** (`run-loop.ts`) — Four-state progress model, playground reset between sessions. Strong validation but no phase structure or discovery mechanism.
3. **Phase-parallel** (`implement-poc.sh`) — Heredoc prompts per phase, `&` + `wait` barriers for parallelism. Good structure but no validation integration or context bounding.

None of these combines all desired properties: validation-driven progress, phase-based structure, vision-based item discovery, and context-bounded sessions.

## Purpose

Generate the autonomous multi-session loop harness from a structured vision. Running `/soda-loop-setup` generates three files (PROGRESS.md, AGENT_PROMPT.md, run-loop.ts) that together orchestrate an autonomous agent loop with:

- **Phase-based structure**: Items organized by phases with explicit dependencies
- **Validation-driven progress**: Each implementation item paired with a validation item
- **Vision-based discovery**: Agent discovers new items by comparing current state to VISION.md
- **Context-bounded sessions**: Hard limits on items per session, budget per session, and inactivity timeout

## Vision-Setup Chain

`soda-loop-setup` is designed to work as the second step in a two-skill workflow:

```
/soda-loop-vision → VISION.md → /soda-loop-setup → PROGRESS.md + AGENT_PROMPT.md + run-loop.ts
```

### Handoff mechanism

Two detection paths, following the same pattern as `soda-propose` → `soda-plan`:

1. **Conversation-based** (same-session): `soda-loop-vision` emits a `## Vision Blueprint` block. `soda-loop-setup` detects it by heading pattern and extracts project name, loop name, and goals. Supports legacy `**Target**` field for backward compatibility.
2. **File-based** (cross-session): `soda-loop-setup` scans `.agent-loops/` for existing loops containing VISION.md.

### Fallback behavior

When no VISION.md exists and no Vision Blueprint is in the conversation, the user can:
- Run `/soda-loop-vision` first (recommended)
- Provide a quick inline vision as free text (produces a minimal VISION.md, lower quality but functional)

## Design Notes

### Phase derivation

Phases are derived automatically from VISION.md goals rather than defined manually by the user. The derivation heuristics:

- **Grouping**: Related goals that form a logical unit of work are grouped into the same phase
- **Ordering**: Foundational goals (no dependencies) form early phases; dependent goals form later phases
- **Size target**: Each phase should have 2-5 goals. Split or merge if outside this range.

The user reviews and can adjust the proposed phases (merge, split, reorder) but does not need to design them from scratch.

### State model

Four states for progress tracking: `[ ]` pending, `[~]` in-progress, `[x]` done, `[!]` blocked. The `[~]` state is critical for crash recovery — when a session is killed by budget or timeout, the next session can detect partially-completed items. The `[!]` state prevents infinite retry loops (3 attempts max).

### Item ID conventions

- Phase items: `1.1`, `1.2`, `2.1`, ...
- Validation items: `V-1.1`, `V-1.2`, ...
- Phase validation: `PV-1`, `PV-2`, ...
- Discovered items: `D-1`, `D-2`, ... (max 10)

### Discovery quota

Maximum 10 discovered items total, maximum 3 added per session. This prevents infinite discovery loops where the agent keeps finding new work without completing existing items. The agent exits after discovery without executing discovered items, ensuring fresh context for execution.

### Budget control

Uses `--max-budget-usd` (default $10) for per-session cost caps. This provides a hard safety net independent of the agent's self-assessment of context usage.

### Inactivity timeout

30-minute default. The loop harness tracks the timestamp of the last stream-json event from the Claude session. If no events are received for the timeout period, the session is killed. This is more responsive than file mtime polling (checks every 10s vs 60s). Detects stuck sessions (e.g., waiting for input, infinite loops in tool use).

### Exit reason communication

Session exit info is appended to PROGRESS.md's Session Log section. The next session reads this to understand why the previous session ended and what to prioritize. Three exit scenarios: normal (voluntary exit), budget-exceeded (cost limit hit), timeout (inactivity kill).

### Template strategy

- **TypeScript script** (`run-loop.ts`): External file in `templates/`, copied to `.agent-loops/<loop-name>/` at setup time. Runs via Bun's JIT TypeScript compiler. Uses `--output-format stream-json` with `--verbose` for session ID tracking and event-driven activity monitoring. Spawned claude sessions use the invocation directory as cwd (run from repo root). Loop files are resolved from the script's own directory by default (`import.meta.dir`), which naturally resolves to `.agent-loops/<loop-name>/`. Supports SIGINT graceful shutdown (two-press pattern: first press stops after current session, second press force kills).
- **Markdown templates** (PROGRESS.md, AGENT_PROMPT.md): Embedded in SKILL.md with placeholder substitution. Keeps the skill self-contained and allows the agent to customize templates during generation.

## Typical Usage

All loop artifacts are placed in `.agent-loops/<loop-name>/` at the repo root. This standardized location simplifies cross-skill discovery, inter-session handoff, and cleanup.

### Recommended: Two-step workflow

```
/soda-loop-vision              # Define vision → .agent-loops/<loop-name>/VISION.md
/soda-loop-setup               # Generate harness → .agent-loops/<loop-name>/{PROGRESS,AGENT_PROMPT}.md + run-loop.ts
.agent-loops/<loop-name>/run-loop.ts  # Start the autonomous loop (run from repo root)
```

### Quick: Standalone with inline vision

```
/soda-loop-setup               # No VISION.md → select "Quick inline vision" → provide free text
.agent-loops/<loop-name>/run-loop.ts  # Run from repo root
```

### Cross-session

```
# Session 1
/soda-loop-vision              # Writes .agent-loops/<loop-name>/VISION.md

# Session 2
/soda-loop-setup               # Scans .agent-loops/ for existing loops
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOOP_DIR` | `import.meta.dir` (`.agent-loops/<loop-name>/`) | Directory containing loop files (PROGRESS.md, AGENT_PROMPT.md) |
| `CLAUDE_MODEL` | `sonnet` | Model to use for agent sessions |
| `MAX_SESSIONS` | `10` | Maximum number of sessions before halting |
| `MAX_BUDGET_USD` | `10` | Per-session cost cap in USD |
| `COOLDOWN_SECS` | `5` | Seconds to wait between sessions |
| `IDLE_TIMEOUT` | `1800` | Seconds of inactivity before killing session |
| `DRY_RUN` | `0` | Set to 1 to show what would happen without running |
| `ALLOWED_TOOLS` | `Read,Write,Edit,Bash,Glob,Grep` | Comma-separated list of allowed tools |

## Future Improvements

- Auto-detect project conventions (test framework, linter, commit format) from existing config
- Template library for common patterns (migration, refactoring, test coverage)
- Merge support for combining discovered items across sessions into new phases
