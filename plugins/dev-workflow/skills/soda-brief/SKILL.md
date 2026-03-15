---
name: soda-brief
description: Lightweight discussion kickoff with initial investigation and issue framing
user-invocable: true
argument-hint: "<topic or goal to explore>"
allowed-tools: Read, Grep, Glob, Task
---

Perform a lightweight investigation on the given topic and produce a Discussion Briefing that frames the discussion for `/soda-discuss`.

Use English for internal reasoning (thinking). Discussion Briefing content must be in English. Next-step suggestion must be in Japanese.

If $ARGUMENTS is empty, output a brief message in Japanese asking the user what topic they want to explore, then stop.

## Purpose

This skill is a **non-interactive preparation step** for `/soda-discuss`. It gathers enough context to start a productive discussion without requiring the depth of `/soda-research`.

**Position in skill chain**: `soda-research → soda-brief → soda-discuss → soda-plan`. soda-brief and soda-research are alternatives at the preparation stage — soda-brief for quick kickoff, soda-research for deep investigation.

## Procedure

### Step 1: Topic Parsing

Identify the core topic from $ARGUMENTS. Determine:
- What area of the codebase or design space is involved
- What kind of discussion this will lead to (new feature, refactoring, skill design, architecture, etc.)

### Step 2: Survey Investigation

Launch a sub-agent (Task, subagent_type: Explore) to survey the relevant area.

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Sub-agent output contract**: Every sub-agent prompt MUST end with:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the topic
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the topic
> ### Open Questions
> - question — what remains unclear from this investigation alone

The survey prompt should include the topic and ask for: relevant files, existing patterns, dependencies, and current state of the area.

### Step 3: Focused Investigation (optional)

If the survey reveals a specific area that needs deeper understanding to frame the discussion well, launch 1 focused sub-agent (Task, subagent_type: Explore) with the survey findings as context. Apply the same constraint block and output contract.

Skip this step if the survey provides sufficient context for framing.

### Step 4: Discussion Briefing

Synthesize findings into a Discussion Briefing block:

```
## Discussion Briefing
- **Topic**: what needs to be discussed
- **Background**: relevant codebase findings and current state
- **Key Questions**: 2-4 questions that should guide the discussion (ordered by dependency)
- **Constraints**: known technical or design constraints
```

Then suggest the next step in Japanese:

```
調査完了。以下のコマンドで議論を開始できます：
  /soda-discuss [topic]
```

## Constraints

- This skill is **non-interactive**. Do NOT use AskUserQuestion.
- Do NOT modify any code (read-only investigation only).
- Do NOT enter plan mode (no EnterPlanMode).
- Keep investigation lightweight — max 2 sub-agent launches (1 survey + 1 optional focused). For deep research, use `/soda-research` instead.
- The Discussion Briefing is a session artifact. Downstream skills use it naturally from the conversation context.
