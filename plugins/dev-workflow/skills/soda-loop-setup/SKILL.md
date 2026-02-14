---
name: soda-loop-setup
description: Generate autonomous loop harness from vision blueprint
user-invocable: true
allowed-tools: Bash(git *), Read, Grep, Glob, Write, AskUserQuestion
---

Generate an autonomous multi-session loop harness for a project. The harness consists of three files: PROGRESS.md, AGENT_PROMPT.md, and run-loop.ts. It consumes a VISION.md produced by `/soda-loop-vision` (or provided inline).

Use English for all generated file content. User interaction (AskUserQuestion options, confirmation messages, phase presentations) must be in Japanese.

## Vision Detection

Before starting, check the conversation for a **Vision Blueprint** block (produced by `/soda-loop-vision`).

- **If found**: Extract project name, target directory, goals, constraints, and out-of-scope items. Verify VISION.md exists at the target path. If VISION.md is missing, write it from the Vision Blueprint content.
- **If not found**: Proceed to Step 1 to detect or create a vision manually.

When a Vision Blueprint is found, skip Step 1 entirely and proceed to Step 2.

## Embedded Templates

### PROGRESS.md Template

````markdown
# {{PROJECT_NAME}} - Loop Progress

## Vision
See: VISION.md

## Configuration
- Discovery quota: 10 items max (add max 3 per session)
- Retry limit: 3 attempts per item before marking [!]

## Phase 1: {{PHASE_1_NAME}}
{{PHASE_1_DESCRIPTION}}

### Items
- [ ] **1.1**: {{TITLE}} [implement]
  - Description: {{DESCRIPTION}}
  - Files: `{{FILE_PATH}}`
  - Validation: {{HOW_TO_VERIFY}}
  - Deps: none

- [ ] **V-1.1**: Validate {{TITLE}} [validate]
  - Steps: {{STEPS}}
  - Expected: {{EXPECTED}}
  - Pass criteria: {{CRITERIA}}
  - Deps: 1.1

### Phase Validation
- [ ] **PV-1**: {{PHASE_VALIDATION}}
  - Deps: all items in Phase 1

## Discovered Items
<!-- Max 10 items. Format: D-N prefix. Agent adds when vision gaps found. -->

## Session Log
<!-- Append-only. Harness appends after each session. -->
````

### AGENT_PROMPT.md Template

````markdown
# Autonomous Loop Agent — {{PROJECT_NAME}}

## Role
You are an autonomous agent working in a multi-session loop. Your goal is to make incremental progress toward the vision described in VISION.md. Each session is context-bounded — you will be replaced by a fresh session when you exit.

## Key Files
- `PROGRESS.md` — Progress tracker with items and their states
- `VISION.md` — Target end state description

## State Legend
- `[ ]` pending — not started
- `[~]` in-progress — started but not completed
- `[x]` done — completed and verified
- `[!]` blocked — failed after 3 retries

## Session Lifecycle
1. Read PROGRESS.md — check Session Log for previous exit reason
2. If previous session exited with `budget-exceeded` or `timeout`: check for `[~]` items with partial progress
3. Find next actionable item: first any `[~]` item (resume), then first `[ ]` item whose deps are all `[x]`
4. If no actionable items → Discovery Protocol (see below)
5. Mark item `[~]` in PROGRESS.md
6. Execute item (implement or validate per item type)
7. On success: mark `[x]`. On failure after 3 retries: mark `[!]` with reason
8. Context check: if processed 3+ items OR context feels heavy → exit
9. Otherwise → back to step 3

## Discovery Protocol
Triggered when no `[ ]` or `[~]` items remain and not all phases are complete:
1. Read VISION.md, compare to current state of the codebase
2. Count existing `D-*` items in Discovered Items section
3. If 10 or more discovered items exist → log "discovery quota reached", exit
4. Add up to 3 new items with `D-N` prefix to Discovered Items section
5. Exit session immediately (do NOT execute discovered items — next session handles them)

## Context Management
- Process at most 3 items per session
- After completing each item: self-assess remaining context capacity
- If uncertain whether context is sufficient → exit early (the loop creates a fresh session)
- NEVER allow context compaction — exit before it happens

## Forced Exit Recovery
Check Session Log for previous session's exit info:
- `budget-exceeded`: Previous session hit token budget. Any `[~]` items may have partial work.
- `timeout`: Previous session was killed for inactivity. Check `[~]` items carefully for inconsistent state.
- Always prioritize `[~]` items over `[ ]` items.

## Safety Rules
- File boundaries: {{FILE_SCOPE}}
- NEVER use `git add -A` or `git add .` — always add specific files
- Commit format: `{{COMMIT_PREFIX}}: <description>`
- Max 3 retries per item, then mark `[!]` with failure reason
- Do not modify PROGRESS.md structure — only update item states and Session Log

## Context Pollution Prevention
- Never read entire large files — use Grep to find relevant sections
- Pipe long command output to temp files: `cmd > /tmp/output.log 2>&1`
- Check results with: `tail -20 /tmp/output.log`
- Avoid storing large content in variables
````

## Procedure

### Step 1: Vision Detection

Check if VISION.md exists in the working directory (or ask for the target directory first).

Use AskUserQuestion:

**Question 1** — What is the target directory path?

Options:
- `.` (current directory)
- Other (user types path)

