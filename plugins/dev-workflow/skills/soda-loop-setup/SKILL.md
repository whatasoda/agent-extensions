---
name: soda-loop-setup
description: Generate autonomous loop harness from vision blueprint
user-invocable: true
allowed-tools: Bash(git *), Read, Grep, Glob, Write, AskUserQuestion
---

Generate an autonomous multi-session loop harness for a project. The harness consists of three files: PROGRESS.md, AGENT_PROMPT.md, and run-loop.ts. It consumes a VISION.md produced by `/soda-loop-vision` (or provided inline).

All loop artifacts are placed in `<repo-root>/.agent-loops/<loop-name>/`.

Use English for all generated file content. User interaction (AskUserQuestion options, confirmation messages, phase presentations) must be in Japanese.

## Vision Detection

Before starting, check the conversation for a **Vision Blueprint** block (produced by `/soda-loop-vision`).

- **If found**: Extract project name, loop name, goals, constraints, and out-of-scope items. Detect `**Loop Name**` field to derive the loop directory (`<repo-root>/.agent-loops/<loop-name>/`). If the Vision Blueprint uses the legacy `**Target**` field instead, derive the loop name from the target directory's basename and use `<repo-root>/.agent-loops/<loop-name>/` as the loop directory. Verify VISION.md exists at the loop directory path. If VISION.md is missing, write it from the Vision Blueprint content.
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
1. Read PROGRESS.md and its Session Log for previous exit reason
2. Resume any `[~]` item first — previous session may have exited mid-work (budget-exceeded or timeout). Inspect partial progress before restarting.
3. If no `[~]` item: find first `[ ]` item whose deps are all `[x]`
4. If no actionable items → Discovery Protocol (see below)
5. Mark item `[~]` in PROGRESS.md
6. Execute item (implement or validate per item type)
7. Self-review before completion:
   - Run `git diff` to verify all changes are intentional and complete
   - Check changes against the item's Validation field
   - For `[implement]` items: confirm the implementation satisfies the description and does not introduce unrelated changes
   - For `[validate]` items: confirm all pass criteria are met with evidence
   - Fix any issues found (each fix attempt counts toward the 3-retry limit)
8. On success: mark `[x]`. On failure after 3 retries: mark `[!]` with reason.
9. Context check: if 3+ items processed OR context feels heavy → exit early (the loop creates a fresh session). Exit before context compaction triggers.
10. Otherwise → back to step 3

## Discovery Protocol
Triggered when no `[ ]` or `[~]` items remain and not all phases are complete:
1. Read VISION.md, compare to current state of the codebase
2. Count existing `D-*` items in Discovered Items section
3. If 10 or more discovered items exist → log "discovery quota reached", exit
4. Add up to 3 new items with `D-N` prefix to Discovered Items section
5. Exit session immediately (do NOT execute discovered items — next session handles them)

## Rules
- File boundaries: {{FILE_SCOPE}}
- Commit format: `{{COMMIT_PREFIX}}: <description>` — always stage specific files (never `git add -A` or `git add .`)
- Max 3 retries per item, then mark `[!]` with failure reason
- Only update item states and append to Session Log in PROGRESS.md — do not alter its structure
- Use Grep to find relevant sections in large files; pipe long command output to temp files (`cmd > /tmp/output.log 2>&1`) and check with `tail -20 /tmp/output.log`
````

## Procedure

### Step 1: Vision Detection

