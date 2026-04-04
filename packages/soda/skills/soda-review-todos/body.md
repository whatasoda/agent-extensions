
## Available CLI Commands (wat)

| Command | Description |
|---|---|
| `sd node search` | Search nodes with `--query`, `--kind`, `--tags`, `--limit`, `--offset` |
| `sd node update <id>` | Update a node's `--body`, `--kind`, `--prop`, `--props-json`, or via `--stdin` |
| `sd node get <id>` | Retrieve a node with all its relations (tags, links) |
| `sd list kinds` | List all node kinds with counts |

## Instructions
1. Fetch all TODOs: `sd node search --kind todo`
2. If tags provided, filter: `sd node search --kind todo --tags <tag1>,<tag2>`
3. Present TODOs grouped by status (pending → in_progress → done)
4. For each pending TODO, discuss with user:
   - Priority assessment (suggest based on deadlines, dependencies)
   - Status update if needed → `sd node update <id> --prop status=in_progress --prop priority=high`
5. Identify blocked or stale TODOs
6. Summarize changes made
