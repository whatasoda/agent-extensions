---
name: soda-loop-vision
description: Define structured vision with verifiable goals for autonomous loop projects
user-invocable: true
argument-hint: [project goal description]
allowed-tools: Bash(git *), Bash(bun *), Bash(codex *), Read, Grep, Glob, Write, Task, AskUserQuestion
---

**CRITICAL**: Do NOT use EnterPlanMode or enter plan mode at any point during this skill. This is an interactive dialogue skill — not an implementation task. Proceed directly through the steps below without planning.

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
   - "コードベースを調査して裏付けを取る"
   - "参考実装を指定する"
   - "既存プランをインポートする"
   - "十分理解できた（ゴール分解に進む）"
   - "自分から補足情報を追加したい"
4. If "さらに深掘りしたい" is selected: ask the next round of questions (informed by previous answers). Repeat from step 1.
5. If "コードベースを調査して裏付けを取る" is selected: read and follow the Codebase Investigation procedure in `references/sub-procedures.md`, then return to step 2 (re-present checkpoint with updated context).
6. If "参考実装を指定する" is selected: read and follow the Reference Implementation procedure in `references/sub-procedures.md`, then return to step 2 (re-present checkpoint with updated context).
7. If "既存プランをインポートする" is selected: read and follow the Plan Import procedure in `references/sub-procedures.md`, then return to step 2 (re-present checkpoint with updated context).
8. If "自分から補足情報を追加したい" is selected: accept the user's free-text input, then return to step 2.
9. If "十分理解できた" is selected: proceed to Step 3.

If after the first round of questions no further ambiguities remain, proceed directly to Step 3 without presenting the checkpoint — **unless** a plan file path is detected in the conversation context (from a recent `soda-plan` session) or `$ARGUMENTS` contains a plan file path. In that case, always present the checkpoint to give the user the opportunity to import the plan. Do NOT ask unnecessary checkpoint questions.

Carry forward any constraints or exclusions that emerged during this dialogue — they will be pre-populated in Step 4.

Also retain the following context from the dialogue for use in Step 6:
- **Problem background**: The problem statement, current situation, and motivation that emerged
- **Technical landscape**: Technologies, architecture details, file paths, APIs, and environmental details discussed
- **Key decisions**: Important choices resolved during discovery — what was chosen, what was rejected, and why
- **Investigation findings**: Codebase patterns, file paths, and constraints discovered through sub-agent investigation (if performed)
- **Reference implementation**: Structure and patterns from the reference code analyzed (if specified)
- **Plan import**: Purpose seed, background/technical context seeds, key decision seeds, goal seeds, and constraints seeds extracted from an imported plan file (if imported)

## Step 3: Goal Elicitation

If Plan Import was performed in Step 2 and goal seeds are available, use them as the initial draft goal list instead of decomposing from scratch. Present them with clear labeling:

> 以下はプランのステップから変換したゴール候補です。必要に応じて調整してください。

Each goal seed has already been transformed from an implementation step to a verifiable outcome during Plan Import. Review each seed for:
- Is the goal statement outcome-oriented (not action-oriented)?
- Is the Acceptance condition concrete and verifiable?
- Does the goal capture the intent, not just the mechanism?

Refine any goals that are still too implementation-focused before presenting to the user. Then proceed to the existing goal presentation and refinement flow below.

If no goal seeds are available (no Plan Import, or extraction failed), proceed normally:

Using the enriched understanding from Requirements Discovery, decompose the project into 3-10 verifiable goals. If no $ARGUMENTS was provided, use the understanding built through the discovery dialogue. Each goal must be:
- **Concrete**: Describes a specific outcome, not a vague aspiration
- **Verifiable**: Has a clear pass/fail condition expressed in the Acceptance sub-field
- **Independent**: Can be evaluated without reference to other goals (though implementation may have dependencies)

Each goal uses this format:
- [ ] {{GOAL_STATEMENT}}
  - Acceptance: {{PASS_FAIL_CONDITION}} (e.g., "`bun test` exits 0", "file `src/config.ts` exports a `Config` type")
  - Context: {{RELEVANT_FILE_PATHS_OR_APIS}} (optional — omit if goal is self-contained)

The Acceptance field must be a concrete, machine- or human-verifiable condition — not a restatement of the goal.

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
   - **Acceptance criteria**: What exactly constitutes pass/fail? Is the current verification condition sufficient? During deep-dive, ensure the Acceptance sub-field is concrete and testable.
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

### Codex Review (pre-draft-review)

Delegate codex review to a subagent to keep the full codex output out of the main context.