Determine the loop directory. Do NOT ask the user to type a path from scratch.

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```
If this fails (non-git context), use the current working directory as the repo root.

**Detection order**:
1. If a Vision Blueprint was found in the conversation → use its `**Loop Name**` (or legacy `**Target**` basename) to derive `.agent-loops/<loop-name>/`
2. Else scan for existing loops:
   ```bash
   ls <repo-root>/.agent-loops/*/VISION.md 2>/dev/null
   ```
   - If a single loop is found → suggest it
   - If multiple loops are found → list them and let user choose via AskUserQuestion
3. If no loops found → ask the user for a loop name (or suggest running `/soda-loop-vision`)

**After determining the loop name**, confirm with the user:

Use AskUserQuestion:
- "`.agent-loops/{{LOOP_NAME}}/` で進める"
- "別のループを指定"

The loop directory is: `<repo-root>/.agent-loops/<loop-name>/`

Derive the project name from the loop name. Do NOT ask the user for the project name.

**Check for VISION.md**:
```bash
ls <repo-root>/.agent-loops/{{LOOP_NAME}}/VISION.md 2>/dev/null
```

**If VISION.md exists**: Read it and extract goals, constraints, and out-of-scope items. Present a summary to the user. Use AskUserQuestion:
- "Use this VISION.md"
- "Re-create vision with /soda-loop-vision"

**If VISION.md does not exist**: Use AskUserQuestion:
- "Run /soda-loop-vision first" (recommended) — inform the user to run `/soda-loop-vision` and stop here
- "Quick inline vision" — ask for a free-text vision, then write a minimal VISION.md with the user's text as a single goal. Proceed to Step 2.

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
- File scope restriction (default: `.` — repo root)
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
Loop: .agent-loops/{{LOOP_NAME}}/
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

**Ensure `.agent-loops/` is gitignored**:
```bash
grep -q '^\.agent-loops/' <repo-root>/.gitignore 2>/dev/null || echo '.agent-loops/' >> <repo-root>/.gitignore
```

**Create loop directory** (if not already created by `/soda-loop-vision`):
```bash
mkdir -p <repo-root>/.agent-loops/{{LOOP_NAME}}/
```

**Check for existing loop files**:
```bash
ls <repo-root>/.agent-loops/{{LOOP_NAME}}/{PROGRESS.md,AGENT_PROMPT.md,run-loop.ts} 2>/dev/null
```
If any exist, use AskUserQuestion to confirm overwrite.

Generate files in this order:

1. **PROGRESS.md** — Substitute all `{{PLACEHOLDER}}` values in the template above. For each phase, generate the Items section with implementation items, validation items, and phase validation item. Write to `<repo-root>/.agent-loops/{{LOOP_NAME}}/PROGRESS.md`.
2. **AGENT_PROMPT.md** — Substitute `{{PROJECT_NAME}}`, `{{FILE_SCOPE}}`, and `{{COMMIT_PREFIX}}` in the template above. Write to `<repo-root>/.agent-loops/{{LOOP_NAME}}/AGENT_PROMPT.md`.
3. **run-loop.ts** — Copy from plugin templates and make executable:
   ```bash
   cp "${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-setup/templates/run-loop.ts" "<repo-root>/.agent-loops/{{LOOP_NAME}}/run-loop.ts"
   chmod +x "<repo-root>/.agent-loops/{{LOOP_NAME}}/run-loop.ts"
   ```

### Step 6: Usage Instructions

Print getting-started instructions:

```
Loop files generated:
- PROGRESS.md — Progress tracker ({{PHASE_COUNT}} phases, {{ITEM_COUNT}} items)
- AGENT_PROMPT.md — Agent prompt
- run-loop.ts — Loop harness

All files in: .agent-loops/{{LOOP_NAME}}/
Vision: .agent-loops/{{LOOP_NAME}}/VISION.md (already exists)

Prerequisites:
  bun must be installed (https://bun.sh)

Start (from repo root):
  .agent-loops/{{LOOP_NAME}}/run-loop.ts

Customize with env vars:
  CLAUDE_MODEL=opus MAX_BUDGET_USD=20 .agent-loops/{{LOOP_NAME}}/run-loop.ts

Stop:
  touch .agent-loops/{{LOOP_NAME}}/STOP

View logs:
  ls .agent-loops/{{LOOP_NAME}}/.loop-logs/

Check status:
  /soda-loop-status
```
