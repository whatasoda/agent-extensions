---
name: soda-loop-vision
description: Define structured vision with verifiable goals for autonomous loop projects
user-invocable: true
argument-hint: [project goal description]
allowed-tools: Bash(git *), Read, Grep, Glob, Write, AskUserQuestion
---

Define a structured vision for an autonomous multi-session loop project. The output is a VISION.md file containing verifiable goals — an intermediate artifact between a high-level vision and a concrete implementation plan.

Use English for all generated file content. User interaction (AskUserQuestion options, draft presentations) must be in Japanese.

If $ARGUMENTS is empty, ask the user to describe the project goal before proceeding.

## Step 1: Project Context

Determine the loop name and loop directory.

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```
If this fails (non-git context), use the current working directory as the repo root.

**Loop name derivation**:
- If `$ARGUMENTS` is provided, derive a suggested loop name by slugifying: lowercase, replace spaces/special chars with hyphens, trim to 50 chars (e.g., "Add dark mode support" → `add-dark-mode-support`)
- If `$ARGUMENTS` is empty, ask the user for a loop name

**Confirm loop name** with AskUserQuestion:
- "「{{SUGGESTED_LOOP_NAME}}」で進める"
- "別の名前を指定"

The loop directory is: `<repo-root>/.agent-loops/<loop-name>/`

The project name equals the loop name.

## Step 2: Goal Elicitation

If $ARGUMENTS is provided, use it as the initial project goal description. Otherwise, ask the user to describe the project goal in free text.

Next, analyze the goal description and decompose it into 3-10 verifiable goals. Each goal must be:
- **Concrete**: Describes a specific outcome, not a vague aspiration
- **Verifiable**: Has a clear pass/fail condition (e.g., "X command exits 0", "file Y exists with Z content", "API endpoint returns 200")
- **Independent**: Can be evaluated without reference to other goals (though implementation may have dependencies)

Present the draft goal list to the user. Use AskUserQuestion:
- "This goal list looks good"
- "Add goals"
- "Remove or modify goals"
- "Goals are too granular — consolidate"
- "Goals are too vague — make more specific"

If the user requests changes, incorporate feedback and re-present. Do NOT proceed until the user confirms the goal list.

## Step 3: Constraints & Scope

Use AskUserQuestion to gather optional context:

**Question** — Are there constraints or exclusions to define?

Options:
- "No constraints needed" — skip to Step 4
- "Add technical constraints" — e.g., specific technologies, conventions, file boundaries
- "Define out-of-scope items" — explicitly exclude work areas
- "Both constraints and out-of-scope"

If the user selects any option other than skip, ask follow-up questions to collect the details. Present the collected constraints/exclusions for confirmation before proceeding.

## Step 4: Draft Review

Present the complete VISION.md draft:

```
Project: {{PROJECT_NAME}}
Loop: .agent-loops/{{LOOP_NAME}}/
Goals: {{GOAL_COUNT}}
Constraints: {{CONSTRAINT_COUNT}} (or "none")
Out of Scope: {{EXCLUSION_COUNT}} (or "none")
```

Followed by the full content that will be written to VISION.md.

Use AskUserQuestion:
- "新ブランチを作成して生成"
- "現ブランチで生成"
- "Adjust goals"
- "Adjust constraints/scope"

If adjustments are requested, go back to the relevant step. Do NOT proceed until the user confirms generation.

**Branch creation** (if user chose "新ブランチを作成して生成"):
Derive branch name as `loop/{{LOOP_NAME}}` and create it:
```bash
git checkout -b loop/{{LOOP_NAME}}
```

## Step 5: Generate VISION.md

**Ensure `.agent-loops/` is gitignored**:
```bash
grep -q '^\.agent-loops/' <repo-root>/.gitignore 2>/dev/null || echo '.agent-loops/' >> <repo-root>/.gitignore
```

**Create loop directory**:
```bash
mkdir -p <repo-root>/.agent-loops/{{LOOP_NAME}}/
```

**Check for existing VISION.md**:
```bash
ls <repo-root>/.agent-loops/{{LOOP_NAME}}/VISION.md 2>/dev/null
```
If it exists, use AskUserQuestion to confirm overwrite.

Write VISION.md to the loop directory using this format:

````markdown
# {{PROJECT_NAME}} - Vision

## Purpose
{{ONE_SENTENCE_PURPOSE}}

## Goals
- [ ] {{VERIFIABLE_GOAL_1}}
- [ ] {{VERIFIABLE_GOAL_2}}
- [ ] {{VERIFIABLE_GOAL_3}}
...

## Constraints
- {{CONSTRAINT_1}}
...

## Out of Scope
- {{EXCLUSION_1}}
...
````

Omit the `## Constraints` section if no constraints were defined.
Omit the `## Out of Scope` section if no exclusions were defined.

## Step 6: Vision Blueprint & Next Steps

After writing the file, emit a **Vision Blueprint** block in the conversation. This enables same-session handoff to `/soda-loop-setup`.

```
## Vision Blueprint

**Project**: {{PROJECT_NAME}}
**Loop Name**: {{LOOP_NAME}}

### Goals
- {{GOAL_1}}
- {{GOAL_2}}
...

### Constraints
- {{CONSTRAINT}}
...

### Out of Scope
- {{EXCLUSION}}
...
```

Then print next steps:

```
Vision defined:
- .agent-loops/{{LOOP_NAME}}/VISION.md — {{GOAL_COUNT}} verifiable goals

Next:
  /soda-loop-setup — Generate loop harness from this vision
```

## Constraints

- This skill only defines the vision. Do NOT generate PROGRESS.md, AGENT_PROMPT.md, or run-loop.ts.
- Do NOT propose phases or work items — that is `/soda-loop-setup`'s responsibility.
- The Vision Blueprint block format must be stable — `/soda-loop-setup` detects it by heading pattern.
