---
name: soda-plan-implementation
description: Create a detailed implementation plan with branch strategy and commit breakdown.
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task
---

Create a detailed implementation plan for the given task.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose-approach` when the user selects an approach).

- **If found**: Use it as the starting context. Extract the problem, selected approach, key findings, affected areas, and risks. Only investigate areas not already covered.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary still provides useful investigation context.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - If a Proposal Summary is available, focus on verifying its findings and exploring gaps it did not cover.
   - If no Proposal Summary is available, investigate from scratch using sub-agents:
     - Launch a sub-agent (Task, subagent_type: Explore) to survey project structure, dependencies, and conventions relevant to the task.
     - Based on findings, optionally launch 1-2 focused sub-agents in parallel to explore specific areas (e.g., existing implementation patterns, integration points, test coverage).
   - Summarize investigation results before proceeding to planning.
2. **Plan**: Formulate the plan using the following structure:

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

3. **Clarify**: If there are ambiguous requirements or missing information, ask the user before finalizing the plan. If investigation reveals multiple fundamentally different approaches, suggest the user run `/soda-propose-approach` first rather than choosing an approach within this skill.

## Constraints

- Present the plan using plan mode. Do NOT begin implementation until the user approves the plan.
- Create a new branch from the current branch by default. If the user specifies a different base, use that instead.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: it should include enough technical context that implementation can proceed from the plan alone.
- Each step must define a commit with an imperative-mood message.
- The plan must identify at least one risk and its mitigation.
