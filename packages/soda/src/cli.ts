#!/usr/bin/env bun
export {};

const [, , command] = process.argv;

switch (command) {
  case "node":
  case "tag":
  case "link":
  case "list":
  case "decision": {
    const { runCli } = await import("./cli/index.js");
    await runCli(command, process.argv.slice(3));
    break;
  }
  case "skill": {
    const { handleSkill } = await import("./cli/commands/skill.js");
    await handleSkill(process.argv.slice(3));
    break;
  }
  case "agent": {
    const { handleAgent } = await import("./cli/commands/agent.js");
    await handleAgent(process.argv.slice(3));
    break;
  }
  case "review": {
    const { handleReview } = await import("./cli/commands/review.js");
    await handleReview(process.argv.slice(3));
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
  default:
    console.error(
      "Usage: wat <node|tag|link|list|tui|setup>\n\nCommands:\n  node    Create, read, update, delete, search nodes\n  tag     Add or remove tags\n  link    Create, delete, list links\n  list    List kinds or tags\n  tui     Launch the TUI browser\n  setup   Configure Claude Code integration",
    );
    process.exit(1);
}
