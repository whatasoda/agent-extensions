import { mkdirSync } from "fs";
import { dirname } from "path";

export function ensureDbDir(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  mkdirSync(dirname(dbPath), { recursive: true });
}
