---
name: soda-team-run
description: Execute agent team tasks — orchestrate Workers, Reviewers, Architect, and Investigators
user-invocable: true
argument-hint: "[task ID, group name, or 'next']"
allowed-tools: Bash(git *), Bash(bun *), Read, Write, Edit, Grep, Glob, Task, AskUserQuestion
---

Execute agent team tasks by orchestrating specialized agents (Worker, Reviewer, Architect, Investigator). Each invocation runs one cycle of task execution.

Use English for all generated file content and sub-agent communication. User interaction (AskUserQuestion options, status updates, summaries) must be in Japanese.

If `$ARGUMENTS` is empty, default to selecting the next actionable tasks automatically.

## Cycle Definition

One cycle of `/soda-team-run` consists of:
1. Select actionable tasks
2. Execute tasks in parallel (Worker per task)
3. Review completed tasks (Reviewer per task)
4. Handle results (merge / re-implement / escalate)
5. Update coordination files
6. Report to user

The user triggers each cycle manually. There is no autonomous loop.

## Step 1: Load Project State

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```

Read `.agent-team/TASKS.md`, `.agent-team/ARCHITECTURE.md`, and `.agent-team/CONFIG.md`.

If `.agent-team/` does not exist or TASKS.md is missing, inform the user and suggest `/soda-team-init`. Stop.

Extract the **Integration Branch** from CONFIG.md. All merge operations target this branch. Verify it exists:
```bash
git rev-parse --verify {{INTEGRATION_BRANCH}}
```
If missing, inform the user and stop.

Parse TASKS.md to determine:
- Total task count and status distribution
- Which tasks are actionable (pending `[ ]` with all deps satisfied)
- Which tasks are in-progress `[~]` (may be stale from a previous interrupted cycle)
- Which tasks are blocked `[!]`

If in-progress tasks exist, use AskUserQuestion:
- "中断タスクを再開する" — treat `[~]` tasks as this cycle's targets
- "中断タスクをリセットして次を選ぶ" — reset `[~]` to `[ ]`, then select normally

## Step 2: Task Selection

### Automatic Selection (default)

Identify all actionable tasks — tasks with status `[ ]` whose dependencies are all `[x]`.

Group actionable tasks by parallelizability:
- Tasks with no mutual file conflicts → can run in parallel
- Tasks that modify overlapping files → must run sequentially

Present the proposed batch:

> **今回のサイクル** ({{N}}タスク並列実行)
>
> | タスク | グループ | 概要 | 依存 |
> |--------|----------|------|------|
> | TASK-001 | A | {{title}} | なし |
> | TASK-003 | A | {{title}} | なし |
>
> 順次実行待ち: TASK-002 (TASK-001 完了後)

Use AskUserQuestion:
- "このバッチで実行する"
- "タスクを選び直す"
- "特定のタスクだけ実行"

### Manual Selection

If `$ARGUMENTS` specifies a task ID (e.g., "TASK-005"), group name (e.g., "GROUP-A"), or the user chose "特定のタスクだけ実行":
- Task ID: execute that specific task (check deps are satisfied)
- Group name: select all actionable tasks in that group
- Present the selection for confirmation

Do NOT proceed until the user confirms the batch.

## Step 3: Worker Execution

For each task in the batch, launch a Worker sub-agent in parallel.

### Worktree Setup

For each Worker, create an isolated git worktree branching from the integration branch:
```bash
git worktree add .worktrees/{{TASK-ID}} -b task/{{TASK-ID}} {{INTEGRATION_BRANCH}}
```

### Worker Sub-agent

Launch via `Task(subagent_type: dev-workflow:team-worker)`. The agent definition handles constraints, tools, and output format.

**Dynamic prompt** — pass only these sections:

```
## Task
[contents of TASK-NNN.md]

## Commit Message
{{imperative mood description from task title}}

