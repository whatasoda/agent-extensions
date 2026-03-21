---
name: soda-plan
description: Plan implementation with sub-agents and design review
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Bash(codex *), Bash(bun *), Read, Write, Grep, Glob, Task, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

Create a detailed implementation plan for the given task.

Use English for internal reasoning (thinking). Plan content (written to plan mode file) must be in English — use structured data, code snippets, and technical English for maximum AI interpretability and compaction resilience. User interaction (AskUserQuestion options, confirmation messages, investigation summaries presented before plan mode) must be in Japanese.

If $ARGUMENTS is empty, ask the user what they want to implement before proceeding.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - **Living Discussion Document check**: Before launching sub-agents, check for `.agent-discussions/*.md` files using Glob.
     - If file(s) found:
       - Present the found file(s) and ask the user which document applies to this task (always confirm, even if only one file — it may be stale or unrelated)
       - Extract all DD-N entries as **mandatory constraints** — every DD-N must be traceable to a plan step
       - Extract RA-N entries as **exclusion constraints** — approaches listed as rejected must not be re-proposed
     - If no files found: proceed normally (conversation-context-based input)
   - **Sub-agent output contract**: Every sub-agent prompt MUST end with the following output format requirement:
       > Return findings in this exact format:
       > ### Files
       > - `path/to/file` — relevance to the task
       > ### Patterns
       > - pattern name — description of the convention or pattern found
       > ### Dependencies
       > - dependency — how it affects the task
       > ### Open Questions
       > - question — what remains unclear from this investigation alone
     - Launch a sub-agent (Task, subagent_type: Explore) to survey project structure, dependencies, and conventions relevant to the task.
     - Summarize the agent's findings into a Common Context block.
     - Based on findings, optionally launch 1-2 focused sub-agents in parallel. Each prompt must include the Common Context block (summarized, not raw output), the specific investigation question, and both the constraint block and output contract.
   - **Sub-agent prompt constraints**: Every sub-agent prompt (both survey and focused) MUST begin with the following constraint block:
     > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "方針を調整して続行" / "ここで中断して方針を整理". Do not choose an approach autonomously.
2. **Branch Strategy**: Use AskUserQuestion to determine branch strategy before planning:
   - "新ブランチ作成"
   - "現ブランチ続行"

   If the user chooses a new branch, derive the branch name from the task description.
   Do NOT proceed to Step 3 until the user confirms branch strategy.
