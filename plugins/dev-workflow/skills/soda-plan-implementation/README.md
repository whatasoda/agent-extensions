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

- Integrate with `soda-propose-approach` for a seamless propose → select → plan flow
- Auto-detect project-specific conventions (branch naming patterns, commit message style)
- Support "this session" mode where the plan skips branch creation and works on the current branch
- Consider adding AUTOPILOT mode integration for long-running implementation sessions
