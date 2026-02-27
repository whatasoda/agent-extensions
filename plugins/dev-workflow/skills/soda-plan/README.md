# soda-plan

## Background

Derived from ~530+ occurrences in session history analysis (2025-09 to 2026-01). This is the single most frequent instruction pattern. The user's planning instruction evolved over time and converged into a standardized template by January 2026:

> 詳細な実装計画をたてて。新しいブランチで作業し、適宜コミットしながら進める計画にすること。計画には実装に必要な情報を適切な粒度で含めること。

Key sub-patterns absorbed:
- "新しいブランチで作業し、適宜コミットしながら進める計画にすること" (~304 occurrences)
- "コミットの分割も定義すること" (~48 occurrences)
- "計画には実装に必要な情報を適切な粒度で含めること" (established Jan 2026)
- "A で進める詳細な実装計画を立てて" (post-`propose-approach` selection flow)

## Purpose

Eliminates the need to repeatedly type the full planning instruction template. Encodes the "plan first, then execute" workflow that dominates the user's work style across all projects.

The core workflow cycle is: investigate → plan → approve → implement (with incremental commits) → review → PR.

## Design Notes

- **Plan mode enforced**: The skill requires plan mode presentation and user approval before any implementation begins. This reflects the user's consistent "計画 → 承認 → 実行" pattern.
- **Self-contained plans**: Plans must include enough technical detail (type definitions, API contracts, etc.) that implementation can proceed from the plan alone. This was added to the user's template after experiencing plans that were too high-level.
- **Commit strategy always included**: Every plan defines commit granularity because the user consistently requests it. "適宜コミット" is the most frequent constraint across all projects (~304 occurrences).
- **New branch by default**: Almost all implementation work starts on a new branch. The user specifies the base branch only when deviating from the current branch.
- **Structured investigation with sub-agents**: In standalone mode (no Proposal Summary), the skill uses a two-step sub-agent strategy — first surveying project structure and conventions, then optionally launching focused agents for specific areas. This mirrors `soda-propose`'s Phase 2 in a lighter form (max 2 focused agents vs 3). When a Proposal Summary exists, sub-agent investigation is skipped in favor of verification and gap-filling. All sub-agent prompts must include a behavioral constraint block prohibiting use of AskUserQuestion, EnterPlanMode, and other interactive tools — Explore-type agents have these tools available, so without explicit prohibition they may independently trigger user interactions or plan mode, causing duplicate behavior. Additionally, sub-agent prompts require a structured output contract (Files, Patterns, Dependencies, Open Questions) to constrain agent autonomy — defining exactly what to return reduces the agent's inclination to take unscripted actions like asking the user for clarification.
- **Verification delegation**: When a Proposal Summary exists, spot-checking (verifying referenced files still exist and patterns haven't changed) is delegated to a sub-agent with model: haiku. This is the simplest form of sub-agent delegation — a focused verification task that returns structured discrepancy reports. The Verification output contract (Verified/Discrepancies/Current State) is purpose-specific, replacing the standard investigation contract for this narrow task. Using haiku minimizes cost for what is essentially a file-existence and diff-detection task.
- **Technical Pre-Gathering for M/L tasks**: Before entering plan mode for M/L tasks, sub-agents (model: sonnet) pre-gather per-area technical details using the Step Detail Template (File State/Type Signatures/API Contracts/Test Patterns/Validation Approaches). This moves technical context gathering out of the main context's plan-writing phase, where it previously consumed significant tokens. The pre-gathered details are incorporated directly into plan steps as structured data (code over prose), aligning with the Compact-Resilience Guidelines. When a Proposal Summary exists, its Affected Areas guide the pre-gathering scope.
- **Element checklist over fixed template**: The plan section lists required and conditional elements without prescribing a format. This ensures Claude Code's plan mode improvements (formatting, layout, interactive features) are transparently adopted. The previous explicit template (Investigation Summary → Steps → Risks) was replaced because it prevented the model from choosing the best presentation for a given task and created a maintenance burden when plan mode capabilities changed. Required elements (task summary, investigation summary, steps with commits/changes/dependencies/validation, risks) ensure consistent quality; conditional elements (technical context, design rationale, cross-step shared context) scale with task complexity.
- **Compact-resilient plan content**: Plans prioritize structured data (code snippets, type signatures, explicit dependency chains, labeled callouts) over prose. This ensures critical technical context survives context compaction. Guidance is embedded inline in the element checklist rather than as a separate section, so it is encountered at the point of authoring each element.
- **Subagent utilization criteria**: Plans with 4+ steps include a subagent utilization plan. Steps are classified as subagent-eligible or main-context based on three criteria: self-containment, no cross-step file conflicts, and isolated verifiability. This prevents subagent misuse on steps that require runtime feedback or shared-file coordination.
- **Task scale classification**: Plans now classify tasks as S (Small), M (Medium), or L (Large) based on step count, dependency complexity, and file scope. Scale S omits subagent planning entirely (overhead exceeds benefit). Scale M includes per-step subagent annotations (existing behavior, previously triggered at 4+ steps). Scale L adds task group splitting — grouping subagent-eligible steps into named parallel execution groups with explicit execution order. The classification criteria use "first matching category" to avoid ambiguity. The L threshold uses an OR condition (7+ steps OR 4+ with 2+ independent subtrees) because dependency graph shape matters more than raw step count for parallelization benefit.
- **Approach escalation**: When investigation reveals multiple fundamentally different approaches, the skill directs the user to `/soda-propose` instead of attempting approach comparison. This maintains a clear separation of concerns between the two skills.
- **Merged confirmation gates**: Strategy Confirmation and Branch Strategy are merged into a single AskUserQuestion interaction (modeled after `soda-plan-lite`). The original design had them as separate steps, but sequential AskUserQuestion calls for closely related decisions created unnecessary round-trips and contributed to the perception of duplicate questioning. The merged step uses context-dependent options: when a Proposal Summary exists, approach re-selection is omitted (already decided); when absent, a "/soda-propose" escalation option is included.
- **English plan content**: Plan content written to plan mode files uses English for two reasons: (1) AI agents consuming the plan (during implementation or via `soda-plans`) interpret structured English more accurately than Japanese prose, and (2) English technical content survives context compaction better, complementing the Compact-Resilience Guidelines. User-facing interaction (AskUserQuestion, confirmation messages) remains in Japanese to maintain natural conversation flow. The `soda-plans` skill handles the bridge by summarizing English plans in Japanese.
- **Design decisions as plan callouts**: When the plan involves software design decisions (architecture, patterns, libraries, data models, API contracts), each decision is presented as a labeled callout in the plan body rather than as a separate AskUserQuestion interaction. The user reviews and confirms all design decisions when approving the plan via ExitPlanMode. This replaces the previous Design Review step that used individual AskUserQuestion per decision — which was the largest source of interaction explosion. The callout format ensures decisions are visually distinct and scannable within the plan.
- **Plan annotation guidance**: After writing the plan, the skill identifies annotation points — areas where domain knowledge would improve quality (business logic, unverified assumptions, context-dependent risks). This is inspired by Boris Tane's workflow of iterating 1-6 times through inline corrections before implementation. Plan mode already supports revision mechanically (user can reject and request changes); the annotation guidance makes multi-round refinement a first-class, expected part of the workflow rather than an exception. User-provided corrections are preserved as `**User Context**` labeled callouts for compaction resilience.
- **Implementation progress tracking**: Plan steps use `- [ ]` / `- [x]` checkbox markers. During implementation, completed steps are marked `- [x]` after their commit succeeds. This convention is inspired by Boris Tane's practice of marking progress in plan documents and mirrors the `soda-loop` PROGRESS.md state model in a lightweight form. No tooling is required — it's a convention enforced by the skill instruction.
- **Research Summary context detection**: When a Research Summary block (from `/soda-research`) is present in the conversation, the skill uses it as supplementary investigation context — extracting key findings, architecture insights, and code references to skip survey-level sub-agent work. This enables a three-skill chain: `/soda-research` → Research Summary → `/soda-plan`. When both a Proposal Summary and Research Summary are present, the Proposal Summary takes precedence for approach selection while the Research Summary provides deeper codebase understanding. Domain Knowledge entries from user annotations in the Research Summary are treated as authoritative.

## Typical Usage Patterns

```
/soda-plan HMR / live reload を考慮した設計に移行したい
```

```
/soda-plan soda-gql の複数GraphQLスキーマ対応を実装する
```

Post-approach-selection:
```
A で進める
→ /soda-plan
```

## Future Improvements

- Auto-detect project-specific conventions (branch naming patterns, commit message style)
- Consider adding AUTOPILOT mode integration for long-running implementation sessions
- Analyze compaction behavior empirically to refine compact-resilience guidance
