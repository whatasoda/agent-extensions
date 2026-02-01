---
name: soda-plan-implementation
description: Create a detailed implementation plan with branch strategy and commit breakdown.
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Create a detailed implementation plan for the given task.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose-approach` when the user selects an approach).

- **If found**: Use it as the starting context. Extract the problem, selected approach, key findings, affected areas, and risks. Only investigate areas not already covered.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary still provides useful investigation context.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns relevant to the task.
   - If a Proposal Summary is available, focus on verifying its findings and exploring gaps it did not cover.
   - If no Proposal Summary is available, investigate from scratch.
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
