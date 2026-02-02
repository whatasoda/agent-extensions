---
name: soda-plans
description: Browse and review implementation plans from other Claude Code sessions.
user-invocable: true
argument-hint: [plan title or keyword]
allowed-tools: Bash(bun *), Read, Grep, Glob, AskUserQuestion
---

Browse and review implementation plans indexed from `~/.claude/plans/`.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Plan Index

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-plans/scripts/list-plans.ts`

The above JSON provides `plans` (array of `{slug, title, fileModified, filePath, stepCount?, hasDesignDecisions?}`) sorted by most recent first, and `totalCount`. The `stepCount` and `hasDesignDecisions` fields are optional — older index entries may lack them.

## Procedure

1. **List Plans**: If the plan index JSON contains a `message` field or `plans` is empty, inform the user that no plans were found for this project and suggest running `/soda-plan` to create one. End the skill. Otherwise, if `$ARGUMENTS` is provided, filter plans by keyword match against titles. Otherwise, show the 10 most recent plans as a numbered list with title and date. When `stepCount` or `hasDesignDecisions` are available, append metadata tags after the date (e.g., `[3ステップ | 設計判断あり]` or `[5ステップ]`). Omit tags for entries without metadata. If there are more plans, mention the total count.

2. **Select Plan**: Use AskUserQuestion with plan titles as options (up to 4 from the filtered/recent list). If the user needs a plan not shown, they can provide a keyword in the "Other" option.

3. **Read and Summarize**: Read the selected plan file using the Read tool. Present a structured summary:
   - **タイトル**: Plan title and creation date
   - **概要**: Problem statement and approach (from the plan's overview/problem section)
   - **設計判断**: Key design decisions found in the plan. Look for "Why:" labels, architectural choices, pattern/library selections, and sections titled 方針/設計判断/Design/アーキテクチャ. Present each decision as: what was decided and why. If alternatives were mentioned, note what was rejected. If no explicit design decisions are found, state "明示的な設計判断の記載なし".
   - **影響範囲**: Key files and areas affected
   - **ステップ**: Commit breakdown / implementation steps (condensed)
   - **リスク**: Risks and mitigation if present

4. **Follow-up**: Use AskUserQuestion with up to 4 of the following options, selected based on the plan's content. Always include "別のプランを見る" and "終了". Fill remaining slots from the top of the list, skipping options that don't apply (e.g., skip the first option if no design decisions were found):
   - "設計判断について詳しく聞く" — deep-dive into specific design decisions in the plan (skip if no design decisions were found)
   - "特定のステップを詳しく見る" — expand a condensed step with full details from the original plan
   - "このプランについて質問する" — answer general questions about plan details
   - "別のプランを見る" — return to step 1
   - "終了" — end the skill

## Constraints

- This skill is read-only. Do NOT modify any files.
- Do NOT implement or execute any part of the plan.
- Focus on providing a clear, concise summary that captures the essential information.
