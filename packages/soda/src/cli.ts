#!/usr/bin/env bun
export {};

const [, , command] = process.argv;

switch (command) {
  case "node":
  case "tag":
  case "link":
  case "list": {
    const { runCli } = await import("./cli/index.js");
    await runCli(command, process.argv.slice(3));
    break;
  }
  case "tui":
  case undefined:
    // @ts-expect-error: .tsx import works at runtime with Bun
    await import("./tui/index.tsx");
    break;
  case "setup":
    await import("./setup/index.js");
    break;
  // TODO: skill    - Manage skill nodes
  // TODO: agent    - Manage agent nodes
  // TODO: decision - Manage decision nodes
  // TODO: review   - Review and summarize nodes
  default:
    console.error(
      "Usage: wat <node|tag|link|list|tui|setup>\n\nCommands:\n  node    Create, read, update, delete, search nodes\n  tag     Add or remove tags\n  link    Create, delete, list links\n  list    List kinds or tags\n  tui     Launch the TUI browser\n  setup   Configure Claude Code integration",
    );
    process.exit(1);
}
