# soda-plan-implementation

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
- **Structured investigation with sub-agents**: In standalone mode (no Proposal Summary), the skill uses a two-step sub-agent strategy — first surveying project structure and conventions, then optionally launching focused agents for specific areas. This mirrors `soda-propose-approach`'s Phase 2 in a lighter form (max 2 focused agents vs 3). When a Proposal Summary exists, sub-agent investigation is skipped in favor of verification and gap-filling.
- **Explicit plan template**: The output structure (Investigation Summary → Steps with commits and technical context → Risks & Mitigation) is defined in the skill to make "self-contained" concrete and ensure consistent plan quality regardless of the task.
- **Approach escalation**: When investigation reveals multiple fundamentally different approaches, the skill directs the user to `/soda-propose-approach` instead of attempting approach comparison. This maintains a clear separation of concerns between the two skills.

## Typical Usage Patterns

```
/soda-plan-implementation HMR / live reload を考慮した設計に移行したい
```

```
/soda-plan-implementation soda-gql の複数GraphQLスキーマ対応を実装する
```

Post-approach-selection:
```
A で進める
→ /soda-plan-implementation
```

## Future Improvements

- Auto-detect project-specific conventions (branch naming patterns, commit message style)
- Support "this session" mode where the plan skips branch creation and works on the current branch
- Consider adding AUTOPILOT mode integration for long-running implementation sessions
