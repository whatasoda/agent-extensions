import path from "path";
import { exitWithError, resolveScript } from "../helpers.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleSession(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "resolve":
      return sessionResolve(rest);
    default:
      exitWithError("Usage: sd session <resolve>");
  }
}

async function sessionResolve(args: string[]): Promise<void> {
  const scriptPath = resolveScript(packageRoot, "resolve-session");
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
