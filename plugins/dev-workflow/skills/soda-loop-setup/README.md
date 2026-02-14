# soda-loop-setup

## Background

Derived from three ad-hoc loop implementations used across projects:

1. **Task-driven** (`run-agent-loop.sh`) — TASKS.md checkbox tracking, STOP file sentinel, cooldown between sessions. Simple but lacks validation structure and context management.
2. **Validation-driven** (`run-loop.sh`) — Four-state progress model, playground reset between sessions. Strong validation but no phase structure or discovery mechanism.
3. **Phase-parallel** (`implement-poc.sh`) — Heredoc prompts per phase, `&` + `wait` barriers for parallelism. Good structure but no validation integration or context bounding.

None of these combines all desired properties: validation-driven progress, phase-based structure, vision-based item discovery, and context-bounded sessions.

## Purpose

Formalize the autonomous multi-session loop pattern into a reusable scaffolding skill. Running `/soda-loop-setup` generates four files (VISION.md, PROGRESS.md, AGENT_PROMPT.md, run-loop.sh) that together orchestrate an autonomous agent loop with:

- **Phase-based structure**: Items organized by phases with explicit dependencies
- **Validation-driven progress**: Each implementation item paired with a validation item
- **Vision-based discovery**: Agent discovers new items by comparing current state to VISION.md
- **Context-bounded sessions**: Hard limits on items per session, budget per session, and inactivity timeout

## Design Notes

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

30-minute default. The loop harness monitors the session log file's mtime. If no output is produced for the timeout period, the session is killed. This detects stuck sessions (e.g., waiting for input, infinite loops in tool use).

### Exit reason communication

Session exit info is appended to PROGRESS.md's Session Log section. The next session reads this to understand why the previous session ended and what to prioritize. Three exit scenarios: normal (voluntary exit), budget-exceeded (cost limit hit), timeout (inactivity kill).

### Template strategy

- **Shell script** (`run-loop.sh`): External file in `templates/`, copied to target directory at setup time. Too complex for inline embedding.
- **Markdown templates** (PROGRESS.md, AGENT_PROMPT.md): Embedded in SKILL.md with placeholder substitution. Keeps the skill self-contained and allows the agent to customize templates during generation.

## Typical Usage

```
/soda-loop-setup
```

1. Answer prompts for project name, vision, phases, and optional advanced config
2. Four files are generated in the target directory
3. Run `./run-loop.sh` to start the autonomous loop

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOOP_DIR` | `.` | Working directory for loop files |
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
