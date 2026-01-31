# agent-extensions

Personal Claude Code marketplace for managing custom skills and plugins.

## Setup

Add this marketplace to Claude Code:

```
/plugin marketplace add whatasoda/agent-extensions
```

Install a plugin:

```
/plugin install <plugin-name>@whatasoda-tools
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)

### Getting started

```sh
bun install
```

### Build

Build packages (rslib) then plugins (bun build):

```sh
bun run build
```

Or build individually:

```sh
bun run build:packages   # rslib build for packages/*
bun run build:plugins    # bun build for plugins/*
```

### Type check

```sh
bun run typecheck
```

## Structure

```
agent-extensions/
├── .claude-plugin/
│   └── marketplace.json       # Marketplace manifest
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/
│       │   └── plugin.json    # Plugin manifest
│       ├── src/               # TypeScript source
│       ├── dist/              # Bundled output (LFS, committed)
│       ├── skills/            # Skill definitions
│       ├── hooks/             # Hook definitions
│       └── package.json
├── packages/
│   └── <package-name>/       # Shared libraries (workspace packages)
│       ├── src/
│       └── package.json       # @agent-extensions/<name>
├── scripts/
│   ├── build-packages.ts     # rslib build for packages
│   └── build-plugins.ts      # bun build for plugins
├── package.json               # Workspace root
└── tsconfig.json
```

## Adding a Plugin

1. Create `plugins/<plugin-name>/` with `.claude-plugin/plugin.json`
2. Add TypeScript source in `src/`, skills in `skills/`
3. Run `bun run build` to generate `dist/`
4. Register in `.claude-plugin/marketplace.json` under `plugins`

## Adding a Shared Package

1. Create `packages/<package-name>/` with `package.json` (name: `@agent-extensions/<name>`)
2. Add source in `src/`
3. Reference from plugins via `"@agent-extensions/<name>": "workspace:*"` in their `package.json`
