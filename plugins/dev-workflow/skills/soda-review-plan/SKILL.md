---
name: soda-review-plan
description: Browse and review implementation plans from other Claude Code sessions.
user-invocable: true
argument-hint: [plan title or keyword]
allowed-tools: Bash(bun *), Read, Grep, Glob
---

Browse and review implementation plans indexed from `~/.claude/plans/`.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Plan Index

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-review-plan/scripts/list-plans.ts`

The above JSON provides `plans` (array of `{slug, title, fileModified, filePath}`) sorted by most recent first, and `totalCount`.

## Procedure

1. **List Plans**: If `$ARGUMENTS` is provided, filter plans by keyword match against titles. Otherwise, show the 10 most recent plans as a numbered list with title and date. If there are more plans, mention the total count.

2. **Select Plan**: Use AskUserQuestion with plan titles as options (up to 4 from the filtered/recent list). If the user needs a plan not shown, they can provide a keyword in the "Other" option.

3. **Read and Summarize**: Read the selected plan file using the Read tool. Present a structured summary:
   - **タイトル**: Plan title and creation date
   - **概要**: Problem statement and approach (from the plan's overview/problem section)
   - **影響範囲**: Key files and areas affected
   - **ステップ**: Commit breakdown / implementation steps (condensed)
   - **リスク**: Risks and mitigation if present

4. **Follow-up**: Use AskUserQuestion:
   - "このプランについて質問する" — answer questions about plan details
   - "別のプランを見る" — return to step 1
   - "終了" — end the skill

## Constraints

- This skill is read-only. Do NOT modify any files.
- Do NOT implement or execute any part of the plan.
- Focus on providing a clear, concise summary that captures the essential information.