## Working Directory
{{worktree path}}
```

### Parallel Execution

Launch all Workers in the batch simultaneously using parallel `Task` calls. Each Worker operates on its own worktree — no file conflicts possible.

While Workers execute, report to the user:

> **実行中** ({{N}}タスク並列)
> - TASK-001: Worker 起動済み
> - TASK-003: Worker 起動済み

### Worker Result Handling

As each Worker completes:

- **DONE**: Proceed to Step 4 (Review)
- **BLOCKED**: Read BLOCKER.md from worktree. Orchestrator decides:
  - If this is the first block: reset the worktree, launch an Investigator sub-agent to analyze the blocker, then create a new Worker with additional context on the same worktree
  - If this is the second block for the same task: escalate to user (see Step 5)

**Worktree reset for retry**: When re-launching a Worker on the same task, reset the worktree to a clean state instead of creating a new one:
```bash
cd .worktrees/{{TASK-ID}}
git clean -fd
git reset --hard {{INTEGRATION_BRANCH}}
```
This maintains the disposable Worker principle (no stale state) while avoiding unnecessary disk usage from worktree recreation.

Update TASKS.md status to `[~]` when Worker starts, and track completion.

## Step 4: Review

For each completed Worker (status DONE), launch a Reviewer sub-agent via `Task(subagent_type: dev-workflow:team-reviewer)`. The agent definition handles constraints, tools, Trivial Fix Policy, Review Criteria, and output format.

**Dynamic prompt** — pass only these sections:

```
## Task Definition
[contents of TASK-NNN.md]

## Architecture Decisions
[contents of ARCHITECTURE.md — or relevant ADRs only if file is large]

## Working Directory
{{worktree path}}

