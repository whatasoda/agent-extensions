### sd handoff

#### sd handoff write
Flags: `--slug` (string, required), `--repo-owner` (string), `--repo-name` (string), `--tags` (comma-separated string), `--stdin` (boolean)

`--stdin` reads raw Markdown text from stdin (NOT JSON).

Upsert behavior: if an active handoff with the same slug exists, it updates the existing node. Otherwise, creates a new node.

Exports the Markdown body to `~/.soda-agent-tools/handoffs/<node-id>.md`.

Example:
```sh
echo "# WRM daemon handoff\n\n## Next Actions\n- Fix Dockerfile" \
  | sd handoff write --slug wrm-daemon --repo-owner dinii-inc --repo-name dinii-self-all --tags topic:wrm-daemon --stdin
```

#### sd handoff list
Flags: `--status` (string: `active` | `completed`, default `active`), `--repo` (string, format `owner/name`), `--tags` (comma-separated string)

Output: JSON array of `{ id, slug, status, title, updated_at, file_path }`.

Example:
```sh
sd handoff list
sd handoff list --status completed
sd handoff list --repo dinii-inc/dinii-self-all --tags topic:wrm-daemon
```

#### sd handoff get <id-or-slug>
Positional: node ID or slug (required)

Resolves by node ID first, then by slug. Output includes `file_path` for the exported Markdown.

Example:
```sh
sd handoff get wrm-daemon
sd handoff get 01KPAD613B7N6P473B37V7K7PJ
```

#### sd handoff complete <id-or-slug>
Positional: node ID or slug (required)

Sets status to `completed` via read-merge-write (preserves all existing properties).

Example:
```sh
sd handoff complete wrm-daemon
```
