---
name: soda-loop-refine
description: Iteratively refine VISION.md and PROGRESS.md through annotation cycle and codebase investigation
user-invocable: true
argument-hint: [loop name or refinement focus]
allowed-tools: Bash(git *), Bash(bun *), Read, Grep, Glob, Write, Task, AskUserQuestion
---

**CRITICAL**: Do NOT use EnterPlanMode or enter plan mode at any point during this skill. This is an interactive dialogue skill — not an implementation task. Proceed directly through the steps below without planning.

Refine an existing VISION.md (and optionally PROGRESS.md) through iterative annotation and optional codebase investigation. This skill fills the gap between vision creation (`/soda-loop-vision`) and loop execution, and also supports mid-loop course correction.

Use English for all generated file content. User interaction (AskUserQuestion options, presentations, annotations) must be in Japanese.

If $ARGUMENTS is empty, proceed directly to loop detection. If $ARGUMENTS contains a loop name or directory path, use it to locate the loop.

## Step 1: Loop Detection

Determine the loop directory. Do NOT ask the user to type a path from scratch.

**Repo root detection**:
```bash
git rev-parse --show-toplevel
```
If this fails (non-git context), use the current working directory as the repo root.

**Detection order**:
1. If `$ARGUMENTS` looks like a loop name or path, use it to locate `<repo-root>/.agent-loops/<argument>/VISION.md`
2. Else scan for existing loops using Glob tool with pattern `<repo-root>/.agent-loops/*/VISION.md`
   - If a single loop is found → suggest it
   - If multiple loops are found → list them and let user choose via AskUserQuestion (one option per loop name + "終了")
3. If no loops found → inform user and suggest running `/soda-loop-vision` first. Stop.

**After determining the loop name**, confirm with the user:

Use AskUserQuestion:
- "`.agent-loops/{{LOOP_NAME}}/` を改善する"
- "別のループを指定"

If "別のループを指定": ask for loop name, re-detect.

The loop directory is: `<repo-root>/.agent-loops/<loop-name>/`

**Read loop artifacts**:
- Read VISION.md (required — if missing, suggest `/soda-loop-vision` and stop)
- Read PROGRESS.md (optional — note whether it exists)
- Check for STOP file existence using Glob tool

## Step 2: Current State Presentation

Present the current state of the loop in Japanese. Use section numbering for reference in the annotation cycle:

```
# {{PROJECT_NAME}} — 現状

## ビジョン
[1] 目的: {{PURPOSE}}

[2] 背景:
{{BACKGROUND_SUMMARY}}

[3] 技術コンテキスト:
- {{DETAIL}}
...

[4] 主要な決定事項:
- {{DECISION}}
...

[5] ゴール ({{GOAL_COUNT}}):
  [5.1] {{GOAL_1}}
  [5.2] {{GOAL_2}}
  ...

[6] 制約:
- {{CONSTRAINT}}
...

[7] スコープ外:
- {{EXCLUSION}}
...
```

Omit sections that are empty in VISION.md. Numbering adjusts accordingly (skip empty section numbers).

If PROGRESS.md exists, append:
```
## 進捗状況
フェーズ: {{PHASE_COUNT}} | 完了: {{DONE}}/{{TOTAL}} ({{PERCENT}}%)

### フェーズ別
- Phase {{N}}: {{NAME}} — {{DONE}}/{{TOTAL}}
...

### ブロック項目
- {{ID}}: {{TITLE}}
...

### 進行中
- {{ID}}: {{TITLE}}
...
```

If a STOP file exists, note: "⏹ ループは停止中です"

**Context detection**: Check the conversation for output from `/soda-loop-status`. If status dashboard output is present (identified by "ループステータス" heading or phase table format), note it as supplementary context — the user likely checked status before invoking this skill. Reference any blocked items or issues visible in the status output.

## Step 3: Refinement Mode Selection

Present options based on what artifacts exist:

**If PROGRESS.md exists**, use AskUserQuestion:
- "ビジョン（ゴール・制約）を改善"
- "コードベースを調査してから改善"
- "参考実装を指定してから改善"
- "進捗を調整"
- "ビジョンと進捗の両方を改善"
- "終了"

**If PROGRESS.md does not exist**, use AskUserQuestion:
- "ビジョン（ゴール・制約）を改善"
- "コードベースを調査してから改善"
- "参考実装を指定してから改善"
- "終了"

**Routing**:
- "ビジョン（ゴール・制約）を改善" → Step 4
- "コードベースを調査してから改善" → Codebase Investigation sub-procedure, then Step 4
- "参考実装を指定してから改善" → Reference Implementation sub-procedure, then Step 4
- "進捗を調整" → Step 5
- "ビジョンと進捗の両方を改善" → Step 4, then Step 5
- "終了" → stop

### Codebase Investigation (sub-procedure)

Same pattern as soda-loop-vision. Launch a single sub-agent (Task, subagent_type: Explore) with:

