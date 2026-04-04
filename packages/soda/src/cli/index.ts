import os from "os";
import path from "path";
import { Database } from "../core/database.js";
import { ensureDbDir } from "../core/ensure-dirs.js";
import { handleDecision } from "./commands/decision.js";
import { handleLink } from "./commands/link.js";
import { handleList } from "./commands/list.js";
import { handleNode } from "./commands/node.js";
import { handleTag } from "./commands/tag.js";
import { exitWithError } from "./helpers.js";

export async function runCli(resource: string, args: string[]): Promise<void> {
  const DB_PATH = process.env.SODA_AGENT_TOOLS_DB ?? path.join(os.homedir(), ".soda-agent-tools", "data.db");
  ensureDbDir(DB_PATH);
  const db = new Database(DB_PATH);

  try {
    switch (resource) {
      case "node":
        await handleNode(db, args);
        break;
      case "tag":
        await handleTag(db, args);
        break;
      case "link":
        await handleLink(db, args);
        break;
      case "list":
        await handleList(db, args);
        break;
      case "decision":
        await handleDecision(db, args);
        break;
      default:
        exitWithError(
          "Usage: sd <node|tag|link|list|tui|setup>\n\nCommands:\n  node    Create, read, update, delete, search nodes\n  tag     Add or remove tags\n  link    Create, delete, list links\n  list    List kinds or tags\n  tui     Launch the TUI browser\n  setup   Configure Claude Code integration",
        );
    }
  } catch (e) {
    exitWithError(`Error: ${String(e instanceof Error ? e.message : e)}`);
  } finally {
    db.close();
  }
}
