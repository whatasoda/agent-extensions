#!/usr/bin/env bun
/**
 * Setup loop directory with gitignore check and file existence checks.
 *
 * Usage:
 *   bun setup-loop-dir.ts <repo-root> <loop-name> [--check file1 file2 ...]
 *
 * Output (JSON):
 *   {
 *     "loopDir": "/abs/path/.agent-loops/loop-name",
 *     "created": true,
 *     "gitignored": true,
 *     "existing": ["VISION.md"],
 *     "missing": ["PROGRESS.md"]
 *   }
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

interface Output {
  loopDir: string;
  created: boolean;
  gitignored: boolean;
  existing: string[];
  missing: string[];
}

interface ErrorOutput {
  error: string;
}

function checkGitIgnored(repoRoot: string, path: string): boolean {
  const result = Bun.spawnSync(["git", "check-ignore", "-q", path], {
    cwd: repoRoot,
  });
  return result.exitCode === 0;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    const error: ErrorOutput = {
      error:
        "Usage: bun setup-loop-dir.ts <repo-root> <loop-name> [--check file1 file2 ...]",
    };
    console.log(JSON.stringify(error));
    process.exit(1);
  }

  const repoRoot = resolve(args[0]);
  const loopName = args[1];
  const agentLoopsDir = resolve(repoRoot, ".agent-loops");
  const loopDir = resolve(agentLoopsDir, loopName);

  // Parse --check files
  const checkFiles: string[] = [];
  const checkIdx = args.indexOf("--check");
  if (checkIdx !== -1) {
    checkFiles.push(...args.slice(checkIdx + 1));
  }

  // Create loop directory
  const dirExisted = existsSync(loopDir);
  mkdirSync(loopDir, { recursive: true });

  // Check if .agent-loops/ is gitignored (expected via global gitignore)
  const gitignored = checkGitIgnored(repoRoot, ".agent-loops/");

  // Check file existence
  const existing: string[] = [];
  const missing: string[] = [];
  for (const file of checkFiles) {
    if (existsSync(resolve(loopDir, file))) {
      existing.push(file);
    } else {
      missing.push(file);
    }
  }

  const output: Output = {
    loopDir,
    created: !dirExisted,
    gitignored,
    existing,
    missing,
  };

  console.log(JSON.stringify(output));
}

main();
