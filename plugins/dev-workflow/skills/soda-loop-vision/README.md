# soda-loop-vision

## Background

The original `soda-loop-setup` skill handled everything: vision definition, phase design, and harness file generation. This bundled approach had two problems:

1. **Cognitive overload**: Users had to specify vision, phase count, phase names, and individual items in a single session. The phase definition step was particularly demanding — users needed to decompose their vision into phases and items before the agent could help.
2. **Low-quality vision input**: The free-text vision field produced vague aspirational statements rather than concrete requirements. This made the agent's Discovery Protocol less effective, as it compared codebase state against imprecise descriptions.
3. **Shallow requirements capture**: The direct path from free-text description to goal decomposition meant the agent operated on potentially ambiguous or incomplete input. Ambiguous terms, unstated motivations, and implicit assumptions flowed directly into goals, producing goals that were technically verifiable but did not capture what the user actually intended.

Separating vision definition into its own skill addresses these issues by dedicating a full interactive session to producing a high-quality, structured vision document. The skill now includes an interactive requirements discovery phase that clarifies ambiguities and surfaces implicit assumptions before goal decomposition, improving the quality and relevance of the resulting goals.

## Purpose

`soda-loop-vision` produces VISION.md — a structured list of verifiable goals that serves as the intermediate artifact between a high-level vision and a concrete implementation plan.

The output format is intentionally simple: a flat list of verifiable goals with optional constraints and exclusions. This format:
- Is easy for users to review and modify
- Provides enough structure for `soda-loop-setup` to derive phases automatically
- Avoids premature structuring (functional areas, dependency graphs) that the user may not have enough context to validate

## Design Notes

### Goal-list format

The core design choice is a flat goal list rather than a hierarchical structure (e.g., functional areas with sub-requirements). Rationale:

- **User cognitive load**: Users can evaluate a flat list of 3-10 goals much more easily than a multi-level hierarchy. Each goal stands alone and can be judged independently.
- **Phase derivation flexibility**: `soda-loop-setup` can group goals into phases using its own analysis. A pre-imposed hierarchy would constrain the agent's grouping options.
- **Verifiability**: Each goal has an explicit pass/fail condition. This is harder to maintain in a hierarchical structure where parent-child relationships create ambiguity about what constitutes "done."

### Handoff mechanism

Uses the same pattern as `soda-propose` → `soda-plan`:

- **Conversation-based**: A Vision Blueprint block is emitted after file generation. `soda-loop-setup` detects this block by heading pattern (`## Vision Blueprint`) and extracts project name, loop name, and goals. This enables same-session chaining.
- **File-based**: VISION.md persists across sessions at `.agent-loops/<loop-name>/VISION.md`. `soda-loop-setup` can scan `.agent-loops/` for existing loops when no Vision Blueprint exists in the conversation. This enables cross-session workflows.

### Branch strategy

At the draft review step, the user can choose to create a new branch (`loop/<loop-name>`) before VISION.md is generated. This follows the same pattern as `soda-plan`'s strategy confirmation step. The branch is created before any files are written, so the entire loop project (vision → setup → execution) lives on a dedicated branch.

### Requirements discovery phase

The Requirements Discovery step (Step 2) is inserted between project context setup and goal decomposition. This follows the same "understand before decompose" principle used in `soda-propose`'s Phase 1 (Problem Understanding), adapted for vision definition rather than approach comparison.

Key design choices:
- **2-4 questions per round** (not all at once): Prevents cognitive overload and allows answers to inform subsequent questions. This mirrors real requirements elicitation where each answer can reveal new questions.
- **Flexible depth**: The agent offers a checkpoint after each round rather than enforcing a fixed number of rounds. Short descriptions with clear scope may need only one round; complex multi-stakeholder projects may need three or four.
- **Categories as guidance, not checklist**: The six question categories (motivation, scope, ambiguity, technical context, success criteria, assumptions) guide the agent's analysis but are not presented as a form to fill out. The agent selects the most relevant categories per round.
- **Constraint pre-population**: Constraints discovered during the dialogue carry forward to Step 4, reducing redundant questioning.

### Goal deep-dive

The deep-dive mechanism in Step 3 allows the user to examine individual goals after the initial decomposition. This addresses a gap where goals could be technically verifiable but miss important edge cases or have acceptance criteria that do not match user intent. The deep-dive is a sub-loop within the existing confirm-or-adjust loop, so it composes naturally with add/remove/granularity adjustments.

### Relationship to soda-loop-setup

```
/soda-loop-vision → VISION.md + Vision Blueprint → /soda-loop-setup
```

`soda-loop-setup` consumes the vision in three ways:
1. Vision Blueprint in conversation (same-session, preferred) — uses `**Loop Name**` field
2. Existing VISION.md file in `.agent-loops/<loop-name>/` (cross-session)
3. Inline free-text fallback (standalone use, minimal structure)

The vision skill is recommended but not required — `soda-loop-setup` retains a fallback path for quick, standalone usage.