3. **Plan**:

   **Technical Pre-Gathering (M/L tasks only)**: After task scale classification, if the task is scale M or L, pre-gather technical details before entering plan mode:
   - Identify rough step areas from investigation findings (affected areas, key files, functional groupings)
   - For each area (up to 3), launch a sub-agent (Task, subagent_type: Explore, model: sonnet) in parallel with the Step Detail Template below
   - Sub-agent prompts must include the constraint block, the specific area to investigate, and the Step Detail Template
   - Use gathered details to write the plan with concrete technical context (type signatures, API contracts, test patterns) rather than re-investigating during plan writing

   **Step Detail Template**: When pre-gathering technical details for M/L tasks, each sub-agent prompt MUST end with the following output format:
   > Return findings in this exact format:
   > ### File State
   > - `path/to/file` — current exports, key functions, line count
   > ### Type Signatures
   > - `TypeName` — definition (from source)
   > ### API Contracts
   > - endpoint/function — signature and behavior
   > ### Test Patterns
   > - test file — existing test patterns, coverage gaps
   > ### Validation Approaches
   > - (how to verify changes in this area)

   Compose the plan content as markdown text (do not enter plan mode yet). Include the following elements. Do not follow a fixed template — organize and format them as best fits the task. Follow the Compact-Resilience Guidelines below when authoring plan content. After composition, proceed to the Codex Review sub-section before entering plan mode.

   **Required elements:**
   - **Task summary and branch name**
   - **Investigation summary** — key findings, affected areas, relevant patterns discovered
   - **Steps** — each step must include:
     - Progress marker: `- [ ]` prefix (updated to `- [x]` during implementation as each step completes)
     - Commit message (imperative mood)
     - File changes with full paths and rationale (`path/to/file` — what and why)
     - Validation criteria — how to verify this step is correct (test command, expected behavior, manual check)
     - Dependencies on prior steps and what this step produces for later steps (do not rely on ordering alone)
   - **Risks and mitigation** — at least one risk with a concrete mitigation strategy

   **Conditional elements** (include when applicable):
   - **Technical context per step** — type signatures, API contracts, data shapes, algorithms
   - **Design rationale** — for non-obvious decisions, state "why" explicitly as a labeled callout, not embedded in prose
   - **Cross-step shared context** — types, constants, or contracts used by multiple steps. Define once and reference by name in each step.
   - **Subagent utilization plan** (include for scale M and L) — for each step, indicate whether it should be executed in a subagent or in the main context. See Subagent Criteria below for the decision rules.
   - **Transition note** (include for scale L only) — note that execution transitions to `/soda-team-init` → `/soda-team-run`. The plan serves as input context for task decomposition. See Execution Phase for details.
   - **Design decisions** (include when the plan involves architecture, external contracts, or user-facing behavior choices) — present each decision as a labeled callout in the plan body:
     > **Design Decision: [topic]**
     > Option A: ... — [trade-off]
     > Option B: ... — [trade-off]
     > Recommended: [option] — [rationale]

     Design decisions are discussed individually during the Plan Discussion Phase before ExitPlanMode. If a decision significantly changes the plan structure, note this dependency explicitly.

     Examples of decisions that require callouts:
     - Architecture patterns (e.g., monolith vs microservice, event-driven vs request-response)
     - Library or framework selection
     - Data model design (schema, relationships)
     - API contract design (endpoints, request/response shapes)
     - State management approach
     - Authentication/authorization strategy

     Examples that do NOT require callouts (implementation details):
     - Variable/function naming
     - Internal helper structure
     - Iteration order
     - File organization within an already-decided architecture
   - **Ambiguities** — if there are ambiguous requirements or missing information, note them as labeled callouts in the plan body rather than asking separately.

### Codex Review (pre-plan-mode)

Delegate codex review to a subagent in findings-only mode. The subagent reports issues but does NOT revise the content — the plan author incorporates findings to preserve original intent.

1. Resolve session JSONL path (for context-aware review):
   Use Glob to discover the installed version: pattern `~/.claude/plugins/cache/whatasoda-tools/dev-workflow/*`, pick the latest version directory.
   Then run via Bash: `bun <Script base>/<version>/scripts/resolve-session.ts`
   Capture stdout as session path. If empty, proceed without session context.

2. Launch a codex review subagent:
   - Tool: `Task(subagent_type: dev-workflow:codex-review)`
   - Prompt: Include the review request with composed content.
   - Review request:
     ```
     ## Codex Review Request
     - **Mode**: findings
     - **Instruction**: "Review this plan. Skip trivial issues — only flag critical problems"
     - **Session Path**: <resolved session path from step 1, or omit if empty>

     ### Content
     [composed plan content]
     ```
3. Use the subagent's response:
   - If **critical issues found**: read the `Issues` section and revise the plan in the main context to address them, preserving the original intent and voice.
   - If **no critical issues**, **Status: Skipped**, or subagent failure: continue without changes.

After the codex review completes, use the EnterPlanMode tool to enter plan mode. Write the reviewed plan content to the plan file. Proceed with the Plan Discussion Phase below, then exit plan mode via ExitPlanMode.

## Plan Discussion Phase

After writing the plan, extract **discussion items** — areas that benefit from interactive confirmation before implementation. Discussion items fall into two categories:

- **Review points**: Steps where user domain knowledge would improve plan quality (business logic, unverified assumptions, context-dependent risks)
- **Design decisions**: Choices presented as `**Design Decision: [topic]**` callouts in the plan

### Procedure

1. **Extract and present**: List all discussion items with their category and dependency relationships:

   > **議論アイテム**: 以下の項目を順に確認します：
   > 1. [category] Step N: {{description}}
   > 2. [category] Step M: {{description}}
   >
   > 依存関係: Item 1 の結論が Item 2 の選択肢に影響します。

   The user may reorder items or mark some as skip.

