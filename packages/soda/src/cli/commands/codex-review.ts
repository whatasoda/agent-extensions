import path from "path";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleCodexReview(args: string[]): Promise<void> {
  const scriptPath = path.join(packageRoot, "scripts", "codex-review.ts");
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
