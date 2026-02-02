# soda-review-lite

## Background

Derived from `soda-review` to reduce token consumption for routine pre-PR checks. The full `soda-review` skill provides a thorough 4-perspective review with interactive next steps, but many review sessions only need a quick sanity check before opening a PR. This lite variant strips the review down to the essentials while reusing the same base-branch detection infrastructure.

## Purpose

Quick pre-PR sanity check. Catches the most impactful issues (functional bugs and completeness gaps) with minimal token usage and zero user interaction gates. Designed for fast, non-interactive execution.

## Design Notes

- **2 perspectives only**: The full version reviews from 4 perspectives (functional correctness, completeness, code quality, potential issues). The lite version keeps only functional correctness and completeness -- the two most likely to catch real bugs. Code quality and potential issues (performance, security) are deferred to the full version.
- **Top 5 findings cap**: Limits output to the 5 highest-severity findings to keep the report concise and actionable. The full version reports all findings.
- **No overview step**: The full version summarizes changed files before reviewing. The lite version skips this to reduce output length and token usage.
- **No interactive next steps**: The full version uses AskUserQuestion after the report to offer follow-up actions (e.g., create a fix plan). The lite version ends immediately after the report.
- **Zero interaction gates (no AskUserQuestion)**: AskUserQuestion is intentionally excluded from allowed-tools. This means the skill cannot prompt the user at any point -- not for error recovery (e.g., specifying a different base branch), not for next steps. On error or empty diff, the skill outputs a message and terminates. This design ensures the skill runs to completion in a single pass with no blocking prompts.
- **Report-only constraint**: Same as the full version -- the review must not modify code.
- **Shared infrastructure**: Reuses `detect-base-branch.ts` from the full `soda-review` skill directory. No duplicated scripts.

## Typical Usage Patterns

```
/soda-review-lite
```

```
/soda-review-lite origin/develop からの差分を対象に
```

```
/soda-review-lite 370c8b726a から最新のコミットまで
```

## When to Use the Full Version

Use `/soda-review` instead when:
- You want a thorough review covering code quality and potential issues (performance, security)
- You need interactive error recovery (e.g., specifying a different base branch on failure)
- You want guided next steps after the review (e.g., creating a fix plan)
- The branch contains large or architecturally significant changes
