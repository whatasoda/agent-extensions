# soda-team-init

## Background

This skill emerged from the observation that soda-loop's single-agent sequential harness produces insufficient implementation quality for large-scale tasks. Analysis of multi-agent best practices (Cursor FastRender, Anthropic harness patterns, industry reports) pointed to a multi-agent team approach as a more effective paradigm.

The key insight: the primary productivity multiplier is parallelism via independent git worktrees, not a faster single agent. And the primary quality risk is Architectural Drift — agents making locally sensible but globally inconsistent decisions.

## Purpose

Initialize a multi-agent team project by:
1. Ingesting a large set of requirements (e.g., 76 gap items from an audit)
2. Investigating the codebase and classifying requirements into groups
3. Discussing design-critical groups with the user
4. Decomposing groups into Worker-sized tasks
5. Generating the coordination files that soda-team-run consumes

## Prerequisites

- **soda-discuss completed**: Design direction should be established before initialization. The Living Discussion Document (`.agent-discussions/`) provides the initial Architecture Decision Records.
- **`.worktrees/` gitignored**: Worker agents operate on isolated git worktrees under `.worktrees/`. This directory must be gitignored before running soda-team-run.
- **`.agent-team/` gitignored**: Coordination files are working artifacts, not committed to the repository.

## Design Rationale

### Agent Team Architecture

Five specialized agent roles with hierarchical coordination:

- **Orchestrator** (long-lived): Task management, Worker lifecycle, progress tracking
- **Architect** (on-demand, role switch in main context): Design decisions, ADR maintenance, direct user communication
- **Worker** (short-lived, disposable): Single-task implementation on isolated worktree
- **Reviewer** (short-lived): Post-implementation quality evaluation
- **Investigator** (short-lived): Codebase research on request

This structure directly addresses the two main risks identified in research:
- **Architectural Drift**: Architect role maintains ARCHITECTURE.md; Reviewer checks ADR compliance
- **Quality degradation at scale**: Dedicated Reviewer separate from implementation; Workers are short-lived to prevent context pollution

### File-Based Coordination Over Real-Time Messaging

Agents coordinate via structured files in `.agent-team/` rather than real-time inter-agent messaging. This was chosen because:
- File-based coordination survives restarts and is auditable
- Works across context windows without special infrastructure
- Git provides natural versioning and conflict detection
- Industry research shows this is more robust for coding agents

### Integration Branch Strategy

All Worker results merge into an integration branch (not main). This provides:
- Safe staging area — main is never in a broken state
- Easy rollback — discard the integration branch if the approach fails
- Natural PR boundary — the integration branch becomes a single PR to main

### Task Self-Containedness

Each TASK-NNN.md must be fully self-contained — a Worker should need only that file to implement. Design Constraints include summarized ADR content (not just references). This prevents Workers from needing to read ARCHITECTURE.md or other tasks, keeping their context focused and reducing the chance of distraction.

### Hybrid Task Decomposition

Requirements are auto-classified into groups, but design-critical groups get human discussion. This balances throughput (76 items can't all be discussed individually) with quality (architectural decisions need human judgment).

## Skill Chain Position

```
soda-discuss → soda-team-init → soda-team-run
```

- **After soda-discuss**: Living Discussion Document provides design direction and initial ADRs
- **Before soda-team-run**: Coordination files are the input to execution cycles

## Coordination Files

See `references/coordination-files.md` for the full specification. Summary:

| File | Manager | Purpose |
|------|---------|---------|
| CONFIG.md | soda-team-init | Integration branch and project metadata |
| TASKS.md | Orchestrator | Task list and progress overview |
| ARCHITECTURE.md | Architect | Design decision records (ADRs) |
| TASK-NNN.md | Orchestrator + Architect | Self-contained Worker instruction |
| REVIEW-NNN.md | Reviewer | Review result and next actions |