**Sub-agent prompt constraints**: Every sub-agent prompt MUST begin with the following constraint block:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.

**Sub-agent output contract**: Every sub-agent prompt MUST end with the following output format requirement:
> Return findings in this exact format:
> ### Files
> - `path/to/file` — relevance to the project goal
> ### Patterns
> - pattern name — description of the convention or pattern found
> ### Dependencies
> - dependency — how it relates to the project goal
> ### Open Questions
> - question — what remains unclear from this investigation alone

The sub-agent prompt includes:
1. The constraint block
2. The current VISION.md content (summarized)
3. Current PROGRESS.md state if available (completed items, blocked items, discovered items)
4. Specific investigation questions (derived from the user's refinement intent or from blocked/discovered items)
5. The output contract

Present findings briefly in Japanese. If investigation reveals specific improvement suggestions for the vision, present them as numbered proposals for use in Step 4.

### Reference Implementation (sub-procedure)

Ask the user to identify the reference implementation: file paths, feature names, or patterns to emulate. Then launch a focused sub-agent (Task, subagent_type: Explore) with:
1. The constraint block (same as Codebase Investigation)
2. The user-specified reference implementation targets
3. Instruction to analyze: structure, patterns, conventions, API design, and behavior of the reference code
4. The output contract (same as Codebase Investigation)

Present a brief summary of the reference implementation analysis in Japanese. Note how findings relate to current vision goals.

## Step 4: Vision Annotation Cycle

This is the core interactive loop. Present the current VISION.md content with section numbering (same format as Step 2, but only the vision sections).

If investigation or reference implementation findings are available, present them alongside as improvement suggestions:
```
## 調査結果を踏まえた改善提案
- [A] ゴール [5.2] を分割: {{RATIONALE}}
- [B] 制約を追加: {{SUGGESTED_CONSTRAINT}}
- [C] Technical Context を追加: {{DETAIL}}
```

Use AskUserQuestion:
- "変更箇所を説明する" — user describes changes verbally (free text)
- "セクション番号で修正を指定" — user specifies section-number reference like "[5.2] を分割して..."
- "外部で編集したのでファイルを再読み込み" — re-read VISION.md after user edited externally
- "提案を適用" — accept the agent's suggested changes (only show if investigation-based suggestions were presented)
- "別の調査を追加" — launch another investigation round
- "完了（ファイルに書き出す）" — finalize and proceed to Step 6

### Processing user changes

**If "変更箇所を説明する" or "セクション番号で修正を指定"**:

Accept the user's input. Parse the intent and present proposed modifications as a diff-style preview:

```
## 変更提案

[5.2] ゴール修正:
  現在: "Support dark mode toggle"
  提案: "Support dark mode toggle with system preference detection and manual override"

[5] ゴール追加:
  新規: "Persist theme preference in localStorage"

[6] 制約追加:
  新規: "Must not use CSS-in-JS (project uses Tailwind)"
```

Use AskUserQuestion:
- "全て適用"
- "一部を選んで適用（番号で指定）"
- "修正して再提案"
- "キャンセル（元に戻す）"

If "全て適用": apply all changes to the in-memory VISION.md state. Return to the main annotation cycle.
If "一部を選んで適用": ask which changes to accept (by reference number). Apply selected changes. Return to the main annotation cycle.
If "修正して再提案": accept the user's corrections to the proposal. Present the updated proposal. Re-confirm.
If "キャンセル": discard this round's proposals. Return to the main annotation cycle.

**If "外部で編集したのでファイルを再読み込み"**:

Re-read VISION.md from disk. Update the in-memory state. Re-present the numbered content. Return to the main annotation cycle.

**If "提案を適用"**:

Apply the agent's investigation-based suggestions. Present the diff-style preview and confirm with the same 4-option AskUserQuestion as above.

**If "別の調査を追加"**:

Execute the Codebase Investigation sub-procedure again with updated context (including any changes already applied). Present new findings and suggestions. Return to the main annotation cycle.

**If "完了（ファイルに書き出す）"**:

Proceed to Step 6.

## Step 5: Progress Adjustment

Only reached when user selected progress adjustment in Step 3.

**Allowed modifications** (limited scope — full restructure should use `/soda-loop-setup`):
- Add new items to an existing phase (with proper ID format: `N.X`)
- Add new validation items (with `V-N.X` format)
- Mark items as `[!]` blocked with reason
- Add items to Discovered Items section (with `D-N` format, respecting the 10-item quota)
- Update item descriptions or validation criteria
- Reorder items within a phase (change dependency chains)

**NOT allowed** (suggest `/soda-loop-setup` for these):
- Add or remove phases
- Restructure phase boundaries
- Change the AGENT_PROMPT.md
- Modify run-loop.ts configuration

If the user requests a disallowed modification, explain the limitation and suggest: "フェーズ構造の変更には `/soda-loop-setup` を再実行してください。"

Present PROGRESS.md phases and items with numbered references:

```
## Phase 1: {{NAME}}
  [1.1] [{{STATUS}}] {{TITLE}}
  [V-1.1] [{{STATUS}}] Validate {{TITLE}}
  [1.2] [{{STATUS}}] {{TITLE}}
  ...

## Phase 2: {{NAME}}
  [2.1] [{{STATUS}}] {{TITLE}}
  ...

## Discovered Items ({{COUNT}}/10)
  [D-1] [{{STATUS}}] {{TITLE}}
  ...
```

Use AskUserQuestion:
- "アイテムを追加" — add new implementation or validation items
- "アイテムを修正" — modify existing item description, validation, or deps
- "ブロック理由を記録" — mark items as `[!]` with reason
- "外部で編集したのでファイルを再読み込み" — re-read PROGRESS.md
- "完了（ファイルに書き出す）" — finalize

For each modification, present the change and confirm before accumulating. After "完了", proceed to Step 6.

## Step 6: Apply Changes

**Conflict detection** — before writing, re-read the file(s) from disk and compare to the state when the skill started:

**If VISION.md was modified**:

Re-read VISION.md. If the content has changed since Step 1 (e.g., external edit or concurrent process), warn the user:

Use AskUserQuestion:
- "上書き（このスキルの変更で置換）"
- "再読み込みしてやり直し（最新状態から再開）"
- "キャンセル（変更を破棄）"

If "上書き": proceed with writing.
If "再読み込みしてやり直し": re-read VISION.md, return to Step 2 with the latest content.
If "キャンセル": stop without writing.

Write VISION.md to `<repo-root>/.agent-loops/{{LOOP_NAME}}/VISION.md` using the same format as soda-loop-vision Step 6.

**If PROGRESS.md was modified**:

Same conflict detection. Re-read and compare. If changed externally, present the same 3-option warning.

Write PROGRESS.md, preserving the existing structure. **Do NOT modify the Session Log section** — it is append-only and managed by the loop harness.

## Step 7: Vision Blueprint & Next Steps

After writing files, emit a **Vision Blueprint** block in the conversation. This enables same-session handoff to `/soda-loop-setup`.

```
## Vision Blueprint

**Project**: {{PROJECT_NAME}}
**Loop Name**: {{LOOP_NAME}}

### Background
{{BACKGROUND_SUMMARY_1_2_SENTENCES}}

### Technical Context
- {{DETAIL_1}}
- {{DETAIL_2}}
...

### Key Decisions
- {{DECISION_1}}
- {{DECISION_2}}
...

### Goals
- {{GOAL_1}}
- {{GOAL_2}}
...

### Constraints
- {{CONSTRAINT}}
...

### Out of Scope
- {{EXCLUSION}}
...
```

The same omission rules as soda-loop-vision apply: omit `### Background`, `### Technical Context`, or `### Key Decisions` if the corresponding VISION.md section is empty or was omitted.

Then print next steps based on context:

**If PROGRESS.md does not exist**:
```
Vision refined:
- .agent-loops/{{LOOP_NAME}}/VISION.md — {{GOAL_COUNT}} verifiable goals ({{CHANGES_SUMMARY}})

Next:
  /soda-loop-setup — Generate loop harness from this vision
```

**If PROGRESS.md exists and was modified**:
```
Loop artifacts refined:
- .agent-loops/{{LOOP_NAME}}/VISION.md — {{GOAL_COUNT}} verifiable goals ({{CHANGES_SUMMARY}})
- .agent-loops/{{LOOP_NAME}}/PROGRESS.md — updated ({{PROGRESS_CHANGES_SUMMARY}})

Next:
  /soda-loop-setup — Regenerate loop harness (if vision changes require new phases)
  Resume loop execution — if only progress was adjusted
```

**If PROGRESS.md exists but was not modified**:
```
Vision refined:
- .agent-loops/{{LOOP_NAME}}/VISION.md — {{GOAL_COUNT}} verifiable goals ({{CHANGES_SUMMARY}})

Note: PROGRESS.md was not modified. If vision changes affect existing phases, consider:
  /soda-loop-setup — Regenerate loop harness from updated vision
```

## Constraints

- This skill refines existing artifacts. It does NOT create VISION.md from scratch — that is `/soda-loop-vision`'s responsibility.
- Do NOT generate AGENT_PROMPT.md or run-loop.ts — that is `/soda-loop-setup`'s responsibility.
- Do NOT add or remove phases in PROGRESS.md — that is `/soda-loop-setup`'s responsibility.
- Do NOT enter plan mode (no EnterPlanMode).
- The Vision Blueprint block format must be stable — `/soda-loop-setup` detects it by heading pattern.
- PROGRESS.md modifications must preserve the Session Log section untouched.
- When presenting changes, always show before/after for user confirmation (no silent modifications).
