---
name: soda-review-lite
description: Review branch changes for correctness and gaps
user-invocable: true
argument-hint: [focus or base branch]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Perform a lightweight code review of the changes on the current branch.

For comprehensive review with 4 perspectives and interactive next steps, use `/soda-review`.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Current Branch Context

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-review/scripts/detect-base-branch.ts`

The above JSON provides `baseBranch`, `mergeBase`, `changedFiles`, `potentialConflicts`, and ready-to-use `commands.diff` / `commands.log`.

If $ARGUMENTS is not empty, treat it as the review focus or an alternative base branch specification. When an alternative base is specified, re-compute the diff using that base instead of the detected one.

## Procedure

1. **Identify the diff**: Use the pre-fetched branch context JSON above. Run `commands.diff` to get the full diff. If $ARGUMENTS specifies a different base, re-compute the merge-base and diff accordingly. If the JSON contains an `error` field or the diff is empty (no changes between merge-base and HEAD), output the error or inform the user there are no changes, then END immediately.
2. **Review**: Examine changes from the following 2 perspectives:
   - Functional correctness (logic bugs, missed edge cases)
   - Completeness (TODOs, unimplemented parts, missing tests)
3. **Report**: Present the top 5 findings ordered by severity. If there are fewer than 5 findings, present all of them.

## Constraints

- Report findings only. Do NOT modify any code.
- If a fix is needed, suggest a concrete improvement but do not apply it.
