
Review branch changes for design conformance — checking implementation against Design Decisions (DD-N) from Living Discussion Documents and detecting implicit design decisions introduced during implementation.

Use English for internal reasoning (thinking). All user-facing output must be in Japanese.

## Current Branch Context

!`wat review detect-base-branch`

The above JSON provides `baseBranch`, `mergeBase`, `changedFiles`, `potentialConflicts`, and ready-to-use `commands.diff` / `commands.log`.

If $ARGUMENTS is not empty, treat it as the review focus or an alternative base branch specification. When an alternative base is specified, re-compute the diff using that base instead of the detected one.

## Procedure

1. **Identify the diff**: Use the pre-fetched branch context JSON above. Run `commands.diff` to get the full diff. If $ARGUMENTS specifies a different base, re-compute the merge-base and diff accordingly. If the JSON contains an `error` field, present the error to the user and use AskUserQuestion: "別のベースブランチを指定" / "レビューを中止". If the diff is empty, inform the user and use AskUserQuestion: "別のベースブランチを指定" / "レビューを終了".

2. **Load design decisions**: Query `wat decision list --repo <owner/repo>` (detect owner/repo from git remote).
   - **If decisions found**: Present the found decisions and use AskUserQuestion to ask which apply to this review. Extract:
     - Decision constraints as **verification targets**
     - `rejected_alternatives` as **exclusion reference** (for context, not verification)
   - **If no decisions found** (degraded mode): Note that no design decisions exist. Skip decision verification in step 4. The implicit decision detection agent will run in discovery mode — identifying all non-trivial design judgments as formalization candidates rather than checking against a baseline.

3. **Prepare diff content**: Run `commands.diff` via Bash and capture the full diff output.

4. **Launch conformance check sub-agents**: Launch two sub-agents in parallel using Task tool. Both sub-agent prompts MUST begin with the standard constraint block.

   **Sub-agent A — DD Verification Agent** (skip if DD-7 degraded mode):
   ```
   Task(subagent_type: Explore)
   ```
   Prompt structure:
   > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
   >
   > ## Task
   > Verify whether the following Design Decisions (DD-N) from a Living Discussion Document are satisfied by the implementation changes in the diff below.
   >
   > For each DD-N, determine:
   > - **SATISFIED**: The implementation clearly fulfills the constraint
   > - **VIOLATED**: The implementation contradicts or fails to implement the constraint
   > - **UNCLEAR**: Cannot determine from the diff alone (may need broader codebase context)
   >
   > When checking, read the actual source files (not just the diff) to understand the full implementation context. The diff shows what changed, but the constraint may be about the resulting state.
   >
   > ## Design Decisions
   > {{extracted DD-N entries with full Constraint/Why/Scope text}}
   >
   > ## Diff
   > {{full diff output}}
   >
   > Return findings in this exact format:
   > ### DD Verification
   > - **DD-N**: {{SATISFIED | VIOLATED | UNCLEAR}} — {{evidence with file:line references}}
   > ### Violation Details
   > - **DD-N**: {{what was required}} vs {{what was found}} — {{file:line}}
   > ### Notes
   > - {{any additional context or caveats}}

   **Sub-agent B — Implicit Decision Detection Agent**:
   ```
   Task(subagent_type: Explore)
   ```
   Prompt structure:
   > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
   >
   > ## Task
   > Examine the following diff and identify design decisions that were made during implementation. A "design decision" is a non-trivial judgment about architecture, data modeling, API shape, error handling strategy, or behavioral semantics — NOT routine implementation details like variable naming, loop structure, or formatting.
   >
   > Examples of design decisions to detect:
   > - Introducing a new data structure or type that defines a contract
   > - Choosing an error handling strategy (throw vs return vs union type)
   > - Defining an API shape (function signatures, parameter types, return types)
   > - Selecting an architectural pattern (observer, middleware, pipeline)
   > - Adding a new dependency or integration point
   >
   > Examples of routine implementation details to SKIP:
   > - Variable/function naming choices
   > - Import ordering
   > - Iteration approach (for vs map vs reduce)
   > - Formatting and style
   > - Adding type annotations to existing code
   >
   > {{IF DD-N entries available}}
   > The following Design Decisions are already recorded. Only report decisions NOT covered by these entries:
   > {{DD-N list with Constraint text}}
   > {{ELSE}}
   > No prior Design Decisions are recorded. Report all non-trivial design judgments found in the diff as candidates for formalization.
   > {{END}}
   >
   > ## Diff
   > {{full diff output}}
   >
   > Return findings in this exact format:
   > ### Implicit Design Decisions
   > - **[file:line]** {{decision description}} — {{why this is a design decision, not routine implementation}}
   > ### Formalization Candidates
   > - {{which of the above should be recorded as formal DD entries, and why}}
   > ### Notes
   > - {{any additional context}}

5. **Integrate results**: Combine both sub-agent outputs into a unified conformance report.

6. **Present report**: Output the conformance report to the user in the format specified below.

7. **Next steps**: Use AskUserQuestion with context-dependent options:
   - If violations found:
     - "違反箇所の修正をプランする" (suggest `/soda-plan`)
     - "DD を実装に合わせて更新する"
     - "メモして後で対応"
   - If implicit decisions found but no violations:
     - "暗黙の判断を DD として記録する"
     - "問題なし、このまま進める"
   - If clean (no violations, no implicit decisions):
     - "設計適合性に問題なし"
     - "別の観点でレビュー"

## Report Format

```
## 設計適合性レポート

### 対象
- ブランチ: {{branch name}}
- ベース: {{base branch}} ({{merge-base commit}})
- 参照: {{selected design decisions, or "なし (探索モード)"}}

### DD 検証結果
| DD | 制約 | 判定 | 根拠 |
|---|---|---|---|
| DD-N | {{constraint summary}} | SATISFIED / VIOLATED / UNCLEAR | {{file:line — evidence}} |

### DD 違反の詳細
{{For each VIOLATED DD:}}
#### DD-N: {{name}}
- **制約**: {{what was required}}
- **実装**: {{what was found}} ({{file:line}})
- **推奨対応**: 実装を修正 / DD を更新

### 暗黙の設計判断
| # | ファイル | 判断内容 | DD化推奨 |
|---|---|---|---|
| 1 | {{file:line}} | {{description}} | Yes / No |

### サマリー
- DD 検証: {{N}} 件中 {{satisfied}} 件適合、{{violated}} 件違反、{{unclear}} 件不明
- 暗黙の設計判断: {{N}} 件検出 (うち {{M}} 件 DD 化推奨)
```

When in DD-7 degraded mode (no Living Discussion Document), omit the "DD 検証結果" and "DD 違反の詳細" sections and update the summary. Replace with:

```
### DD 検証結果
Living Discussion Document が見つからないため、DD 検証はスキップしました。
暗黙の設計判断の探索のみ実行しています。

### サマリー
- DD 検証: スキップ (Living Discussion Document なし)
- 暗黙の設計判断: {{N}} 件検出 (うち {{M}} 件 DD 化推奨)
```

## Constraints

- **Report only** — do NOT modify any code or files. If a fix is needed, suggest a direction but do not apply it.
- **No code quality review** — this skill focuses exclusively on design conformance. Code quality concerns (bugs, style, performance) are handled by `/soda-fix` and manual review.
- Sub-agent prompts MUST begin with: "You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools."
