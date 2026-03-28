# agent-extensions

This repository is a Claude Code plugin marketplace owned by whatasoda.

## Repository Purpose

Manage and distribute personal Claude Code plugins and skills via the marketplace mechanism. The primary deliverable is `@whatasoda/agent-tools` — a unified npm package (CLI: `wat`) combining workflow skills and a knowledge graph.

## Tech Stack

- **Runtime**: Bun (TypeScript source distribution, no build step)
- **Language**: TypeScript
- **Dependency management**: Bun workspaces (`plugins/*`, `packages/*`)
- **npm package**: `@whatasoda/agent-tools` (published from `packages/soda/`)
- **Knowledge graph**: SQLite via `bun:sqlite` (`~/.soda-brain/brain.db`)

## Architecture

### Distribution Model

Skills and agents are distributed via a two-layer system:

1. **npm package** (`packages/soda/`): Contains all source code, skill bodies, agent bodies, CLI, TUI, and core library. Published as `@whatasoda/agent-tools` with CLI entry point `wat`.
2. **Marketplace stubs** (`plugins/soda/`): Thin SKILL.md files with YAML frontmatter + bash embedding (`!`wat skill print <name>``). Installed via Claude Code marketplace.

Updating skills only requires `npm update` — marketplace stubs rarely change.

### packages/soda/ — npm package

```
packages/soda/
  package.json          # @whatasoda/agent-tools, bin: { wat: "src/cli.ts" }
  src/
    cli.ts              # CLI entry point (#!/usr/bin/env bun)
    cli/                # CLI dispatcher and command handlers
      commands/         # node, tag, link, list, decision, skill, agent, review
    core/               # Database, types, kinds, search, schema
    tui/                # Ink/React read-only TUI
    setup/              # Global install helper
  skills/               # Skill body .md files (wat skill print reads these)
    soda-discuss/body.md
    soda-plan/body.md
    ...
  agents/               # Agent body .md files (wat agent print reads these)
    team-worker/body.md
    ...
  scripts/              # Utility scripts (codex-review, resolve-session, detect-base-branch)
```

### plugins/soda/ — marketplace stubs

```
plugins/soda/
  .claude-plugin/plugin.json
  package.json
  hooks/hooks.json      # Empty
  skills/
    soda-discuss/SKILL.md   # frontmatter + !`wat skill print soda-discuss`
    ...
  agents/
    team-worker.md          # frontmatter + !`wat agent print team-worker`
    ...
```

### CLI Commands (wat)

```
wat node create|get|update|delete|search   # Knowledge graph CRUD
wat tag add|remove                         # Node tagging
wat link create|delete|list                # Typed directional links
wat list kinds|tags                         # Metadata listing
wat decision create|list                   # Design decision management
wat skill print <name>                     # Output skill body for marketplace stubs
wat agent print <name>                     # Output agent body for marketplace stubs
wat review detect-base-branch              # Git branch detection utility
wat tui                                    # Read-only knowledge graph browser
wat setup                                  # Global install helper
```

## Conventions

### Skill Structure

Each skill has two parts:
- **Body** (`packages/soda/skills/<name>/body.md`): The actual skill content, served by CLI
- **Stub** (`plugins/soda/skills/<name>/SKILL.md`): Frontmatter + bash embedding

Stubs contain security-relevant settings (allowed-tools) that should not change with npm updates.

### Marketplace Registration

`.claude-plugin/marketplace.json` registers the `soda` plugin. Keep the `version` field in sync with `plugins/soda/.claude-plugin/plugin.json`.

### CI / Automation

GitHub Actions (`.github/workflows/ci.yml`) on push to main:

1. Runs tests (`packages/soda`)
2. Detects plugin changes → auto-bumps plugin version
3. Detects package changes → auto-bumps package version + publishes to npm
4. Commits version bumps with `[skip ci]`

**Version bumping:**
- **Patch versions**: Handled automatically by CI
- **Minor/major versions**: Bump manually
- `scripts/bump-version.ts` handles plugin version bumps

### Naming

- Plugin name: `soda`
- Skill prefix: `soda-` (e.g., `soda-discuss`, `soda-plan`)
- npm package: `@whatasoda/agent-tools`
- CLI binary: `wat`
- Marketplace: `whatasoda-tools`
