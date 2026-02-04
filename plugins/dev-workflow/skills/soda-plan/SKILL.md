---
name: soda-plan
description: Plan implementation with sub-agents and design review
user-invocable: true
argument-hint: [task description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

Create a detailed implementation plan for the given task.

Use English for internal reasoning (thinking). Plan content (written to plan mode file) must be in English — use structured data, code snippets, and technical English for maximum AI interpretability and compaction resilience. User interaction (AskUserQuestion options, confirmation messages, investigation summaries presented before plan mode) must be in Japanese.

If $ARGUMENTS is empty and no Proposal Summary exists in the conversation, ask the user what they want to implement before proceeding.

## Context Detection

Before starting, check the conversation for a **Proposal Summary** block (produced by `/soda-propose`).

- **If found**: Use it as the starting context.
  - **Investigate**: Extract key findings and affected areas. Verify they are still current — if the Proposal Summary references specific files or patterns, spot-check that they still exist and haven't changed significantly. If key findings are outdated, note the discrepancies and investigate the gaps using sub-agents. Skip sub-agent investigation if the Proposal Summary covers the scope adequately.
  - **Plan**: Incorporate Expected Impact (gains, losses, UX changes) and Risks into the plan's risk assessment. Use Affected Areas as the starting point for step breakdown. Leverage Rejected Alternatives context to avoid re-exploring ruled-out directions. If Implementation Hints are provided, use them to inform step ordering and architectural decisions. If a Scope Boundary is provided, constrain the plan to the defined scope and note deferred items.
  - **Clarify**: Do not re-ask about approach selection (already decided). Clarify implementation-level ambiguities. Design decisions are handled in the Design Review step.
- **If not found**: Proceed normally using $ARGUMENTS as the task description.

When both $ARGUMENTS and a Proposal Summary are present, $ARGUMENTS takes precedence for the task description, but the Proposal Summary provides investigation context.

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - If no Proposal Summary is available, investigate from scratch using sub-agents:
     - **Sub-agent prompt constraints**: Every sub-agent prompt (both survey and focused) MUST begin with the following constraint block:
       > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings as structured text output only.
     - Launch a sub-agent (Task, subagent_type: Explore) to survey project structure, dependencies, and conventions relevant to the task.
     - Summarize the agent's findings into a Common Context block.
     - Based on findings, optionally launch 1-2 focused sub-agents in parallel. Each prompt must include the Common Context block (summarized, not raw output) and the specific investigation question.
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "Run /soda-propose to compare approaches" / "Continue — I'll specify the approach". Do not choose an approach autonomously.
2. **Strategy Confirmation**: Present the investigation findings and the intended implementation direction to the user.
   - **When a Proposal Summary exists**: Summarize the selected approach and key findings. Use AskUserQuestion to confirm:
     - "Proceed with this approach"
     - "Adjust the approach before planning"
   - **When no Proposal Summary exists**: Present investigation findings and intended direction. Use AskUserQuestion to confirm:
     - "Proceed with this direction"
     - "Adjust the direction"
     - "Run /soda-propose to compare alternatives"
   If the user wants to adjust, incorporate their feedback and re-present. If they choose /soda-propose, stop planning and suggest the user invoke it.
   Do NOT proceed to Step 3 until the user confirms.
3. **Branch Strategy**: Use AskUserQuestion to ask the user whether to create a new branch or continue on the current branch. Options:
   - "Create a new branch" (default for most tasks)
   - "Continue on the current branch" (for follow-up work or small additions)
   If the user chooses a new branch, derive the branch name from the task description.
   Do NOT proceed to Step 4 until the user responds.
4. **Plan**: Use the EnterPlanMode tool to enter plan mode, then formulate the plan. Include the following elements. Do not follow a fixed template — organize and format them as best fits the task. Follow the Compact-Resilience Guidelines below when authoring plan content.

   **Required elements:**
   - **Task summary and branch name**
   - **Investigation summary** — key findings, affected areas, relevant patterns discovered
   - **Steps** — each step must include:
     - Commit message (imperative mood)
     - File changes with full paths and rationale (`path/to/file` — what and why)
     - Validation criteria — how to verify this step is correct (test command, expected behavior, manual check)
     - Dependencies on prior steps and what this step produces for later steps (do not rely on ordering alone)
   - **Risks and mitigation** — at least one risk with a concrete mitigation strategy

   **Conditional elements** (include when applicable):
   - **Technical context per step** — type signatures, API contracts, data shapes, algorithms
   - **Design rationale** — for non-obvious decisions, state "why" explicitly as a labeled callout, not embedded in prose
   - **Cross-step shared context** — types, constants, or contracts used by multiple steps. Define once and reference by name in each step.
   - **Subagent utilization plan** (include when the plan has 4+ steps) — for each step, indicate whether it should be executed in a subagent or in the main context. See Subagent Criteria below for the decision rules.

5. **Design Review**: After drafting the plan, review it for software design decisions. A design decision is any choice that affects architecture, external contracts, or user-facing behavior. Examples of design decisions that REQUIRE user confirmation:
   - Architecture patterns (e.g., monolith vs microservice, event-driven vs request-response)
   - Library or framework selection
   - Data model design (schema, relationships)
   - API contract design (endpoints, request/response shapes)
   - State management approach
   - Authentication/authorization strategy

   Examples that do NOT require confirmation (implementation details):
   - Variable/function naming
   - Internal helper structure
   - Iteration order
   - File organization within an already-decided architecture

   For each design decision found, use AskUserQuestion to present concrete alternatives with rationale (e.g., "Use Strategy A — simpler but less flexible" / "Use Strategy B — more complex but extensible"). Do NOT finalize the plan until all design decisions are confirmed by the user. If no design decisions are found, state this explicitly and proceed.
6. **Clarify**: If there are ambiguous requirements or missing information, ask the user before finalizing the plan.

## Constraints

- Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in the Branch Strategy step. If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.
- When in doubt about whether to use AskUserQuestion, prefer asking. The plan's self-contained requirement does not override the need for user confirmation on design decisions.

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
