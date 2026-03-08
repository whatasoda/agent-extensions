# soda-discuss

## Background

This skill formalizes an interactive design discussion pattern observed across multiple sessions. When designing new features or skills, the user follows a characteristic approach:

1. Start with a vague idea or aspiration
2. Explore the codebase and past sessions for evidence
3. Share findings and discuss implications collaboratively
4. Let the direction emerge through dialogue rather than predetermining it
5. Produce a summary when the shape of the solution becomes clear

This pattern was implicit — embedded in how the user naturally works — and needed to be captured without losing its flexibility.

## Purpose

Provide a value-based framework for open-ended design discussions. Unlike procedural skills (soda-plan, soda-propose), this skill deliberately avoids prescribing a fixed workflow. Instead, it defines the principles that make these discussions effective.

## Design Rationale

### Values Over Procedures

Existing skills in the dev-workflow plugin are procedural: they define numbered steps, sub-agent contracts, output formats, and confirmation gates. This works well for tasks with known structure (planning, reviewing, proposing).

Design discussions are different. The conversation's shape depends on the topic, the user's current understanding, and what investigation reveals. Forcing a fixed flow would undermine the skill's purpose. Instead, the SKILL.md defines:

- **Core Values**: Principles that guide behavior (understand before committing, ground in reality, separate concerns, preserve flexibility, feedback shapes direction)
- **Guidelines**: Flexible suggestions, not mandatory steps
- **Anti-patterns**: What to avoid, providing boundaries without constraining the flow

### Discussion Summary as Session Artifact

The Discussion Summary is intentionally designed as a **session artifact** rather than a downstream-chaining block. Reasons:

- Existing chaining blocks (Research Summary, Proposal Summary) have strict format contracts because downstream skills parse them programmatically
- Discussion outcomes are inherently less structured — the value is in captured insights and emerging direction, not in parseable fields
- Adding auto-detection to downstream skills would couple them to this skill's format, which may evolve as usage patterns become clearer

This can be revisited once real usage patterns stabilize.

## Skill Chain Position

```
soda-research → soda-discuss → soda-propose → soda-plan
```

- **After soda-research**: When research revealed interesting findings but the direction isn't clear yet
- **Before soda-propose**: When the discussion has identified possible approaches worth comparing
- **Before soda-plan**: When the discussion has converged enough to plan directly (skipping propose)
- **Standalone**: When exploring a new idea from scratch

## Typical Usage Scenarios

- Designing a new skill when the user has a vague idea but no concrete requirements
- Exploring how to formalize an observed workflow pattern
- Discussing architectural decisions where multiple concerns intersect
- Brainstorming how existing patterns could be extended or combined