Then check for VISION.md:
```bash
ls {{TARGET_DIR}}/VISION.md 2>/dev/null
```

**If VISION.md exists**: Read it and extract project name, goals, constraints, and out-of-scope items. Present a summary to the user. Use AskUserQuestion:
- "Use this VISION.md"
- "Re-create vision with /soda-loop-vision"

**If VISION.md does not exist**: Use AskUserQuestion:
- "Run /soda-loop-vision first" (recommended) — inform the user to run `/soda-loop-vision` and stop here
- "Quick inline vision" — ask for a project name and free-text vision, then write a minimal VISION.md with the user's text as a single goal. Proceed to Step 2.

If the user chose "Run /soda-loop-vision first" or "Re-create vision with /soda-loop-vision", print the suggestion and stop. Do NOT continue to Step 2.

### Step 2: Advanced Configuration (optional)

Use AskUserQuestion:

**Question** — Would you like to customize advanced settings?

Options:
- Use defaults
- Customize

If "Customize" is selected, ask a follow-up AskUserQuestion with these fields:
- Model (`sonnet` / `opus` / `haiku`)
- Max budget per session USD (default: `10`)
- Max sessions (default: `10`)
- Idle timeout seconds (default: `1800`)
- Allowed tools (default: `Read,Write,Edit,Bash,Glob,Grep`)
- File scope restriction (default: `.` — current directory)
- Commit prefix (default: `feat`)

### Step 3: Phase Proposal

Derive phases from the goals in VISION.md. Do NOT ask the user to define phases manually.

1. Parse goals from VISION.md (the `## Goals` section with `- [ ]` items).
2. Analyze goal relationships and derive phases:
   - Group related goals that form a logical unit of work
   - Order phases by dependency: foundational goals first, dependent goals later
   - Each phase should have 2-5 goals (split or merge if outside this range)
3. For each phase, generate:
   - Phase name (derived from the theme of its goals)
   - Phase description (one sentence summarizing what this phase achieves)
   - Implementation items (one per goal, with `[implement]` tag)
   - Validation items (one per implementation item, with `[validate]` tag)
   - Phase validation item (overall phase verification)

Present the proposed phases:

```
Proposed phases (derived from VISION.md):

Phase 1: {{PHASE_NAME}}
  {{PHASE_DESCRIPTION}}
  Items: {{IMPL_COUNT}} implementation + {{VAL_COUNT}} validation
  Goals covered:
    - {{GOAL_1}}
    - {{GOAL_2}}

Phase 2: {{PHASE_NAME}}
  {{PHASE_DESCRIPTION}}
  Items: {{IMPL_COUNT}} implementation + {{VAL_COUNT}} validation
  Goals covered:
    - {{GOAL_3}}
    - {{GOAL_4}}

...
```

Use AskUserQuestion:
- "Generate with these phases"
- "Merge phases" (combine phases to reduce count)
- "Split a phase" (break a large phase into smaller ones)
- "Adjust items" (modify specific items within phases)

If the user requests adjustments, incorporate feedback and re-present. Do NOT proceed until the user confirms.

### Step 4: Confirmation

Present a summary of all configuration:

```
Project: {{PROJECT_NAME}}
Target: {{TARGET_DIR}}
Vision: VISION.md ({{GOAL_COUNT}} goals)
Phases: {{PHASE_COUNT}} (auto-derived)
Model: {{MODEL}} | Budget: ${{BUDGET}}/session | Max sessions: {{MAX_SESSIONS}}
```

Use AskUserQuestion:

**Question** — Generate loop files with this configuration?

Options:
- Generate
- Adjust settings (go back to relevant step)
- Cancel

### Step 5: Generate Files

Before generating, check if loop files already exist in the target directory:
```bash
ls {{TARGET_DIR}}/{PROGRESS.md,AGENT_PROMPT.md,run-loop.ts} 2>/dev/null
```
If any exist, use AskUserQuestion to confirm overwrite.

Generate files in this order:

1. **PROGRESS.md** — Substitute all `{{PLACEHOLDER}}` values in the template above. For each phase, generate the Items section with implementation items, validation items, and phase validation item.
2. **AGENT_PROMPT.md** — Substitute `{{PROJECT_NAME}}`, `{{FILE_SCOPE}}`, and `{{COMMIT_PREFIX}}` in the template above.
3. **run-loop.ts** — Copy from `${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-setup/templates/run-loop.ts` and make executable:
   ```bash
   cp "${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-setup/templates/run-loop.ts" "{{TARGET_DIR}}/run-loop.ts"
   chmod +x "{{TARGET_DIR}}/run-loop.ts"
   ```

### Step 6: Usage Instructions

Print getting-started instructions:

```
Loop files generated:
- PROGRESS.md — Progress tracker ({{PHASE_COUNT}} phases, {{ITEM_COUNT}} items)
- AGENT_PROMPT.md — Agent prompt
- run-loop.ts — Loop harness

Vision: {{TARGET_DIR}}/VISION.md (already exists)

Prerequisites:
  bun must be installed (https://bun.sh)

Start:
  cd {{TARGET_DIR}}
  ./run-loop.ts

Customize with env vars:
  CLAUDE_MODEL=opus MAX_BUDGET_USD=20 ./run-loop.ts

Stop:
  touch {{TARGET_DIR}}/STOP

View logs:
  ls {{TARGET_DIR}}/.loop-logs/
```
