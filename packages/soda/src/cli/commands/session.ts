import path from "path";
import { exitWithError } from "../helpers.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleSession(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "resolve":
      return sessionResolve(rest);
    default:
      exitWithError("Usage: wat session <resolve>");
  }
}

async function sessionResolve(args: string[]): Promise<void> {
  const scriptPath = path.join(packageRoot, "scripts", "resolve-session.ts");
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
