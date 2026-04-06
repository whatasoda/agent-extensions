export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `
Create a detailed implementation plan for the given task.

Use English for internal reasoning (thinking). Plan content (written to plan mode file) must be in English — use structured data, code snippets, and technical English for maximum AI interpretability and compaction resilience. User interaction (AskUserQuestion options, confirmation messages, investigation summaries presented before plan mode) must be in Japanese.

If $ARGUMENTS is empty, ask the user what they want to implement before proceeding.

${ctx.commandDocs(["decision", "session", "review"])}

## Procedure

1. **Investigate**: Explore the codebase to understand the scope, affected areas, and existing patterns.
   - **Design Decision check**: Before launching sub-agents, query existing decisions via \`sd decision list --repo <owner/repo>\` (detect owner/repo from git remote).
     - If decisions found:
       - Present the found decisions and ask the user which apply to this task (always confirm — some may be stale or unrelated)
       - Extract decisions as **mandatory constraints** — every applicable decision must be traceable to a plan step
       - Extract \`rejected_alternatives\` from each decision as **exclusion constraints** — approaches listed as rejected must not be re-proposed
     - If no decisions found: proceed normally (conversation-context-based input)
   - **Codebase investigation output contract**: Every codebase sub-agent prompt MUST end with the following output format requirement:
       > Return findings in this exact format:
       > ### Files
       > - \`path/to/file\` — relevance to the task
       > ### Patterns
       > - pattern name — description of the convention or pattern found
       > ### Dependencies
       > - dependency — how it affects the task
       > ### Open Questions
       > - question — what remains unclear from this investigation alone
   - **External research output contract**: Every external research sub-agent prompt MUST end with:
       > Return findings in this exact format:
       > ### Official Documentation
       > - library/service name — key API, configuration, version-specific notes
       > ### Best Practices
       > - practice — source and context
       > ### Patterns & Examples
       > - pattern — description with code snippets if available
       > ### Caveats
       > - caveat — gotchas, known issues, version incompatibilities
   - **External Research Trigger**: Before launching the survey sub-agent, evaluate whether the task involves external technologies:
     - If the task references **named external libraries, frameworks, or services**, **technology selection or comparison**, or **external API integration** → launch an external research sub-agent **in parallel** with the codebase survey.
     - If the task is purely about modifying existing code with no new external dependencies → skip external research.
     - External research sub-agent prompt:
       > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
       >
       > ## Research Task
       > Investigate external documentation and resources for: [topic]
       >
       > ## Research Strategy
       > 1. Use Context7 MCP (resolve-library-id → get-library-docs) for each identified library/framework
       > 2. Use WebSearch for broader context: best practices, migration guides, comparison articles, known issues
       > 3. Synthesize findings — prioritize official documentation over community content
       >
       > [External research output contract]
   - **Sub-agent prompt constraints**: Every sub-agent prompt (both survey and focused) MUST begin with the following constraint block:
     > You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
   - Launch a sub-agent (Task, subagent_type: Explore) to survey project structure, dependencies, and conventions relevant to the task. If external research is triggered, launch both sub-agents in a single message (parallel execution).
   - Summarize findings from all agents into a Common Context block. If external research was performed, include a dedicated "External Context" section in the Common Context block.
   - Based on findings, optionally launch 1-2 focused sub-agents in parallel. Each prompt must include the Common Context block (summarized, not raw output), the specific investigation question, and both the constraint block and output contract.
   - Summarize investigation results before proceeding.
   - If investigation reveals multiple fundamentally different approaches, use AskUserQuestion to let the user decide: "方針を調整して続行" / "ここで中断して方針を整理". Do not choose an approach autonomously.
2. **Branch Strategy**: Use AskUserQuestion to determine branch strategy before planning:
   - "新ブランチ作成"
   - "現ブランチ続行"

   If the user chooses a new branch, derive the branch name from the task description.
   Do NOT proceed to Step 3 until the user confirms branch strategy.
3. **Plan**:

   Compose the plan content as markdown text (do not enter plan mode yet). Include the following elements. Do not follow a fixed template — organize and format them as best fits the task. Follow the Compact-Resilience Guidelines below when authoring plan content. After composition, proceed to the Codex Review sub-section before entering plan mode.

   **Required elements:**
   - **Task summary and branch name**
   - **Investigation summary** — key findings, affected areas, relevant patterns discovered
   - **Steps** — each step must include:
     - Progress marker: \`- [ ]\` prefix (updated to \`- [x]\` during implementation as each step completes)
     - Commit message (imperative mood)
     - File changes with full paths and rationale (\`path/to/file\` — what and why)
     - Validation criteria — how to verify this step is correct (test command, expected behavior, manual check)
     - Dependencies on prior steps and what this step produces for later steps (do not rely on ordering alone)
   - **Risks and mitigation** — at least one risk with a concrete mitigation strategy

   **Conditional elements** (include when applicable):
   - **Technical context per step** — type signatures, API contracts, data shapes, algorithms
   - **Design rationale** — for non-obvious decisions, state "why" explicitly as a labeled callout, not embedded in prose
   - **Cross-step shared context** — types, constants, or contracts used by multiple steps. Define once and reference by name in each step.
   - **Design decisions** (include when the plan involves architecture, external contracts, or user-facing behavior choices) — present each decision as a labeled callout in the plan body:
     > **Design Decision: [topic]**
     > Option A: ... — [trade-off]
     > Option B: ... — [trade-off]
     > Recommended: [option] — [rationale]

     Design decisions are discussed individually during the Plan Discussion Phase before ExitPlanMode. If a decision significantly changes the plan structure, note this dependency explicitly.

     Examples of decisions that require callouts:
     - Architecture patterns (e.g., monolith vs microservice, event-driven vs request-response)
     - Library or framework selection
     - Data model design (schema, relationships)
     - API contract design (endpoints, request/response shapes)
     - State management approach
     - Authentication/authorization strategy

     Examples that do NOT require callouts (implementation details):
     - Variable/function naming
     - Internal helper structure
     - Iteration order
     - File organization within an already-decided architecture
   - **Ambiguities** — if there are ambiguous requirements or missing information, note them as labeled callouts in the plan body rather than asking separately.

### Codex Review (pre-plan-mode)

Delegate codex review to a subagent in findings-only mode. The subagent reports issues but does NOT revise the content — the plan author incorporates findings to preserve original intent.

1. Resolve session JSONL path (for context-aware review):
   Run via Bash: \`sd session resolve\`
   Capture stdout as session path. If empty, proceed without session context.

2. Launch a codex review subagent:
   - Tool: \`Task(subagent_type: soda:codex-review)\`
   - Prompt: Include the review request with composed content.
   - Review request:
     \`\`\`
     ## Codex Review Request
     - **Mode**: findings
     - **Instruction**: "Review this plan. Skip trivial issues — only flag critical problems"
     - **Session Path**: <resolved session path from step 1, or omit if empty>

     ### Content
     [composed plan content]
     \`\`\`
3. Use the subagent's response:
   - If **critical issues found**: read the \`Issues\` section and revise the plan in the main context to address them, preserving the original intent and voice.
   - If **no critical issues**, **Status: Skipped**, or subagent failure: continue without changes.

After the codex review completes, use the EnterPlanMode tool to enter plan mode. Write the reviewed plan content to the plan file. Proceed with the Plan Discussion Phase below, then exit plan mode via ExitPlanMode.

## Plan Discussion Phase

After writing the plan, extract **discussion items** — areas that benefit from interactive confirmation before implementation. Discussion items fall into two categories:

- **Review points**: Steps where user domain knowledge would improve plan quality (business logic, unverified assumptions, context-dependent risks)
- **Design decisions**: Choices presented as \`**Design Decision: [topic]**\` callouts in the plan

### Procedure

1. **Extract and present**: List all discussion items with their category and dependency relationships:

   > **議論アイテム**: 以下の項目を順に確認します：
   > 1. [category] Step N: {{description}}
   > 2. [category] Step M: {{description}}
   >
   > 依存関係: Item 1 の結論が Item 2 の選択肢に影響します。

   The user may reorder items or mark some as skip.

2. **Discuss one at a time**: Present each item individually, following soda-discuss Interaction Principles (referenced from \`/soda-discuss\` SKILL.md — not duplicated here):

   - **提示して委ねる**: Present context/options as text output, let the user respond freely
   - **一度に一つ、承認を待つ**: Wait for the user's response before moving to the next item
   - **選択肢には根拠と推奨を添える**: For design decisions, include tradeoffs and a recommendation
   - **データが先、判断が後**: Present investigation data before asking for a decision
   - **判断の保留は深掘りのシグナル**: If the user defers, provide deeper analysis before re-presenting

   For each item type:
   - **Review point**: Present the relevant plan section and what is uncertain → wait for domain knowledge
   - **Design decision**: Present options, tradeoffs, and recommendation → wait for direction

3. **Reflect conclusions**: After each item is resolved, immediately update the plan:
   - Review point conclusions: mark as \`**User Context**: {{correction or additional information}}\`
   - Design decision conclusions: update the callout to show the confirmed option

   These labeled callouts ensure domain knowledge and decisions survive context compaction.

4. **Handle emergent items**: If discussion reveals new items, add them to the list at the appropriate position based on dependency relationships.

5. **Complete**: When all items are resolved (or the user signals readiness), proceed to ExitPlanMode.

If no discussion items are identified, skip this phase and proceed directly to ExitPlanMode.

## Execution Phase

After plan approval (ExitPlanMode), execute all steps sequentially in the main context. Update plan step markers from \`- [ ]\` to \`- [x]\` as each step completes.

## Constraints

- Do NOT begin implementation until the user approves the plan.
- Branch strategy is determined by the user in Step 2 (Branch Strategy). If the user chooses a new branch, create it from the current branch unless a different base is specified.
- The plan must include incremental commits throughout the work.
- The plan must be self-contained: include enough technical context (as code snippets and structured data, not prose) that implementation can proceed from the plan alone, even after context compaction.
- Each step must define a commit with an imperative-mood message, explicit dependencies on prior steps, and validation criteria.
- The plan must identify at least one risk and its mitigation.
- Design decisions must be presented as labeled callouts in the plan body. Each decision is discussed individually during the Plan Discussion Phase before ExitPlanMode.
- During implementation, update the plan's step markers from \`- [ ]\` to \`- [x]\` as each step's commit is completed. This provides at-a-glance progress visibility.
- If design decisions are loaded from the DB, all applicable decisions must be reflected in plan steps. Each step that implements a decision must reference it by name. Rejected alternatives from each decision must not be re-proposed as approaches.

## Compact-Resilience Guidelines

Plans must survive context compaction. Follow these rules when authoring plan content:

- **Explicit dependency chains**: State what each step depends on and produces. Do not rely on step ordering alone — ordering is lost during compaction.
- **Code over prose**: Prefer code snippets and structured data (\`interface Foo { bar: string }\`) over prose descriptions ("Foo has a bar field of type string"). Code survives intact; prose gets summarized away.
- **Labeled callouts**: State design rationale as "Why: ..." callouts, not embedded in paragraphs. Labeled callouts are retained as structure; prose rationale is dropped.

`;
}
