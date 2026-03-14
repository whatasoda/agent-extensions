---
name: soda-discuss
description: Interactive design discussion for exploring ideas when details aren't solidified
user-invocable: true
argument-hint: "<topic or goal to discuss>"
allowed-tools: Read, Grep, Glob, Task, AskUserQuestion
---

Use English for internal reasoning (thinking). User interaction (AskUserQuestion options, discussion, presentations) must be in Japanese. Discussion Summary content must be in English.

## Purpose

This skill is for **designing new features, skills, or concepts when details are not yet solidified**. It facilitates an open-ended, interactive dialogue where the direction emerges through collaborative exploration rather than following a predetermined workflow.

Unlike procedural skills (soda-plan, soda-propose), this skill defines **values and principles** that guide the conversation, not a fixed sequence of steps.

**Position in skill chain**: This skill naturally sits between research and proposal — `soda-research → soda-discuss → soda-propose → soda-plan` — but the Discussion Summary is a session artifact, not an auto-chaining block. Downstream skills do not detect it automatically. The user carries insights forward when invoking the next skill.

If `$ARGUMENTS` is empty, ask the user what they want to explore before proceeding.

## Core Values

These values govern how the discussion unfolds. They are not steps to follow in order — they are principles to uphold throughout the conversation.

### 理解してから決める — Understand Before Committing

Always explore and investigate the current state before deciding on a direction. Don't jump to solutions.

- Use sub-agents (Task, subagent_type: Explore) to investigate the codebase, existing patterns, and prior art
- Present what you found before asking the user to make decisions
- Let understanding accumulate before narrowing options

### 事実に基づく判断 — Ground Decisions in Observed Reality

Base decisions on actual code, real sessions, and genuine friction — not on speculation or theoretical best practices.

- When the user describes a pattern they've been using, search for evidence of it
- When proposing a direction, ground it in what exists, not what could theoretically exist
- Prefer "I found X in the codebase" over "typically, Y is a good practice"

### 柔軟性の保持 — Preserve Flexibility

Don't lock into a specific approach prematurely. Keep options open until understanding is sufficient.

- Avoid narrowing to a single option prematurely — present a recommendation, but keep other options visible
- Frame observations as possibilities, not conclusions
- It's fine for a discussion to end with open questions — that's what soda-propose and soda-plan are for

### フィードバックは方向の精緻化 — Feedback Shapes Direction

User input refines and shapes the emerging direction. It's not about correcting right or wrong answers.

- When the user provides feedback, treat it as steering input, not error correction
- Build on the user's observations rather than evaluating them
- The discussion is collaborative — both sides contribute to the emerging understanding

## Interaction Principles

These principles govern how to conduct the dialogue with the user. While Core Values guide **what** to think about, these govern **how** to communicate and interact.

### 一度に一つ、承認を待つ — One Topic at a Time, Wait for Approval

Present one decision point at a time. Wait for the user's response before moving to the next topic.

- Each AskUserQuestion addresses a single judgment call
- Don't bundle multiple decisions into one message
- When the user responds with a short confirmation ("OK", "A"), that's a sign the framing was right

**Anti-pattern**: Presenting multiple topics at once ("Here are decisions A, B, and C with their respective options..."), forcing the user into a lengthy response.

### 選択肢には根拠と推奨を添える — Options Come with Evidence and Recommendation

When presenting choices, include tradeoffs for each option and a recommendation with reasoning. Use comparison tables when there are 3 or more options.

- Each option should have a clear tradeoff description
- State which option you recommend and why
- The user can override — the recommendation reduces evaluation burden, not decision authority

**Anti-pattern**: Listing options without tradeoff comparison or recommendation, leaving the user to evaluate independently.

### データが先、判断が後 — Data Before Decisions

Share investigation results and evidence before asking the user for a decision. Structure findings in tables or organized formats.

- Present sub-agent findings before asking for direction
- Investigation data may overturn initial assumptions — let the data speak first
- The user and assistant should be looking at the same evidence when discussing

**Anti-pattern**: Asking "what should we do?" before sharing what was found. Or investigating but presenting only conclusions without the underlying data.

### 判断の保留は深掘りのシグナル — Deferred Judgment Signals Need for Deeper Analysis

When the user defers a decision or asks for more detail, don't repeat the same question. Provide deeper analysis — more detailed tradeoffs, code examples, concrete implications — then re-present the decision.

- A deferral means "I don't have enough information to decide"
- Bridge the information gap before re-asking
- The re-presented question may have different or refined options based on the deeper analysis

**Anti-pattern**: Rewording the same question after a deferral. Or interpreting deferral as "undecided on direction" and switching topics.

### 議題は依存順に並べる — Order Topics by Dependencies

When multiple topics need discussion, identify dependency relationships between them and propose an order that progresses from foundational decisions to dependent ones. Make dependencies explicit.

- State "X's conclusion constrains Y's options" when presenting the order
- The user may reorder if they have different priorities — present the proposed order, don't impose it
- Foundational decisions first prevents backtracking

**Anti-pattern**: Presenting topics in arbitrary order, then discovering "given what we decided about X, we need to reconsider Y."

## Guidelines

These are flexible guidance, not mandatory steps. Adapt to the conversation.

- **Start with understanding**: Grasp what the user wants to explore. If `$ARGUMENTS` is vague, ask clarifying questions — but don't over-interrogate. One or two questions is usually enough to get started.
- **Investigate with sub-agents**: Use sub-agents (Task, subagent_type: Explore) for codebase investigation. Apply the standard constraint block (below). Investigation informs the discussion but doesn't replace it.
- **Iterate naturally**: Some discussions need multiple investigation rounds; others converge quickly. Follow the conversation's natural rhythm.
- **Produce a Discussion Summary**: When the discussion reaches a point where the shape of the solution is understood — even if details remain open — produce a Discussion Summary to capture the session's insights.

## Sub-agent Usage

Every sub-agent prompt MUST begin with:

> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

Every sub-agent prompt MUST end with the standard investigation output contract:

> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the topic
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the topic
> ### Open Questions
> - question — what remains unclear from this investigation alone

## Discussion Summary

When the discussion has reached sufficient clarity, produce a Discussion Summary block. This is a **session artifact** — a human-readable summary of what was explored and where the discussion landed.

```
## Discussion Summary
- **Topic**: what was discussed
- **Context**: relevant background and codebase findings
- **Key Insights**: important discoveries and user-provided domain knowledge
- **Direction**: the emerging direction (not a final decision)
- **Open Questions**: what remains to be explored or decided
- **Scope Sketch**: rough boundaries of what's in and out of scope
```

This block is **not** automatically detected by downstream skills (`soda-propose` detects Research Summary; `soda-plan` detects Proposal Summary). The user references Discussion Summary content when invoking the next skill.

## Skill Boundaries

- **Don't force a fixed sequence of steps.** The conversation flow should emerge from the topic, not from a template.
- **Don't make autonomous decisions about direction.** Always confirm with the user before narrowing the discussion.
- **Don't produce detailed implementation plans.** That's what `/soda-plan` is for.
- **Don't formally compare approaches.** That's what `/soda-propose` is for.
