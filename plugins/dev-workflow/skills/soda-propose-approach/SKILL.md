---
name: soda-propose-approach
description: Propose multiple approaches for a given problem and summarize trade-offs.
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Read, Grep, Glob, Task
---

Investigate and propose multiple approaches for the given problem or goal.

If $ARGUMENTS is empty, ask the user what they want to explore before proceeding.

## Phase 1: Problem Understanding

Restate the problem described in $ARGUMENTS in your own words. Present your understanding to the user, then use AskUserQuestion to confirm the following before proceeding:

- **Scope**: What is in scope and out of scope for this exploration?
- **Priority axis**: What matters most? (e.g., speed, maintainability, compatibility, UX quality)
- **Constraints**: Are there approaches to avoid, or hard technical/business constraints?

Do NOT proceed to Phase 2 until the user confirms your understanding is correct.

## Phase 2: Investigation

### Step 1: Common Context

Launch a sub-agent (Task, subagent_type: Explore) to gather shared context:
- Project structure and architecture relevant to the problem
- Key dependencies and constraints
- Existing patterns and conventions

### Step 2: Focused Investigation

Based on the problem scope confirmed in Phase 1, launch 1-3 parallel sub-agents (Task, subagent_type: Explore), each targeting a specific area. Pass the common context from Step 1 to each agent.

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

Then use AskUserQuestion (multiSelect: true) to ask:
"Which approaches should I compare in detail?"

- If only 1 approach is selected, skip Phase 4 and go directly to Proposal Summary.
- If 2-3 approaches are selected, proceed to Phase 4.

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

Use AskUserQuestion to confirm the final selection. On selection, emit the Proposal Summary and suggest `/soda-plan-implementation`.

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
    - Approach (Label): (one-sentence reason for rejection)

## Constraints

- This skill only proposes. Do NOT implement anything.
- Do NOT modify any code (read-only investigation only).
- After confirming the selection, wait for the user to decide the next step.
