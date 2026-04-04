### sd link

#### sd link create <from> <to> --type <type>
Positionals: from-node ID, to-node ID (both required)
Flags: `--type` (string, required)

Example:
```sh
sd link create 01KNBXBK8E 01KNBXCAH8 --type decided_during
```

#### sd link delete <from> <to> --type <type>
Positionals: from-node ID, to-node ID (both required)
Flags: `--type` (string, required)

Example:
```sh
sd link delete 01KNBXBK8E 01KNBXCAH8 --type decided_during
```

#### sd link list <id>
Positional: node ID (required)
Flags: `--direction` (string: `from` | `to` | `both`, default `both`)

Example:
```sh
sd link list 01KNBXCAH8 --direction from
```