1. Launch a codex review subagent:
   - Tool: `Task(subagent_type: Explore, model: haiku)`
   - Prompt must include: the constraint block ("You are a codex-review agent. Run the review command below, parse the output, and return findings in the specified format. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive tools."), the Bash command with composed content via heredoc, and the Codex Review Output Contract — Init.
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts init "Review this vision definition. Focus on goal verifiability, constraint validity, and scope clarity — only flag critical problems" <<'CODEX_REVIEW_EOF'
     [composed VISION.md content]
     CODEX_REVIEW_EOF
     ```
   - **Codex Review Output Contract — Init**:
     ```
     Return findings in this exact format:
     ### Review Result
     - **review_file**: (path from script output line `review_file:`)
     - **session_id**: (value from script output line `session_id:`, or "none")
     - **Status**: No critical issues | Critical issues found | Skipped
     ### Critical Issues
     - (issue description — or "none")
     ```
   - Capture `review_file`, `session_id`, and critical issues from the subagent's response.
2. If the subagent reports critical issues, revise the VISION.md content before presenting in Step 5.
3. If the user requests goal/constraint adjustments in Step 5 and the content is revised, launch another subagent with the resume command:
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts resume CODEX_SESSION REVIEW_FILE "Vision updated — review again. Only flag critical problems" <<'CODEX_REVIEW_EOF'
     [revised VISION.md content]
     CODEX_REVIEW_EOF
     ```
   - **Codex Review Output Contract — Resume**:
     ```
     Return findings in this exact format:
     ### Review Result
     - **Status**: No critical issues | Critical issues found | Skipped
     ### Critical Issues
     - (issue description — or "none")
     ```
4. If the subagent reports skip or failure, continue without review.

## Step 5: Draft Review

Present the complete VISION.md draft:

```
Project: {{PROJECT_NAME}}
Loop: .agent-loops/{{LOOP_NAME}}/
Background: {{PARAGRAPH_COUNT}} paragraphs
Technical Context: {{DETAIL_COUNT}} items
Key Decisions: {{DECISION_COUNT}} decisions
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

## Background
{{BACKGROUND_PARAGRAPH_1}}

{{BACKGROUND_PARAGRAPH_2}}

{{BACKGROUND_PARAGRAPH_3_IF_NEEDED}}

## Technical Context
- {{TECHNOLOGY_OR_ARCHITECTURE_DETAIL_1}}
- {{TECHNOLOGY_OR_ARCHITECTURE_DETAIL_2}}
- {{FILE_PATH_OR_API_DETAIL}}
...

## Key Decisions
- {{DECISION_1}}: {{CHOSEN_OPTION}} (not {{REJECTED_OPTION}} — {{RATIONALE}})
- {{DECISION_2}}: {{CHOSEN_OPTION}} (not {{REJECTED_OPTION}} — {{RATIONALE}})
...

## Goals
- [ ] {{VERIFIABLE_GOAL_1}}
  - Acceptance: {{PASS_FAIL_CONDITION_1}}
  - Context: {{FILE_PATHS_1}}
- [ ] {{VERIFIABLE_GOAL_2}}
  - Acceptance: {{PASS_FAIL_CONDITION_2}}
- [ ] {{VERIFIABLE_GOAL_3}}
  - Acceptance: {{PASS_FAIL_CONDITION_3}}
...
Omit the `Context:` sub-field if the goal is self-contained.

## Constraints
- {{CONSTRAINT_1}}
...

## Out of Scope
- {{EXCLUSION_1}}
...
````

Omit the `## Background` section if the project context is straightforward and no meaningful background emerged during discovery (e.g., a simple one-goal project initiated without discovery dialogue).
Omit the `## Technical Context` section if no specific technologies, file paths, or APIs were discussed.
Omit the `## Key Decisions` section if no ambiguities were resolved and no alternatives were considered during discovery.
Omit the `## Constraints` section if no constraints were defined.
Omit the `## Out of Scope` section if no exclusions were defined.

**Background** guidelines:
- 2-3 paragraphs of prose (not bullet points)
- Paragraph 1: Problem statement — what is wrong or missing in the current state
- Paragraph 2: Motivation — why this matters now, who is affected
- Paragraph 3 (optional): Broader context — how this fits into larger goals or recent changes

**Technical Context** guidelines:
- Bullet list of concrete technical details
- Include: relevant technologies/frameworks, existing architecture patterns, important file paths, APIs or interfaces involved, environment or platform constraints
- Each item should be factual and specific (e.g., "`src/auth/` handles OAuth2 flows using passport.js" not "uses authentication")

**Key Decisions** guidelines:
- Each entry follows the format: "{{TOPIC}}: {{CHOSEN}} (not {{REJECTED}} — {{REASON}})"
- Only include decisions that were actively resolved during requirements discovery — do not fabricate decisions that were never discussed
- Include decisions about scope, approach, technology choice, or priority that affect how goals should be interpreted

## Step 7: Vision Blueprint & Next Steps

After writing the file, emit a **Vision Blueprint** block in the conversation. This enables same-session handoff to `/soda-loop-setup`.

```
## Vision Blueprint

**Project**: {{PROJECT_NAME}}
**Loop Name**: {{LOOP_NAME}}

### Background
{{BACKGROUND_SUMMARY_1_2_SENTENCES}}

### Technical Context
- {{DETAIL_1}}
- {{DETAIL_2}}
...

### Key Decisions
- {{DECISION_1}}
- {{DECISION_2}}
...

### Goals
- {{GOAL_1}}
  - Acceptance: {{CONDITION_1}}
- {{GOAL_2}}
  - Acceptance: {{CONDITION_2}}
...

### Constraints
- {{CONSTRAINT}}
...

### Out of Scope
- {{EXCLUSION}}
...
```

The same omission rules apply to the Vision Blueprint: omit `### Background`, `### Technical Context`, or `### Key Decisions` if the corresponding VISION.md section was omitted.

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
