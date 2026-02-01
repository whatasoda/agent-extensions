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
4. **Plan**: Formulate the plan using the following structure:

       ## Implementation Plan: [Task Summary]
       **Branch**: `branch-name`

       ### Investigation Summary
       - (key findings, affected areas, relevant patterns)

       ### Steps

       #### Step N: [Step Name]
       **Commit**: `[commit message in imperative mood]`
       **Changes**:
       - `path/to/file` — what changes and why
       **Technical Context**:
       - (type definitions, API contracts, algorithms — include only when needed for this step)

       (repeat for each step)

       ### Risks & Mitigation
       - (risk): (mitigation strategy)

   If the plan involves software design decisions (architecture choices, pattern selection, library choices, data model design, API contract design), present each decision to the user via AskUserQuestion before incorporating it into the plan. For each decision, structure the options as concrete alternatives with a brief rationale (e.g., "Use Strategy A — simpler but less flexible" / "Use Strategy B — more complex but extensible"). Do not make design decisions autonomously. Implementation-level details (variable names, internal helper structure, iteration order) do not require user confirmation.
5. **Clarify**: If there are ambiguous requirements or missing information, ask the user before finalizing the plan.

## Constraints

- Present the plan using plan mode. Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in the Branch Strategy step. If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: it should include enough technical context that implementation can proceed from the plan alone.
- Each step must define a commit with an imperative-mood message.
- The plan must identify at least one risk and its mitigation.
