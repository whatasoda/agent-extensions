# agent-extensions

This repository is a Claude Code plugin marketplace owned by whatasoda.

## Repository Purpose

Manage and distribute personal Claude Code plugins and skills via the marketplace mechanism.

## Conventions

### Plugin Structure

Each plugin lives under `plugins/<plugin-name>/` and must contain:

- `.claude-plugin/plugin.json` - Plugin manifest with name, description, version
- `skills/<skill-name>/SKILL.md` - At least one skill definition

Optional:

- `hooks/hooks.json` - Event-driven hook definitions
- `.mcp.json` - MCP server configurations
- `.lsp.json` - LSP server configurations

### Marketplace Registration

When adding or removing a plugin, update `.claude-plugin/marketplace.json`:

- Add an entry to the `plugins` array with `name`, `source` (relative path), `description`, and `version`
- Keep the `metadata.version` in sync when making structural changes

### Naming

- Plugin names: kebab-case (e.g., `my-plugin`)
- Skill names: kebab-case (e.g., `review-code`)
- Marketplace name: `whatasoda-tools`
