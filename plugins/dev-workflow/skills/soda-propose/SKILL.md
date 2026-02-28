---
name: soda-propose
description: Compare approaches with sub-agent investigation
user-invocable: true
argument-hint: [problem description]
allowed-tools: Bash(git *), Bash(codex *), Bash(bun *), Read, Write, Grep, Glob, Task, AskUserQuestion
---

Investigate and propose multiple approaches for the given problem or goal.

Use English for internal reasoning (thinking). All user-facing output — problem restatement, proposals, comparisons, and AskUserQuestion options — must be in Japanese. The Proposal Summary block must use the exact English template format for downstream compatibility.

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

- **If found**: Use Key Findings, Architecture & Dependencies, and Code References as the Common Context block (Step 1). Skip the survey sub-agent entirely. Proceed directly to Step 2 (Focused Investigation), using Open Questions from the Research Summary to guide focused agent prompts. Treat Domain Knowledge entries as authoritative constraints.
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

### Comparison Framework

Before launching sub-agents, derive a comparison framework from the Phase 1 priority axis. The framework specifies evaluation dimensions that all per-approach sub-agents must address consistently:

**Fixed dimensions** (always included):
- Implementation complexity (step count, affected file count, migration effort)
- Risk assessment (migration risk, compatibility risk, regression risk)
- Impact assessment (Gains, Losses/Risks, UX Delta)

**Dynamic dimension** (derived from Phase 1 priority axis):
- Add one dimension matching the confirmed priority axis (e.g., "Performance impact" if speed is prioritized, "Long-term maintainability" if maintainability is prioritized)

### Approach Analysis Output Contract

Per-approach sub-agent prompts MUST end with the following output format:
> Return findings in this exact format:
> ### Implementation Outline
> - step — description (affected file: `path/to/file`)
> ### Affected Areas
> - `path/to/file` — what changes and why
> ### Pros
> - advantage — explanation
> ### Cons
> - disadvantage — explanation
> ### Risks
> - risk — likelihood and impact, mitigation suggestion
> ### Impact Assessment
> - **Gains**: (what will be achieved)
> - **Losses / Risks**: (what might be lost or degraded)
> - **UX Delta**: (how the end-user experience changes)
> ### Priority Axis Evaluation
> - (evaluation against the dynamic dimension from the Comparison Framework)

### Step 1: Per-Approach Analysis (Sub-agents)

For each shortlisted approach, launch a sub-agent (Task, subagent_type: Explore, model: sonnet) in parallel. Each sub-agent prompt must include:
1. The constraint block (same as Phase 2)
2. The Common Context block from Phase 2 (summarized, not raw output)
3. The Comparison Framework (all evaluation dimensions)
4. The approach summary from Phase 3 (label, summary, key trade-off, scope of impact)
5. The Approach Analysis output contract

### Step 2: Comparison Assembly (Main Context)

Using the per-approach findings from sub-agents, assemble:
- Pros / Cons comparison table
- Risk assessment comparison
- **Impact Tracking**: side-by-side comparison of Gains, Losses/Risks, UX Delta
- Priority axis evaluation comparison
- Recommendation with reasoning
- When emitting the Proposal Summary, populate Implementation Hints if the comparison revealed meaningful implementation ordering or architectural decisions. Populate Scope Boundary if the selected approach has explicit exclusions or deferrals.

Use AskUserQuestion to confirm the final selection. Options should include each shortlisted approach by label, plus "None of these — revisit from scratch". On selection, emit the Proposal Summary and suggest `/soda-plan`.

If the user rejects all approaches, return to Phase 1. Use AskUserQuestion to determine the next step: "Redefine the problem and re-investigate" / "Broaden scope to find additional approaches" / "End this exploration".

### Codex Review (pre-emission)

Delegate codex review to a subagent. The subagent handles revision internally if critical issues are found.

1. Launch a codex review subagent:
   - Tool: `Task(subagent_type: dev-workflow:codex-review)`
   - Prompt: Include the review request with composed content.
   - Review request:
     ```
     ## Codex Review Request
     - **Mode**: init
     - **Instruction**: "Review this proposal. Focus on trade-off validity, missing risk assessments, and impact accuracy — only flag critical problems"

     ### Content
     [composed Proposal Summary]
     ```
2. Use the subagent's response:
   - If **Revision Applied: Yes**: use the `Revised Content` from the response as the Proposal Summary.
   - If **Status: Skipped** or subagent failure: continue without review.

Emit the reviewed Proposal Summary.

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
