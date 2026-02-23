# soda-plan-lite

## Background

Derived from `soda-plan` to address token consumption concerns. The full `soda-plan` skill provides thorough investigation via sub-agents, multi-step user confirmation gates, design decision review, and conditional plan elements. While valuable for complex tasks, this thoroughness consumes significant tokens for straightforward tasks where the scope is clear and design decisions are minimal.

`soda-plan-lite` retains the core planning structure (investigate, confirm, plan) while removing elements that primarily benefit complex or ambiguous tasks.

## Purpose

Quick planning for straightforward implementation tasks. Produces a self-contained, compact-resilient plan with branch strategy and commit breakdown — the same core output as `soda-plan` — but with fewer interaction rounds and no sub-agent overhead.

The core workflow cycle remains: investigate -> plan -> approve -> implement (with incremental commits).

## Design Notes

- **No sub-agents**: Investigation uses direct Grep/Glob/Read instead of Task tool sub-agents. This eliminates the two-step sub-agent strategy (survey + focused investigation) that `soda-plan` uses, trading depth for speed and token efficiency. When a Proposal Summary exists, both versions do spot-checking only, so the difference is minimal in that case.
- **Merged confirmation gates**: `soda-plan` has three separate AskUserQuestion interactions: Strategy Confirmation, Branch Strategy, and Design Review (plus optional Clarify). `soda-plan-lite` merges Strategy Confirmation and Branch Strategy into a single AskUserQuestion with three options ("この方針で新ブランチ作成" / "この方針で現ブランチ続行" / "方針を調整"). This is the only user interaction in the entire skill, reducing round-trips from 3+ to 1.
- **No design review step**: `soda-plan` explicitly reviews the plan for software design decisions (architecture, API contracts, data models) and presents each to the user for confirmation. `soda-plan-lite` omits this step entirely. If the task involves significant design decisions, the user should use `/soda-plan` instead.
- **Required elements only**: `soda-plan` has both required and conditional elements (technical context per step, design rationale callouts, cross-step shared context, subagent utilization plan). `soda-plan-lite` includes only the required elements: task summary, investigation summary, steps (with commits, file changes, validation, dependencies), and risks. This keeps plan output concise.
- **No clarify step**: Instead of a separate clarification interaction, ambiguities are noted directly in the plan body. This avoids an additional round-trip while still surfacing uncertainties.
- **No subagent criteria**: Since lite plans don't use sub-agents for execution either, the subagent utilization plan and eligibility criteria are omitted entirely.
- **English plan content**: Same rationale as `soda-plan` — plan files are in English for AI interpretability and compaction resilience. User interaction remains in Japanese. See `soda-plan` README for full rationale.
- **Compact-resilience retained**: The Compact-Resilience Guidelines (explicit dependency chains, code over prose, labeled callouts) are kept because plan quality and survivability after context compaction are important regardless of plan complexity.
- **Plan mode enforced**: Same as `soda-plan` — plan mode presentation and user approval before implementation.
- **Research Summary context detection**: When a Research Summary block (from `/soda-research`) is present, the skill uses Key Findings and Code References as investigation context, skipping redundant investigation. Same pattern as `soda-plan` but without the multi-source priority description (lite version doesn't need the complexity).
- **Annotation encouragement**: Rather than the full annotation guidance in `soda-plan` (which identifies specific annotation points), the lite version simply encourages the user to provide corrections for areas of uncertainty. This keeps the single-interaction design while still supporting iterative refinement.
- **Progress tracking**: Same `- [ ]` / `- [x]` convention as `soda-plan`. See `soda-plan` README for full rationale.

## Typical Usage Patterns

Simple feature addition:
```
/soda-plan-lite エラーメッセージにエラーコードを追加する
```

Small refactoring:
```
/soda-plan-lite ユーティリティ関数を共通パッケージに移動する
```

Post-approach-selection for a straightforward approach:
```
A で進める
-> /soda-plan-lite
```

## When to Use `/soda-plan` Instead

- The task involves multiple possible architectural approaches that need comparison
- There are non-obvious design decisions (API contracts, data models, state management) that need explicit user confirmation
- The scope is large (4+ steps) and would benefit from sub-agent investigation and subagent utilization planning
- The codebase is unfamiliar and requires deep investigation
