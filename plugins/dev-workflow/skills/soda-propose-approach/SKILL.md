---
name: soda-propose-approach
description: Propose multiple approaches for a given problem and summarize trade-offs.
user_invocable: true
---

Investigate and propose multiple approaches for the problem or goal the user presents.

## Procedure

1. **Understand the problem**: Grasp the user's problem accurately. Ask clarifying questions if needed.
2. **Investigate current state**: Explore the codebase to understand existing implementation, constraints, and dependencies.
3. **Enumerate approaches**: Propose 2-4 feasible approaches.
4. **Compare and summarize**: For each approach, lay out:
   - Summary (what changes and how)
   - Pros and cons
   - Implementation cost (scope of impact)
   - Risks and caveats
5. **Recommend**: If one approach stands out, state the recommendation with reasoning.

## Output Format

- Label each approach (A, B, C...) so the user can select easily.
- Present trade-offs as a table or concise bullet list.
- Structure the output so the user can follow up with `/soda-plan-implementation` after selecting an approach (e.g., "A で進める").

## Constraints

- This skill only proposes. Do NOT implement anything.
- Do NOT modify any code (read-only investigation only).
- Do NOT proceed to the next step until the user makes a selection.

## Argument Handling

If the user provides text after `/soda-propose-approach`, treat it as the problem description.
If no text is provided, ask the user what they want to explore.
