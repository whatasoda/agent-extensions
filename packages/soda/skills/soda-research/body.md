
Perform deep, structured codebase research on the given topic and produce a reusable Research Summary artifact.

Use English for internal reasoning (thinking). All user-facing output — topic framing, findings presentation, and AskUserQuestion options — must be in Japanese. The Research Summary block must use the exact English template format for downstream compatibility.

If $ARGUMENTS is empty, ask the user what they want to research before proceeding.

## Procedure

### Step 1: Topic Framing

Restate the research topic described in $ARGUMENTS. Identify:

- **Research scope**: What specific areas of the codebase to investigate (files, patterns, architecture, dependencies)
- **Research questions**: 2-3 concrete questions this research should answer
- **Expected output**: What kind of understanding the user needs (architecture overview, dependency mapping, pattern discovery, implementation details)

Present this framing briefly. Do NOT use AskUserQuestion — proceed directly to Step 2.

### Step 2: Investigation

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with the following constraint block:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Sub-agent output contract**: Every sub-agent prompt MUST end with the following output format requirement:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the topic
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the topic
> ### Open Questions
> - question — what remains unclear from this investigation alone

#### Round 1: Survey

Launch a sub-agent (Task, subagent_type: Explore) with a prompt that includes the constraint block, then:
- The research topic and scope from Step 1
- Instruction to survey: project structure, key files, dependencies, and conventions related to the topic
- The output contract

Synthesize the agent's findings into a Common Context block.

#### Round 2: Focused Investigation

Based on Round 1 findings, launch 1-2 focused sub-agents in parallel (Task, subagent_type: Explore). Each prompt must include:
1. The constraint block
2. The Common Context block from Round 1 (summarized, not raw output)
3. A specific research question from Step 1 or a new question that emerged from Round 1
4. The output contract

### Step 3: Findings Presentation

Synthesize all investigation results into a structured findings report. Organize by theme (not by agent). Present in Japanese:

- **主要な発見**: Key discoveries with file paths and specific code references (`path/to/file:L42-L78`)
- **パターンと規約**: Patterns and conventions found in the codebase
- **アーキテクチャと依存関係**: Architecture relationships, dependency chains, data flow
- **未解決の疑問**: Open questions and areas of uncertainty
- **調査範囲**: What was covered and what was not

### Step 4: Annotation Cycle

This is the core differentiator of this skill — iterative refinement through user feedback, inspired by Boris Tane's annotation-driven workflow. Optimal depth is typically 2-3 rounds, but there is no hard limit.

Use AskUserQuestion:
- "特定の領域をさらに深掘り" — user specifies what to investigate more deeply
- "この理解に補足・修正を加える" — user provides domain knowledge corrections or additions
- "別の角度から調査" — pivot the investigation to a different perspective
- "十分理解できた（Research Summary を出力）" — finalize and emit Research Summary

**If "特定の領域をさらに深掘り"**: Ask the user which area to investigate. Launch 1 focused sub-agent with the accumulated context and the user's direction. Present additional findings, then return to this AskUserQuestion.

**If "この理解に補足・修正を加える"**: Accept the user's free-text input. Record it as domain knowledge. Revise any affected findings to reflect the correction. Present the updated findings, then return to this AskUserQuestion.

**If "別の角度から調査"**: Ask the user what angle to take. Launch 1 sub-agent with the new perspective. Present findings from the new angle alongside existing findings, then return to this AskUserQuestion.

**If "十分理解できた"**: Proceed to Step 5.

### Step 5: Research Summary

Emit the following structured handoff block. This enables same-session chaining to `/soda-discuss` or `/soda-plan`.

```
## Research Summary

**Topic**: (one-sentence research question)
**Scope**: (what areas were investigated)

### Key Findings
- `path/to/file` — (discovery with specific details)
- (pattern or convention found)

### Architecture & Dependencies
- (relationship discovered)
- (dependency chain)

### Code References
- `path/to/file:L42-L78` — (what this code does and why it matters)

### Open Questions
- (unresolved question that could not be answered from code alone)

### Domain Knowledge
- (corrections or additions provided by user during annotation cycle)
(omit this section if no user annotations were provided)
```

Then print next steps:

```
Research complete:
- Research Summary emitted for handoff

Next:
  /soda-discuss — Discuss direction and explore approaches using this research
  /soda-plan — Plan implementation directly using this research
```

## Constraints

- This skill only investigates. Do NOT modify any code.
- Do NOT enter plan mode (no EnterPlanMode).
- The Research Summary block format should be stable — downstream skills use it as conversation context.
- Findings presentation must be organized by theme, not by agent. Merge and deduplicate findings across agents.
- Domain Knowledge entries from user annotations are authoritative — they override investigation findings when there is a conflict.
