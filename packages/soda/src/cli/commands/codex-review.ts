import path from "path";
import { resolveScript } from "../helpers.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleCodexReview(args: string[]): Promise<void> {
  const scriptPath = resolveScript(packageRoot, "codex-review");
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
