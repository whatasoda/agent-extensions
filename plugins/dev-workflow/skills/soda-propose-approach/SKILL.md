---
name: soda-propose-approach
description: Propose multiple approaches for a given problem and summarize trade-offs.
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Investigate and propose multiple approaches for the given problem or goal.

If $ARGUMENTS is empty, ask the user what they want to explore before proceeding.

## Procedure

1. **Understand the problem**: Grasp the problem described in $ARGUMENTS accurately. Ask clarifying questions if needed.
2. **Investigate current state**: Explore the codebase to understand existing implementation, constraints, and dependencies.
3. **Enumerate approaches**: Propose 2-4 feasible approaches.
4. **Compare and summarize**: For each approach, lay out:
   - Summary (what changes and how)
   - Pros and cons
   - Implementation cost (scope of impact)
   - Risks and caveats
5. **Recommend**: If one approach stands out, state the recommendation with reasoning.
6. **Confirm selection**: When the user selects an approach, respond with a Proposal Summary (see format below) and suggest proceeding with `/soda-plan-implementation`.

## Output Format

- Label each approach (A, B, C...) so the user can select easily.
- Present trade-offs as a table or concise bullet list.

## Proposal Summary Format

When the user selects an approach, emit the following block. Keep it compact (under 30 lines total). This serves as a handoff point for `/soda-plan-implementation`.

    ## Proposal Summary

    **Problem**: (one-sentence description)
    **Selected**: Approach (Label) — (one-sentence summary)

    ### Key Findings
    - (critical discovery from investigation)
    - (relevant constraint or dependency)

    ### Affected Areas
    - `path/to/file` — (why relevant)

    ### Risks
    - (key risk specific to this approach)

## Constraints

- This skill only proposes. Do NOT implement anything.
- Do NOT modify any code (read-only investigation only).
- After confirming the selection, wait for the user to decide the next step.
