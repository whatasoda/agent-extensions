# soda-brief

## Background

When `/soda-discuss` was invoked without prior research, the first several turns were typically spent on basic codebase investigation — surveying files, understanding existing patterns, and establishing context. This investigation phase was necessary but not interactive — it didn't benefit from the user's input until findings were ready to discuss.

soda-brief separates this "gather initial context" phase from the "discuss interactively" phase, allowing discussions to start from an informed position.

## Purpose

Provides a lightweight, non-interactive investigation that produces a Discussion Briefing — a framing document that identifies the topic, relevant background, key questions, and constraints. This gives `/soda-discuss` a starting point so the conversation can focus on exploration and decision-making rather than basic fact-finding.

The typical flow:
- `/soda-brief` → Discussion Briefing → `/soda-discuss` → Discussion Summary → `/soda-plan`
- `/soda-brief` standalone (quick context gathering before any discussion)

## Design Notes

- **Non-interactive by design**: soda-brief does not use AskUserQuestion. The briefing is a starting point, not a refined artifact. Refinement and iteration happen in `/soda-discuss`. This keeps soda-brief fast and predictable — one invocation, one output.

- **Distinction from soda-research**: soda-research is deep (multi-round annotation cycle), interactive (user corrects and enriches findings), and produces a comprehensive Research Summary. soda-brief is shallow (max 2 sub-agents), non-interactive, and produces a lightweight Discussion Briefing. They are alternatives at the preparation stage: soda-brief for quick kickoff, soda-research for thorough investigation.

- **Discussion Briefing as session artifact**: Like the Discussion Summary produced by soda-discuss, the Discussion Briefing is not formally detected by downstream skills. It provides context that soda-discuss uses naturally from the conversation.

- **Key Questions as discussion guide**: The briefing's Key Questions are ordered by dependency (foundational questions first). This aligns with soda-discuss's interaction principle "議題は依存順に並べる" and gives the discussion a natural starting structure without being prescriptive.

- **Sub-agent strategy**: Uses the same constraint block and output contract as all other dev-workflow skills for consistency. Limited to 1 survey + 1 optional focused agent to keep the skill lightweight.

## Skill Chain Position

```
soda-research → soda-brief → soda-discuss → soda-plan
```

- **Alternative to soda-research**: When the topic needs quick framing rather than deep investigation
- **Before soda-discuss**: Provides informed starting context for the discussion
- **Standalone**: Quick context gathering for any purpose

## Typical Usage Patterns

```
/soda-brief スキルチェーンの再構成について議論したい
→ (AI investigates, produces Discussion Briefing)
→ /soda-discuss スキルチェーンの再構成
→ (discussion proceeds from informed position)
```

```
/soda-brief 認証フローのリファクタリング
→ (AI surveys auth-related code, frames key questions)
→ /soda-discuss
```
