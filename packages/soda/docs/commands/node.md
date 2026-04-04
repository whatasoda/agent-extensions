### sd node

#### sd node create
Flags: `--kind` (string, required without --stdin), `--body` (string), `--tags` (comma-separated string), `--prop` (string, multiple: `key=value`), `--props-json` (string, JSON object), `--stdin` (boolean)

`--stdin` reads JSON: `{ kind, body?, properties?, tags? }`

Example:
```sh
sd node create --kind memo --body "Design note about auth flow" --tags "topic:auth,review"
```

#### sd node get <id>
Positional: node ID (required)

Example:
```sh
sd node get 01KNBXBK8E0H0FQJ3CRRW0NJ19
```

#### sd node update <id>
Positional: node ID (required)
Flags: `--body` (string), `--kind` (string), `--prop` (string, multiple: `key=value`), `--props-json` (string, JSON object), `--stdin` (boolean)

`--stdin` reads JSON: `{ body?, kind?, properties? }`

Example:
```sh
sd node update 01KNBXBK8E --body "Updated content"
```

#### sd node delete <id>
Positional: node ID (required)

Example:
```sh
sd node delete 01KNBXBK8E
```

#### sd node search
Flags: `--query` (string), `--kind` (string), `--tags` (comma-separated string), `--limit` (number, default 20), `--offset` (number, default 0)

Example:
```sh
sd node search --kind memo --tags "topic:auth" --limit 10
```
