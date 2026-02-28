---
name: soda-loop-plan
description: Create a detailed plan for a subset of soda-loop vision goals
user-invocable: true
argument-hint: "[loop-name or path]"
allowed-tools: Bash(git *), Bash(codex *), Bash(bun *), Read, Write, Grep, Glob, Task, AskUserQuestion
---

**CRITICAL**: Do NOT use EnterPlanMode or enter plan mode at any point during this skill. This is an interactive dialogue skill — not an implementation task. Proceed directly through the steps below without planning.

Create a detailed, investigated implementation plan for a subset of goals from an existing VISION.md. The output is a PLAN-*.md file that serves as an intermediate artifact between the high-level vision and the concrete PROGRESS.md task breakdown.

Use English for all generated file content. User interaction (AskUserQuestion options, presentations) must be in Japanese.

If $ARGUMENTS is empty, proceed directly to loop detection. If $ARGUMENTS contains a loop name or directory path, use it to locate the loop.

## PLAN-*.md File Format

````markdown
# Plan: {{PLAN_NAME}}

**Loop**: {{LOOP_NAME}}
**Created**: {{ISO_DATE}}

## Goals Covered
- {{GOAL_TEXT_1}}
- {{GOAL_TEXT_2}}

## Context
{{investigation summary — key findings about this area}}

## Steps

### Step: {{STEP_TITLE}}
- Goal Ref: {{GOAL_ID}}
- Description: {{what this step does}}
- Files: `{{path/to/file}}` — {{why}}
- Acceptance: {{verifiable pass/fail condition}}
- Validation: `{{runnable_command}}` — {{expected outcome}}
- Deps: {{other step titles WITHIN THIS PLAN ONLY, or "none"}}

## Risks
- {{risk}} — {{mitigation}}

## Open Questions
- {{question}}
````

**Step title uniqueness constraint**: Step titles MUST be unique within a plan file — ensures unambiguous Deps remapping during plan-to-PROGRESS.md conversion.

File naming: `PLAN-NN-<kebab-name>.md` (zero-padded numeric prefix). Location: `.agent-loops/<loop-name>/`.

1:1 plan-to-phase mapping: plans sorted by numeric prefix map to sequential phases (e.g., PLAN-01 and PLAN-03 → Phase 1 and Phase 2). Each plan's steps become items N.1, N.2, etc. where N is the sequential phase number.

**Deps constraint**: Step `Deps` may only reference titles within the same plan. Cross-plan deps are expressed via phase ordering (numeric prefixes).

## Plan Blueprint Handoff Block

```
## Plan Blueprint

**Project**: {{PROJECT_NAME}}
**Loop Name**: {{LOOP_NAME}}
**Plan File**: {{ABSOLUTE_PATH_TO_PLAN_FILE}}

### Covered Goals
- {{goal text}}

### Steps
- {{step_title}} — {{one-line summary}}

### Risks
- {{risk summary}}
```

## Goal ID Convention

Goals identified by checkbox text: `- [ ] Implement X` → Goal ID is `Implement X`. This is text-based matching consistent with existing goal parsing in soda-loop-setup.

## Procedure

### Step 1: Loop Detection

