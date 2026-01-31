# agent-extensions

This repository is a Claude Code plugin marketplace owned by whatasoda.

## Repository Purpose

Manage and distribute personal Claude Code plugins and skills via the marketplace mechanism.

## Tech Stack

- **Runtime / Build**: Bun
- **Language**: TypeScript
- **Dependency management**: Bun workspaces (`plugins/*`, `packages/*`)
- **Build output**: `plugins/*/dist/` (Git LFS tracked, committed)

## Conventions

### Plugin Structure

Each plugin lives under `plugins/<plugin-name>/` and must contain:

- `.claude-plugin/plugin.json` - Plugin manifest with name, description, version
- `package.json` - Plugin dependencies (can reference `@agent-extensions/*` packages)
- `tsconfig.json` - Extends root `tsconfig.json`
- `skills/<skill-name>/SKILL.md` - At least one skill definition

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
- Plugins reference them as `"@agent-extensions/<name>": "workspace:*"`
- Bundled into plugin `dist/` at build time (not needed at install time)

### Build

- `bun run build` builds all plugins with `src/` directories
- Each plugin's `src/**/*.ts` is bundled into `dist/` using `bun build`
- External dependencies are inlined so `dist/` is self-contained
- `dist/` is committed (LFS tracked) because marketplace install cannot run builds

### Marketplace Registration

When adding or removing a plugin, update `.claude-plugin/marketplace.json`:

- Add an entry to the `plugins` array with `name`, `source` (relative path), `description`, and `version`
- Keep the `metadata.version` in sync when making structural changes

### Naming

- Plugin names: kebab-case (e.g., `my-plugin`)
- Skill names: kebab-case (e.g., `review-code`)
- Package names: `@agent-extensions/<kebab-case>` (e.g., `@agent-extensions/utils`)
- Marketplace name: `whatasoda-tools`
