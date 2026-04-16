export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `Write a session handoff for cross-worktree continuity. This skill is **non-interactive** — it auto-generates and writes the handoff without confirmation.

Use English for internal reasoning (thinking). Handoff content must be in English. Status messages to the user must be in Japanese.

If $ARGUMENTS is not empty, use it as the workstream name or scope hint.

## Purpose

This skill captures **what the next session needs to know to continue this work**. It writes a rich Markdown document to the knowledge graph with file export, accessible from any worktree.

**When to use**: When ending a session with work still in progress. For completed work, use \`/soda-recap\` instead.

## Procedure

### Step 1: Context Gathering

Launch a sub-agent (Task, subagent_type: Explore) to gather session context:

**Sub-agent prompt**:
> You are a research-only agent. Do NOT use AskUserQuestion, EnterPlanMode, or any interactive/planning tools. Return your findings in the output format specified below.
>
> ## Task
> Gather context for a session handoff document.
>
> ### Git State
> Run \`git status\`, \`git log --oneline -10\`, and \`git diff --stat\` to understand current working state.
> Check current branch: \`git branch --show-current\`
> Check remote: \`git remote get-url origin 2>/dev/null\`
>
> ### Changed Files
> For each significantly changed or in-progress file, read enough to understand what was modified and what remains.
>
> ### Conversation Context
> If $ARGUMENTS provides a scope hint, focus investigation on that area.
>
> Return findings in this exact format:
> ### Current State
> - branch, uncommitted changes, recent commits
> ### Work Done
> - what was accomplished in this session
> ### In Progress
> - what is partially done or needs continuation
> ### References
> - \\\`path/to/file\\\` — why it matters for the next session
> ### Repo Info
> - remote URL (for owner/name extraction)

### Step 2: Synthesize Handoff

From the sub-agent findings and conversation context, compose a rich Markdown document. The document MUST include at minimum:

- **Task**: What is being worked on (one-line summary as H1 heading)
- **Next Actions**: Concrete steps for the next session to pick up

Additional sections to include when relevant:
- **Current State**: Branch, PR status, CI status, what's deployed vs local
- **Architecture / Design**: Key design decisions or patterns the next session should know
- **References**: File paths, URLs, related PRs, Notion links
- **Known Issues**: Blockers, flaky tests, environment-specific gotchas
- **Verification Steps**: How to validate the work (commands, expected output)

Write the body as **rich Markdown** — use code blocks, tables, command examples, and structured sections. This document will be read directly by the next Claude Code session via \`Read\`.

### Step 3: Derive Metadata

- **slug**: From $ARGUMENTS or task name. Kebab-case, max 50 chars (e.g., \`wrm-daemon-distribution\`, \`ci-setup\`)
- **repo**: Parse \`git remote get-url origin\` output to extract owner and name
- **tags**: \`topic:<slug>\` plus any relevant existing tags (check with \`sd list tags\`)
- **keywords_en**: 3-7 English keywords for search

### Step 4: Write to DB + Export

Pipe the Markdown body to the handoff command. The command handles DB upsert and file export automatically:

\`\`\`sh
cat <<'HANDOFF_EOF' | sd handoff write --slug <slug> --repo-owner <owner> --repo-name <name> --tags topic:<slug> --stdin
<full Markdown body here>
HANDOFF_EOF
\`\`\`

If a handoff with the same slug already exists (active), it will be updated in place.

The output JSON includes \`file_path\` — the exported Markdown location.

### Step 5: Present

Display the result to the user in Japanese:

\`\`\`
ハンドオフを記録しました。

**Slug**: <slug>
**File**: <file_path>

次のセッションで以下のコマンドで読み込めます:
  Read <file_path>
  sd handoff get <slug>
\`\`\`

## Constraints

- This skill is **non-interactive**. Do NOT use AskUserQuestion.
- Do NOT modify any code — this is a recording-only skill.
- Do NOT enter plan mode (no EnterPlanMode).
- Write the handoff directly — do NOT ask for confirmation before DB writes.
- Keep context gathering lightweight — max 1 sub-agent launch.
- If the handoff body would be very short (< 5 lines), that's fine — not every handoff needs to be comprehensive. Capture what matters for the next session.

${ctx.commandDocs(["handoff", "node", "link", "list"])}
`;
}
