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

## Structure

```
agent-extensions/
├── .claude-plugin/
│   └── marketplace.json   # Marketplace manifest
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/
│       │   └── plugin.json    # Plugin manifest
│       ├── skills/
│       │   └── <skill-name>/
│       │       └── SKILL.md   # Skill definition
│       ├── hooks/
│       │   └── hooks.json     # Hook definitions
│       ├── .mcp.json          # MCP server config
│       └── .lsp.json          # LSP server config
├── .gitignore
├── CLAUDE.md
└── README.md
```

## Adding a Plugin

1. Create a directory under `plugins/` with your plugin name
2. Add `.claude-plugin/plugin.json` with the plugin manifest
3. Add skills, hooks, MCP/LSP configs as needed
4. Register the plugin in `.claude-plugin/marketplace.json` under `plugins`
