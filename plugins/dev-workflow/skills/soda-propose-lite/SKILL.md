---
name: soda-propose-lite
description: Propose multiple approaches for a given problem (lightweight)
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Read, Grep, Glob, AskUserQuestion
---

Investigate and propose multiple approaches for the given problem or goal. This is a lightweight version of `/soda-propose` optimized for lower token consumption and faster turnaround.

For deeper investigation with sub-agent exploration and detailed comparison, use `/soda-propose`.

Use English for internal reasoning (thinking). All user-facing output — problem restatement, proposals, AskUserQuestion options, and Proposal Summary — must be in Japanese.

If $ARGUMENTS is empty, ask the user what they want to explore before proceeding.

## Phase 1: Problem Understanding

Restate the problem described in $ARGUMENTS in one sentence. Identify the most relevant scope, priority axis, and constraints from context, then proceed directly to Phase 2.

Do NOT use AskUserQuestion in this phase. Do NOT ask for confirmation. Move on immediately.

## Phase 2: Investigation

Investigate the codebase directly using Grep, Glob, and Read. Focus on:

- Relevant code structure and patterns
- Key dependencies and integration points
- Existing conventions that affect the approach

Perform a single-pass investigation — gather all needed context in one round of tool usage. Do NOT use sub-agents (Task tool).

## Phase 3: Proposal & Selection

Present 2-3 approaches labeled A, B, C. Each approach includes:

- **Summary**: What changes and how (1-2 sentences)
- **Key trade-off**: Main advantage vs main drawback (1 bullet)
- **Impact Outlook**:
  - **Gains**: What will be achieved
  - **Losses**: What might be lost or degraded

After presenting all approaches, state a recommendation if one stands out.

Use AskUserQuestion to ask which approach to proceed with. List each approach label as a separate option, plus "None of these — start over". This is the only AskUserQuestion in the entire skill.

If the user selects an approach, emit the Proposal Summary. If the user rejects all approaches, return to Phase 1 and ask what angle to change.

## Proposal Summary Format

When the user makes a final selection, emit the following block. This serves as a handoff point for `/soda-plan`.

Guidelines for effective handoff:
- Ensure `/soda-plan` can proceed without re-investigating the same areas
- Prefer structured data (file paths, dependencies) over prose descriptions
- Keep it focused — this is a lightweight proposal; omit optional sections

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

    ### Risks
    - (key risk specific to this approach)

## Constraints

- This skill only proposes. Do NOT implement anything.
- Do NOT modify any code (read-only investigation only).
- After confirming the selection, wait for the user to decide the next step.