2. **Discuss one at a time**: Present each item individually, following soda-discuss Interaction Principles (referenced from `/soda-discuss` SKILL.md — not duplicated here):

   - **提示して委ねる**: Present context/options as text output, let the user respond freely
   - **一度に一つ、承認を待つ**: Wait for the user's response before moving to the next item
   - **選択肢には根拠と推奨を添える**: For design decisions, include tradeoffs and a recommendation
   - **データが先、判断が後**: Present investigation data before asking for a decision
   - **判断の保留は深掘りのシグナル**: If the user defers, provide deeper analysis before re-presenting

   For each item type:
   - **Review point**: Present the relevant plan section and what is uncertain → wait for domain knowledge
   - **Design decision**: Present options, tradeoffs, and recommendation → wait for direction

3. **Reflect conclusions**: After each item is resolved, immediately update the plan:
   - Review point conclusions: mark as `**User Context**: {{correction or additional information}}`
   - Design decision conclusions: update the callout to show the confirmed option

   These labeled callouts ensure domain knowledge and decisions survive context compaction.

4. **Handle emergent items**: If discussion reveals new items, add them to the list at the appropriate position based on dependency relationships.

5. **Complete**: When all items are resolved (or the user signals readiness), proceed to ExitPlanMode.

If no discussion items are identified, skip this phase and proceed directly to ExitPlanMode.

## Execution Phase

After plan approval (ExitPlanMode), execution routing depends on the task scale classification.

### Scale S — Main Context

Execute all steps in the main context sequentially. No worktree isolation or review cycle.

### Scale M — Worker → Reviewer Core Loop

Subagent-eligible steps are executed via `team-worker` → `team-reviewer` cycle on isolated worktrees. Main-context steps execute in the main context as before.

**For each subagent-eligible step:**

1. **Create worktree**:
   ```bash
   git worktree add .worktrees/step-{{N}} -b plan/step-{{N}} HEAD
   ```

2. **Launch Worker** via `Task(subagent_type: dev-workflow:team-worker)` with prompt:
   ```
   ## Task
   ### Definition
   {{step description and file changes from plan}}
   ### Design Constraints
   {{design decisions and constraints from plan, if any}}
   ### Context
   {{investigation summary and cross-step shared context from plan}}
   ### Validation
   {{validation criteria from plan step}}

   ## Commit Message
   {{commit message from plan step}}

   ## Working Directory
   {{worktree absolute path}}
   ```

3. **On Worker DONE** → launch Reviewer via `Task(subagent_type: dev-workflow:team-reviewer)`:
   ```
   ## Task Definition
   {{same task sections as Worker input (Definition, Design Constraints, Context, Validation)}}
   ## Working Directory
   {{worktree path}}
   ## Changes to Review
   {{git diff of worktree branch vs base}}
   ```

   > **Why no `## Architecture Decisions`**: soda-plan context does not maintain ARCHITECTURE.md. Reviewer evaluates against the step's own Design Constraints and Validation criteria instead.

4. **Handle verdict**:
   - **PASS / PASS_WITH_FIX** → merge worktree branch to current branch, clean up:
     ```bash
     git checkout {{current_branch}}
     git merge --squash plan/step-{{N}}
     git commit -m "{{commit message}} (plan/step-{{N}})"
     git worktree remove .worktrees/step-{{N}}
     git branch -d plan/step-{{N}}
     ```
     **Merge conflict handling**: If merge fails due to conflicts:
     ```bash
     git merge --abort
     ```
     Report conflicting files to user via AskUserQuestion with options:
     - "コンフリクトを手動で解決する" → user resolves, then resume
     - "このステップをスキップ" → clean up worktree and branch:
       ```bash
       git worktree remove .worktrees/step-{{N}}
       git branch -D plan/step-{{N}}
       ```
   - **FAIL** → append Reviewer's "For Next Worker" findings to the step's Context section, reset worktree to the base commit, retry Worker once:
     ```bash
     cd .worktrees/step-{{N}}
     git clean -fd
     git reset --hard {{current_branch}}
     ```
     > **Why `{{current_branch}}` not `~1`**: Worker may create multiple commits. Resetting to the branch the worktree was created from guarantees a clean slate, matching soda-team-run's pattern.

     If second attempt also FAILs → report to user via AskUserQuestion with Reviewer findings and options:
     - "実装を受け入れる" → merge worktree branch as-is (same as PASS flow)
     - "このステップをスキップ" → clean up worktree and branch, skip this step:
       ```bash
       git worktree remove .worktrees/step-{{N}}
       git branch -D plan/step-{{N}}
       ```
   - **ESCALATE** → report to user via AskUserQuestion with escalation details and options:
     - "実装を受け入れる" → merge worktree branch as-is (same as PASS flow)
     - "このステップをスキップ" → clean up worktree and branch, skip this step:
       ```bash
       git worktree remove .worktrees/step-{{N}}
       git branch -D plan/step-{{N}}
       ```

