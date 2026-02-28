---
name: soda-loop-status
description: Check results and status of a soda-loop run
user-invocable: true
argument-hint: [loop name or directory path]
allowed-tools: Bash(bun *), Read, Grep, Glob, AskUserQuestion
---

Check the results and status of a soda-loop run. Parses PROGRESS.md, session logs, VISION.md, and STOP sentinel to present a unified status dashboard.

Loop artifacts are located in `<repo-root>/.agent-loops/<loop-name>/`. The script auto-discovers loops when no argument is provided.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Loop Status Data

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-status/scripts/parse-loop-status.ts $ARGUMENTS`

The above JSON provides the full loop status. See the schema description below for field details.

**Schema reference:**
- `loopDir` — Absolute path to the loop directory
- `projectName` — Extracted from PROGRESS.md title heading
- `isRunning` — true if no STOP file AND there are pending/in-progress items
- `isStopped` — true if STOP file exists
- `progress` — Item counts: `pending`, `inProgress`, `done`, `blocked`, `total`, `percentComplete`
- `phases[]` — Per-phase breakdown with `number`, `name`, `items` counts
- `discoveredItems` — Items added by agent discovery protocol (D-* prefix)
- `blockedItems[]` — Items in blocked state with `id` and `title`
- `inProgressItems[]` — Items in in-progress state with `id` and `title`
- `sessions` — Session history: `count`, `entries[]` with `number`, `timestamp`, `exitReason`, `sessionId`, `costUsd`, `durationMs`, `numTurns`, `completedItems`, `changedFiles`; aggregates: `totalCostUsd`, `averageCostUsd`, `averageDurationMs`
- `vision` — VISION.md data: `purpose`, `goalCount`, `goals[]` with `text` and `status`
- `plans` — PLAN-*.md data: `count`, `files[]` with `filename`, `name`, `goalsCovered`, `stepCount`, `created`; `coveredGoalCount`, `totalGoalCount` (null if no plan files exist)
- `learnings` — LEARNINGS.md status: `exists`, `lineCount` (null if file doesn't exist)
- `sessionHandoff` — SESSION_HANDOFF.md status: `exists` (null if file doesn't exist)
- `multipleLoops` — Present when multiple loops are found in `.agent-loops/`. Contains `available` (loop name list) and `agentLoopsDir` (path)
- `error` — Present when a fatal error occurred (e.g., no PROGRESS.md found)
- `warnings[]` — Non-fatal issues (e.g., missing .loop-logs)

## Procedure

### Step 1: Loop Selection / Error Check

**If the JSON contains a `multipleLoops` field**: Multiple loops were found in `.agent-loops/`. Present the available loops and use AskUserQuestion to let the user choose:
- One option per loop name from `available` array
- "終了" — end the skill

After the user selects a loop, re-run the script with the loop directory path:
```bash
bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-status/scripts/parse-loop-status.ts <agentLoopsDir>/<selected-loop-name>
```
Parse the new JSON and continue to Step 2.

**If the JSON contains an `error` field**: Inform the user in Japanese and use AskUserQuestion:
- "ループ名を指定する" — user provides loop name or directory path
- "終了" — end the skill

If the user provides a name or path, re-run the script:
```bash
bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-status/scripts/parse-loop-status.ts <user-provided-path>
```
Parse the new JSON and continue. If it still has an error, repeat this step.

### Step 2: Status Overview

Present a dashboard using the parsed JSON data. Format in Japanese:

```
# {{projectName}} — ループステータス

状態: {{STATUS_LABEL}}
進捗: {{done}}/{{total}} ({{percentComplete}}%)
セッション: {{sessions.count}}回 | 総コスト: ${{sessions.totalCostUsd ?? "N/A"}} | 平均: ${{sessions.averageCostUsd ?? "N/A"}}/回 | 平均時間: {{sessions.averageDurationMs ?? "N/A"}}ms

{{PROGRESS_BAR}}
```

**Status label rules:**
- `isRunning` is true → "🔄 実行中 (pending: {{pending}}, in-progress: {{inProgress}})"
- `isStopped` is true → "⏹ 停止済み"
- `progress.blocked > 0` → "⚠ ブロック中 (blocked: {{blocked}})"
- Otherwise (all done, no pending/in-progress/blocked) → "✅ 完了"

**Progress bar:** Generate a 20-character ASCII bar based on `percentComplete`. Example for 60%: `[============--------] 60%`

**Phase table:**

```
## フェーズ別進捗

| フェーズ | 完了 | 進行中 | 未着手 | ブロック | 合計 |
|----------|------|--------|--------|----------|------|
| 1: {{name}} | {{done}} | {{inProgress}} | {{pending}} | {{blocked}} | {{total}} |
| 2: {{name}} | ... | ... | ... | ... | ... |
```

**Discovered items** (if count > 0):
```
## 発見項目 ({{count}}/10)
- {{id}}: {{title}} [{{status}}]
```

**Blocked items** (if any):
```
## ⚠ ブロック項目
- **{{id}}**: {{title}}
```

**In-progress items** (if any, show from phases data):
```
## 進行中
- **{{id}}**: {{title}}
```

**Plans** (if `plans` is not null and `plans.count > 0`):
```
## 計画ファイル ({{plans.count}})

