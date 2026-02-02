# soda-plans-lite

## Background

Derived from `soda-plans` to reduce token consumption. The full `/soda-plans` skill provides a comprehensive plan review experience with detailed summaries, design decision analysis, and interactive follow-up options. However, many use cases only require a quick glance at a plan's core content — its title, what it addresses, and what steps it involves. `soda-plans-lite` was created to serve these lightweight lookup scenarios without the overhead of the full version.

## Purpose

Quick plan lookup for referencing past work. Enables fast retrieval and concise display of plan essentials when a full review is unnecessary — for example, when confirming which plan covers a topic or recalling the implementation steps of a recent plan.

## Design Notes

- **Auto-selection**: Unlike the full version which always presents an interactive selection menu, the lite version auto-selects plans when possible. With `$ARGUMENTS`, the best keyword match is selected automatically. Without arguments, the most recent plan is shown. AskUserQuestion is only used when keyword matches are genuinely ambiguous, limiting interaction to at most 1 gate.
- **3-item summary**: The summary is reduced from 6 sections (タイトル, 概要, 設計判断, 影響範囲, ステップ, リスク) to 3 (タイトル, 概要, ステップ). Design decisions, affected files, and risks are intentionally omitted to keep output compact.
- **No follow-up**: The full version offers interactive follow-up options (deep-dive into decisions, expand steps, ask questions, browse other plans). The lite version ends immediately after showing the summary, eliminating additional interaction rounds and token usage.
- **Shared infrastructure**: Reuses the same `list-plans.ts` script and plan index from the full version. No separate indexing or tooling is needed.

## Typical Usage Patterns

```
/soda-plans-lite
```
Shows a summary of the most recent plan.

```
/soda-plans-lite HMR
```
Auto-selects and summarizes the best plan matching "HMR".

```
/soda-plans-lite 認証
```
Auto-selects and summarizes the best plan matching "認証".

## When to Use the Full Version

Use `/soda-plans` instead when you need:
- Design decision analysis (what was decided and why)
- Impact scope / affected files overview
- Risk assessment
- Interactive follow-up (deep-dive into steps, ask questions about a plan)
- Browsing multiple plans in one session
