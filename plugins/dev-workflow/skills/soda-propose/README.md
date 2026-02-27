# soda-propose

## Background

Derived from ~160 occurrences in session history analysis (2025-09 to 2026-01). This pattern frequently appears as the first step in the user's decision-making workflow, preceding `plan-implementation`. The "propose → select → plan" chain is one of the most common multi-turn flows observed.

Key sub-patterns absorbed:
- "どのようなアプローチが考えられるだろうか？提案して" (open-ended exploration)
- "対応のアプローチを提示して。それぞれのトレードオフも含めて教えて" (explicit trade-off request)
- "現状の把握とアプローチの提案をして" (investigate-first variant)
- "トレードオフや実行の障害を整理したうえでアプローチを提案して" (risk-aware variant)

## Purpose

Structured exploration of alternatives before committing to an implementation approach. Prevents jumping into implementation without considering trade-offs. Acts as the decision-support phase in the user's workflow.

The typical flow: user describes a goal → this skill proposes options → user shortlists candidates → detailed comparison → final selection → `/soda-plan` takes over.

## Design Notes

- **4-phase structure**: The skill is organized into Problem Understanding → Investigation → Initial Proposal → Detailed Comparison. Each phase has an explicit gate condition (user confirmation via AskUserQuestion) before proceeding. This prevents the AI from rushing through phases and ensures the user stays in control of the decision process at each step.

- **Confirmation-based Phase 1**: Rather than asking open-ended questions (which don't fit AskUserQuestion's selection UI), the AI presents its own assessment of scope, priorities, and constraints, then asks the user to confirm or point out what's wrong. This reduces user effort (confirm vs. author from scratch) and makes the selection-based tool natural to use. A re-present loop handles corrections.

- **Sub-agent investigation strategy (Phase 2)**: Investigation uses a two-step sub-agent approach: first a shared-context agent gathers project structure and conventions, then 1-3 focused agents explore specific areas in parallel. The shared-context step avoids redundant exploration across agents and ensures consistent architectural understanding. Step 1 results are explicitly summarized into a Common Context block before being passed to Step 2 agents — this prevents raw output relay and keeps focused agents' prompts concise.

- **Phase 4 delegation with shared Comparison Framework**: Phase 4 previously performed all detailed analysis (implementation outlines, pros/cons, risk assessment, Impact Tracking) in the main context for each shortlisted approach. This was the largest source of main-context token consumption. The restructured Phase 4 launches per-approach sub-agents in parallel, each receiving a shared Comparison Framework that defines evaluation dimensions derived from Phase 1's priority axis. The framework ensures consistent evaluation axes across independent agents, making main-context comparison assembly straightforward. A purpose-specific Approach Analysis output contract (7 sections) replaces the standard investigation contract for this phase. Sub-agents use model: sonnet for cost efficiency — the main context handles synthesis and recommendation, which requires the most reasoning capability.

- **Sub-agent prompt constraints (Phase 2)**: All sub-agent prompts must begin with a behavioral constraint block prohibiting use of AskUserQuestion, EnterPlanMode, and other interactive/planning tools. Explore-type agents have these tools available by default, and without explicit prohibition they may independently trigger user interactions or enter plan mode — causing duplicate behavior where the user sees questions or planning actions from both the main agent and sub-agents simultaneously. A structured output contract (Files, Patterns, Dependencies, Open Questions) further constrains agent autonomy by defining exactly what to return, reducing the agent's inclination to take unscripted actions. This mirrors the same pattern used in `soda-plan`.

- **Impact Tracking**: Every approach is evaluated not just on technical merits but on what it achieves and what it risks losing — especially in terms of end-user experience. This reflects the user's actual decision-making priority: understanding how the application's users will be affected. Impact Outlook (Phase 3, brief) and Impact Tracking (Phase 4, detailed) ensure this perspective is never lost during the technical comparison.

- **Labeled options (A, B, C...)**: The user frequently selects by label in follow-up messages ("Aで進める", "1 を採用する", "A と D をためそう"). Labels make this selection pattern frictionless.

- **Multi-select shortlisting (Phase 3→4)**: Instead of forcing a single selection from brief summaries, the user can shortlist 2-3 candidates for detailed comparison. This matches the observed pattern where users often want to narrow down before committing, and prevents premature decisions based on insufficient information. When only 1 is selected, a condensed deep-dive (affected files, gains/losses) still runs before emitting the Proposal Summary — this ensures plan-implementation always receives sufficient detail regardless of the selection path.

- **Edge case handling**: The skill defines explicit behavior for boundary scenarios: only one viable approach found (explain why others were ruled out), all approaches selected (full comparison), all rejected (return to Phase 1 with options), and ambiguous problems that can't reach Phase 1 consensus (fall back to exploratory investigation). These prevent the AI from stalling or making arbitrary choices when the standard flow doesn't apply.

- **Read-only constraint**: This skill explicitly does not modify code. It exists purely in the investigation/proposal phase. This prevents the common anti-pattern of AI tools starting to implement before the user has decided on an approach.

- **Chaining to plan-implementation**: The Proposal Summary output format is designed so the user can naturally follow up with `/soda-plan` after selecting. The summary includes Expected Impact and Rejected Alternatives so the planning phase inherits the full decision context.

- **Recommendation included**: When one approach clearly dominates, the skill should say so. The user values opinionated technical guidance, not just neutral enumeration.

- **Implementation Hints in Proposal Summary**: An optional section that carries implementation-oriented context (suggested ordering, dependency chains, architectural decisions) into the planning phase. This bridges the gap between approach-level reasoning and implementation-level planning, reducing information loss in the handoff. Kept optional so compact summaries remain possible.

- **Scope Boundary in Proposal Summary**: An optional section that explicitly defines what is in scope and what is deferred. This prevents the planning phase from expanding beyond what the selected approach intended to cover.

- **Research Summary context detection (Phase 2)**: When a Research Summary block (from `/soda-research`) is present in the conversation, its Key Findings and Architecture & Dependencies are used as the Common Context block, skipping the survey sub-agent (Step 1) entirely. Open Questions from the Research Summary guide focused agent prompts in Step 2. This enables a three-skill chain: `/soda-research` → Research Summary → `/soda-propose` → Proposal Summary → `/soda-plan`. Domain Knowledge entries from user annotations in the Research Summary are treated as authoritative constraints.

## Typical Usage Patterns

```
/soda-propose フロントエンドの UI コンポーネントで park ui に寄せられるものはないだろうか
```

```
/soda-propose HMR の実装方法を検討したい
```

Chained flow:
```
/soda-propose キャッシュ戦略を改善したい
→ (AI restates problem, confirms understanding)
→ (AI investigates via sub-agents)
→ (AI proposes A, B, C with Impact Outlook)
→ User: "A と C を詳しく比較して"
→ (AI provides detailed comparison with Impact Tracking)
→ User: "Aで進める"
→ (AI emits Proposal Summary)
→ /soda-plan
```

With prior research:
```
/soda-research GraphQL スキーマの構造を調べて
→ (AI investigates, user annotates, Research Summary emitted)
→ /soda-propose 複数スキーマ対応のアプローチ
→ (AI skips survey agent, uses Research Summary as Common Context)
→ (AI proposes approaches, user selects)
→ /soda-plan
```

## Future Improvements

- Consider adding a "sparring" mode for design discussions (~53 occurrences of hypothesis-validation patterns)
- Consider integration with document output ("md ファイルに書き出して") for preserving proposals across sessions
