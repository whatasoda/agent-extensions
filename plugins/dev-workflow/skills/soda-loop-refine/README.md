# soda-loop-refine

## Background

The loop workflow (vision → setup → execute → status) had a gap: no structured way to refine artifacts after initial creation. Users could manually edit VISION.md or PROGRESS.md, but this bypassed the interactive discovery and verification that made initial creation robust. Three scenarios highlighted this gap:

1. **Pre-setup refinement**: After creating VISION.md with `/soda-loop-vision`, the user realizes goals need adjustment before generating the harness. Re-running `/soda-loop-vision` from scratch discards the existing work.
2. **Mid-loop course correction**: During autonomous execution, the agent discovers new requirements or encounters blockers. The user checks status with `/soda-loop-status` and wants to adjust vision or progress without stopping and restarting the entire workflow.
3. **Post-review adjustment**: After reviewing loop results, the user wants to modify goals or constraints for the next iteration.

## Purpose

Iterative refinement of existing loop artifacts (VISION.md and PROGRESS.md) through an annotation cycle adapted for CLI context. Bridges the gap between creation (`/soda-loop-vision`) and execution, and enables course correction during and after loop runs.

## Design Notes

### Annotation cycle adaptation for CLI

The annotation cycle draws from Boris Tane's Claude Code workflow (iterative plan annotation) and soda-research's annotation cycle (Step 4), but adapts both for file modification rather than knowledge building:

- **Section numbering**: VISION.md sections are numbered for reference, enabling "modify [5.2]" style interaction. This replaces GUI inline annotation with CLI-friendly section addressing.
- **Diff-style preview**: Changes are presented as before/after pairs, not as a full document re-render. This reduces cognitive load when reviewing modifications.
- **Cherry-pick acceptance**: Users can accept all proposed changes or select specific ones by number. This is the CLI equivalent of accepting/rejecting individual inline annotations.
- **External edit support**: Users can edit VISION.md in their editor and reload. This respects the user's preferred editing tool rather than forcing all edits through the skill.

### Limited PROGRESS.md scope

PROGRESS.md modifications are intentionally limited to additive changes and status updates. Structural changes (adding/removing phases, restructuring boundaries) require re-running `/soda-loop-setup` because:

- Phase structure depends on the full goal set and their dependency analysis
- AGENT_PROMPT.md references phase structure (file scope, commit format)
- Partial restructuring risks inconsistency between PROGRESS.md and AGENT_PROMPT.md

### soda-loop-status context detection

When the user invokes `/soda-loop-refine` after `/soda-loop-status`, the skill detects status output in the conversation and uses it as supplementary context. This enables the natural flow: check status → identify issues → refine. The detection is loose (heading pattern matching for "ループステータス") rather than structured block detection, since soda-loop-status does not emit a formal handoff block.

### Codebase investigation reuse

The investigation sub-procedure reuses the same sub-agent constraint block and output contract as soda-research, soda-plan, soda-propose, and soda-loop-vision. For soda-loop-refine, investigation prompts additionally include PROGRESS.md context (completed items, blocked items) so the agent investigates with awareness of what has already been accomplished.

### Conflict detection

Before writing files, the skill checks if artifacts have changed externally (e.g., by a concurrent loop session modifying PROGRESS.md). This is especially important for mid-loop refinement where the autonomous agent may be writing to PROGRESS.md at the same time. The skill re-reads the file and compares to the initial state, offering overwrite/reload/cancel options on conflict.

### Relationship to other loop skills

```
/soda-loop-vision → VISION.md → /soda-loop-refine → refined VISION.md
                                        ↕
/soda-loop-setup → PROGRESS.md → /soda-loop-refine → refined PROGRESS.md
                                        ↓
                               Vision Blueprint → /soda-loop-setup (regenerate)
```

The skill emits a Vision Blueprint for same-session handoff to `/soda-loop-setup`, enabling the "refine vision then regenerate harness" workflow.

The skill also composes with `/soda-loop-status` for mid-loop use: the user checks status, identifies issues, then invokes `/soda-loop-refine` to address them. Status dashboard context is detected automatically.
