# agent-extensions

This repository is a Claude Code plugin marketplace owned by whatasoda.

## Repository Purpose

Manage and distribute personal Claude Code plugins and skills via the marketplace mechanism.

## Tech Stack

- **Runtime / Build**: Bun + rslib (for packages)
- **Language**: TypeScript
- **Dependency management**: Bun workspaces (`plugins/*`, `packages/*`)
- **Package build**: rslib (ESM + DTS)
- **Plugin build**: `bun build` (self-contained bundle)
- **Build output**: `plugins/*/dist/` (Git LFS tracked, committed)

## Conventions

### Plugin Structure

Each plugin lives under `plugins/<plugin-name>/` and must contain:

- `.claude-plugin/plugin.json` - Plugin manifest with name, description, version
- `package.json` - Plugin dependencies (can reference `@agent-extensions/*` packages)
- `tsconfig.json` - Extends root `tsconfig.json`
- `skills/<skill-name>/SKILL.md` - At least one skill definition
- `skills/<skill-name>/README.md` - Skill context document (background, purpose, design rationale for future improvement)

Optional:

- `src/` - TypeScript source (built to `dist/` via `bun run build`)
- `hooks/hooks.json` - Event-driven hook definitions (reference `${CLAUDE_PLUGIN_ROOT}/dist/...`)
- `.mcp.json` - MCP server configurations
- `.lsp.json` - LSP server configurations

### Shared Packages

Shared libraries live under `packages/<package-name>/`:

- `package.json` with name `@agent-extensions/<package-name>`
- `tsconfig.json` extending root
- `src/` with TypeScript source
- `rslib.config.ts` for building with rslib (ESM + DTS)
- `@public-index.ts` entry point (sync-exports convention)
- Plugins reference them as `"@agent-extensions/<name>": "workspace:*"`
- Bundled into plugin `dist/` at build time (not needed at install time)

#### sync-exports convention

Packages use the `@public-*` file naming pattern to declare exports:

- `@public-index.ts` → `"."` (main entry)
- `@public-utils.ts` → `"./utils"`

The `@agent-extensions/sync-exports` package provides tooling to detect these files and generate the `exports` field in `package.json` and rslib entry configuration.

### Build

`bun run build` runs two phases in order:

1. **Packages** (`bun run build:packages`):
   - Runs `syncExports()` on all packages to auto-generate `exports` fields in `package.json` from `@public-*.ts` files
   - Then builds each `packages/*/rslib.config.ts` with rslib (ESM + DTS)
2. **Plugins** (`bun run build:plugins`): Bundles each `plugins/*/src/` into `dist/` using `bun build`

- Plugin builds inline all dependencies (including `@agent-extensions/*` packages) so `dist/` is self-contained
- `plugins/*/dist/` is committed (LFS tracked) because marketplace install cannot run builds
- `packages/*/dist/` is **not** committed (gitignored) — only needed locally for development

### Marketplace Registration

When adding or removing a plugin, update `.claude-plugin/marketplace.json`:

- Add an entry to the `plugins` array with `name`, `source` (relative path), `description`, and `version`
- Keep the `metadata.version` in sync when making structural changes

### Naming

- Plugin names: kebab-case (e.g., `my-plugin`)
- Skill names: kebab-case (e.g., `review-code`)
- Package names: `@agent-extensions/<kebab-case>` (e.g., `@agent-extensions/utils`)
- Marketplace name: `whatasoda-tools`
