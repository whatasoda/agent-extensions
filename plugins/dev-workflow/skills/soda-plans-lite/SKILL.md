---
name: soda-plans-lite
description: Quick-browse implementation plans (lightweight)
user-invocable: true
argument-hint: [plan title or keyword]
allowed-tools: Bash(bun *), Read, Grep, Glob, AskUserQuestion
---

Lightweight version of `/soda-plans` for quick plan lookup with minimal token usage.

For detailed summaries with design decisions and follow-up, use `/soda-plans`.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Plan Index

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-plans/scripts/list-plans.ts`

The above JSON provides `plans` (array of `{slug, title, fileModified, filePath, stepCount?, hasDesignDecisions?}`) sorted by most recent first, and `totalCount`. The `stepCount` and `hasDesignDecisions` fields are optional — older index entries may lack them.

## Procedure

1. **List Plans**: If the plan index JSON contains a `message` field or `plans` is empty, inform the user that no plans were found for this project and suggest running `/soda-plan` to create one. End the skill. Otherwise, if `$ARGUMENTS` is provided, filter plans by keyword match against titles. Otherwise, show the 10 most recent plans as a numbered list with title and date. When `stepCount` or `hasDesignDecisions` are available, append metadata tags after the date (e.g., `[3ステップ | 設計判断あり]` or `[5ステップ]`). Omit tags for entries without metadata. If there are more plans, mention the total count.

2. **Select Plan**: If `$ARGUMENTS` keyword is provided, auto-select the best matching plan from the filtered results. If no arguments are provided, select the most recent plan automatically. Use AskUserQuestion ONLY when multiple plans match the keyword ambiguously (maximum 1 interaction gate). If no plans match the keyword, inform the user and end.

3. **Read and Summarize**: Read the selected plan file using the Read tool. Present a structured summary limited to these 3 items ONLY:
   - **タイトル**: Plan title and creation date
   - **概要**: Problem statement and approach (from the plan's overview/problem section)
   - **ステップ**: Commit breakdown / implementation steps (condensed)

   Do NOT include 設計判断, 影響範囲, or リスク sections. Keep the summary concise.

4. End the skill after showing the summary. There is no follow-up interaction.

## Constraints

- This skill is read-only. Do NOT modify any files.
- Do NOT implement or execute any part of the plan.
- Focus on providing a quick, concise summary that captures the essential information.