| プラン | ステップ数 | カバーゴール | 作成日 |
|--------|-----------|-------------|--------|
| {{filename}} | {{stepCount}} | {{goalsCovered.length}} | {{created ?? "N/A"}} |
```
Add coverage summary: `ゴールカバレッジ: {{coveredGoalCount}}/{{totalGoalCount}} ({{percentage}}%)`

**Warnings** (if any): Show briefly at the bottom.

### Step 3: Follow-up

Use AskUserQuestion with options selected based on context. Always include "終了". Choose up to 3 other options from the following list, prioritizing options relevant to the current state:

- "ライブモニタリング" — start watch mode for periodic status updates (include if `isRunning` is true). See Watch Mode below.
- "セッション履歴を見る" — show session history table (include if `sessions.count > 0`)
- "ブロック項目を詳しく見る" — investigate blocked items in PROGRESS.md (include if `blockedItems.length > 0`)
- "ビジョンの達成状況を確認" — show vision goals vs progress (include if `vision` is not null)
- "特定のフェーズを詳しく見る" — expand a phase with full item details (include if `phases.length > 0`)
- "LEARNINGS.md を見る" — show accumulated cross-session knowledge (include if `learnings` is not null and `learnings.exists`)
- "セッション引き継ぎを見る" — show SESSION_HANDOFF.md content (include if `sessionHandoff` is not null and `sessionHandoff.exists`)
- "計画ファイルの詳細を見る" — show plan files with goals covered and step details (include if `plans` is not null and `plans.count > 0`)
- "PROGRESS.md を直接見る" — read the raw file
- "最新セッションのログを見る" — read the most recent .loop-logs/session-N.log (include if `sessions.count > 0`)
- "終了" — end the skill

### Watch Mode

When the user selects "ライブモニタリング", run the parser in watch mode:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/skills/soda-loop-status/scripts/parse-loop-status.ts {{loopDir}} --watch --interval=30
```

This outputs one JSON line per check interval (default 30 seconds). The script checks PROGRESS.md mtime and STOP file on each tick, and automatically exits when the loop completes or stops.

Present each update as a compact status line:
```
[{{timestamp}}] {{percentComplete}}% ({{done}}/{{total}}) | セッション: {{sessions.count}} | コスト: ${{totalCostUsd}}
```

When watch mode exits, return to Step 3 for follow-up options.

### Step 4: Detail Views

Provide the selected detail view, then return to Step 3 for further follow-up.

**セッション履歴を見る:**
Present a table from `sessions.entries`:
```
| # | 日時 | 終了理由 | 完了項目 | コスト | 時間 | ターン数 |
|---|------|----------|----------|--------|------|----------|
| {{number}} | {{timestamp}} | {{exitReason}} | {{completedItems.join(", ") || "—"}} | ${{costUsd ?? "N/A"}} | {{durationMs ? Math.round(durationMs/60000) + "分" : "N/A"}} | {{numTurns ?? "N/A"}} |
```
Add a summary line: total sessions, total cost, average cost/session, average duration, breakdown by exit reason (e.g., "normal: 5, budget-exceeded: 2, timeout: 1").

**ブロック項目を詳しく見る:**
For each blocked item, use Grep to find the item in PROGRESS.md by its ID (e.g., `**{{id}}**`), read the surrounding context (item description, dependencies, validation criteria), and present:
- Item ID and title
- Dependencies listed in the item
- Any indented lines below the item (may contain failure reason)
- Suggestion: what the user might do to unblock it

**ビジョンの達成状況を確認:**
Present vision goals alongside loop progress:
```
## ビジョン達成状況

目的: {{vision.purpose ?? "(未設定)"}}

| # | ゴール | 状態 |
|---|--------|------|
| 1 | {{goal.text}} | {{goal.status == "done" ? "✅" : "⬜"}} |
```
Add summary: {{goalsCompleted}}/{{goalCount}} goals achieved. If phases map clearly to goals, note the relationship.

**特定のフェーズを詳しく見る:**
Use AskUserQuestion to ask which phase (list phase names as options). Then use Grep to find all items in that phase section of PROGRESS.md. Present every item with full details (description, files, validation, deps).

**LEARNINGS.md を見る:**
Use Read tool to display the file at `{{loopDir}}/LEARNINGS.md`. Present the content with section headers highlighted.

**セッション引き継ぎを見る:**
Use Read tool to display the file at `{{loopDir}}/SESSION_HANDOFF.md`. Present the handoff information: completed items, changed files, and suggested next priorities.

**計画ファイルの詳細を見る:**
For each plan file in `plans.files`, present:
```
### {{filename}}
名前: {{name}}
作成日: {{created ?? "N/A"}}
ステップ数: {{stepCount}}

カバーゴール:
- {{goal text 1}}
- {{goal text 2}}
```
Use Read tool to read each `PLAN-*.md` file at `{{loopDir}}/{{filename}}` for full step details if the user requests deeper inspection.

**PROGRESS.md を直接見る:**
Use Read tool to display the file at `{{loopDir}}/PROGRESS.md`.

**最新セッションのログを見る:**
Determine the latest session number from `sessions.entries`. Read `{{loopDir}}/.loop-logs/session-{{N}}.log` using the Read tool. Present key events:
- `init` event → session ID
- `tool_use` events → summarize tools used (count by tool name)
- `result` event → cost, if present
- If the file is very large, read only the first and last 50 lines.

## Constraints

- This skill is read-only. Do NOT modify any files.
- Do NOT run or interact with the loop harness (run-loop.ts).
- Do NOT implement or execute any part of the loop's work items.
- Focus on presenting status information clearly and helping the user understand the current state.
