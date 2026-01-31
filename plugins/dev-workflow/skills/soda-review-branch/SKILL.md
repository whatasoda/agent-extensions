---
name: soda-review-branch
description: Review changes on the current branch and report issues, improvements, and gaps.
user_invocable: true
---

Perform a comprehensive code review of the changes on the current branch.

## Procedure

1. **Identify the diff**: Determine the merge-base with the default branch (or a user-specified base) and retrieve the diff.
2. **Overview**: Get a summary of changed files and the overall scope of changes.
3. **Review**: Examine changes from the following perspectives:
   - Functional correctness (logic bugs, missed edge cases)
   - Completeness (TODOs, unimplemented parts, missing tests)
   - Code quality (naming, structure, duplication)
   - Potential issues (performance, security)
4. **Report**: Present findings ordered by severity.

## Constraints

- Report findings only. Do NOT modify any code.
- If a fix is needed, suggest a concrete improvement but do not apply it.

## Argument Handling

If the user provides text after `/soda-review-branch`, treat it as the review focus or base specification.
Example: `/soda-review-branch diff from origin/develop`
