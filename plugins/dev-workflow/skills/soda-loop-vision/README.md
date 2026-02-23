# soda-loop-vision

## Background

The original `soda-loop-setup` skill handled everything: vision definition, phase design, and harness file generation. This bundled approach had two problems:

1. **Cognitive overload**: Users had to specify vision, phase count, phase names, and individual items in a single session. The phase definition step was particularly demanding — users needed to decompose their vision into phases and items before the agent could help.
2. **Low-quality vision input**: The free-text vision field produced vague aspirational statements rather than concrete requirements. This made the agent's Discovery Protocol less effective, as it compared codebase state against imprecise descriptions.
3. **Shallow requirements capture**: The direct path from free-text description to goal decomposition meant the agent operated on potentially ambiguous or incomplete input. Ambiguous terms, unstated motivations, and implicit assumptions flowed directly into goals, producing goals that were technically verifiable but did not capture what the user actually intended.
4. **Context loss at output**: Even after adding Requirements Discovery, the output template only captured Purpose, Goals, Constraints, and Out of Scope. Rich context gathered during discovery — problem background, technical landscape, ambiguity resolutions — was discarded. Subsequent autonomous agents working from VISION.md alone lacked the context needed for high-quality Discovery Protocol execution and decision-making.

Separating vision definition into its own skill addresses these issues by dedicating a full interactive session to producing a high-quality, structured vision document. The skill includes an interactive requirements discovery phase that clarifies ambiguities and surfaces implicit assumptions before goal decomposition. The output format captures this discovery context through Background, Technical Context, and Key Decisions sections alongside the core Goals, ensuring downstream agents have sufficient context for autonomous operation.

## Purpose

`soda-loop-vision` produces VISION.md — a structured list of verifiable goals that serves as the intermediate artifact between a high-level vision and a concrete implementation plan.

The output format balances simplicity with context preservation. The core structure remains a flat list of verifiable goals with optional constraints and exclusions, supplemented by three contextual sections (Background, Technical Context, Key Decisions) that capture discovery insights. This format:
- Is easy for users to review and modify
- Provides enough structure for `soda-loop-setup` to derive phases automatically
- Avoids premature structuring (functional areas, dependency graphs) that the user may not have enough context to validate
- Preserves discovery context for autonomous agents using the Discovery Protocol in VISION.md

## Design Notes

### Goal-list format

The core design choice is a flat goal list rather than a hierarchical structure (e.g., functional areas with sub-requirements). Rationale:

- **User cognitive load**: Users can evaluate a flat list of 3-10 goals much more easily than a multi-level hierarchy. Each goal stands alone and can be judged independently.
- **Phase derivation flexibility**: `soda-loop-setup` can group goals into phases using its own analysis. A pre-imposed hierarchy would constrain the agent's grouping options.
- **Verifiability**: Each goal has an explicit pass/fail condition. This is harder to maintain in a hierarchical structure where parent-child relationships create ambiguity about what constitutes "done."

### Handoff mechanism

Uses the same pattern as `soda-propose` → `soda-plan`:

- **Conversation-based**: A Vision Blueprint block is emitted after file generation. `soda-loop-setup` detects this block by heading pattern (`## Vision Blueprint`) and extracts project name, loop name, goals, constraints, out-of-scope items, and contextual sections (background, technical context, key decisions). This enables same-session chaining.
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

### Contextual sections (Background, Technical Context, Key Decisions)

Three informational sections supplement the core goal list, placed between Purpose and Goals in VISION.md. These sections are the primary mechanism for preserving Requirements Discovery output that does not fit into goals, constraints, or exclusions.

Design choices:
- **Prose for Background, bullets for Technical Context and Key Decisions**: Background captures narrative context (problem statement, motivation) that reads better as paragraphs. Technical Context and Key Decisions are reference material that benefits from scannable bullet format.
- **Placed before Goals, not after**: Readers (both human and autonomous agents) build understanding progressively. Context before goals means the goals are read with full understanding of why they exist and what technical landscape they operate in.
- **All three are optional**: Simple projects with clear scope may produce only Purpose and Goals. The omission rules prevent empty boilerplate sections.
- **Key Decisions use "X not Y because Z" format**: This captures the decision boundary, not just the choice. When an autonomous agent encounters an ambiguity during implementation, it can check Key Decisions to see if the ambiguity was already resolved.
- **Additive and non-breaking**: No existing consumer parses these sections. `soda-loop-setup` reads only `## Goals`. `soda-loop-status` reads only `## Purpose` and `## Goals`. The Discovery Protocol reads VISION.md holistically and benefits from richer content without any code changes.

### Codebase investigation in requirements discovery

Step 2 optionally invokes sub-agent investigation to ground the requirements dialogue in actual codebase state. This addresses a gap where VISION.md goals could be well-formed in isolation but disconnected from the existing code structure.

Key design choices:
- **Optional, not mandatory**: Investigation is offered at the checkpoint alongside continue/proceed options. Simple projects with clear scope may not need it. The user decides when (or whether) to investigate.
- **Single sub-agent per invocation**: Unlike soda-research's multi-round survey+focused pattern, vision investigation uses a single agent per invocation. The investigation scope is narrow (informed by the current dialogue state), so a survey step is unnecessary. The user can invoke investigation multiple times across different checkpoint rounds if needed.
- **Findings feed discovery, not output directly**: Investigation findings enrich the requirements dialogue context rather than appearing as a separate section in VISION.md. They influence goals, constraints, and the Technical Context section indirectly through the continued dialogue.
- **Sub-agent constraints identical to soda-research**: The constraint block and output contract are the same as soda-research, soda-propose, and soda-plan. This maintains consistency and predictable sub-agent behavior across all skills.

### Reference Implementation pattern

The "参考実装を指定する" option allows the user to point at existing code as a model for the project. This is common in practice — "build X similar to how Y works." The reference analysis informs goal verifiability (e.g., "behaves like feature Y") and helps the agent understand conventions the user expects to follow.

### Relationship to soda-loop-setup

```
/soda-loop-vision → VISION.md + Vision Blueprint → /soda-loop-setup
```

`soda-loop-setup` consumes the vision in three ways:
1. Vision Blueprint in conversation (same-session, preferred) — uses `**Loop Name**` field
2. Existing VISION.md file in `.agent-loops/<loop-name>/` (cross-session)
3. Inline free-text fallback (standalone use, minimal structure)

The vision skill is recommended but not required — `soda-loop-setup` retains a fallback path for quick, standalone usage.
