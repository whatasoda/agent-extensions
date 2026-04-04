import type { Database } from "../../core/database.js";
import { exitWithError, outputJson } from "../helpers.js";

export async function handleList(db: Database, args: string[]): Promise<void> {
  const [action] = args;

  switch (action) {
    case "kinds":
      return outputJson(db.listKinds());
    case "tags":
      return outputJson(db.listTags());
    default:
      exitWithError("Usage: sd list <kinds|tags>");
  }
}
