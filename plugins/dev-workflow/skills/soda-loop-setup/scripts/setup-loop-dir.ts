#!/usr/bin/env bun
/**
 * Setup loop directory with gitignore and file existence checks.
 *
 * Usage:
 *   bun setup-loop-dir.ts <repo-root> <loop-name> [--check file1 file2 ...]
 *
 * Output (JSON):
 *   {
 *     "loopDir": "/abs/path/.agent-loops/loop-name",
 *     "created": true,
 *     "gitignore": "created" | "exists" | "updated",
 *     "existing": ["VISION.md"],
 *     "missing": ["PROGRESS.md"]
 *   }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Output {
  loopDir: string;
  created: boolean;
  gitignore: "created" | "exists" | "updated";
  existing: string[];
  missing: string[];
}

interface ErrorOutput {
  error: string;
}

const GITIGNORE_CONTENT = `# Ignore all loop artifacts
*
!.gitignore
`;

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    const error: ErrorOutput = {
      error: "Usage: bun setup-loop-dir.ts <repo-root> <loop-name> [--check file1 file2 ...]",
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

  // Handle .agent-loops/.gitignore
  const gitignorePath = resolve(agentLoopsDir, ".gitignore");
  let gitignoreStatus: Output["gitignore"];

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE_CONTENT, "utf-8");
    gitignoreStatus = "created";
  } else {
    const content = readFileSync(gitignorePath, "utf-8");
    if (content.includes("*")) {
      gitignoreStatus = "exists";
    } else {
      writeFileSync(gitignorePath, content.trimEnd() + "\n*\n", "utf-8");
      gitignoreStatus = "updated";
    }
  }

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
    gitignore: gitignoreStatus,
    existing,
    missing,
  };

  console.log(JSON.stringify(output));
}

main();
