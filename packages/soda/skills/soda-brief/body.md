
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

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Codebase investigation output contract**: Every codebase sub-agent prompt MUST end with:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the topic
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the topic
> ### Open Questions
> - question — what remains unclear from this investigation alone

**External research output contract**: Every external research sub-agent prompt MUST end with:
> Return findings in this exact format:
> ### Official Documentation
> - library/service name — key API, configuration, version-specific notes
> ### Best Practices
> - practice — source and context
> ### Patterns & Examples
> - pattern — description with code snippets if available
> ### Caveats
> - caveat — gotchas, known issues, version incompatibilities

#### External Research Trigger

Before launching sub-agents, evaluate whether the topic involves external technologies:

- If the topic references **named external libraries, frameworks, or services** (e.g., "Drizzle", "NextAuth", "Stripe"), **technology selection or comparison** (e.g., "which ORM", "migrate from X to Y"), or **external API integration** (e.g., "Slack API", "GitHub webhook") → launch an external research sub-agent **in parallel** with the codebase survey.
- If the topic is purely about modifying existing code with no new external dependencies → skip external research.

**External research sub-agent prompt template**:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
>
> ## Research Task
> Investigate external documentation and resources for: [topic extracted from $ARGUMENTS]
>
> ## Research Strategy
> 1. Use Context7 MCP (resolve-library-id → get-library-docs) for each identified library/framework
> 2. Use WebSearch for broader context: best practices, migration guides, comparison articles, known issues
> 3. Synthesize findings — prioritize official documentation over community content
>
> [External research output contract]

#### Codebase Survey

Launch a sub-agent (Task, subagent_type: Explore) to survey the relevant area. The survey prompt should include the topic and ask for: relevant files, existing patterns, dependencies, and current state of the area.

If external research is triggered, launch both sub-agents in a single message (parallel execution).

### Step 3: Focused Investigation (optional)

If the survey reveals a specific area that needs deeper understanding to frame the discussion well, launch 1 focused sub-agent (Task, subagent_type: Explore) with the survey findings as context. Apply the same constraint block and output contract.

Skip this step if the survey provides sufficient context for framing.

### Step 4: Discussion Briefing

Synthesize findings into a Discussion Briefing block:

```
## Discussion Briefing
- **Topic**: what needs to be discussed
- **Background**: relevant codebase findings and current state
- **External Context** (include if external research was performed): key findings from official docs, best practices, and caveats
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
