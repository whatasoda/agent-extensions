---
name: soda-propose
description: Compare approaches with sub-agent investigation
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task, AskUserQuestion
---

Investigate and propose multiple approaches for the given problem or goal.

Use English for internal reasoning (thinking). All user-facing output — problem restatement, proposals, comparisons, AskUserQuestion options, and Proposal Summary — must be in Japanese.

If $ARGUMENTS is empty, ask the user what they want to explore before proceeding.

## Phase 1: Problem Understanding

Restate the problem described in $ARGUMENTS in your own words. Include your best assessment of:

- **Scope**: What appears to be in scope and out of scope
- **Priority axis**: What seems to matter most (e.g., speed, maintainability, compatibility, UX quality)
- **Constraints**: Any apparent technical or business constraints

Present this understanding to the user, then use AskUserQuestion to confirm:
- "This understanding is correct"
- "Scope needs adjustment"
- "Priority axis is different"
- "There are additional constraints"

If the user selects anything other than confirmation, incorporate their feedback (via free-text input), revise your understanding, and re-present. Do NOT proceed to Phase 2 until the user confirms.

If consensus cannot be reached after 2 confirmation attempts, use AskUserQuestion: "Run exploratory investigation first, then redefine the problem" / "Try defining the problem one more time" / "End this exploration".

## Phase 2: Investigation

**Sub-agent prompt constraints**: Every sub-agent prompt (both common-context and focused) MUST begin with the following constraint block:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Sub-agent output contract**: Every sub-agent prompt MUST end with the following output format requirement:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the task
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it affects the task
> ### Open Questions
> - question — what remains unclear from this investigation alone

### Research Summary Detection

Before launching sub-agents, check for a **Research Summary** block (produced by `/soda-research`) in the conversation.

- **If found**: Use Key Findings and Architecture & Dependencies as the Common Context block (Step 1). Skip the survey sub-agent entirely. Proceed directly to Step 2 (Focused Investigation), using Open Questions from the Research Summary to guide focused agent prompts. Treat Domain Knowledge entries as authoritative constraints.
- **If not found**: Proceed normally with Step 1 survey agent.

### Step 1: Common Context

Launch a sub-agent (Task, subagent_type: Explore) with a prompt that includes the constraint block, then:
- The problem statement and scope confirmed in Phase 1
- Instruction to report: project structure, key dependencies, existing patterns, and relevant conventions
- The output contract

Summarize the agent's findings into a Common Context block for use in Step 2.

### Step 2: Focused Investigation

For each focused agent, construct the prompt to include:
1. The constraint block
2. The Common Context block from Step 1 (summarized, not raw output)
3. The specific investigation question for this agent
4. The scope and priority axis confirmed in Phase 1
5. The output contract

Launch 1-3 agents in parallel (Task, subagent_type: Explore).

Examples of focused investigations:
- "How does the current X implementation work?"
- "What are the integration points with Y?"
- "What test coverage exists for Z?"

## Phase 3: Initial Proposal & Shortlisting

Present 2-4 approaches labeled A, B, C... Each approach includes:
- **Summary**: What changes and how (1-2 sentences)
- **Key trade-off**: Main advantage vs main drawback (1-2 bullets)
- **Scope of impact**: Which areas of the codebase are affected
- **Impact Outlook**: What is achieved and what may be lost — how the end-user experience changes, how the underlying problem is resolved

After presenting all approaches, state a recommendation if one stands out.

If only one viable approach was found, present it with a brief explanation of why other directions were ruled out. Use AskUserQuestion: "Proceed with detailed review of this approach" / "Re-investigate with a different angle". If proceeding, provide a condensed deep-dive (see below) and emit the Proposal Summary. If re-investigating, ask the user what angle or constraint to change, then return to Phase 2 with the revised scope.

Otherwise, ask "Which approaches should I compare in detail?" using AskUserQuestion with multiSelect enabled so the user can select multiple approaches at once. List each approach label as a separate option.

- If only 1 approach is selected: Provide a condensed deep-dive before emitting the Proposal Summary. Include affected files and areas with specifics (from Phase 2 findings) and condensed Impact Tracking (Gains / Losses only, no comparison table). Skip the Pros/Cons comparison and risk-per-approach comparison (no comparison target), but ensure the Proposal Summary contains sufficient detail for `/soda-plan`. Include Implementation Hints and Scope Boundary in the Proposal Summary if relevant findings exist.
- If all approaches are selected, or 2-3 approaches are selected, proceed to Phase 4.

## Phase 4: Detailed Comparison & Decision

For the shortlisted approaches, provide:
- Detailed implementation outline
- Affected files and areas with specifics
- Pros / Cons comparison table
- Risk assessment per approach
- **Impact Tracking**: For each candidate, compare side by side:
  - **Gains**: What will be achieved (problem resolution, UX improvement, performance, etc.)
  - **Losses / Risks**: What might be lost or degraded (existing functionality, UX aspects, compatibility)
  - **UX Delta**: How the end-user experience changes concretely
- Recommendation with reasoning
- When emitting the Proposal Summary, populate Implementation Hints if the comparison revealed meaningful implementation ordering or architectural decisions. Populate Scope Boundary if the selected approach has explicit exclusions or deferrals.

Use AskUserQuestion to confirm the final selection. Options should include each shortlisted approach by label, plus "None of these — revisit from scratch". On selection, emit the Proposal Summary and suggest `/soda-plan`.

If the user rejects all approaches, return to Phase 1. Use AskUserQuestion to determine the next step: "Redefine the problem and re-investigate" / "Broaden scope to find additional approaches" / "End this exploration".

## Proposal Summary Format

When the user makes a final selection, emit the following block. This serves as a handoff point for `/soda-plan`.

Guidelines for effective handoff:
- Ensure `/soda-plan` can proceed without re-investigating the same areas
- Prefer structured data (file paths, type signatures, explicit dependencies) over prose descriptions
- Focus on decisions made and their rationale, not implementation details
- Include optional sections (Implementation Hints, Scope Boundary) when they provide actionable context for planning

    ## Proposal Summary

    **Problem**: (one-sentence description)
    **Selected**: Approach (Label) — (one-sentence summary)

    ### Key Findings
    - (critical discovery from investigation)
    - (relevant constraint or dependency)

    ### Affected Areas
    - `path/to/file` — (why relevant)

    ### Expected Impact
    - **Gains**: (what will be achieved)
    - **Potential Losses**: (what might be lost or degraded)
    - **UX Changes**: (how the end-user experience changes)

    ### Risks
    - (key risk specific to this approach)

    ### Implementation Hints (optional)
    - (suggested implementation order or dependency chain)
    - (architectural decision made during comparison — e.g., "use X pattern because Y")

    ### Scope Boundary (optional)
    - **In scope**: (what this approach covers)
    - **Deferred**: (what is intentionally left for future work)

    ### Rejected Alternatives
    - Approach (Label): (one-sentence reason) — rejected after detailed comparison
    (omit this section if no approaches were compared in Phase 4)

    ### Not Compared
    - Approach (Label): (one-sentence reason for not shortlisting)
    (omit this section if all proposed approaches were shortlisted)

## Constraints

- This skill only proposes. Do NOT implement anything.
- Do NOT modify any code (read-only investigation only).
- After confirming the selection, wait for the user to decide the next step.
