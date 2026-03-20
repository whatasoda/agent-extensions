# soda-plan

## Background

Derived from ~530+ occurrences in session history analysis (2025-09 to 2026-01). This is the single most frequent instruction pattern. The user's planning instruction evolved over time and converged into a standardized template by January 2026:

> 詳細な実装計画をたてて。新しいブランチで作業し、適宜コミットしながら進める計画にすること。計画には実装に必要な情報を適切な粒度で含めること。

Key sub-patterns absorbed:
- "新しいブランチで作業し、適宜コミットしながら進める計画にすること" (~304 occurrences)
- "コミットの分割も定義すること" (~48 occurrences)
- "計画には実装に必要な情報を適切な粒度で含めること" (established Jan 2026)
- "A で進める詳細な実装計画を立てて" (post-discussion selection flow)

## Purpose

Eliminates the need to repeatedly type the full planning instruction template. Encodes the "plan first, then execute" workflow that dominates the user's work style across all projects.

The core workflow cycle is: investigate → plan → approve → implement (with incremental commits) → review → PR.

## Design Notes

- **Plan mode enforced**: The skill requires plan mode presentation and user approval before any implementation begins. This reflects the user's consistent "計画 → 承認 → 実行" pattern.
- **Self-contained plans**: Plans must include enough technical detail (type definitions, API contracts, etc.) that implementation can proceed from the plan alone. This was added to the user's template after experiencing plans that were too high-level.
- **Commit strategy always included**: Every plan defines commit granularity because the user consistently requests it. "適宜コミット" is the most frequent constraint across all projects (~304 occurrences).
- **New branch by default**: Almost all implementation work starts on a new branch. The user specifies the base branch only when deviating from the current branch.
- **Structured investigation with sub-agents**: The skill uses a two-step sub-agent strategy — first surveying project structure and conventions, then optionally launching focused agents for specific areas (max 2 focused agents). All sub-agent prompts must include a behavioral constraint block prohibiting use of AskUserQuestion, EnterPlanMode, and other interactive tools — Explore-type agents have these tools available, so without explicit prohibition they may independently trigger user interactions or plan mode, causing duplicate behavior. Additionally, sub-agent prompts require a structured output contract (Files, Patterns, Dependencies, Open Questions) to constrain agent autonomy — defining exactly what to return reduces the agent's inclination to take unscripted actions like asking the user for clarification.
- **Technical Pre-Gathering for M/L tasks**: Before entering plan mode for M/L tasks, sub-agents (model: sonnet) pre-gather per-area technical details using the Step Detail Template (File State/Type Signatures/API Contracts/Test Patterns/Validation Approaches). This moves technical context gathering out of the main context's plan-writing phase, where it previously consumed significant tokens. The pre-gathered details are incorporated directly into plan steps as structured data (code over prose), aligning with the Compact-Resilience Guidelines.
- **Element checklist over fixed template**: The plan section lists required and conditional elements without prescribing a format. This ensures Claude Code's plan mode improvements (formatting, layout, interactive features) are transparently adopted. The previous explicit template (Investigation Summary → Steps → Risks) was replaced because it prevented the model from choosing the best presentation for a given task and created a maintenance burden when plan mode capabilities changed. Required elements (task summary, investigation summary, steps with commits/changes/dependencies/validation, risks) ensure consistent quality; conditional elements (technical context, design rationale, cross-step shared context) scale with task complexity.
- **Compact-resilient plan content**: Plans prioritize structured data (code snippets, type signatures, explicit dependency chains, labeled callouts) over prose. This ensures critical technical context survives context compaction. Guidance is embedded inline in the element checklist rather than as a separate section, so it is encountered at the point of authoring each element.
- **Subagent utilization criteria**: Plans with 4+ steps include a subagent utilization plan. Steps are classified as subagent-eligible or main-context based on three criteria: self-containment, no cross-step file conflicts, and isolated verifiability. This prevents subagent misuse on steps that require runtime feedback or shared-file coordination.
- **Task scale classification**: Plans now classify tasks as S (Small), M (Medium), or L (Large) based on step count, dependency complexity, and file scope. Scale S omits subagent planning entirely (overhead exceeds benefit). Scale M includes per-step subagent annotations (existing behavior, previously triggered at 4+ steps). Scale L adds task group splitting — grouping subagent-eligible steps into named parallel execution groups with explicit execution order. The classification criteria use "first matching category" to avoid ambiguity. The L threshold uses an OR condition (7+ steps OR 4+ with 2+ independent subtrees) because dependency graph shape matters more than raw step count for parallelization benefit.
- **Approach escalation**: When investigation reveals multiple fundamentally different approaches, the skill pauses and asks the user to clarify direction instead of attempting approach comparison. Approach-level analysis should be resolved in `/soda-discuss` before invoking soda-plan.
- **No direction confirmation gate**: The original design included an Investigation Digest (structured summary with scale estimation, findings, and anticipated design decisions) and a direction confirmation step between investigation and planning. This was removed because the summarization step acted as a context compression point — forcing the agent to distill its understanding into a rigid format before plan composition, which risked losing nuanced decision-making context built up during investigation. The ExitPlanMode approval already serves as the user's confirmation gate, and design decisions are surfaced as labeled callouts in the plan itself. Branch Strategy remains as the only pre-planning confirmation.
- **Approach escalation preserved**: When investigation reveals multiple fundamentally different approaches, the skill still pauses to ask the user. This safety valve is independent of the removed direction confirmation gate.
- **English plan content**: Plan content written to plan mode files uses English for two reasons: (1) AI agents consuming the plan during implementation interpret structured English more accurately than Japanese prose, and (2) English technical content survives context compaction better, complementing the Compact-Resilience Guidelines. User-facing interaction (AskUserQuestion, confirmation messages) remains in Japanese to maintain natural conversation flow.
- **Design decisions as plan callouts**: When the plan involves software design decisions (architecture, patterns, libraries, data models, API contracts), each decision is presented as a labeled callout in the plan body. Decisions are discussed individually during the Plan Discussion Phase rather than batch-confirmed at ExitPlanMode. This replaces the previous Design Review step that used individual AskUserQuestion per decision — which was the largest source of interaction explosion. The callout format ensures decisions are visually distinct and scannable within the plan.
- **Plan Discussion Phase**: After writing the plan, the skill extracts discussion items — review points (domain knowledge gaps) and design decisions — and discusses each one-at-a-time within plan mode before ExitPlanMode. This unifies the previous Plan Annotation Guidance and design decision confirmation into a single interactive flow. The merge is motivated by three observations: (1) both share the same confirmation pattern (present context → wait for user input → reflect in plan), (2) review points frequently spawn design decisions during discussion, (3) separate flows add ordering complexity without benefit. The one-at-a-time interaction style follows soda-discuss's Interaction Principles (referenced by name, not duplicated) to avoid soda-plan bloat and ensure principles evolve in one place. The iterative refinement concept is inspired by Boris Tane's workflow of iterating 1-6 times through inline corrections before implementation. User-provided corrections are preserved as `**User Context**` labeled callouts for compaction resilience.
- **Implementation progress tracking**: Plan steps use `- [ ]` / `- [x]` checkbox markers. During implementation, completed steps are marked `- [x]` after their commit succeeds. This convention is inspired by Boris Tane's practice of marking progress in plan documents and mirrors the `soda-loop` PROGRESS.md state model in a lightweight form. No tooling is required — it's a convention enforced by the skill instruction.
- **Conversation context over formal detection**: soda-plan reads direction, scope, and prior findings from the conversation context directly rather than detecting formal summary blocks. This assumes soda-plan is invoked after discussion has settled (typically after `/soda-discuss`). When prior research or discussion artifacts are in the conversation, they naturally inform the investigation and planning phases.

## Typical Usage Patterns

```
/soda-plan HMR / live reload を考慮した設計に移行したい
```

```
/soda-plan soda-gql の複数GraphQLスキーマ対応を実装する
```

## Future Improvements

- Auto-detect project-specific conventions (branch naming patterns, commit message style)
- Consider adding AUTOPILOT mode integration for long-running implementation sessions
- Analyze compaction behavior empirically to refine compact-resilience guidance
