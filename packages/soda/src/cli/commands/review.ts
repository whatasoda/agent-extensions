import path from "path";
import { exitWithError } from "../helpers.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleReview(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "detect-base-branch":
      return reviewDetectBaseBranch(rest);
    default:
      exitWithError("Usage: soda review <detect-base-branch>");
  }
}

async function reviewDetectBaseBranch(args: string[]): Promise<void> {
  const scriptPath = path.join(packageRoot, "scripts", "detect-base-branch.ts");
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
