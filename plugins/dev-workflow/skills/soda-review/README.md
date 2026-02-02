# soda-review

## Background

Derived from ~190 occurrences in session history analysis (2025-09 to 2026-01). Branch review requests are the third most frequent pattern, typically appearing before PR creation. There is also overlap with the `check-completeness` pattern (~45 occurrences) which focuses on gaps and TODOs.

Key sub-patterns absorbed:
- "このブランチでの変更をレビューして" (default: current branch vs default branch)
- "origin/develop からの merge-base を起点としたこのブランチの変更についてレビューして" (explicit base)
- "e6b2699b より最近のコミットでの変更についてレビューして" (commit hash base)
- "全体を通して機能的に失われたものがないか詳細にレビュー・確認して" (focus on regressions)

## Purpose

Pre-PR quality gate. Catches functional issues, completeness gaps, and code quality problems before changes leave the branch. This is intentionally a basic foundation — the skill covers the core review workflow without attempting to be comprehensive.

## Design Notes

- **Basic foundation**: This is an intentionally minimal first version. The skill covers the standard review flow but does not yet include project-specific checklists or structured output formats.
- **Report-only constraint**: The review must not modify code. This prevents the common pattern where a review turns into an unsolicited refactoring session. The user decides what to fix after seeing the report.
- **Flexible base specification**: The base reference varies significantly across usage (merge-base with default branch, specific commit hashes, named branches). The argument handling is kept flexible to support all these patterns.
- **Severity ordering**: Findings are reported by severity to help the user prioritize, especially in large diffs.

## Typical Usage Patterns

```
/soda-review
```

```
/soda-review origin/develop からの差分を対象に
```

```
/soda-review 370c8b726a から最新のコミットまで
```

## Future Improvements

- Add configurable review checklists per project (e.g., dinii-self-all has different concerns than soda-gql)
- Integrate `check-completeness` patterns: "やり残しはある？", "対応漏れはないか" (~45 occurrences)
- Add structured output format for tracking review findings across iterations
- Consider a "regression focus" mode for large refactoring branches
- Consider integration with `create-pr` for a seamless review → PR flow
