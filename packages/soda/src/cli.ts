#!/usr/bin/env bun
export {};

const [, , command] = process.argv;

switch (command) {
  case "node":
  case "tag":
  case "link":
  case "list":
  case "decision":
  case "handoff": {
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
  case "codex-review": {
    const { handleCodexReview } = await import("./cli/commands/codex-review.js");
    await handleCodexReview(process.argv.slice(3));
    break;
  }
  case "session": {
    const { handleSession } = await import("./cli/commands/session.js");
    await handleSession(process.argv.slice(3));
    break;
  }
  case "update": {
    const { handleUpdate } = await import("./cli/commands/update.js");
    await handleUpdate(process.argv.slice(3));
    break;
  }
  case "tui":
  case undefined:
    await import("./tui/index.js");
    break;
  default:
    console.error(
      "Usage: sd <node|tag|link|list|decision|handoff|skill|agent|review|codex-review|session|update|tui>\n\nCommands:\n  node          Create, read, update, delete, search nodes\n  tag           Add or remove tags\n  link          Create, delete, list links\n  list          List kinds or tags\n  decision      Create or list design decisions\n  handoff       Write, list, get, complete session handoffs\n  skill         Print skill body\n  agent         Print agent body\n  review        Review utilities\n  codex-review  Run codex review\n  session       Session utilities\n  update        Update to latest version (sd update [tag])\n  tui           Launch the TUI browser",
    );
    process.exit(1);
}
