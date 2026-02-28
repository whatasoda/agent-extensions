---
name: soda-plan
description: Plan implementation with sub-agents and design review
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Bash(codex *), Bash(bun *), Read, Write, Grep, Glob, Task, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

Create a detailed implementation plan for the given task.

Use English for internal reasoning (thinking). Plan content (written to plan mode file) must be in English — use structured data, code snippets, and technical English for maximum AI interpretability and compaction resilience. User interaction (AskUserQuestion options, confirmation messages, investigation summaries presented before plan mode) must be in Japanese.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose`).

- **If found**: Use it as the starting context.
  - **Investigate**: Extract key findings and affected areas. Delegate verification to a sub-agent (Task, subagent_type: Explore, model: haiku) with the constraint block and the Verification output contract (both defined in Procedure Step 1). The sub-agent receives the Proposal Summary's Key Findings and Affected Areas and checks whether referenced files still exist and patterns haven't changed significantly. If the sub-agent reports discrepancies, investigate the gaps using focused sub-agents. Skip further investigation if no discrepancies are found.
  - **Plan**: Incorporate Expected Impact (gains, losses, UX changes) and Risks into the plan's risk assessment. Use Affected Areas as the starting point for step breakdown. Leverage Rejected Alternatives context to avoid re-exploring ruled-out directions. If Implementation Hints are provided, use them to inform step ordering and architectural decisions. If a Scope Boundary is provided, constrain the plan to the defined scope and note deferred items.
  - **Clarify**: Do not re-ask about approach selection (already decided). Clarify implementation-level ambiguities. Design decisions are handled as labeled callouts in the plan body.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both $ARGUMENTS and a Proposal Summary are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary provides investigation context.

Also check for a **Research Summary** block (produced by `/soda-research`).

- **If found**: Use it as supplementary investigation context.
  - **Investigate**: Extract key findings, architecture insights, and code references. Use these as the starting point for investigation — skip survey-level sub-agent work and focus only on gaps not covered by the Research Summary. If the Research Summary includes Domain Knowledge, treat these as authoritative user-provided corrections.
  - **Plan**: Reference specific file paths and code references from the Research Summary in step breakdowns. Use Open Questions as input for plan ambiguities.
- **If not found**: No change to normal flow.

When both a Proposal Summary and Research Summary are present, the Proposal Summary takes precedence for approach selection context. The Research Summary provides deeper codebase understanding that supplements both.

Priority order: Proposal Summary (approach decision) > Research Summary (codebase understanding) > $ARGUMENTS (task description)

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - If no Proposal Summary is available, investigate from scratch using sub-agents:
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
   - **Verification output contract**: When delegating Proposal Summary verification, the sub-agent prompt MUST end with the following output format:
     > Return findings in this exact format:
     > ### Verified
     > - `path/to/file` — status (current | changed — description)
     > ### Discrepancies
     > - finding — what changed and how it affects the plan
     > ### Current State
     > - (brief summary of current state of affected areas)
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "Run /soda-propose to compare approaches" / "Continue — I'll specify the approach". Do not choose an approach autonomously.
2. **Strategy Confirmation + Branch Strategy**: Present the investigation findings and the intended implementation direction to the user. Use a single AskUserQuestion with these options:
   - **When a Proposal Summary exists**:
     - "この方針で新ブランチ作成"
     - "この方針で現ブランチ続行"
     - "方針を調整"
   - **When no Proposal Summary exists**:
     - "この方針で新ブランチ作成"
     - "この方針で現ブランチ続行"
     - "方針を調整"
     - "/soda-propose で代替案を比較"
   If the user chooses a new branch, derive the branch name from the task description.
   If the user wants to adjust, incorporate their feedback and re-present. If they choose /soda-propose, stop planning and suggest the user invoke it.
   Do NOT proceed to Step 3 until the user confirms.
3. **Plan**:

   **Technical Pre-Gathering (M/L tasks only)**: After task scale classification, if the task is scale M or L, pre-gather technical details before entering plan mode:
   - Identify rough step areas from investigation findings (affected areas, key files, functional groupings)
   - For each area (up to 3), launch a sub-agent (Task, subagent_type: Explore, model: sonnet) in parallel with the Step Detail Template below
   - Sub-agent prompts must include the constraint block, the specific area to investigate, and the Step Detail Template
   - Use gathered details to write the plan with concrete technical context (type signatures, API contracts, test patterns) rather than re-investigating during plan writing
   - If a Proposal Summary exists, use its Affected Areas to scope the pre-gathering areas

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
   - **Task group splitting** (include for scale L only) — group subagent-eligible steps into named task groups that can be executed in parallel. See Task Scale Classification below for details.
   - **Design decisions** (include when the plan involves architecture, external contracts, or user-facing behavior choices) — present each decision as a labeled callout in the plan body:
     > **Design Decision: [topic]**
     > Option A: ... — [trade-off]
     > Option B: ... — [trade-off]
     > Recommended: [option] — [rationale]

     The user reviews and confirms design decisions when approving the plan via ExitPlanMode. If a decision significantly changes the plan structure, note this dependency explicitly.

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

Delegate codex review to a subagent to keep the full codex output out of the main context.

1. Launch a codex review subagent:
   - Tool: `Task(subagent_type: dev-workflow:codex-review)`
   - Prompt: Specify "init" mode and include the Bash command with composed content via heredoc.
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts init "Review this plan. Skip trivial issues — only flag critical problems" <<'CODEX_REVIEW_EOF'
     [composed plan content]
     CODEX_REVIEW_EOF
     ```
   - Capture `review_file`, `session_id`, and critical issues from the subagent's response.
