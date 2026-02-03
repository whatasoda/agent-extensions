---
name: soda-plan-lite
description: Create a lightweight implementation plan with branch strategy and commit breakdown
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

Create a lightweight implementation plan for the given task.

Use English for internal reasoning (thinking). Plan content (written to plan mode file) must be in English — use structured data, code snippets, and technical English for maximum AI interpretability and compaction resilience. User interaction (AskUserQuestion options, confirmation messages, investigation summaries presented before plan mode) must be in Japanese.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

For plans with design decision review and sub-agent investigation, use `/soda-plan`.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose`).

- **If found**: Use it as the starting context.
  - **Investigate**: Extract key findings and affected areas. Spot-check that referenced files or patterns still exist and haven't changed significantly. Note any discrepancies in the plan body.
  - **Plan**: Incorporate Expected Impact (gains, losses, UX changes) and Risks into the plan's risk assessment. Use Affected Areas as the starting point for step breakdown. Leverage Rejected Alternatives context to avoid re-exploring ruled-out directions. If Implementation Hints are provided, use them to inform step ordering and architectural decisions. If a Scope Boundary is provided, constrain the plan to the defined scope and note deferred items.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both $ARGUMENTS and a Proposal Summary are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary provides investigation context.

## Procedure

1. **Investigate**: Explore the codebase directly using Grep, Glob, and Read to understand the scope, affected areas, and existing patterns. Do NOT use sub-agents (Task tool).
   - If a Proposal Summary is available, spot-check only — verify key findings are still current rather than investigating from scratch.
   - If no Proposal Summary is available, investigate from scratch directly.
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "Run /soda-propose to compare approaches" / "Continue — I'll specify the approach". Do not choose an approach autonomously.
2. **Strategy Confirmation + Branch Strategy**: Present the investigation findings and intended implementation direction. Use AskUserQuestion with these options:
   - "This is the ONLY AskUserQuestion in the entire skill."
   - Options:
     - "この方針で新ブランチ作成"
     - "この方針で現ブランチ続行"
     - "方針を調整"
   - If the user chooses a new branch, derive the branch name from the task description.
   - If the user wants to adjust, incorporate their feedback and re-present.
   - Do NOT proceed to Step 3 until the user confirms.
3. **Plan**: Use the EnterPlanMode tool to enter plan mode, then formulate the plan. Include the following required elements. Do not follow a fixed template — organize and format them as best fits the task. Follow the Compact-Resilience Guidelines below when authoring plan content.

   **Required elements:**
   - **Task summary and branch name**
   - **Investigation summary** — key findings, affected areas, relevant patterns discovered
   - **Steps** — each step must include:
     - Commit message (imperative mood)
     - File changes with full paths and rationale (`path/to/file` — what and why)
     - Validation criteria — how to verify this step is correct (test command, expected behavior, manual check)
     - Dependencies on prior steps and what this step produces for later steps (do not rely on ordering alone)
   - **Risks and mitigation** — at least one risk with a concrete mitigation strategy

   If there are ambiguous requirements or missing information, note them in the plan body rather than asking separately.

## Constraints

- Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in the Strategy Confirmation + Branch Strategy step. If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.

## Compact-Resilience Guidelines

Plans must survive context compaction. Follow these rules when authoring plan content:

- **Explicit dependency chains**: State what each step depends on and produces. Do not rely on step ordering alone — ordering is lost during compaction.
- **Code over prose**: Prefer code snippets and structured data (`interface Foo { bar: string }`) over prose descriptions ("Foo has a bar field of type string"). Code survives intact; prose gets summarized away.
- **Labeled callouts**: State design rationale as "Why: ..." callouts, not embedded in paragraphs. Labeled callouts are retained as structure; prose rationale is dropped.