## Changes to Review
[git diff of the Worker's worktree branch vs base]
```

### Review Result Handling

- **PASS**: Write REVIEW-NNN-A.md → proceed to merge (Step 5)
- **PASS_WITH_FIX**: Write REVIEW-NNN-A.md (including Trivial Fixes Applied) → proceed to merge (Step 5). The Reviewer has already committed the fix.
- **FAIL**: Write REVIEW-NNN-A.md → append findings to TASK-NNN.md History → reset worktree (`git clean -fd && git reset --hard`) → create new Worker on the same worktree (return to Step 3 for this task)
- **ESCALATE**: Write REVIEW-NNN-A.md → invoke Architect (Step 5). After Architect updates TASK-NNN.md Design Constraints, reset worktree (`git clean -fd && git reset --hard`) before re-entering Step 3.

Limit re-implementation attempts to 2 before user escalation. If a task fails review twice, mark as `[!]` and escalate to user. When the user explicitly chooses "追加調査して再試行" from User Escalation, the retry counter resets (the user has made an informed decision to continue).

## Step 5: Resolution

### Merge (PASS)

For each passed task, merge the Worker branch into the integration branch:

```bash
git checkout {{INTEGRATION_BRANCH}}
git merge task/{{TASK-ID}} --no-ff -m "{{task title}} (TASK-NNN)"
```

**Merge conflict handling**: If the merge fails due to conflicts:
- Abort the merge: `git merge --abort`
- Report the conflict to the user with the affected files
- Use AskUserQuestion:
  - "コンフリクトを手動で解決する" — user resolves, then resume
  - "このタスクを後回しにする" — mark `[!]`, proceed with other tasks
- Do NOT attempt automatic conflict resolution.

After successful merge, clean up:
```bash
git worktree remove .worktrees/{{TASK-ID}}
git branch -d task/{{TASK-ID}}
```

Update TASKS.md: `[~]` → `[x]` with merge commit SHA.

### Architect Escalation (ESCALATE)

When a Reviewer flags a design-level issue, the Orchestrator switches to **Architect role**. This is a deliberate context shift — while in Architect role, progress concerns are set aside and the focus is entirely on design correctness.

**Entering Architect role**:
1. Read ARCHITECTURE.md to load the full design decision history
2. Read the Reviewer's ESCALATE findings
3. Present the escalation to the user with the Reviewer's findings and relevant ADRs

**Architect dialogue with user**:
- Follow soda-discuss Interaction Principles (options with evidence and recommendation, one topic at a time)
- The user decides:
  - Resolve the design issue (user ↔ Architect dialogue)
  - Override and accept the implementation as-is
  - Defer the task (mark as `[!]`)

**Exiting Architect role**:
- If a design decision was made:
  - Write new/revised ADR to ARCHITECTURE.md
  - Update affected TASK-NNN.md files with revised Design Constraints (summarized, not just references)
  - The task re-enters Step 3 with updated constraints
- Resume Orchestrator role and continue the cycle

### User Escalation (BLOCKED)

When a task is blocked twice or a Worker fails twice:

Present the situation to the user:

> **エスカレーション**: TASK-NNN
> - 失敗回数: {{N}}
> - 直近の問題: {{summary from REVIEW or BLOCKER.md}}
> - 試行履歴: {{brief history}}

Use AskUserQuestion:
- "追加調査して再試行" — launch Investigator, update TASK-NNN.md context, retry
- "タスクを分割する" — see Task Splitting below
- "タスクをスキップ" — mark `[!]` with reason
- "手動で対応する" — mark `[!]`, user handles outside the team

### Task Splitting

When the user chooses to split a failed task:

1. **Analyze**: Read the failed TASK-NNN.md, BLOCKER.md (if any), and latest REVIEW-NNN-A.md (if any) to understand the failure
2. **Investigate**: Launch an Investigator sub-agent with the failure context to propose a split strategy
3. **Present**: Show the proposed sub-tasks to the user in table format (same as soda-team-init Step 5):
   > | # | タスク | 受入条件 | 依存 |
   > |---|--------|----------|------|
   > | 1 | {{title}} | {{acceptance}} | なし |
   > | 2 | {{title}} | {{acceptance}} | #1 |
4. **Confirm**: Use AskUserQuestion for user approval
5. **Generate**:
   - Mark original task as `[!]` in TASKS.md with note: `split → TASK-XXX, TASK-YYY`
   - Generate new TASK-XXX.md, TASK-YYY.md files:
     - Inherit Context and Design Constraints from the original task
     - Add failure insights to History: `- Split from TASK-NNN: "{{failure summary}}"`
   - Add new tasks to TASKS.md
   - New task numbers: `max(existing task numbers) + 1`, continuing zero-padded sequence
6. **Clean up**: Remove the original task's worktree (`git worktree remove`, `git branch -D`)
7. New tasks become actionable in the next cycle (or current cycle if user selects "次のサイクルを実行")

## Step 6: Cycle Report

After all tasks in the batch are resolved, present a cycle summary:

> **サイクル完了**
>
> | タスク | 結果 | 詳細 |
> |--------|------|------|
> | TASK-001 | ✅ マージ済み | {{commit SHA}} |
> | TASK-003 | ✅ マージ済み | {{commit SHA}} |
> | TASK-002 | ❌ ブロック | {{reason}} |
>
> **進捗**: {{done}}/{{total}} タスク完了 ({{percent}}%)
> **次に実行可能**: TASK-004, TASK-005

Use AskUserQuestion:
- "次のサイクルを実行" — return to Step 2
- "終了"

## Constraints

- Each invocation is one cycle. No autonomous looping.
- Workers MUST run on isolated git worktrees — never on the working tree.
- Workers MUST NOT use interactive tools (AskUserQuestion, EnterPlanMode).
- Reviewers MUST NOT make non-trivial modifications. Trivial fixes (1-2 lines, unambiguous) are permitted and must be recorded.
- Re-implementation is limited to 2 attempts per task before user escalation.
- TASKS.md is the single source of truth for task status. Update it after every state change.
- All coordination files must conform to `../soda-team-init/references/coordination-files.md`.
- Merge target is the integration branch recorded in `.agent-team/CONFIG.md`. Do NOT assume `main`.

## Sub-agent Usage

Every sub-agent prompt MUST begin with the appropriate constraint block (Worker constraints or Reviewer constraints as defined in Steps 3 and 4).

Sub-agent types:
- **Worker**: `Task(subagent_type: dev-workflow:team-worker)` — implementation agent, runs on isolated worktree. See `agents/team-worker.md` for constraints and output format.
- **Reviewer**: `Task(subagent_type: dev-workflow:team-reviewer)` — review agent with validation execution and trivial fix authority. See `agents/team-reviewer.md` for constraints, Trivial Fix Policy, Review Criteria, and output format.
- **Investigator**: `Task(subagent_type: Explore)` — codebase investigation
- **Architect**: Role switch within main context (not a sub-agent). Orchestrator loads ARCHITECTURE.md and enters design-focused dialogue with user via AskUserQuestion. See "Architect Escalation" in Step 5.
