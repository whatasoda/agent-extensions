### sd insights

#### sd insights analyze

Read Claude Code JSONL transcripts and emit an aggregate, privacy-preserving
usage report.

Flags:

- `--days` (positive number, default `7`)
- `--since` (ISO timestamp; overrides the calculated start)
- `--until` (ISO timestamp, default now)
- `--root` (transcript root, default `~/.claude/projects`)
- `--pretty` (pretty-print JSON)

The scanner:

- filters by each entry timestamp rather than file modification time
- de-duplicates split and fork-copied API responses by `message.id`
- reads nested `subagents/agent-*.jsonl` transcripts
- separates root and subagent usage
- reports input, cache creation, cache read, output, and processed-context tokens
- retains no conversation, thinking, command text, or tool output

Example:

```sh
sd insights analyze --days 14 --pretty
```

#### sd insights workstreams

Resolve multi-handoff workstreams from high-confidence evidence and attach
session-level token and outcome aggregates.

Additional flags:

- `--db` (knowledge graph SQLite path, default `~/.soda-agent-tools/data.db`)
- `--min-handoffs` (minimum component size, default `2`)
- `--limit` (maximum workstreams and topic candidates returned, default `10`)
- `--detail` (include root/subagent token breakdowns and up to five recent handoffs)

The default summary view keeps output small while retaining per-workstream
context, cache-read share, subagent share, artifacts, and the latest handoff.
Use `--detail` when investigating one of the reported hotspots.

Confirmed component edges are limited to:

- allowlisted handoff-to-handoff knowledge graph links
- a session that explicitly references or gets handoff A and writes handoff B

Shared topic tags are reported as merge candidates only. Outputs from
`sd handoff list`, node searches, assistant prose matches, and repo/branch
similarity are not used as component edges.

```sh
sd insights workstreams --days 14 --pretty
sd insights workstreams --days 14 --limit 3 --detail --pretty
```
