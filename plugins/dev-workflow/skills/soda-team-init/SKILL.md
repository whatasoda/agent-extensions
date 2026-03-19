---
name: soda-team-init
description: Initialize agent team project — classify requirements, decompose tasks, set up coordination files
user-invocable: true
argument-hint: "<requirements source or project description>"
allowed-tools: Bash(git *), Bash(bun *), Read, Write, Grep, Glob, Task, AskUserQuestion
---

**CRITICAL**: Do NOT use EnterPlanMode or enter plan mode at any point during this skill. This is an interactive dialogue skill — not an implementation task.

Initialize an agent team project by classifying requirements into groups, decomposing them into tasks, and generating the coordination files that soda-team-run consumes.

Use English for all generated file content. User interaction (AskUserQuestion options, presentations, summaries) must be in Japanese.

**Prerequisite**: A soda-discuss session should have been completed beforehand to establish design direction. The Discussion Summary provides the Architect's initial context.

If `$ARGUMENTS` is empty, ask the user to describe the requirements source before proceeding.

## Step 1: Project Setup

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```

**Check for existing `.agent-team/` projects**:

1. **Legacy flat layout detection**: If `.agent-team/CONFIG.md` exists directly (not inside a subdirectory), warn the user that the old flat format is detected and suggest manual cleanup before re-initializing. Stop.
2. **Scan for namespaced projects**: Check for existing projects by scanning `.agent-team/*/TASKS.md`.
3. If existing namespaced projects found, present the list and use AskUserQuestion:
   - "既存プロジェクトを上書きする (対象を選択)" — present project list for selection, then overwrite that project's directory
   - "新規プロジェクトとして作成" — proceed to branch strategy, create a new namespace
   - "キャンセル"
4. If no existing projects found, proceed to branch strategy.

**Branch Strategy**:

Determine the integration branch where all Worker results will be merged. This branch is NOT main — it serves as a staging area for the entire team project.

Use AskUserQuestion:
- "新しい統合ブランチを作成" — create a new branch from current HEAD
- "現在のブランチを統合ブランチとして使用 (`{{CURRENT_BRANCH}}`)"

If creating a new branch:
- Derive branch name as `team/{{project-name}}` (slugified from the project description)
- Present the suggested name for confirmation
- Create from current HEAD:
  ```bash
  git checkout -b {{BRANCH_NAME}}
  ```

Record the integration branch name — CONFIG.md will be written together with other coordination files in Step 6.

This branch name is used by soda-team-run for all merge operations.

**Derive namespace directory name**:
```
NAMESPACE = "<YYYYMMDD>-<project-name>"    # e.g., 20260320-auth-refactor
# Collision check
if .agent-team/NAMESPACE already exists:
  append -2, -3, etc. until unique
```
The `NAMESPACE` variable is used in Step 6 for all file generation paths.

## Step 2: Requirements Ingestion

Accept requirements from the user. Requirements can come from:

- **Inline text**: User provides a list directly in `$ARGUMENTS` or as a follow-up message
- **File reference**: User points to a file containing requirements (e.g., a gap analysis document, issue list)
- **Discussion Summary**: Extract direction and scope from a preceding soda-discuss session

Parse the input into a normalized list of individual requirements. Each requirement should be a single, actionable item.

Present the parsed list to the user:

> **要件一覧** ({{COUNT}}件)
> 1. {{requirement 1}}
> 2. {{requirement 2}}
> ...

Use AskUserQuestion:
- "この一覧で進める"
- "要件を追加・修正"
- "要件を再分割（粒度が粗い）"

Do NOT proceed until the user confirms the requirements list.

## Step 3: Investigation & Classification

Launch 1-2 sub-agents (Task, subagent_type: Explore) to investigate the codebase and classify requirements.

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Investigation goals**:
- Identify which files and areas each requirement affects
- Find existing patterns and conventions relevant to the requirements
- Detect natural groupings based on shared affected areas, dependencies, or functional domains

**Sub-agent output contract**: Every sub-agent prompt MUST end with:
> Return findings in this exact format:
> ### Affected Areas
> - requirement N — `path/to/affected/area`, `path/to/other/area`
> ### Proposed Groups
> - Group name — [requirement numbers] — rationale for grouping
> ### Dependencies
> - requirement N depends on requirement M — reason
> ### Patterns
> - pattern name — description of existing convention relevant to these requirements
> ### Open Questions
> - question — what remains unclear

After investigation, classify requirements into groups. Each group should:
- Share affected code areas or functional domain
- Be implementable as a coherent unit
- Contain 3-10 requirements (split or merge if outside this range)

**Identify design-critical groups**: A group is design-critical if:
- It involves architectural decisions not covered by the Discussion Summary
- It affects multiple functional domains or cross-cutting concerns
- Investigation revealed conflicting patterns or ambiguity in the existing codebase

Present the classification result:

> **グループ分類結果**
>
> **GROUP-A**: {{name}} ({{N}}件) {{🔶 設計判断が必要 if design-critical}}
> - {{requirement 1}}
> - {{requirement 2}}
> - 影響範囲: `src/foo/`, `src/bar/`
>
> **GROUP-B**: {{name}} ({{N}}件)
> - {{requirement 3}}
> - {{requirement 4}}
> - 影響範囲: `src/baz/`
>
> **グループ間依存**: GROUP-A → GROUP-B (AのAPI変更がBに影響)

Use AskUserQuestion:
- "この分類で進める"
- "グループを調整"
- "さらに調査を深める"（available at most once）

Do NOT proceed until the user confirms the classification.

## Step 4: Design-Critical Group Discussion

For each group marked as design-critical, conduct a focused discussion with the user. Process groups in dependency order.

For each design-critical group:

1. Present the group's requirements, affected areas, and the specific design question
2. Present options with evidence and recommendation (following soda-discuss Interaction Principles)
3. Use AskUserQuestion for the user's decision
4. Record the decision as an ADR draft (to be written to ARCHITECTURE.md in Step 6)

For groups that are NOT design-critical, briefly present the planned approach:

> **GROUP-B**: {{name}} — 自動分解方針
> - {{approach summary}}
> - 設計判断なし（既存パターン `src/existing/pattern.ts` に従う）

Use AskUserQuestion after presenting all non-critical groups:
- "この方針で自動分解に進む"
- "特定のグループについて議論したい"

## Step 5: Task Decomposition

Decompose each group into individual tasks. For each group, launch a sub-agent (Task, subagent_type: Explore) to investigate at task-level granularity.

**Sub-agent prompt** must include:
- The constraint block
- The group's requirements and affected areas
- Design decisions from Step 4 (if any)
- Existing patterns discovered in Step 3

**Sub-agent output contract**:
> Return findings in this exact format:
> ### Tasks
> - task title — description, affected files, acceptance criteria, validation command
> ### Task Dependencies
> - task A depends on task B — reason
> ### Risks
> - risk — mitigation

**Task granularity guideline**: Each task should be completable by a single Worker in one session. Signs a task is too large:
- Affects more than 5 files
- Has more than 3 acceptance criteria
- Requires changes in multiple functional domains

Signs a task is too small:
- Is a single-line change
- Cannot be validated independently

Present the decomposed tasks per group:

> **GROUP-A タスク分解** ({{N}}タスク)
>
> | # | タスク | 受入条件 | 依存 | 並列可 |
> |---|--------|----------|------|--------|
> | 1 | {{title}} | {{acceptance}} | なし | ✓ |
> | 2 | {{title}} | {{acceptance}} | #1 | - |
> | 3 | {{title}} | {{acceptance}} | なし | ✓ |
>
> **並列実行プラン**: #1 と #3 を並列 → #2

Present groups one at a time (following soda-discuss "one topic at a time" principle).

Use AskUserQuestion for each group:
- "このタスク分解で進める"
- "タスクを調整"

After all groups are confirmed, present a final overview:

> **全体サマリー**
> - グループ数: {{N}}
> - タスク総数: {{M}}
> - 並列実行可能: 最大{{P}}タスク同時
> - 設計判断: {{D}}件 (ARCHITECTURE.md に記録)
> - 推定実行順序: GROUP-A (#1,#3 並列) → GROUP-A #2 → GROUP-B (#1,#2 並列) → ...

Use AskUserQuestion:
- "ファイル生成に進む"
- "全体を調整"

## Step 6: Generate Coordination Files

### Codex Review (pre-generation)

Before writing files, compose the full content of TASKS.md and ARCHITECTURE.md, then delegate review:

1. Launch a codex review subagent:
   - Tool: `Task(subagent_type: dev-workflow:codex-review)`
   - Prompt:
     ```
     ## Codex Review Request
     - **Mode**: init
     - **Instruction**: "Review this agent team initialization. Focus on task completeness, dependency correctness, ADR quality, and TASK file self-containedness — only flag critical problems"

     ### Content
     [composed TASKS.md + ARCHITECTURE.md + sample TASK-NNN.md]
     ```
2. If **Revision Applied: Yes**: use `Revised Content`.
3. If **Status: Skipped** or failure: continue without review.

### File Generation

Initialize the namespaced directory:
```bash
mkdir -p .agent-team/{{NAMESPACE}}/tasks .agent-team/{{NAMESPACE}}/reviews
```

Write the following files (refer to `references/coordination-files.md` for format specification):

1. **`.agent-team/{{NAMESPACE}}/CONFIG.md`** — Integration branch name, base branch/commit, creation date (as determined in Step 1)
2. **`.agent-team/{{NAMESPACE}}/TASKS.md`** — Task list with group overview and all tasks in pending state
3. **`.agent-team/{{NAMESPACE}}/ARCHITECTURE.md`** — Initial ADRs from:
   - soda-discuss Discussion Summary (transcribed as ADRs)
   - Design decisions from Step 4 (design-critical group discussions)
4. **`.agent-team/{{NAMESPACE}}/tasks/TASK-NNN.md`** — One file per task, with:
   - Definition from Step 5 decomposition
   - Design Constraints summarized from relevant ADRs (not just references)
   - Context from investigation findings
   - Validation criteria

Task numbering: `TASK-001`, `TASK-002`, ... zero-padded to 3 digits. Order follows dependency topology within each group, groups ordered by inter-group dependencies.

### Gitignore Check

```bash
git check-ignore .agent-team/
```

If `.agent-team/` is NOT gitignored, warn the user and suggest adding it to their global gitignore.

## Step 7: Summary & Next Steps

Present the generated files:

> **Agent Team 初期化完了**
>
> ```
> .agent-team/
> └── {{NAMESPACE}}/
>     ├── CONFIG.md             — integration branch: {{BRANCH_NAME}}
>     ├── TASKS.md              — {{GROUP_COUNT}} groups, {{TASK_COUNT}} tasks
>     ├── ARCHITECTURE.md       — {{ADR_COUNT}} decisions
>     └── tasks/
>         ├── TASK-001.md
>         ├── TASK-002.md
>         └── ... ({{TASK_COUNT}} files)
> ```
>
> **実行順序**:
> {{GROUP-A}}: TASK-001, TASK-003 (並列) → TASK-002
> {{GROUP-B}}: TASK-004, TASK-005 (並列)
> GROUP-A → GROUP-B (依存)

Then print next steps:

```
Next:
  /soda-team-run  — Execute tasks with agent team
```

## Constraints

- This skill only initializes the coordination files. Do NOT execute any tasks.
- Do NOT create Worker agents or start implementation.
- The `.agent-team/` directory structure and file formats must conform to `references/coordination-files.md`.
- Every TASK-NNN.md must be self-contained — a Worker should need only that file to begin implementation.
- Design Constraints in TASK-NNN.md must include summarized ADR content, not just references to ARCHITECTURE.md.

## Sub-agent Usage

Every sub-agent prompt MUST begin with the constraint block:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

Every sub-agent prompt MUST end with the relevant output contract defined in the step where it is used.
