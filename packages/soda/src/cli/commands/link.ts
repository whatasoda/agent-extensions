import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli } from "../helpers.js";

export async function handleLink(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "create":
      return linkCreate(db, rest);
    case "delete":
      return linkDelete(db, rest);
    case "list":
      return linkList(db, rest);
    default:
      exitWithError("Usage: soda-brain link <create|delete|list>");
  }
}

async function linkCreate(db: Database, args: string[]): Promise<void> {
  const { positionals, values } = parseCli(args, {
    type: { type: "string" },
  });

  const [fromId, toId] = positionals;
  if (!fromId || !toId || !values.type) {
    exitWithError("Usage: soda-brain link create <from-id> <to-id> --type <link-type>");
  }
  const result = db.createLink(fromId, toId, values.type as string);
  outputJson(result);
}

async function linkDelete(db: Database, args: string[]): Promise<void> {
  const { positionals, values } = parseCli(args, {
    type: { type: "string" },
  });

  const [fromId, toId] = positionals;
  if (!fromId || !toId || !values.type) {
    exitWithError("Usage: soda-brain link delete <from-id> <to-id> --type <link-type>");
  }
  db.deleteLink(fromId, toId, values.type as string);
  outputJson({ success: true });
}

async function linkList(db: Database, args: string[]): Promise<void> {
  const { positionals, values } = parseCli(args, {
    direction: { type: "string" },
  });

  const [nodeId] = positionals;
  if (!nodeId) {
    exitWithError("Usage: soda-brain link list <node-id> [--direction from|to|both]");
  }

  const direction = (values.direction as string | undefined) ?? "both";
  if (direction !== "from" && direction !== "to" && direction !== "both") {
    exitWithError("Error: --direction must be from, to, or both");
  }

  const result = db.getLinks(nodeId, direction);
  outputJson(result);
}
