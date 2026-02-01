---
name: soda-plan-implementation
description: Create a detailed implementation plan with branch strategy and commit breakdown.
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task
---

Create a detailed implementation plan for the given task.

Use English for internal reasoning (thinking). All user-facing output — plans, questions, summaries — must be in Japanese.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose-approach`).

- **If found**: Use it as the starting context.
  - **Investigate**: Extract key findings and affected areas. Verify they are still current, then explore only uncovered gaps. Skip sub-agent investigation if the Proposal Summary covers the scope adequately.
  - **Plan**: Incorporate Expected Impact (gains, losses, UX changes) and Risks into the plan's risk assessment. Use Affected Areas as the starting point for step breakdown. Leverage Rejected Alternatives context to avoid re-exploring ruled-out directions. If Implementation Hints are provided, use them to inform step ordering and architectural decisions. If a Scope Boundary is provided, constrain the plan to the defined scope and note deferred items.
  - **Clarify**: Do not re-ask about approach selection (already decided). Only clarify implementation-level ambiguities and design decisions.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both $ARGUMENTS and a Proposal Summary are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary provides investigation context.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - If no Proposal Summary is available, investigate from scratch using sub-agents:
     - Launch a sub-agent (Task, subagent_type: Explore) to survey project structure, dependencies, and conventions relevant to the task.
     - Based on findings, optionally launch 1-2 focused sub-agents in parallel to explore specific areas (e.g., existing implementation patterns, integration points, test coverage).
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "Run /soda-propose-approach to compare approaches" / "Continue — I'll specify the approach". Do not choose an approach autonomously.
2. **Strategy Confirmation**: If no Proposal Summary is available, present the investigation findings and the intended implementation direction to the user. Use AskUserQuestion to confirm:
   - "Proceed with this direction"
   - "Adjust the direction" (incorporate user feedback, then re-present)
   - "Run /soda-propose-approach to compare alternatives"
   If the user wants to adjust, incorporate their feedback and re-present the direction. If they choose /soda-propose-approach, stop planning and suggest the user invoke it.
   Skip this step when a Proposal Summary exists (approach already decided).
3. **Branch Strategy**: Use AskUserQuestion to ask the user whether to create a new branch or continue on the current branch. Options:
   - "Create a new branch" (default for most tasks)
   - "Continue on the current branch" (for follow-up work or small additions)
   If the user chooses a new branch, derive the branch name from the task description.
4. **Plan**: Formulate the plan. Include the following elements. Do not follow a fixed template — organize and format them as best fits the task.

   **Required elements:**
   - **Task summary and branch name**
   - **Investigation summary** — key findings, affected areas, relevant patterns discovered
   - **Steps** — each step must include:
     - Commit message (imperative mood)
     - File changes with full paths and rationale (`path/to/file` — what and why)
     - Validation criteria — how to verify this step is correct (test command, expected behavior, manual check)
     - Dependencies on prior steps and what this step produces for later steps (do not rely on ordering alone)
       - _Compact-resilience: explicit dependency chains survive compaction; implicit ordering does not._
   - **Risks and mitigation** — at least one risk with a concrete mitigation strategy

   **Conditional elements** (include when applicable):
   - **Technical context per step** — type signatures, API contracts, data shapes, algorithms. Prefer code snippets and structured data over prose descriptions.
     - _Compact-resilience: `interface Foo { bar: string }` survives compaction intact; "Foo has a bar field of type string" gets summarized away._
   - **Design rationale** — for non-obvious decisions, state "why" explicitly as a labeled callout, not embedded in prose.
     - _Compact-resilience: a labeled "Why: ..." callout is retained as structure; rationale buried in a paragraph is dropped._
   - **Cross-step shared context** — types, constants, or contracts used by multiple steps. Define once and reference by name in each step.
   - **Subagent utilization plan** (include when the plan has 4+ steps) — for each step, indicate whether it should be executed in a subagent or in the main context. See Subagent Criteria below for the decision rules.

   If the plan involves software design decisions (architecture choices, pattern selection, library choices, data model design, API contract design), present each decision to the user via AskUserQuestion before incorporating it into the plan. For each decision, structure the options as concrete alternatives with a brief rationale (e.g., "Use Strategy A — simpler but less flexible" / "Use Strategy B — more complex but extensible"). Do not make design decisions autonomously. Implementation-level details (variable names, internal helper structure, iteration order) do not require user confirmation.
5. **Clarify**: If there are ambiguous requirements or missing information, ask the user before finalizing the plan.

## Constraints

- Present the plan using plan mode. Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in the Branch Strategy step. If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.

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
