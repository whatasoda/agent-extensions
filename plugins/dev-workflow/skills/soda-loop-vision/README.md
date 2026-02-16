# soda-loop-vision

## Background

The original `soda-loop-setup` skill handled everything: vision definition, phase design, and harness file generation. This bundled approach had two problems:

1. **Cognitive overload**: Users had to specify vision, phase count, phase names, and individual items in a single session. The phase definition step was particularly demanding — users needed to decompose their vision into phases and items before the agent could help.
2. **Low-quality vision input**: The free-text vision field produced vague aspirational statements rather than concrete requirements. This made the agent's Discovery Protocol less effective, as it compared codebase state against imprecise descriptions.

Separating vision definition into its own skill addresses both issues by dedicating a full interactive session to producing a high-quality, structured vision document.

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

### Relationship to soda-loop-setup

```
/soda-loop-vision → VISION.md + Vision Blueprint → /soda-loop-setup
```

`soda-loop-setup` consumes the vision in three ways:
1. Vision Blueprint in conversation (same-session, preferred) — uses `**Loop Name**` field
2. Existing VISION.md file in `.agent-loops/<loop-name>/` (cross-session)
3. Inline free-text fallback (standalone use, minimal structure)

The vision skill is recommended but not required — `soda-loop-setup` retains a fallback path for quick, standalone usage.
