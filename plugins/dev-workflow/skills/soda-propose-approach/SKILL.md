---
name: soda-propose-approach
description: Propose multiple approaches for a given problem and summarize trade-offs.
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task
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

If consensus cannot be reached after 2 confirmation attempts, propose running Phase 2 in exploratory mode — investigate the current state first, then return to Phase 1 to collaboratively redefine the problem based on the investigation findings.

## Phase 2: Investigation

### Step 1: Common Context

Launch a sub-agent (Task, subagent_type: Explore) with a prompt that includes:
- The problem statement and scope confirmed in Phase 1
- Instruction to report: project structure, key dependencies, existing patterns, and relevant conventions

Summarize the agent's findings into a Common Context block for use in Step 2.

### Step 2: Focused Investigation

For each focused agent, construct the prompt to include:
1. The Common Context block from Step 1 (summarized, not raw output)
2. The specific investigation question for this agent
3. The scope and priority axis confirmed in Phase 1

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

Otherwise, use AskUserQuestion (multiSelect: true) to ask:
"Which approaches should I compare in detail?"

- If only 1 approach is selected: Provide a condensed deep-dive before emitting the Proposal Summary. Include affected files and areas with specifics (from Phase 2 findings) and condensed Impact Tracking (Gains / Losses only, no comparison table). Skip the Pros/Cons comparison and risk-per-approach comparison (no comparison target), but ensure the Proposal Summary contains sufficient detail for `/soda-plan-implementation`.
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

Use AskUserQuestion to confirm the final selection. Options should include each shortlisted approach by label, plus "None of these — revisit from scratch". On selection, emit the Proposal Summary and suggest `/soda-plan-implementation`.

If the user rejects all approaches, return to Phase 1. Use AskUserQuestion to determine the next step: "Redefine the problem and re-investigate" / "Broaden scope to find additional approaches" / "End this exploration".

## Proposal Summary Format

When the user makes a final selection, emit the following block. Keep it compact (under 40 lines total). This serves as a handoff point for `/soda-plan-implementation`.

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
