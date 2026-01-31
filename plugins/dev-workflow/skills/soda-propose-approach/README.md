# soda-propose-approach

## Background

Derived from ~160 occurrences in session history analysis (2025-09 to 2026-01). This pattern frequently appears as the first step in the user's decision-making workflow, preceding `plan-implementation`. The "propose → select → plan" chain is one of the most common multi-turn flows observed.

Key sub-patterns absorbed:
- "どのようなアプローチが考えられるだろうか？提案して" (open-ended exploration)
- "対応のアプローチを提示して。それぞれのトレードオフも含めて教えて" (explicit trade-off request)
- "現状の把握とアプローチの提案をして" (investigate-first variant)
- "トレードオフや実行の障害を整理したうえでアプローチを提案して" (risk-aware variant)

## Purpose

Structured exploration of alternatives before committing to an implementation approach. Prevents jumping into implementation without considering trade-offs. Acts as the decision-support phase in the user's workflow.

The typical flow: user describes a goal → this skill proposes options → user selects one → `/soda-plan-implementation` takes over.

## Design Notes

- **Labeled options (A, B, C...)**: The user frequently selects by label in follow-up messages ("Aで進める", "1 を採用する", "A と D をためそう"). Labels make this selection pattern frictionless.
- **Read-only constraint**: This skill explicitly does not modify code. It exists purely in the investigation/proposal phase. This prevents the common anti-pattern of AI tools starting to implement before the user has decided on an approach.
- **Chaining to plan-implementation**: The output format is designed so the user can naturally follow up with `/soda-plan-implementation` after selecting. This reflects the dominant two-phase flow in the history data.
- **Recommendation included**: When one approach clearly dominates, the skill should say so. The user values opinionated technical guidance, not just neutral enumeration.

## Typical Usage Patterns

```
/soda-propose-approach フロントエンドの UI コンポーネントで park ui に寄せられるものはないだろうか
```

```
/soda-propose-approach HMR の実装方法を検討したい
```

Chained flow:
```
/soda-propose-approach キャッシュ戦略を改善したい
→ (AI proposes A, B, C)
→ User: "Aで進める"
→ /soda-plan-implementation
```

## Future Improvements

- Add a structured comparison table format as a standard output template
- Support "investigate first, then propose" as an explicit two-phase mode for complex problems
- Consider adding a "sparring" mode for design discussions (~53 occurrences of hypothesis-validation patterns)
- Consider integration with document output ("md ファイルに書き出して") for preserving proposals across sessions
