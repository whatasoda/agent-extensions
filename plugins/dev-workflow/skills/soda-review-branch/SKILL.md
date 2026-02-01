---
name: soda-review-branch
description: Review changes on the current branch and report issues, improvements, and gaps.
user-invocable: true
argument-hint: [focus or base branch]
allowed-tools: Bash(git *), Read, Grep, Glob
---

Perform a comprehensive code review of the changes on the current branch.

## Current Branch Context

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-review-branch/scripts/detect-base-branch.ts`

The above JSON provides `baseBranch`, `mergeBase`, `changedFiles`, `potentialConflicts`, and ready-to-use `commands.diff` / `commands.log`.

If $ARGUMENTS is not empty, treat it as the review focus or an alternative base branch specification. When an alternative base is specified, re-compute the diff using that base instead of the detected one.

## Procedure

1. **Identify the diff**: Use the pre-fetched branch context JSON above. Run `commands.diff` to get the full diff. If $ARGUMENTS specifies a different base, re-compute the merge-base and diff accordingly. If the JSON contains an `error` field, present the error to the user and use AskUserQuestion: "Specify a different base branch" / "Cancel review".
2. **Overview**: Summarize the changed files and the overall scope of changes.
3. **Review**: Examine changes from the following perspectives:
   - Functional correctness (logic bugs, missed edge cases)
   - Completeness (TODOs, unimplemented parts, missing tests)
   - Code quality (naming, structure, duplication)
   - Potential issues (performance, security)
4. **Report**: Present findings ordered by severity.
5. **Next Steps**: After presenting the report, use AskUserQuestion to ask the user what to do next:
   - "Create a plan to fix the issues" (suggest `/soda-plan-implementation`)
   - "Note these for later"

## Constraints

- Report findings only. Do NOT modify any code.
- If a fix is needed, suggest a concrete improvement but do not apply it.
