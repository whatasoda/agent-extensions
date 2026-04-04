### sd decision

#### sd decision create
Flags: `--constraint` (string, required without --stdin), `--why` (string, required without --stdin), `--scope` (string, required without --stdin), `--repo-owner` (string), `--repo-name` (string), `--tag` (string, multiple), `--rejected-alt-json` (string, JSON array), `--stdin` (boolean)

`--stdin` reads JSON: `{ constraint, properties?: { why, scope, ... }, tags? }`

Example:
```sh
sd decision create --constraint "Use SQLite for local storage" \
  --why "No network dependency, single-file DB" \
  --scope "packages/soda/src/core" \
  --repo-owner whatasoda --repo-name agent-extensions \
  --tag topic:architecture
```

#### sd decision list
Flags: `--tag` (string, multiple), `--repo` (string, format `owner/name`), `--limit` (number, default 50)

When `--repo` is used, results are filtered to decisions with matching repo_owner and repo_name properties.

Example:
```sh
sd decision list --repo whatasoda/agent-extensions --tag topic:architecture
```
