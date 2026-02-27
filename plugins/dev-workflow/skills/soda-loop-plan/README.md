# soda-loop-plan

## Background

The soda-loop system currently has a two-step workflow: `soda-loop-vision` creates VISION.md with high-level goals, then `soda-loop-setup` directly derives PROGRESS.md task breakdowns from those goals via pure LLM reasoning — with no intermediate investigation. This quality gap means PROGRESS.md items can be vague or miss important implementation details that sub-agent investigation would catch. Adding a plan layer allows users to create per-area investigated plans that setup then consumes to generate higher-quality PROGRESS.md phases.

## Purpose

`soda-loop-plan` produces PLAN-*.md files — investigated implementation plans per area that bridge vision goals and PROGRESS.md phases. Each plan covers a subset of VISION.md goals and provides detailed steps with file references, acceptance criteria, and validation commands. The 1:1 plan-to-phase mapping means each plan becomes exactly one phase in PROGRESS.md, and each plan's steps become the items within that phase.

## Design Notes

### 1:1 plan-to-phase mapping

PLAN-01 becomes Phase 1, PLAN-02 becomes Phase 2. Each plan's steps become items N.1, N.2, etc. within its corresponding phase.

- **Simple, predictable mapping**: No complex merge logic is needed. The user knows exactly which plan produced which phase.
- **Numeric prefixes determine phase ordering**: PLAN-01 before PLAN-02. Non-contiguous prefixes are handled gracefully (e.g., if PLAN-02 is deleted, PLAN-01 and PLAN-03 still map to Phase 1 and Phase 2 in order).
- **Cross-plan dependencies expressed via ordering**: Step `Deps` may only reference titles within the same plan. Dependencies between plans are expressed implicitly through phase ordering (numeric prefixes), avoiding the complexity of cross-plan dependency resolution.

### Schema alignment with PROGRESS.md

Plan steps mirror PROGRESS.md item fields: Description, Files, Acceptance, Validation, Deps. This makes plan-to-PROGRESS.md conversion mechanical rather than requiring LLM interpretation — setup can map fields directly without inferring intent.

- **Step title uniqueness constraint**: Step titles must be unique within a plan file. This enables unambiguous Deps remapping to item IDs during conversion (e.g., a step titled "Add validation" can be referenced by other steps' Deps fields without ambiguity).
- **Goal Ref field**: Each step references the goal it serves, maintaining traceability from PROGRESS.md items back through plan steps to vision goals.

### Source-of-truth hierarchy

VISION.md defines what to build (goals), PLAN-*.md defines how to build it (investigated steps), PROGRESS.md tracks execution (status, completion).

- **Plans are read-only from setup's perspective**: `soda-loop-setup` derives phases from plans but does not modify them. Plans remain stable reference artifacts.
- **Goal ID is text-based**: Goals are identified by checkbox text (`- [ ] Implement X` has Goal ID `Implement X`). This is fragile but consistent with existing goal parsing throughout the soda-loop system.

### Investigation reuse

The investigation step uses the same sub-agent constraint block and output contract as `soda-loop-vision`, `soda-research`, `soda-plan`, and `soda-propose`. This maintains consistent and predictable sub-agent behavior across all skills.

- **Findings synthesized into Context section**: Investigation output (files, patterns, dependencies, open questions) is synthesized into the plan's `## Context` section and informs step composition.
- **1-2 sub-agents per plan**: A single agent handles 1-2 goals. For 3+ goals covering distinct areas, two agents divide the goal assignments. This keeps investigation scope focused while allowing parallel exploration of unrelated areas.

### Codex review

Plan content is reviewed before writing via external codex review. The review focuses on step completeness, dependency correctness, and acceptance criteria verifiability — flagging only critical problems.

- **Fresh sessions for re-reviews**: Re-reviews after revision use a fresh codex session (not `resume --last`) to avoid session drift where prior context biases the reviewer toward accepting marginal fixes.
- **Graceful degradation**: If the codex command fails, the skill skips review with a warning and continues. Review is valuable but not a hard gate.

### Plan Blueprint handoff

Uses the same conversation-based handoff pattern as Vision Blueprint in `soda-loop-vision`:

- **Conversation-based**: A Plan Blueprint block is emitted after file generation. `soda-loop-setup` detects this block by heading pattern (`## Plan Blueprint`) and extracts plan file path, covered goals, steps, and risks. This enables same-session chaining: `/soda-loop-plan` followed by `/soda-loop-setup`.
- **File-based**: PLAN-*.md files persist at `.agent-loops/<loop-name>/PLAN-*.md`. `soda-loop-setup` can scan for existing plans when no Plan Blueprint exists in the conversation, enabling cross-session workflows.

### Goal ID convention

Goals are identified by checkbox text: `- [ ] Implement X` has Goal ID `Implement X`. Text-based matching is fragile but consistent with existing goal parsing in `soda-loop-setup`. Setup's stale detection handles mismatches gracefully — it warns about unrecognized goal references rather than hard-failing, so renamed goals do not break the workflow.

### Numeric prefix assignment

New plans get `max(existing prefixes) + 1`, zero-padded to 2 digits. If no existing plans exist, the first plan starts at `01`.

- **Non-contiguous prefixes are allowed**: If PLAN-02 is deleted, the next plan is PLAN-03, not PLAN-02. This preserves phase ordering stability — existing plan-to-phase mappings are not disrupted by deletions.
- **Zero-padding to 2 digits**: Supports up to 99 plans per loop, which is far beyond practical usage. The fixed-width prefix ensures consistent alphabetical sorting.

### Staleness model

Plans can become stale when VISION.md goals change after plan creation.

- **`soda-loop-setup` detects stale plans**: Plans referencing non-existent goals (goals that were removed or renamed in VISION.md) trigger a warning during setup. Setup continues but flags the mismatch.
- **No auto-invalidation**: The system does not automatically delete or regenerate stale plans. The user decides whether to regenerate, update, or ignore the staleness. This avoids destructive automation on artifacts that may have required significant investigation effort.

### No EnterPlanMode

Same design choice as `soda-loop-vision`: this is an interactive dialogue skill, not an implementation task. The skill writes plan files directly through its own procedure rather than entering plan mode. EnterPlanMode is explicitly prohibited in the skill constraints to prevent accidental mode switching.

## Relationship to other loop skills

```
/soda-loop-vision → VISION.md → /soda-loop-plan → PLAN-*.md → /soda-loop-setup → PROGRESS.md
                                       ↑                              ↓
                              (optional layer)               (consumes plans for phases)
```

- The plan layer is optional: small tasks can skip `/soda-loop-plan` and go directly from vision to setup
- Setup detects existing plans and uses them for phase derivation instead of pure LLM reasoning
