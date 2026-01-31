---
name: soda-plan-implementation
description: Create a detailed implementation plan with branch strategy and commit breakdown.
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Create a detailed implementation plan for the given task.

If $ARGUMENTS is empty, ask the user what they want to implement before proceeding.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns relevant to $ARGUMENTS.
2. **Plan**: Formulate a detailed plan that includes:
   - A new branch name derived from the task description
   - Step-by-step implementation breakdown
   - Commit strategy: define what each commit should contain and at what granularity
   - Technical details needed for implementation (type definitions, API contracts, dependency relationships, etc.) embedded directly in the plan at an appropriate level of detail
3. **Clarify**: If there are multiple viable approaches or ambiguous requirements, ask the user before finalizing the plan.

## Constraints

- Present the plan using plan mode. Do NOT begin implementation until the user approves the plan.
- Create a new branch from the current branch by default. If the user specifies a different base, use that instead.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: it should include enough technical context that implementation can proceed from the plan alone.
