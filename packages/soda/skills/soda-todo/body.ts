export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `
Use English for internal reasoning (thinking). User interaction must be in Japanese.

## Todo Schema

| Field    | Type                                     | Default |
|----------|------------------------------------------|---------|
| status   | pending / in_progress / done / cancelled | pending |
| priority | low / medium / high                      | (none)  |
| deadline | ISO 8601 datetime                        | (none)  |

${ctx.commandDocs(["node", "tag"])}

## Instructions

Follow these five steps in order.

### Step 1: Accept Input

Accept the user's raw input. This may be:
- Direct text describing tasks (e.g., "来週までにPRレビュー、あと牛乳買う")
- Vague or compound descriptions that need splitting
- References to conversation context

If the user invokes \`/sb-todo\` without input, ask what they'd like to record.

### Step 2: Groom

Process the raw input into structured todo items:

1. **Split** compound inputs into separate todos (one actionable item per todo)
2. **Clean** body text — concise, actionable phrasing
3. **Infer** priority from urgency cues ("急ぎ" → high, "いつか" → low)
4. **Extract** deadlines from temporal references ("来週" → concrete ISO 8601 datetime, e.g., \`2026-03-28T00:00:00Z\`)
5. **Assign** tags based on content context (e.g., work, personal, shopping)

If critical information is ambiguous or missing and you cannot make a reasonable inference, ask the user before proceeding. Do not guess when uncertain.

### Step 3: Present

Present all groomed todos in a batch list for review:

\`\`\`
以下のTODOを作成します：

1. **PRレビューを完了する**
   - priority: medium
   - deadline: 2026-03-28T00:00:00Z
   - tags: work

2. **牛乳を買う**
   - priority: low
   - tags: shopping
\`\`\`

### Step 4: Approve / Modify

Wait for the user's response:
- **Approval** ("OK", "いいね", etc.) → proceed to Step 5
- **Modification** ("2番のpriorityはhighにして") → apply changes, re-present the full list (return to Step 3)

Repeat until the user approves.

### Step 5: Create

Create each approved todo via CLI:

\`\`\`sh
sd node create --kind todo --body "<body>" --prop status=pending --prop priority=<priority> --tags <tag1>,<tag2>
\`\`\`

Add \`--prop deadline=<datetime>\` when a deadline was specified.

After all nodes are created, show a summary:

\`\`\`
作成完了：
- <id1>: PRレビューを完了する
- <id2>: 牛乳を買う
\`\`\`
`;
}