2. If the subagent reports critical issues, revise the content and launch another subagent specifying "resume" mode:
   - Bash command:
     ```bash
     bun ${CLAUDE_PLUGIN_ROOT}/scripts/codex-review.ts resume CODEX_SESSION REVIEW_FILE "Plan updated — review again. Skip trivial issues — only flag critical problems" <<'CODEX_REVIEW_EOF'
     [revised plan content]
     CODEX_REVIEW_EOF
     ```
3. If the subagent reports skip or failure, continue without review.

After the codex review completes, use the EnterPlanMode tool to enter plan mode. Write the reviewed plan content to the plan file. Proceed with the Plan Annotation Guidance below, then exit plan mode via ExitPlanMode.

## Plan Annotation Guidance

After writing the plan, identify 1-3 **annotation points** — areas where user domain knowledge would most improve plan quality. Common annotation points:
- Steps involving business logic or domain-specific behavior
- Assumptions about existing code behavior that weren't fully verified
- Design decisions where the user may have preferences not captured in investigation
- Risk assessments that depend on deployment context

Present these annotation points in the plan as a brief note:

> **レビューポイント**: 以下の箇所はドメイン知識による補足があると計画の精度が向上します：
> - Step N: {{annotation point description}}
> - Step M: {{annotation point description}}

The user may provide inline corrections or additional context. Incorporate their feedback and revise the affected plan sections. This annotation cycle can repeat multiple times before ExitPlanMode.

When the user provides domain knowledge corrections, mark them in the plan as:
> **User Context**: {{correction or additional information}}

This ensures domain knowledge survives context compaction as a labeled callout.

## Constraints

- Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in the Strategy Confirmation + Branch Strategy step. If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.
- Design decisions must be presented as labeled callouts in the plan body. The user confirms them when approving the plan via ExitPlanMode.
- During implementation, update the plan's step markers from `- [ ]` to `- [x]` as each step's commit is completed. This provides at-a-glance progress visibility.

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

After investigation (Step 1) and before planning (Step 3), classify the task scale based on investigation results. The classification determines which conditional elements to include and how subagent utilization is structured.

**Classification criteria** (use the first matching category):

- **S (Small)** — 1-3 steps, no cross-step dependencies beyond sequential ordering
  - Subagent utilization plan: omit (no benefit from subagent overhead)
  - Task group splitting: omit
- **M (Medium)** — 4-6 steps, fewer than 2 independent subtrees in the dependency graph
  - Subagent utilization plan: include (per-step annotation as before)
  - Task group splitting: omit (single chain — grouping adds no value)
- **L (Large)** — 7+ steps, OR 4+ steps with 2+ independent subtrees in the dependency graph
  - Subagent utilization plan: include (per-step annotation)
  - Task group splitting: include (group subagent-eligible steps into parallelizable task groups)

State the classification at the top of the plan body: `**Task Scale: [S|M|L]**`

### Task Group Splitting (Scale L)

For scale L tasks, after annotating each step with subagent eligibility (Subagent Criteria), group subagent-eligible steps into **task groups**:

**Grouping rules**:
1. Steps with no dependency relationship between them → same group (parallel execution)
2. Steps that share input/output dependencies → separate groups (sequential execution)
3. Main-context steps are never grouped — they execute in the main context between groups
4. Each group must be nameable (e.g., "Group A: Setup infrastructure", "Group B: Implement feature modules")

**Plan format for task groups**:

    ### Task Groups

    **Execution order**: Group A → Step 3 (main-context) → Group B → Step 7 (main-context, integration)

    **Group A** — [description]
    - Step 1: [commit message] (Subagent-eligible)
    - Step 2: [commit message] (Subagent-eligible)

    **Group B** — [description] (depends on: Group A, Step 3)
    - Step 4: [commit message] (Subagent-eligible)
    - Step 5: [commit message] (Subagent-eligible)
    - Step 6: [commit message] (Subagent-eligible)

**Constraint**: The execution order must be a valid topological sort of the step dependency graph. Every dependency declared in individual steps must be respected in the group ordering.
