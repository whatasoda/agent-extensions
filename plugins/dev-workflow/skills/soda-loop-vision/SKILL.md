---
name: soda-loop-vision
description: Define structured vision with verifiable goals for autonomous loop projects
user-invocable: true
argument-hint: [project goal description]
allowed-tools: Bash(git *), Bash(bun *), Read, Grep, Glob, Write, AskUserQuestion
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

## Step 2: Requirements Discovery

Analyze the user's project description (from $ARGUMENTS or free-text input) to identify gaps, ambiguities, and implicit assumptions before decomposing into goals.

**Analysis categories** (use as guidance, not a rigid checklist — select the most relevant categories per round):
- **Motivation & context**: What problem is being solved? Who is affected? Why now?
- **Scope boundaries**: What is included vs excluded? Where does this project end?
- **Ambiguity resolution**: Terms or phrases that could be interpreted multiple ways
- **Technical context**: Technologies, environments, APIs, compatibility requirements
- **Success criteria**: How the user will judge completeness
- **Implicit assumptions**: Prerequisites or conditions taken for granted

**Iterative dialogue**:
1. Ask 2-4 targeted clarifying questions (prioritized by impact on goal clarity). Present these as natural-language questions — free-text answers are needed, so do NOT use AskUserQuestion for the questions themselves.
2. After receiving answers, assess whether new ambiguities or gaps have surfaced.
3. Use AskUserQuestion to offer a checkpoint:
   - "さらに深掘りしたい（追加の質問がある）"
   - "十分理解できた（ゴール分解に進む）"
   - "自分から補足情報を追加したい"
4. If "さらに深掘りしたい" is selected: ask the next round of questions (informed by previous answers). Repeat from step 1.
5. If "自分から補足情報を追加したい" is selected: accept the user's free-text input, then return to step 2.
6. If "十分理解できた" is selected: proceed to Step 3.

If after the first round of questions no further ambiguities remain, proceed directly to Step 3 without presenting the checkpoint. Do NOT ask unnecessary checkpoint questions.

Carry forward any constraints or exclusions that emerged during this dialogue — they will be pre-populated in Step 4.

## Step 3: Goal Elicitation

Using the enriched understanding from Requirements Discovery, decompose the project into 3-10 verifiable goals. If no $ARGUMENTS was provided, use the understanding built through the discovery dialogue. Each goal must be:
- **Concrete**: Describes a specific outcome, not a vague aspiration
- **Verifiable**: Has a clear pass/fail condition (e.g., "X command exits 0", "file Y exists with Z content", "API endpoint returns 200")
- **Independent**: Can be evaluated without reference to other goals (though implementation may have dependencies)

Present the draft goal list to the user. Use AskUserQuestion:
- "このゴールリストで進める"
- "ゴールを追加"
- "ゴールを削除・修正"
- "ゴールが細かすぎる（統合して）"
- "ゴールが曖昧すぎる（具体化して）"
- "個別ゴールを深掘り"

If the user requests changes (add / remove / granular / vague), incorporate feedback and re-present. Do NOT proceed until the user confirms the goal list.

### Goal Deep-Dive

If the user selects "個別ゴールを深掘り":

1. Present the numbered goal list. Use AskUserQuestion to ask which goal to examine — list each goal by number as a separate option, plus "全ゴールを順に確認".
2. For the selected goal, ask probing questions about:
   - **Acceptance criteria**: What exactly constitutes pass/fail? Is the current verification condition sufficient?
   - **Edge cases**: What boundary conditions or error scenarios should the goal account for?
   - **Technical details**: Are there specific implementation constraints or approaches the goal should reflect?
3. Refine the goal wording and its verifiability condition based on answers. Present the updated goal to the user for confirmation.
4. After completing the deep-dive, return to the main goal list presentation with all options (including deep-dive again).

The user may deep-dive multiple goals across multiple rounds. Each round returns to the main goal list.

## Step 4: Constraints & Scope

If constraints or exclusions were identified during Requirements Discovery (Step 2), present them first:

> ヒアリングで以下の制約・除外事項が確認されました：
> - {{DISCOVERED_ITEM_1}}
> - {{DISCOVERED_ITEM_2}}

Then use AskUserQuestion:
- "これで十分（追加なし）" — skip to Step 5
- "技術的な制約を追加"
- "スコープ外の項目を追加"
- "制約と除外の両方を追加"

If no constraints emerged during discovery, use AskUserQuestion:
- "制約は不要" — skip to Step 5
- "技術的な制約を追加" — e.g., specific technologies, conventions, file boundaries
- "スコープ外の項目を追加" — explicitly exclude work areas
- "制約と除外の両方を追加"

If the user selects any option other than skip, ask follow-up questions to collect the details. Present the collected constraints/exclusions for confirmation before proceeding.

## Step 5: Draft Review

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

## Step 6: Generate VISION.md

**Initialize loop directory and check for existing files**:
```bash
bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-setup/scripts/setup-loop-dir.ts <repo-root> {{LOOP_NAME}} --check VISION.md
```
This creates `.agent-loops/{{LOOP_NAME}}/` directory and checks gitignore status. Parse the JSON output:
- If `gitignored` is `false`, warn the user that `.agent-loops/` is not gitignored and suggest adding it to their global gitignore (`git config --global core.excludesFile` → add `.agent-loops/` entry).
- If `existing` contains `VISION.md`, use AskUserQuestion to confirm overwrite.

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

## Step 7: Vision Blueprint & Next Steps

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
