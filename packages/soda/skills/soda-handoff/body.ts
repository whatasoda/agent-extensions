export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `Write a session handoff for cross-worktree continuity. This skill is **non-interactive** — it runs one command and reports the result.

The handoff document is authored **and reviewed** by Codex, not by you. \`sd handoff generate\` resolves the current Claude transcript, snapshots the repository state, has \`codex exec\` write the document under a read-only sandbox, then has a second Codex pass review it against the same evidence and revise it. Anything the review cannot clear is recorded inside the stored document as an "Unresolved review findings" section.

Status messages to the user must be in Japanese.

**When to use**: When ending a session with work still in progress. For completed work, use \`/soda-recap\` instead.

## Procedure

### Step 1: Generate

Run the command. If $ARGUMENTS is not empty, pass it as the scope hint:

\`\`\`sh
sd handoff generate --scope "$ARGUMENTS"
\`\`\`

With no arguments, run \`sd handoff generate\` alone.

The command runs several Codex passes and takes several minutes. Do not run anything else while waiting.

### Step 2: Present

On success the command prints one JSON object. Every path in it is absolute — report paths **exactly as printed**, never shortened, relativized, or rewritten with \`~\`.

\`\`\`
ハンドオフを記録しました。

**Title**: <title>
**Slug**: <slug>
**File**: <file_path>
**Review**: <review.rounds_run> ラウンド / 修正 <review.revisions> 回 / 判定 <review.verdict>

次のセッションで以下のコマンドで読み込めます:
  Read <file_path>
  sd handoff get <slug>
\`\`\`

When \`review.blockers\` is greater than 0, say so explicitly — the document was stored with an
"Unresolved review findings" section listing what Codex could not clear, and the user may want to
rerun with a higher \`--review-rounds\`:

\`\`\`
⚠ 未解決の指摘が <review.blockers> 件あります（本文末尾の "Unresolved review findings" に記載）。
\`\`\`

### Step 3: On failure

The command exits non-zero with \`Error: <reason>\` on stderr and writes nothing. Report the reason to the user in Japanese and stop.

**Do NOT write the handoff yourself.** Generation belongs to Codex; there is no Claude-side fallback. Common causes and the flag that addresses them:

- transcript could not be resolved → \`--transcript <path>\`, \`--session-id <id>\`, or \`--allow-latest-fallback\`
- \`codex\` not found → the Codex CLI is not installed; the user must fix that
- timeout → \`--timeout-seconds <n>\` (default 1800, applied per Codex pass)
- transcript too large → \`--max-transcript-chars <n>\` (default 300000) or \`--from-turn\` / \`--to-turn\`

## Constraints

- **Never read the handoff.** Do not \`Read\` \`file_path\`, do not run \`sd handoff get\`, do not \`cat\` the exported Markdown. The document is written for the *next* session; pulling it into this session's context wastes it and gives you nothing. The command deliberately never prints the body — do not go looking for it.
- Do NOT gather context yourself — no sub-agents, no \`git\` inspection, no file reads. The command does all of it.
- Do NOT compose, review, or edit the handoff body. The review pass is Codex's job, and its verdict is final.
- Do NOT modify any code — this is a recording-only skill.
- Do NOT use AskUserQuestion, and do NOT enter plan mode.
- Run the command directly — do NOT ask for confirmation first.

${ctx.commandDocs(["handoff"])}
`;
}
