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

The typical flow: user describes a goal → this skill proposes options → user shortlists candidates → detailed comparison → final selection → `/soda-plan-implementation` takes over.

## Design Notes

- **4-phase structure**: The skill is organized into Problem Understanding → Investigation → Initial Proposal → Detailed Comparison. Each phase has an explicit gate condition (user confirmation via AskUserQuestion) before proceeding. This prevents the AI from rushing through phases and ensures the user stays in control of the decision process at each step.

- **Problem understanding gate (Phase 1)**: The AI must restate the problem and get user confirmation before investigating. This prevents wasted investigation effort on a misunderstood problem — a frequent failure mode when the AI jumps straight into codebase exploration.

- **Sub-agent investigation strategy (Phase 2)**: Investigation uses a two-step sub-agent approach: first a shared-context agent gathers project structure and conventions, then 1-3 focused agents explore specific areas in parallel. The shared-context step avoids redundant exploration across agents and ensures consistent architectural understanding.

- **Impact Tracking**: Every approach is evaluated not just on technical merits but on what it achieves and what it risks losing — especially in terms of end-user experience. This reflects the user's actual decision-making priority: understanding how the application's users will be affected. Impact Outlook (Phase 3, brief) and Impact Tracking (Phase 4, detailed) ensure this perspective is never lost during the technical comparison.

- **Labeled options (A, B, C...)**: The user frequently selects by label in follow-up messages ("Aで進める", "1 を採用する", "A と D をためそう"). Labels make this selection pattern frictionless.

- **Multi-select shortlisting (Phase 3→4)**: Instead of forcing a single selection from brief summaries, the user can shortlist 2-3 candidates for detailed comparison. This matches the observed pattern where users often want to narrow down before committing, and prevents premature decisions based on insufficient information.

- **Read-only constraint**: This skill explicitly does not modify code. It exists purely in the investigation/proposal phase. This prevents the common anti-pattern of AI tools starting to implement before the user has decided on an approach.

- **Chaining to plan-implementation**: The Proposal Summary output format is designed so the user can naturally follow up with `/soda-plan-implementation` after selecting. The summary includes Expected Impact and Rejected Alternatives so the planning phase inherits the full decision context.

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
→ (AI restates problem, confirms understanding)
→ (AI investigates via sub-agents)
→ (AI proposes A, B, C with Impact Outlook)
→ User: "A と C を詳しく比較して"
→ (AI provides detailed comparison with Impact Tracking)
→ User: "Aで進める"
→ (AI emits Proposal Summary)
→ /soda-plan-implementation
```

## Future Improvements

- Consider adding a "sparring" mode for design discussions (~53 occurrences of hypothesis-validation patterns)
- Consider integration with document output ("md ファイルに書き出して") for preserving proposals across sessions
