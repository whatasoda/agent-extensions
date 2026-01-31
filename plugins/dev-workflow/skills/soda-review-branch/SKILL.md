---
name: soda-review-branch
description: Review changes on the current branch and report issues, improvements, and gaps.
user-invocable: true
argument-hint: [focus or base branch]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Perform a comprehensive code review of the changes on the current branch.

## Current Branch Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Diff stat: !`git diff --stat $(git merge-base HEAD main)..HEAD 2>/dev/null || echo "(no merge-base with main)"`
- Commits: !`git log --oneline $(git merge-base HEAD main)..HEAD 2>/dev/null || echo "(no commits beyond main)"`

If $ARGUMENTS is not empty, treat it as the review focus or an alternative base branch specification. When an alternative base is specified, re-fetch the diff using that base instead of the default.

## Procedure

1. **Identify the diff**: Use the pre-fetched context above as the starting point. If $ARGUMENTS specifies a different base, re-fetch the diff accordingly.
2. **Overview**: Summarize the changed files and the overall scope of changes.
3. **Review**: Examine changes from the following perspectives:
   - Functional correctness (logic bugs, missed edge cases)
   - Completeness (TODOs, unimplemented parts, missing tests)
   - Code quality (naming, structure, duplication)
   - Potential issues (performance, security)
4. **Report**: Present findings ordered by severity.

## Constraints

- Report findings only. Do NOT modify any code.
- If a fix is needed, suggest a concrete improvement but do not apply it.
