export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `Record an implementation summary after a work session. This skill is **non-interactive** — it auto-generates and writes the recap without confirmation.

Use English for internal reasoning (thinking). Recap output must be in English. Status messages to the user must be in Japanese.

If $ARGUMENTS is not empty, use it as a scope hint or summary seed for the recap.

## Purpose

This skill captures **what was done, what remains, and what was learned** after any implementation session. It works after any kind of work — standalone coding, \`/soda-plan\` execution, \`/soda-team-run\` completion, or ad-hoc changes.

**Position in skill chain**: This skill is invoked **after** implementation, independent of any prior skill. It is not part of the \`soda-research → soda-brief → soda-discuss → soda-plan\` chain.

## Procedure

### Step 1: Context Gathering

Launch a sub-agent (Task, subagent_type: Explore) to gather implementation context:

**Sub-agent prompt**:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
>
> ## Task
> Gather implementation context for a post-work recap.
>
> ### Git Changes
> Run \`git log --oneline -20\` and \`git diff main...HEAD --stat\` (or appropriate base branch) to understand recent changes.
> If no branch divergence, use \`git log --oneline -10\` and \`git diff HEAD~5 --stat\` as fallback.
>
> ### Changed Files
> For each significantly changed file, read enough to understand what was modified and why.
>
> ### Conversation Context
> If $ARGUMENTS provides a scope hint, focus the investigation on that area.
>
> Return findings in this exact format:
> ### Changes
> - \`path/to/file\` — what changed and why
> ### Completed Items
> - description of completed work
> ### Pending Items
> - description of remaining/deferred work (if any)
> ### Observations
> - implementation notes, unexpected findings, or implicit choices made

If the sub-agent finds no git changes, note this and proceed with conversation-context-only recap.

### Step 2: Synthesize Recap

From the sub-agent findings (and conversation context), produce:

- **what_done** (required): List of completed work items. Each item should be a concise but specific description.
- **pending** (optional): List of remaining or deferred work items. Omit if nothing is pending.
- **notes** (optional): Implementation observations — unexpected findings, trade-offs made, or things worth remembering. These are lightweight observations, NOT formal design decisions. If something warrants a formal decision, note that it should be created via \`sd decision create\` separately.
- **keywords_en** (optional): English keywords for searchability.

### Step 3: Write to DB

Write the recap node without confirmation:

\`\`\`sh
sd node create --kind recap --body "<one-line recap title>" --stdin <<'EOF'
{"kind":"recap","body":"<title>","properties":{"what_done":[...],"pending":[...],"notes":[...],"keywords_en":[...]},"tags":["topic:<slug>"]}
EOF
\`\`\`

### Step 4: Link Related Nodes

Search for related existing nodes that this implementation touches:

\`\`\`sh
sd node search --kind decision --tags "topic:<slug>" --limit 10
sd node search --kind todo --tags "topic:<slug>" --limit 10
\`\`\`

For each related node found:
- Decisions that were implemented: \`sd link create <recap_id> <decision_id> --type implements\`
- Todos that were completed: \`sd link create <recap_id> <todo_id> --type completes\`

If no related nodes are found, skip linking.

### Step 5: Present

Display the recorded recap to the user in Japanese:

\`\`\`
記録完了。

**Recap**: <title>
- 完了: <what_done items>
- 未対応: <pending items, or "なし">
- メモ: <notes, or "なし">
- リンク: <linked nodes, or "なし">
\`\`\`

## Constraints

- This skill is **non-interactive**. Do NOT use AskUserQuestion.
- Do NOT modify any code — this is a recording-only skill.
- Do NOT enter plan mode (no EnterPlanMode).
- Write the recap directly — do NOT ask for confirmation before DB writes.
- Keep context gathering lightweight — max 1 sub-agent launch.
- If no git changes and no useful conversation context exist, write a minimal recap noting the absence and present it.

${ctx.commandDocs(["node", "link", "tag"])}
`;
}
