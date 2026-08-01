### sd handoff

#### sd handoff generate
Generates, reviews, and writes the handoff document with Codex in one command. Resolves the current
Claude transcript, snapshots repository state, and runs `codex exec` under a read-only sandbox with a
structured output schema. There is no fallback: any failure exits non-zero and writes nothing.

Pipeline (one `codex exec` call per step, each with its own `--timeout-seconds` budget):

1. **author** — writes the document from the transcript evidence and repository snapshot.
2. **review** — an independent pass checks the draft against the same evidence and verifies cited
   paths in the repository. An issue is a `blocker` only when the next session would act wrongly
   because of it; harmless imprecision is `improve`.
3. **revise** — the author applies the reviewer's fixes and returns the full corrected document.

Steps 2-3 repeat up to `--review-rounds` times, stopping as soon as a review accepts. The final
round is a verdict, not an edit. Blockers still open at that point do not discard the handoff: they
are appended to the document as an **Unresolved review findings** section and counted in
`review.blockers`, so the next session knows which statements are unverified. Every prompt and
result stays in `artifacts_dir`.

Positionals are joined into the scope hint when `--scope` is absent.

Flags: `--scope` (string), `--slug` (string, otherwise Codex derives it), `--model` (string, default `gpt-5.4`),
`--review-rounds` (number, default `2`, `0` disables review),
`--tags` (comma-separated string, added on top of `topic:<slug>` and the tags Codex proposes),
`--repo-owner` / `--repo-name` (string, default: parsed from the `origin` remote),
`--transcript` (path), `--session-id` (string), `--claude-config-dir` (path, default `$CLAUDE_CONFIG_DIR`),
`--from-turn` / `--to-turn` (number), `--allow-latest-fallback` (boolean),
`--max-transcript-chars` (number, default `300000` — oldest turns are dropped first),
`--timeout-seconds` (number, default `1800`, per Codex pass), `--dry-run` (boolean — build the authoring prompt, skip Codex),
`--output` (`full` | `compact`, default `compact`)

Output (`compact`):
`{ id, slug, status, title, updated_at, file_path, model, review, transcript, artifacts_dir, prompt_path }`,
where `review` is `{ rounds_run, revisions, verdict, blockers, improvements, notes }`.
`--output full` adds `review.issues`. `--dry-run` returns
`{ dry_run, slug, model, artifacts_dir, prompt_path, transcript, repo }`.

**The handoff body is never printed**, in either output mode — it is written for the next session to
`Read` from `file_path`, not for the calling agent to ingest. Use `sd handoff get` when a human
wants the text. Every path in the output is absolute.

Stores `generated_by: "codex"`, `model`, and `keywords_en` on the node alongside the usual handoff properties.

Example:
```sh
sd handoff generate --scope "wrm daemon distribution"
sd handoff generate --slug ci-setup --review-rounds 3
sd handoff generate --dry-run
```

#### sd handoff write
Flags: `--slug` (string, required), `--repo-owner` (string), `--repo-name` (string), `--tags` (comma-separated string), `--stdin` (boolean), `--output` (`full` | `compact`, default `full`)

`--stdin` reads raw Markdown text from stdin (NOT JSON).

Upsert behavior: if an active handoff with the same slug exists, it updates the existing node. Otherwise, creates a new node.

Exports the Markdown body to `~/.soda-agent-tools/handoffs/<node-id>.md`.

Use `--output compact` in automated workflows to return only
`{ id, slug, status, updated_at, file_path }` without echoing the Markdown body.

Example:
```sh
echo "# WRM daemon handoff\n\n## Next Actions\n- Fix Dockerfile" \
  | sd handoff write --slug wrm-daemon --repo-owner dinii-inc --repo-name dinii-self-all --tags topic:wrm-daemon --stdin --output compact
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