5. **On Worker BLOCKED** → read BLOCKER.md from worktree root, report to user via AskUserQuestion.

**Sequencing**: Subagent-eligible steps with no mutual dependencies may run in parallel (separate worktrees). Steps with dependencies execute sequentially — wait for the dependency to merge before creating the next worktree.

### Scale L — Transition to /soda-team-init

Scale L tasks are too large for soda-plan's inline execution. After plan approval, present transition guidance:

> このタスクは規模が大きいため、`/soda-team-init` でタスク分解し `/soda-team-run` で実行することを推奨します。
> プランの内容を `/soda-team-init` の入力コンテキストとして活用できます。

Do NOT execute implementation inline. The approved plan serves as input context for `/soda-team-init`.

## Constraints

- Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in Step 2 (Branch Strategy). If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.
- Design decisions must be presented as labeled callouts in the plan body. Each decision is discussed individually during the Plan Discussion Phase before ExitPlanMode.
- During implementation, update the plan's step markers from `- [ ]` to `- [x]` as each step's commit is completed. This provides at-a-glance progress visibility.
- If a Living Discussion Document is loaded, all Design Decisions (DD-N) must be reflected in plan steps. Each step that implements a DD-N must reference it explicitly (e.g., "Implements DD-3"). Rejected Alternatives (RA-N) must not be re-proposed as approaches.

## Compact-Resilience Guidelines

Plans must survive context compaction. Follow these rules when authoring plan content:

- **Explicit dependency chains**: State what each step depends on and produces. Do not rely on step ordering alone — ordering is lost during compaction.
- **Code over prose**: Prefer code snippets and structured data (`interface Foo { bar: string }`) over prose descriptions ("Foo has a bar field of type string"). Code survives intact; prose gets summarized away.
- **Labeled callouts**: State design rationale as "Why: ..." callouts, not embedded in paragraphs. Labeled callouts are retained as structure; prose rationale is dropped.

## Subagent Criteria

When executing the approved plan, use subagents (Task tool) for steps that meet ALL of the following:

1. **Self-contained** — The step does not need to read results from a prior step's execution at runtime. All inputs are defined in the plan (file paths, type signatures, expected behavior).
2. **No cross-step file conflicts** — The step does not modify files that a concurrent step also modifies.
3. **Verifiable in isolation** — The step has validation criteria that can be checked without running the full application or depending on other steps' output.

Use the main context for steps that:
- Depend on runtime output from a prior step (e.g., "adjust based on test results from Step 2")
- Modify shared files (e.g., a central config, shared type file) that other steps also touch
- Require iterative adjustment based on integration feedback
- Are the final integration or verification step

When the plan includes a subagent utilization plan, annotate each step with one of:
- **Subagent-eligible** — meets all three criteria above
- **Main-context** — state which criterion is not met

## Task Scale Classification

Immediately after investigation (Step 1) completes, classify the task scale based on investigation results. The classification determines which conditional elements to include and how execution is routed.

**Classification criteria** (use the first matching category):

- **S (Small)** — 1-3 steps, no cross-step dependencies beyond sequential ordering
  - Subagent utilization plan: omit (no benefit from subagent overhead)
  - Execution method: main context (see Execution Phase)
- **M (Medium)** — 4-6 steps, fewer than 2 independent subtrees in the dependency graph
  - Subagent utilization plan: include (per-step annotation as before)
  - Execution method: Worker → Reviewer core loop for subagent-eligible steps (see Execution Phase)
- **L (Large)** — 7+ steps, OR 4+ steps with 2+ independent subtrees in the dependency graph
  - Subagent utilization plan: include (per-step annotation)
  - Execution method: transition to `/soda-team-init` → `/soda-team-run` (see Execution Phase)

State the classification at the top of the plan body: `**Task Scale: [S|M|L]**`
