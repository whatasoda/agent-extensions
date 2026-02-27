# Step 2 Sub-Procedures

Sub-procedures triggered from the Step 2 checkpoint in SKILL.md.

## Codebase Investigation

Triggered when user selects "コードベースを調査して裏付けを取る" at the Step 2 checkpoint.

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

**Investigation prompt construction**:

Launch a single sub-agent (Task, subagent_type: Explore) with a prompt that includes:
1. The constraint block
2. The project goal and all context gathered during requirements discovery so far (summarized, not raw dialogue)
3. Specific investigation questions derived from the current dialogue state (e.g., ambiguities that could be resolved by looking at existing code, patterns that would inform goal feasibility)
4. The output contract

**Findings integration**:

Synthesize the sub-agent's output into the requirements discovery context:
- Relevant file paths and patterns are added to the retained Technical Landscape context
- Open questions become candidates for the next dialogue round
- Any constraints discovered in the code are carried forward to Step 4

Present a brief summary of findings in Japanese before returning to the Step 2 checkpoint. The user can then continue discovery dialogue with the enriched context, investigate further, or proceed to goal decomposition.

## Reference Implementation

Triggered when user selects "参考実装を指定する" at the Step 2 checkpoint.

Ask the user to identify the reference implementation: file paths, feature names, or patterns to emulate. Then launch a focused sub-agent (Task, subagent_type: Explore) with:
1. The constraint block (same as Codebase Investigation)
2. The user-specified reference implementation targets
3. Instruction to analyze: structure, patterns, conventions, API design, and behavior of the reference code
4. The output contract (same as Codebase Investigation)

Synthesize findings as Reference Implementation context. This context informs goal decomposition in Step 3 — goals may reference the reference implementation as a model for structure, naming, or behavior.

Present a brief summary of the reference implementation analysis in Japanese before returning to the Step 2 checkpoint.

## Plan Import

Triggered when user selects "既存プランをインポートする" at the Step 2 checkpoint.

Ask the user to provide the plan file path. The plan file path is typically visible in the conversation from a recent `soda-plan` session (after ExitPlanMode). If `$ARGUMENTS` contains a file path to a plan file, suggest it as the default.

Once the path is confirmed, read the plan file using the Read tool.

**Section extraction** (best-effort, by heading patterns):

| Plan section | Detection pattern | Maps to |
|---|---|---|
| Task summary | First `#` heading or opening paragraph | Purpose seed |
| Investigation summary | Paragraphs describing findings, affected areas, patterns | Background + Technical Context seeds |
| Design decisions | `**Design Decision: ...**` callouts or `**Why: ...**` callouts | Key Decisions seeds |
| Steps | `- [ ]` items with commit messages and file changes | Goal seeds (requires semantic transformation) |
| Risks | Section mentioning risks and mitigations | Constraints seeds |
| User Context | `**User Context: ...**` callouts | Retained as authoritative domain knowledge |

If section headings do not match expected patterns, treat the entire plan content as Background context.

**Step-to-Goal semantic transformation:**

Plan steps describe implementation actions; goals must describe verifiable outcomes. Transform each step's intent into an outcome statement with a pass/fail condition.

Examples:
- Step: "Add Plan Context Detection section to SKILL.md"
  → Goal: "soda-loop-vision SKILL.md contains a Plan Import sub-procedure"
  → Acceptance: "The sub-procedure section exists and is reachable from the Step 2 checkpoint"
- Step: "Modify `src/config.ts` to export a `Config` type"
  → Goal: "`src/config.ts` exports a `Config` type"
  → Acceptance: "`bun typecheck` passes"

Present a summary of extracted context in Japanese:

> **プランから抽出した情報:**
> - **Purpose**: {{EXTRACTED_PURPOSE}}
> - **Background/Technical Context**: {{SUMMARY}}
> - **Key Decisions**: {{COUNT}} 件
> - **Goal seeds**: {{COUNT}} 件（ステップから変換）
> - **Constraints seeds**: {{COUNT}} 件（リスクから変換）

Return to the Step 2 checkpoint with the enriched context. The extracted context is retained alongside other discovery context (Problem background, Technical landscape, Key decisions, Investigation findings) for use in Steps 3-6.
