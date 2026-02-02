# soda-plans

## Background

Claude Code stores implementation plans in `~/.claude/plans/` as markdown files with randomly generated names (e.g., `abstract-finding-corbato.md`). These plans are created during plan mode sessions but have no built-in mechanism for cross-session discovery or review. This skill addresses the need to browse and understand plans created in other sessions.

## Purpose

Cross-session plan discovery and review. Enables a user (or another Claude Code session) to find, read, and understand plans that were created elsewhere without needing to know the exact file paths.

## Design Notes

- **Index-based discovery**: Relies on `plan-index.json` created by the `plan-tracker` PostToolUse hook. The index is project-scoped (stored per project in `~/.claude/projects/`) but indexes all plans globally since plan files have no project association metadata.
- **Read-only constraint**: Like `soda-review`, this skill must not modify anything. Its purpose is to present information, not to act on it.
- **Summarization focus**: Plans can be long and detailed. The skill extracts and presents the essential structure (problem, approach, files, steps, risks) in a condensed form suitable for quick review.
- **Keyword filtering**: The `$ARGUMENTS` parameter allows filtering by title keyword, which helps when the plan list is large.

## Typical Usage Patterns

```
/soda-plans
```

```
/soda-plans HMR
```

```
/soda-plans 認証
```

## Future Improvements

- Add project association heuristics (match file paths in plans to current project)
- Support plan status tracking (planned / in progress / completed / abandoned)
- Add plan diffing (compare two versions of a plan)
- Integration with `/soda-plan` for plan refinement workflow
- Consider filtering by date range or branch name
