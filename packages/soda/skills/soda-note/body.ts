export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `
Use English for internal reasoning (thinking). User interaction must be in Japanese.

## Purpose

Quick, non-interactive capture of insights and ideas into the knowledge graph with automatic related-node discovery and linking.

If $ARGUMENTS is empty, output a brief message in Japanese asking what they want to record, then stop.

## Procedure

Follow these steps sequentially. Do NOT ask the user for confirmation at any point — this skill is fully automatic.

### Step 1: Analyze Content

Parse $ARGUMENTS as the note content. From the content, generate:

- **summary_en**: A concise one-line English summary (for FTS indexing)
- **keywords_en**: An array of 3-7 English keywords (for FTS indexing)

### Step 2: Discover Existing Tags

Run:
\`\`\`sh
sd list tags
\`\`\`

From the returned list, select tags that match the note's topic. Use ONLY tags that already exist — do NOT invent new tags. Zero matching tags is acceptable.

### Step 3: Search Related Nodes

Run:
\`\`\`sh
sd node search --query "<space-separated keywords_en>" --limit 5
\`\`\`

The output is JSON: \`{"nodes": [...], "total": N}\`. Each node has \`id\`, \`body\`, \`kind\`, \`properties\`, and \`tags\` fields. There is no \`title\` field — use \`body\` (first line, truncated) or \`properties.summary_en\` as the display label.

If the result has zero nodes, proceed to Step 4 with an empty related-nodes list.

### Step 4: Create Idea Node

Create the node by piping JSON to stdin:

\`\`\`sh
echo '{"kind":"idea","body":"<note content>","properties":{"summary_en":"<english summary>","keywords_en":["kw1","kw2"]},"tags":["tag1","tag2"]}' | sd node create --stdin
\`\`\`

Important:
- \`tags\` must be a JSON array (e.g., \`["topic:auth","review"]\`), not a comma-separated string
- If no matching tags were found in Step 2, use an empty array: \`"tags":[]\`
- Escape any special characters in the note content for valid JSON

Capture the created node's \`id\` from the output.

### Step 5: Link Related Nodes

For each related node found in Step 3, create a link:

\`\`\`sh
sd link create <new_node_id> <related_node_id> --type related_to
\`\`\`

Skip this step entirely if no related nodes were found.

### Step 6: Output Result

Output a concise summary in this format:

\`\`\`
✓ 記録しました (<node_id>)
  "<note body, first ~50 chars>"
  関連: N件リンク済み
    → <display label> (<kind>)
    → <display label> (<kind>)
  タグ: tag1, tag2
\`\`\`

- Display label: use \`properties.summary_en\` if available, otherwise first line of \`body\` truncated to ~40 chars
- If zero related nodes: show \`関連: なし\`
- If zero tags: omit the タグ line entirely

${ctx.commandDocs(["node", "tag", "link", "list"])}
`;
}
