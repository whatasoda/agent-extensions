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

### Three-Layer Principle Architecture

The SKILL.md organizes guidance into three complementary layers:

- **Core Values**: Principles governing **what** to think about during the discussion (understand before committing, ground in reality, preserve flexibility, feedback shapes direction). These are philosophical guardrails that apply throughout.
- **Interaction Principles**: Principles governing **how** to conduct the dialogue (one topic at a time, options with evidence and recommendation, data before decisions, deferred judgment as signal, dependency-ordered topics). These ensure consistent interaction quality regardless of topic. Each includes a concrete anti-pattern.
- **Guidelines**: Flexible suggestions for the overall flow, not mandatory steps.

This separation emerged from observing that Core Values alone were too abstract to ensure consistent interaction quality. Sessions that went well shared specific interaction patterns (structured options with tradeoffs, one decision at a time, recommendations) that were not captured by values like "understand before committing." The Interaction Principles layer codifies these patterns without making the skill procedural.

### Values Over Procedures

Existing skills in the dev-workflow plugin are procedural: they define numbered steps, sub-agent contracts, output formats, and confirmation gates. This works well for tasks with known structure (planning, reviewing, proposing).

Design discussions are different. The conversation's shape depends on the topic, the user's current understanding, and what investigation reveals. Forcing a fixed flow would undermine the skill's purpose.

### Interaction Principles: Evidence and Origin

The five Interaction Principles were extracted from analysis of actual high-quality discussion sessions:

- **一度に一つ、承認を待つ**: Users explicitly requested this pattern ("present one at a time, wait for OK") in multiple sessions. When followed, user responses shortened to 1-3 words, indicating reduced cognitive load.
- **選択肢には根拠と推奨を添える**: Comparison tables with tradeoffs and recommendations consistently enabled fast decision-making. Recommendations reduce evaluation burden without limiting decision authority.
- **データが先、判断が後**: Investigation data sometimes overturned initial assumptions, making data-first presentation essential to avoid wasted decisions.
- **判断の保留は深掘りのシグナル**: When users deferred a premature question, effective sessions responded with deeper analysis rather than rephrasing. Deferral signals information gap, not indecision.
- **議題は依存順に並べる**: Multi-topic discussions that followed dependency order progressed without backtracking. Those that didn't required revisiting earlier decisions.

### Discussion Summary as Session Artifact

The Discussion Summary is intentionally designed as a **session artifact** rather than a downstream-chaining block. Reasons:

- Existing chaining blocks (Research Summary, Proposal Summary) have strict format contracts because downstream skills parse them programmatically
- Discussion outcomes are inherently less structured — the value is in captured insights and emerging direction, not in parseable fields
- Adding auto-detection to downstream skills would couple them to this skill's format, which may evolve as usage patterns become clearer

This can be revisited once real usage patterns stabilize.

### Skill Boundaries (formerly Anti-patterns)

The bottom section of SKILL.md defines skill boundaries — what this skill is NOT for. This complements Interaction Principle anti-patterns (which define how NOT to interact) with scope anti-patterns (which define what NOT to produce). The separation keeps each concern focused.

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
