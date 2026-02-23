---
name: soda-research-lite
description: Quick codebase research without sub-agents
user-invocable: true
argument-hint: [research topic or question]
allowed-tools: Bash(git *), Read, Grep, Glob, AskUserQuestion
---

Perform quick, structured codebase research on the given topic and produce a Research Summary artifact.

For deeper research with sub-agent investigation and iterative annotation, use `/soda-research`.

Use English for internal reasoning (thinking). All user-facing output — topic framing, findings, and AskUserQuestion options — must be in Japanese. The Research Summary block must use the exact English template format for downstream compatibility.

If $ARGUMENTS is empty, ask the user what they want to research before proceeding.

## Procedure

### Step 1: Topic Framing

Restate the research topic described in $ARGUMENTS in one sentence. Identify the most relevant scope and research questions from context, then proceed directly to Step 2.

Do NOT use AskUserQuestion in this step. Move on immediately.

### Step 2: Investigation

Investigate the codebase directly using Grep, Glob, and Read. Do NOT use sub-agents (Task tool). Focus on:

- Key files and code related to the research topic
- Patterns, conventions, and architecture
- Dependencies and integration points

Perform a single-pass investigation — gather all needed context in one round of tool usage. Be thorough but efficient.

### Step 3: Findings & Annotation Checkpoint

Present findings organized by theme in Japanese:

- **主要な発見**: Key discoveries with file paths and code references
- **パターンと規約**: Patterns and conventions found
- **アーキテクチャと依存関係**: Architecture relationships and dependencies
- **未解決の疑問**: Open questions and uncertainties

Then use AskUserQuestion. This is the only AskUserQuestion in the entire skill:
- "補足・修正を加えてから Research Summary を出力" — user provides corrections, then finalize
- "このまま Research Summary を出力" — finalize immediately
- "もっと深く調べたい（/soda-research に切り替え）" — suggest escalation to full version

**If user provides corrections**: Record them as domain knowledge, update affected findings, then emit Research Summary.

**If finalizing immediately**: Proceed to Step 4.

**If escalating**: Print suggestion to run `/soda-research` and stop.

### Step 4: Research Summary

Emit the following structured handoff block. This enables same-session chaining to `/soda-plan` or `/soda-propose`.

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
- (unresolved question)

### Domain Knowledge
- (corrections or additions from user)
(omit this section if no user annotations were provided)
```

Then print next steps:

```
Research complete:
- Research Summary emitted for handoff

Next:
  /soda-propose — Explore implementation approaches using this research
  /soda-plan — Plan implementation directly using this research
```

## Constraints

- This skill only investigates. Do NOT modify any code.
- Do NOT enter plan mode (no EnterPlanMode).
- Do NOT use sub-agents (Task tool is not in allowed-tools).
- The Research Summary block format must be stable — same format as `/soda-research`.
- Domain Knowledge entries from user annotations are authoritative.
