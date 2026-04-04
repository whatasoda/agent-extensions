export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `
Review current branch changes using codex-review (findings mode), classify issues by severity, and apply fixes with appropriate user decision gates.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

${ctx.commandDocs(["review"])}

## Phase 1: Collect Changes

1. Run \`sd review detect-base-branch\` and use the \`baseBranch\` and \`mergeBase\` from its JSON output. If the script fails, default to \`main\`. If the JSON contains an \`error\` field, present the error to the user and use AskUserQuestion: "ベースブランチを指定する" / "中止". If the user specifies a base branch, re-compute the diff using that base. If the user cancels, stop.
2. Run \`git diff <base>...HEAD\` to collect the current branch's changes.
3. If the diff is empty, inform the user and stop.
4. Present a brief summary to the user:
   > **変更概要**
   > - 変更ファイル数: N
   > - 追加行数: +X / 削除行数: -Y

## Phase 2: Review via codex-review

Invoke codex-review in findings mode:

\`\`\`
Task(subagent_type: soda:codex-review)
\`\`\`

Prompt:

\`\`\`
## Codex Review Request
- **Mode**: findings
- **Instruction**: "Review these code changes. For each issue found, output in the following structured format:

ISSUE
Severity: Critical | High | Medium | Low
Summary: <one-line description>
File: <file path>
Location: <line range or function name>
Fix Strategy: <description of the suggested fix>
Alternative: <alternative fix strategy, if applicable — omit if only one clear approach>
---

Focus on correctness, security, performance, and maintainability. Do not report style-only issues."

### Content
<git diff output>
\`\`\`

If the codex-review sub-agent returns Status: "Skipped", inform the user that review is unavailable and stop.

## Phase 3: Classify Issues

Parse the codex-review output from the Issues section. For each issue, classify into one of three categories:

- **Auto-fix**: Severity is Critical or High, AND the issue has a single clear fix strategy (no Alternative field, or Alternative is trivially equivalent)
- **User-confirm**: Severity is Critical or High, AND one of:
  - Multiple meaningfully different fix strategies exist (Alternative field present and distinct)
  - The fix necessity itself is debatable (e.g., trade-off between correctness and performance)
- **Skip**: Severity is Medium or Low

**Fallback rule**: If the codex output cannot be parsed into the structured format above, treat ALL issues as User-confirm. Do NOT auto-fix unparseable findings.

## Phase 4: Present Summary

Present the classification summary to the user:

> **レビュー結果**
> - 自動修正: N件 (Critical/High, 修正方針が明確)
> - 確認待ち: M件 (Critical/High, 複数の選択肢あり)
> - スキップ: K件 (Medium/Low, 報告のみ)
>
> **スキップ対象の指摘** (Medium/Low):
> - [issue summary] (file) — Severity
> - ...

Use AskUserQuestion with the following options:
- "すべて進める" — Apply auto-fixes, then proceed to user-confirm issues one by one
- "自動修正のみ先に適用" — Apply auto-fixes only, skip user-confirm issues
- "すべて個別に確認" — Treat all issues (including auto-fix) as user-confirm
- "中止" — Stop without making any changes

If the user selects "中止", stop immediately.

If the user selects "すべて進める", proceed to Phase 5, then Phase 6 for any remaining User-confirm issues.

If the user selects "自動修正のみ先に適用", proceed to Phase 5, then skip Phase 6 and go directly to Phase 7.

If the user selects "すべて個別に確認", reclassify all Auto-fix issues as User-confirm and proceed to Phase 6 (skip Phase 5).

## Phase 5: Apply Auto-fixes

For each Auto-fix issue (in file order to minimize conflicts):

1. Read the target file.
2. Apply the fix using the Edit tool.
3. Commit with a descriptive message: \`fix(<scope>): <issue summary>\`

If an edit fails (e.g., the target code has changed), skip the issue and add it to the User-confirm list with a note explaining the failure.

After all auto-fixes are applied, follow the routing selected in Phase 4 (Phase 6 for "すべて進める", or Phase 7 for "自動修正のみ先に適用").

## Phase 6: User Decision Gates

For each User-confirm issue, present the issue details and use AskUserQuestion:

> **指摘内容**: [issue summary]
> **重要度**: [severity]
> **ファイル**: [file path] ([location])
> **詳細**: [full issue description from codex output]

Options:
- Each available fix strategy as a separate option (2-4 options max), with a brief description of the trade-off
- "修正しない（スキップ）" — Skip this issue

If the user selects a fix strategy:
1. Read the target file.
2. Apply the selected fix using the Edit tool.
3. Commit: \`fix(<scope>): <issue summary>\`

If the user selects "修正しない（スキップ）", move to the next issue.

## Phase 7: Summary Report

Present the final summary:

> **修正結果**
> - 自動修正: N件 適用済み
> - ユーザー確認修正: M件 (適用: X, スキップ: Y)
> - 未対応 (Medium/Low): K件

Use AskUserQuestion:
- "再レビューを実行" — Run codex-review (findings mode, fresh session) on the updated diff to verify fixes and check for new issues. If new issues are found, restart from Phase 3 with the new results.
- "完了" — End the skill execution.

## Constraints

- This skill modifies code. Use Edit tool for precise changes, not Write tool for full file rewrites.
- Each fix must be committed individually for easy revert.
- Never auto-fix issues that cannot be parsed from the codex output (fallback rule).
- All user-facing text must be in Japanese.
`;
}
