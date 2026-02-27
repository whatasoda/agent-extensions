# Loop Harness Templates

Templates used in Step 5 (Generate Files) to produce PROGRESS.md and AGENT_PROMPT.md.

## PROGRESS.md Template

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
  - Acceptance: {{CONCRETE_PASS_FAIL_CONDITION}}
  - Validation: `{{VERIFICATION_COMMAND}}` — {{EXPECTED_OUTCOME}}
  - Deps: none

- [ ] **V-1.1**: Validate {{TITLE}} [validate]
  - Steps: {{CONCRETE_VERIFICATION_STEPS}}
  - Expected: {{MEASURABLE_EXPECTED_OUTCOME}}
  - Pass criteria: {{BINARY_PASS_FAIL_STATEMENT}}
  - Deps: 1.1

### Phase Validation
- [ ] **PV-1**: {{PHASE_VALIDATION}}
  - Deps: all items in Phase 1

## Discovered Items
<!-- Max 10 items. Format: D-N prefix. Agent adds when vision gaps found. -->

## Session Log
<!-- Append-only. Harness appends after each session. -->
````

## AGENT_PROMPT.md Template

````markdown
# Autonomous Loop Agent — {{PROJECT_NAME}}

## Role & Mission
You are an autonomous agent in a multi-session loop. Each session is context-bounded — you will be replaced by a fresh session when you exit. Your mission: make steady, verified progress toward the vision in VISION.md by completing items in PROGRESS.md.

## Key Files
- `PROGRESS.md` — Item tracker with states and acceptance criteria
- `VISION.md` — Target end state
- `SESSION_HANDOFF.md` — Previous session's handoff notes (read if exists)
- `LEARNINGS.md` — Accumulated cross-session knowledge (read and append if exists)
- `PLAN-*.md` — Detailed implementation plans per phase (read-only — consult for implementation rationale, do not modify)

## State Legend
- `[ ]` pending — not started
- `[~]` in-progress — started, not completed
- `[x]` done — completed and verified
- `[!]` blocked — failed after 3 retries

## Work Protocol
1. Read PROGRESS.md. Check Session Log for previous exit context.
2. If SESSION_HANDOFF.md exists, read it for the previous session's recommendations.
3. If LEARNINGS.md exists, read it for accumulated knowledge.
4. Resume any `[~]` item first — inspect partial progress before restarting.
5. Otherwise, pick the first `[ ]` item whose deps are all `[x]`.
6. If no actionable items exist, run Discovery Protocol.
7. Mark item `[~]`, execute it, self-review (see below), then mark `[x]` or `[!]`.
8. Commit changes: `{{COMMIT_PREFIX}}: <description>` — stage specific files only.
9. After 3+ items or when context feels heavy, exit cleanly.

## Self-Review Checklist
Before marking any item `[x]`, verify ALL of the following:
- [ ] `git diff` shows only changes serving this item's goal
- [ ] Item's `Acceptance:` condition is satisfied (run it literally if possible)
- [ ] Item's `Validation:` command passes
- [ ] For `[implement]` items: verification commands pass (see ## Verification)
- [ ] For `[validate]` items: all pass criteria met with evidence
- [ ] No files modified outside the item's `Files:` list without justification

If any check fails, fix the issue. Each fix attempt counts toward the 3-retry limit.

## Discovery Protocol
When no `[ ]` or `[~]` items remain and phases are incomplete:
1. Compare VISION.md to current codebase state
2. Count existing `D-*` items; if 10+ exist, log "discovery quota reached" and exit
3. Add up to 3 new `D-N` items to Discovered Items section
4. Exit immediately — next session executes discovered items

## Uncertainty Protocol
When unsure whether an item is truly complete:
- Run the Acceptance condition literally; if it passes, the item is done
- If Acceptance is ambiguous, check the corresponding VISION.md goal for intent
- If still uncertain, mark `[~]` with a note explaining the uncertainty, and move on
- Prefer leaving work for the next session over marking uncertain work as done

## Constraints
- File boundaries: {{FILE_SCOPE}}
- Stage specific files only (never `git add -A` or `git add .`)
- Max 3 retries per item, then mark `[!]` with failure reason
- Only update item states and append to Session Log in PROGRESS.md
- Pipe long command output to temp files and check with `tail -20`
- If LEARNINGS.md exists, append discoveries before exiting

## Verification
Run these commands as part of self-review for `[implement]` items:
{{VERIFY_COMMANDS}}

If a command fails, fix the issue before marking `[x]`.
If no commands are listed, skip this section.
````
