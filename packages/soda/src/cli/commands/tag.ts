import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli } from "../helpers.js";

export async function handleTag(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "add":
      return tagAdd(db, rest);
    case "remove":
      return tagRemove(db, rest);
    default:
      exitWithError("Usage: soda-brain tag <add|remove> <node-id> <tag1> [tag2 ...]");
  }
}

async function tagAdd(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [nodeId, ...tags] = positionals;
  if (!nodeId || tags.length === 0) {
    exitWithError("Usage: soda-brain tag add <node-id> <tag1> [tag2 ...]");
  }
  db.addTags(nodeId, tags);
  outputJson({ success: true });
}

async function tagRemove(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [nodeId, ...tags] = positionals;
  if (!nodeId || tags.length === 0) {
    exitWithError("Usage: soda-brain tag remove <node-id> <tag1> [tag2 ...]");
  }
  db.removeTags(nodeId, tags);
  outputJson({ success: true });
}
