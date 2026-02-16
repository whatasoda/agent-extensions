# soda-loop-status

## Background

After starting an autonomous loop with `soda-loop-setup` + `run-loop.ts`, users need visibility into what happened. The loop generates rich artifacts (PROGRESS.md, session logs, VISION.md) but parsing them manually is tedious, especially for long-running loops with many sessions. This skill provides a structured, at-a-glance view of loop status.

## Purpose

Read-only status dashboard for soda-loop runs. Parses all loop artifacts (PROGRESS.md, .loop-logs/, VISION.md, STOP file) into a unified view with drill-down capability.

Designed for two scenarios:
1. **Mid-loop check**: Loop is still running, user wants to see progress
2. **Post-loop review**: Loop finished, user wants to understand results

## Design Notes

### Helper script approach

Follows the established pattern from `soda-plans` (list-plans.ts) and `soda-review` (detect-base-branch.ts): a Bun script parses data sources and outputs structured JSON. The SKILL.md procedure then formats the JSON for presentation.

This separation keeps the SKILL.md focused on user interaction while the script handles parsing complexity (NDJSON logs, markdown structure, file existence checks).

### Loop directory detection

Three-tier detection: CLI argument > auto-discovery in `.agent-loops/` > current directory PROGRESS.md presence. The auto-discovery scans `<repo-root>/.agent-loops/` for subdirectories containing PROGRESS.md. If a single loop is found, it's used automatically. If multiple loops exist, the script outputs a selection prompt for the SKILL.md to present. If neither works, SKILL.md asks the user.

### Progress bar and dashboard format

The status overview uses a compact dashboard format rather than verbose prose. The user wants to quickly assess "how far along is it?" and "are there problems?" before deciding to drill down.

### Cost tracking

Session costs are extracted from .loop-logs/session-N.log NDJSON files (the "result" event contains cost_usd). This provides actual spend data not available from PROGRESS.md alone.

### Graceful degradation

The script handles partial data: missing VISION.md, missing .loop-logs/, incomplete session logs. Each missing component produces a warning rather than an error, so the user always gets the best available view.

## Relationship to Other Skills

```
soda-loop-vision → soda-loop-setup → (run-loop.ts) → soda-loop-status
    (VISION.md)     (PROGRESS.md,        (runs)       (reads all,
                     AGENT_PROMPT.md,                   read-only)
                     run-loop.ts)

All artifacts in: .agent-loops/<loop-name>/
```
