# soda-team-run

## Background

This skill replaces soda-loop's autonomous single-agent harness with a human-triggered, multi-agent execution model. The shift was motivated by observed quality issues in soda-loop: context degradation across sessions, lack of real-time quality feedback, and retry-based error handling that doesn't address root causes.

## Purpose

Execute agent team tasks by orchestrating specialized agents. Each `/soda-team-run` invocation runs one cycle: select tasks, run Workers in parallel, review results, handle merges and escalations.

The human triggers each cycle — there is no autonomous loop. This ensures the user maintains oversight and can intervene between cycles.

## Design Rationale

### Human-Triggered Cycles Over Autonomous Loops

soda-loop's autonomous execution was the primary source of quality problems. By requiring the user to trigger each cycle:
- The user sees results before more work begins
- Direction can be adjusted between cycles
- There's a natural checkpoint for "stop and rethink" moments

### Parallel Workers on Isolated Worktrees

Each Worker runs on its own git worktree, branching from the integration branch. This enables:
- True parallel execution with no file conflicts
- Clean rollback per task (just delete the worktree)
- Independent validation (each Worker runs its own tests)

Worker branches use the `task/` prefix (e.g., `task/TASK-001`) to distinguish from the integration branch (`team/` prefix).

### Short-Lived, Disposable Workers

Workers are created per task and destroyed after completion. This addresses context pollution — a Worker that has been running for a long time accumulates stale context and makes progressively worse decisions. Fresh Workers start with only the TASK-NNN.md content, keeping their context focused.

When a Worker fails, a new Worker is created (not the same one retried). The new Worker receives the Reviewer's findings in the task's History section, so it learns from the failure without inheriting the failed Worker's confused state.

### Reviewer Separation

Reviewers are separate agents that cannot modify files. This prevents:
- Self-assessment bias (the implementer reviewing their own work)
- "Fix it myself" shortcuts that bypass quality gates
- Mixing implementation concerns with quality judgment

### Architect as Role Switch

The Architect is not a separate sub-agent but a role the main context assumes when design decisions are needed. While this provides less isolation than a separate agent, it was chosen because:
- Small design decisions don't warrant session interruption
- The Architect needs to communicate directly with the user
- ARCHITECTURE.md serves as the persistent context (not the agent's memory)
- For major design issues, the user can always escalate to a separate `/soda-discuss` session

### Merge Conflict Strategy

Merge conflicts are never auto-resolved. When a conflict occurs merging a Worker branch into the integration branch:
- The merge is aborted
- The user is informed with the affected files
- The user decides: resolve manually or defer the task

This is deliberately conservative — automated conflict resolution can silently introduce bugs that are harder to find than the original conflict.

## Cycle Workflow

```
Step 1: Load project state (TASKS.md, CONFIG.md, ARCHITECTURE.md)
Step 2: Select actionable tasks → present batch for confirmation
Step 3: Launch Workers in parallel (isolated worktrees)
Step 4: Review completed tasks (Reviewer per task)
Step 5: Resolve results:
        - PASS → merge to integration branch
        - FAIL → new Worker with Reviewer findings (max 2 attempts)
        - ESCALATE → Architect role for design discussion
        - BLOCKED → user escalation
Step 6: Cycle report with progress summary
```

## Error Handling

| Situation | Response |
|-----------|----------|
| Worker completes but review fails | New Worker with Reviewer findings |
| Worker blocked (cannot proceed) | Investigator analyzes → new Worker with more context |
| Same task fails twice | Escalate to user (split / skip / manual) |
| Reviewer escalates design issue | Architect role switch → ADR update → retry |
| Merge conflict | Abort, report to user, defer or manual resolve |

## Prerequisites

- `.agent-team/` directory populated by `/soda-team-init`
- Integration branch exists (recorded in CONFIG.md)
- `.worktrees/` directory gitignored