Determine the loop directory. Do NOT ask the user to type a path from scratch.

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```
If this fails (non-git context), use the current working directory as the repo root.

**Detection order**:

First, check the conversation for a **Vision Blueprint** block (produced by `/soda-loop-vision`). If found, extract loop name from the `**Loop Name**` field and derive the loop directory as `<repo-root>/.agent-loops/<loop-name>/`.

If no Vision Blueprint is found:
1. If `$ARGUMENTS` looks like a loop name or path, use it to locate `<repo-root>/.agent-loops/<argument>/VISION.md`
2. Else scan for existing loops using Glob tool with pattern `<repo-root>/.agent-loops/*/VISION.md`
   - If a single loop is found → suggest it
   - If multiple loops are found → list them and let user choose via AskUserQuestion (one option per loop name + "終了")
3. If no loops found → inform user and suggest running `/soda-loop-vision` first. Stop.

**After determining the loop name**, confirm with the user:

Use AskUserQuestion:
- "`.agent-loops/{{LOOP_NAME}}/` で進める"
- "別のループを指定"

If "別のループを指定": ask for loop name, re-detect.

The loop directory is: `<repo-root>/.agent-loops/<loop-name>/`

**Read VISION.md**: Read the file and extract the `## Goals` section. If VISION.md is missing, suggest `/soda-loop-vision` and stop.

### Step 2: Goal Selection

Present the goals from VISION.md with coverage status. First, check for existing plan files:

**Existing plan scan**: Glob `<loop-dir>/PLAN-*.md`. For each existing plan, extract the `## Goals Covered` section (bullet list of goal texts).

Present numbered goals with coverage indicators:

```
## ゴール一覧

1. [ ] {{GOAL_TEXT_1}} [uncovered]
2. [ ] {{GOAL_TEXT_2}} [covered by PLAN-01]
3. [ ] {{GOAL_TEXT_3}} [uncovered]
4. [ ] {{GOAL_TEXT_4}} [covered by PLAN-02]
...
```

Use AskUserQuestion (multiSelect: true):
- One option per **uncovered** goal (label: goal text, description: acceptance criteria if available)
- If all goals are covered, inform the user and offer: "既存プランを上書きするゴールを選択" / "終了"

After selection:

**Plan name derivation**: Derive a kebab-case plan name from the selected goals' common theme. Present to the user for confirmation via AskUserQuestion:
- "「{{SUGGESTED_NAME}}」で進める"
- "別の名前を指定"

**Numeric prefix assignment**: `max(existing plan prefixes) + 1`, zero-padded to 2 digits. If no existing plans, start at `01`.

The plan file will be: `PLAN-{{PREFIX}}-{{PLAN_NAME}}.md`

### Step 3: Investigation

Launch 1-2 sub-agents (Task, subagent_type: Explore) to investigate the selected goals.

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with the following constraint block:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Sub-agent output contract**: Every sub-agent prompt MUST end with the following output format requirement:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the goal
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the goal
> ### Open Questions
> - question — what remains unclear from this investigation alone

**Investigation prompt construction**:

For each sub-agent, include:
1. The constraint block
2. The selected goals and their acceptance criteria from VISION.md
3. Any relevant context from VISION.md (Background, Technical Context, Key Decisions sections)
4. Specific investigation directives: identify relevant files, existing patterns, dependencies, and potential risks
5. The output contract

If only 1-2 goals are selected, use a single sub-agent. If 3+ goals are selected covering distinct areas, use 2 sub-agents with divided goal assignments.

Present a brief summary of investigation findings in Japanese before proceeding to Step 4.

### Step 4: Plan Composition

Compose the PLAN-*.md file following the format defined in the PLAN-*.md File Format section above.

**Composition rules**:
1. `# Plan:` heading uses the confirmed plan name
2. `**Loop**:` uses the loop name
3. `**Created**:` uses current ISO date
4. `## Goals Covered` lists the selected goals as bullet items (exact text from VISION.md)
5. `## Context` summarizes investigation findings — key files, patterns, and architectural decisions relevant to this plan's scope
6. `## Steps` contains one `### Step:` block per implementation step. Each step must include all required sub-fields: Goal Ref, Description, Files, Acceptance, Validation, Deps
7. `## Risks` lists identified risks with mitigations
8. `## Open Questions` lists unresolved questions from investigation

**Validation before writing**:
- All required sub-fields present in every step
- Step titles are unique within the plan
- Deps only reference titles within this plan (no cross-plan references)
- Goal Ref values match goal text from VISION.md
- At least one step per covered goal

### Codex Review

Delegate codex review to a subagent to keep the full codex output out of the main context.

1. Launch a codex review subagent:
   - Tool: `Task(subagent_type: dev-workflow:codex-review)`
   - Prompt: Specify "init" mode and include the Bash command with composed content via heredoc.
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts init "Review this implementation plan. Focus on step completeness, dependency correctness, and acceptance criteria verifiability — only flag critical problems" <<'CODEX_REVIEW_EOF'
     [composed PLAN-*.md content]
     CODEX_REVIEW_EOF
     ```
   - Capture `review_file`, `session_id`, and critical issues from the subagent's response.
2. If the subagent reports critical issues, revise the content and launch another subagent with a **fresh** "init" command (not resume):
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts init "Review this implementation plan. Focus on step completeness, dependency correctness, and acceptance criteria verifiability — only flag critical problems" <<'CODEX_REVIEW_EOF'
     [revised PLAN-*.md content]
     CODEX_REVIEW_EOF
     ```
3. If the subagent reports skip or failure, continue without review.

### Step 5: Write Plan File

Write the reviewed plan to `<loop-dir>/PLAN-{{PREFIX}}-{{PLAN_NAME}}.md`.

If a file already exists at this path (e.g., from a previous run), use AskUserQuestion:
- "上書きする"
- "別のプレフィックスを使用"
- "キャンセル"

After writing, emit the **Plan Blueprint** handoff block in the conversation:

```
## Plan Blueprint

**Project**: {{PROJECT_NAME}}
**Loop Name**: {{LOOP_NAME}}
**Plan File**: {{ABSOLUTE_PATH_TO_PLAN_FILE}}

### Covered Goals
- {{goal text 1}}
- {{goal text 2}}

### Steps
- {{step_title_1}} — {{one-line summary}}
- {{step_title_2}} — {{one-line summary}}

### Risks
- {{risk summary}}
```

Then print next steps:

```
Plan created:
- {{PLAN_FILENAME}} — {{STEP_COUNT}} steps covering {{GOAL_COUNT}} goals

Next:
  /soda-loop-plan — Create plans for remaining uncovered goals
  /soda-loop-setup — Generate loop harness (consumes plans for phase derivation)
```

## Constraints

- This skill only creates plan files. Do NOT generate PROGRESS.md, AGENT_PROMPT.md, or run-loop.ts.
- Do NOT modify VISION.md — that is `/soda-loop-vision`'s responsibility.
- Do NOT enter plan mode (no EnterPlanMode).
- The Plan Blueprint block format must be stable — `/soda-loop-setup` detects it by heading pattern.
- Step Deps may only reference titles within the same plan. Cross-plan dependencies are expressed via phase ordering (numeric prefixes).
- Step titles must be unique within a plan file.
