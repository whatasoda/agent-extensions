# soda-propose-lite

## Background

Derived from `soda-propose` to address cases where the full skill's multi-phase, sub-agent-driven workflow consumes more tokens and time than the decision warrants. In practice, many approach-selection tasks involve straightforward trade-offs that do not require parallel sub-agent investigation or a dedicated detailed comparison phase. This lightweight variant preserves the core "propose then select" structure while cutting the overhead.

## Purpose

Quick structured exploration of alternatives for simpler decisions. Prevents jumping into implementation without considering trade-offs, while keeping token consumption low and turnaround fast.

The typical flow: user describes a goal, this skill proposes 2-3 options with trade-offs, user selects one, Proposal Summary is emitted for `/soda-plan`.

## Design Notes

- **No confirmation gate in Phase 1**: The full version asks the user to confirm the problem restatement before investigation. The lite version skips this gate entirely — it restates the problem in one sentence and proceeds immediately. This eliminates one round-trip of AskUserQuestion, which is the main latency and token cost in the full version's Phase 1. The trade-off is that misunderstandings are caught later (at proposal selection) rather than earlier.

- **No sub-agents (Task tool)**: The full version uses a two-step sub-agent strategy (Common Context + Focused Investigation) in Phase 2. The lite version performs all investigation directly using Grep, Glob, and Read in a single pass. This avoids the overhead of spawning and summarizing sub-agent results, but limits investigation depth — the agent cannot explore multiple angles in parallel.

- **Single-pass investigation**: Instead of the full version's Common Context step followed by focused agents, the lite version does one round of codebase exploration. This is sufficient for problems where the relevant code areas are already known or easily discoverable.

- **Fewer approaches (2-3 vs 2-4)**: The lite version caps proposals at 3 to keep the selection simple and reduce the output volume. For problems that genuinely have 4+ viable approaches, the full version is more appropriate.

- **Simplified Impact Outlook**: Each approach includes Gains and Losses only. The full version's UX Delta is dropped because it adds detail that is more valuable in the detailed comparison phase (which the lite version does not have).

- **No Phase 4 (Detailed Comparison)**: The full version has a dedicated phase for side-by-side comparison of shortlisted approaches with pros/cons tables, risk assessment, and Impact Tracking. The lite version goes straight from approach selection to Proposal Summary. This is the largest token saving but means the user decides based on the brief Phase 3 summaries alone.

- **No multi-select shortlisting**: The full version allows the user to shortlist multiple approaches for detailed comparison. The lite version asks for a single final selection, since there is no detailed comparison phase to feed into.

- **Compact Proposal Summary**: The lite version's summary includes only the required fields: Problem, Selected, Key Findings, Affected Areas, Expected Impact, and Risks. The full version's optional sections (Implementation Hints, Scope Boundary, Rejected Alternatives, Not Compared) are dropped to keep the output concise. The summary target is under 30 lines (vs 50 in the full version).

- **Single AskUserQuestion**: The entire skill uses AskUserQuestion exactly once — at the approach selection step in Phase 3. This minimizes interaction overhead while still keeping the user in control of the final decision.

- **Read-only constraint**: Same as the full version. This skill does not modify code.

## Typical Usage Patterns

```
/soda-propose-lite この関数のリファクタリング方法を検討したい
```

```
/soda-propose-lite テストのカバレッジ改善のアプローチを提案して
```

Chained flow:
```
/soda-propose-lite エラーハンドリングの統一方法を検討したい
-> (AI restates problem, investigates directly)
-> (AI proposes A, B, C with Impact Outlook)
-> User selects "A"
-> (AI emits Proposal Summary)
-> /soda-plan
```

## When to Use the Full Version

Use `/soda-propose` instead when:
- The problem is ambiguous and needs scope clarification before investigation
- Multiple areas of the codebase need parallel exploration
- You want a detailed side-by-side comparison of shortlisted approaches
- The decision has high impact and warrants thorough analysis
- More than 3 viable approaches are expected
